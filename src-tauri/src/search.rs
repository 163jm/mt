use crate::error::CmdResult;
use crate::models::{ContentHit, SearchHit};
use regex::bytes::Regex as BytesRegex;
use regex::Regex;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameSearchOpts {
    pub regex: bool,
    pub case_sensitive: bool,
    #[serde(default)]
    pub size_min: Option<u64>,
    #[serde(default)]
    pub size_max: Option<u64>,
    #[serde(default)]
    pub date_from: Option<i64>,
    #[serde(default)]
    pub date_to: Option<i64>,
    #[serde(default)]
    pub exts: Option<Vec<String>>,
    #[serde(default)]
    pub max_results: Option<usize>,
}

/// 将通配符 (* ?) 转为正则
fn wildcard_to_regex(pat: &str) -> String {
    let mut out = String::with_capacity(pat.len() * 2);
    for ch in pat.chars() {
        match ch {
            '*' => out.push_str(".*"),
            '?' => out.push('.'),
            c if r"\.+^$(){}[]|".contains(c) => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out
}

fn modified_millis_path(p: &Path) -> i64 {
    fs::metadata(p)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn search_name(root: String, query: String, opts: NameSearchOpts) -> CmdResult<Vec<SearchHit>> {
    let pattern = if opts.regex {
        query.clone()
    } else {
        wildcard_to_regex(&query)
    };
    let re = if opts.case_sensitive {
        Regex::new(&pattern)
    } else {
        Regex::new(&format!("(?i){pattern}"))
    }
    .map_err(|e| format!("正则错误: {e}"))?;

    let max = opts.max_results.unwrap_or(2000);
    let exts: Vec<String> = opts
        .exts
        .as_ref()
        .map(|v| v.iter().map(|e| e.to_ascii_lowercase()).collect())
        .unwrap_or_default();

    let mut hits = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(64)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if hits.len() >= max {
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        // 名字匹配
        if !re.is_match(&name) {
            continue;
        }
        let path = entry.path();
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = md.is_dir();
        let size = if is_dir { 0 } else { md.len() };

        // 大小过滤
        if let Some(min) = opts.size_min {
            if size < min {
                continue;
            }
        }
        if let Some(max_s) = opts.size_max {
            if size > max_s {
                continue;
            }
        }
        // 日期过滤
        let modified = modified_millis_path(path);
        if let Some(from) = opts.date_from {
            if modified < from {
                continue;
            }
        }
        if let Some(to) = opts.date_to {
            if modified > to {
                continue;
            }
        }
        // 扩展名过滤
        if !exts.is_empty() {
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            if !exts.contains(&ext) {
                continue;
            }
        }

        hits.push(SearchHit {
            path: path.to_string_lossy().to_string(),
            name,
            size,
            modified,
            is_dir,
        });
    }
    Ok(hits)
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchOpts {
    #[serde(default)]
    pub is_hex: bool,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub max_results: Option<usize>,
    #[serde(default)]
    pub max_file_size: Option<u64>,
}

const TEXT_MAX_BYTES: u64 = 64 * 1024 * 1024; // 跳过 >64MB 文件

#[tauri::command]
pub fn search_content(
    root: String,
    query: String,
    opts: ContentSearchOpts,
) -> CmdResult<Vec<ContentHit>> {
    let needle: Vec<u8> = if opts.is_hex {
        // 解析 HEX 字符串(忽略空格)
        let cleaned: String = query.chars().filter(|c| !c.is_whitespace()).collect();
        if cleaned.len() % 2 != 0 || cleaned.len() == 0 {
            return Err("HEX 查询长度必须为偶数且非空".into());
        }
        (0..cleaned.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&cleaned[i..i + 2], 16))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|e| format!("HEX 解析错误: {e}"))?
    } else if opts.case_sensitive {
        query.into_bytes()
    } else {
        query.to_lowercase().into_bytes()
    };

    // 构建字节正则
    let pattern = if opts.is_hex {
        // HEX:每个字节用 \xNN 转义,支持任意字节序列
        needle.iter().map(|b| format!("\\x{:02x}", b)).collect::<String>()
    } else if opts.case_sensitive {
        regex::escape(&String::from_utf8_lossy(&needle))
    } else {
        // 不区分大小写:用 (?i) + 转义
        format!("(?i){}", regex::escape(&String::from_utf8_lossy(&needle)))
    };
    let re = BytesRegex::new(&pattern).map_err(|e| format!("正则错误: {e}"))?;

    let max = opts.max_results.unwrap_or(500);
    let max_file = opts.max_file_size.unwrap_or(TEXT_MAX_BYTES);
    let mut hits = Vec::new();

    'outer: for entry in WalkDir::new(&root)
        .max_depth(64)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if hits.len() >= max {
            break;
        }
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if md.is_dir() {
            continue;
        }
        if md.len() > max_file {
            continue;
        }
        let path = entry.path();
        let data = match fs::read(path) {
            Ok(d) => d,
            Err(_) => continue,
        };
        // 逐行查找第一个匹配
        let cur = std::io::Cursor::new(&data);
        let reader = BufReader::new(cur);
        for (lineno, line) in reader.lines().enumerate() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            let hay: &[u8] = if opts.case_sensitive || opts.is_hex {
                line.as_bytes()
            } else {
                // 大小写不敏感:用字节正则的 (?i) 已处理,直接搜原文
                line.as_bytes()
            };
            if let Some(m) = re.find(hay) {
                let col = m.start();
                let preview = make_preview(&line, col, m.end() - m.start());
                hits.push(ContentHit {
                    path: path.to_string_lossy().to_string(),
                    line: lineno + 1,
                    column: col + 1,
                    preview,
                });
                if hits.len() >= max {
                    break 'outer;
                }
                break; // 每个文件只取第一个命中
            }
        }
    }
    Ok(hits)
}

fn make_preview(line: &str, col: usize, _len: usize) -> String {
    let chars: Vec<char> = line.chars().collect();
    let start = col.saturating_sub(40);
    let end = (col + 60).min(chars.len());
    let mut s: String = chars[start..end].iter().collect();
    if start > 0 {
        s.insert_str(0, "…");
    }
    if end < chars.len() {
        s.push('…');
    }
    s.trim().to_string()
}
