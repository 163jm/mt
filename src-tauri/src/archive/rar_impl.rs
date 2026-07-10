use crate::error::CmdResult;
use crate::models::ArchiveEntry;
use std::path::Path;
use std::process::Command;

/// RAR 格式没有稳定、无授权风险的纯 Rust 解码库，因此这里通过调用系统上
/// 已安装的 7-Zip (7z.exe) 或 WinRAR (unrar.exe / Rar.exe) 命令行程序来实现。
/// 找不到任何一个可用工具时,返回明确的错误提示,指导用户安装。

fn find_tool() -> Option<(String, ToolKind)> {
    #[cfg(windows)]
    let candidates: &[(&str, ToolKind)] = &[
        (r"C:\Program Files\7-Zip\7z.exe", ToolKind::SevenZip),
        (r"C:\Program Files (x86)\7-Zip\7z.exe", ToolKind::SevenZip),
        ("7z.exe", ToolKind::SevenZip),
        ("7z", ToolKind::SevenZip),
        (r"C:\Program Files\WinRAR\UnRAR.exe", ToolKind::UnRar),
        (r"C:\Program Files (x86)\WinRAR\UnRAR.exe", ToolKind::UnRar),
        ("UnRAR.exe", ToolKind::UnRar),
        ("unrar", ToolKind::UnRar),
    ];
    #[cfg(not(windows))]
    let candidates: &[(&str, ToolKind)] = &[
        ("7z", ToolKind::SevenZip),
        ("7zz", ToolKind::SevenZip),
        ("unrar", ToolKind::UnRar),
    ];

    for (bin, kind) in candidates {
        if Path::new(bin).exists() {
            return Some((bin.to_string(), *kind));
        }
        // 也尝试直接从 PATH 里探测(不依赖绝对路径的候选项)
        if !bin.contains(['\\', '/']) {
            let probe = Command::new(bin).arg(match kind {
                ToolKind::SevenZip => "i",
                ToolKind::UnRar => "-?",
            }).output();
            if probe.is_ok() {
                return Some((bin.to_string(), *kind));
            }
        }
    }
    None
}

#[derive(Clone, Copy)]
enum ToolKind {
    SevenZip,
    UnRar,
}

const NO_TOOL_HINT: &str =
    "未检测到可用的 RAR 解压工具。请安装 7-Zip (https://www.7-zip.org/) 或 WinRAR，\
     安装后 MT 管理器会自动使用其命令行组件来读取 RAR 压缩包。";

pub fn list(path: &str) -> CmdResult<Vec<ArchiveEntry>> {
    let (bin, kind) = find_tool().ok_or_else(|| NO_TOOL_HINT.to_string())?;
    match kind {
        ToolKind::SevenZip => list_via_7z(&bin, path),
        ToolKind::UnRar => list_via_unrar(&bin, path),
    }
}

fn list_via_7z(bin: &str, path: &str) -> CmdResult<Vec<ArchiveEntry>> {
    let out = Command::new(bin)
        .args(["l", "-slt", path])
        .output()
        .map_err(|e| format!("调用 7z 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "7z 列出 RAR 内容失败: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    let mut cur_path: Option<String> = None;
    let mut cur_size: u64 = 0;
    let mut cur_csize: u64 = 0;
    let mut cur_is_dir = false;
    let mut cur_modified: i64 = 0;

    let flush = |entries: &mut Vec<ArchiveEntry>,
                 p: &Option<String>,
                 size: u64,
                 csize: u64,
                 is_dir: bool,
                 modified: i64| {
        if let Some(p) = p {
            let name = Path::new(p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            entries.push(ArchiveEntry {
                path: p.replace('\\', "/"),
                name,
                is_dir,
                size,
                compressed_size: csize,
                modified,
            });
        }
    };

    for line in text.lines() {
        if let Some(v) = line.strip_prefix("Path = ") {
            // 新条目开始 -> 先落盘上一条(第一行 Path = 是压缩包本身,需跳过)
            if cur_path.is_some() {
                flush(&mut entries, &cur_path, cur_size, cur_csize, cur_is_dir, cur_modified);
            }
            cur_path = Some(v.trim().to_string());
            cur_size = 0;
            cur_csize = 0;
            cur_is_dir = false;
            cur_modified = 0;
        } else if let Some(v) = line.strip_prefix("Size = ") {
            cur_size = v.trim().parse().unwrap_or(0);
        } else if let Some(v) = line.strip_prefix("Packed Size = ") {
            cur_csize = v.trim().parse().unwrap_or(0);
        } else if let Some(v) = line.strip_prefix("Attributes = ") {
            cur_is_dir = v.contains('D');
        } else if let Some(v) = line.strip_prefix("Modified = ") {
            cur_modified = parse_7z_time(v.trim());
        }
    }
    // 落盘最后一条
    if cur_path.is_some() {
        flush(&mut entries, &cur_path, cur_size, cur_csize, cur_is_dir, cur_modified);
    }
    Ok(entries)
}

fn parse_7z_time(s: &str) -> i64 {
    // 格式形如 "2024-05-01 12:34:56"
    use chrono::NaiveDateTime;
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .map(|d| d.and_utc().timestamp_millis())
        .unwrap_or(0)
}

fn list_via_unrar(bin: &str, path: &str) -> CmdResult<Vec<ArchiveEntry>> {
    // unrar 表格输出 (v/l 命令) 的列宽会因文件名长度/语言环境浮动,难以稳定解析,
    // 这里改用 "lb" (bare list) 模式:每行仅输出一个条目路径,足够满足浏览/解压场景,
    // 唯一的代价是拿不到精确的大小/时间(前端会显示为 0 / 未知,不影响解压功能)。
    let out = Command::new(bin)
        .args(["lb", "-r", path])
        .output()
        .map_err(|e| format!("调用 unrar 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "unrar 列出内容失败: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for line in text.lines() {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }
        let is_dir = name.ends_with('/') || name.ends_with('\\');
        entries.push(ArchiveEntry {
            path: name.replace('\\', "/"),
            name: Path::new(name)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| name.to_string()),
            is_dir,
            size: 0,
            compressed_size: 0,
            modified: 0,
        });
    }
    Ok(entries)
}

pub fn extract_entry(archive: &str, entry: &str, out: &Path) -> CmdResult<()> {
    let (bin, kind) = find_tool().ok_or_else(|| NO_TOOL_HINT.to_string())?;
    let tmp_dir = std::env::temp_dir().join("mt-manager-win-rar-extract");
    let _ = std::fs::remove_dir_all(&tmp_dir);
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    match kind {
        ToolKind::SevenZip => {
            let status = Command::new(&bin)
                .args(["e", archive, &format!("-o{}", tmp_dir.display()), entry, "-y"])
                .status()
                .map_err(|e| format!("调用 7z 解压失败: {e}"))?;
            if !status.success() {
                return Err("7z 解压条目失败".into());
            }
        }
        ToolKind::UnRar => {
            let status = Command::new(&bin)
                .args(["e", "-y", "-inul", archive, entry, &format!("{}/", tmp_dir.display())])
                .status()
                .map_err(|e| format!("调用 unrar 解压失败: {e}"))?;
            if !status.success() {
                return Err("unrar 解压条目失败".into());
            }
        }
    }
    // 找到解压出的文件(取解压目录下与条目文件名匹配的第一个文件)
    let want_name = Path::new(entry).file_name().and_then(|n| n.to_str()).unwrap_or(entry);
    let found = walkdir::WalkDir::new(&tmp_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .find(|e| e.file_name().to_str() == Some(want_name));
    let src = found.map(|e| e.path().to_path_buf()).ok_or("未在解压结果中找到目标文件")?;
    if let Some(parent) = out.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::copy(&src, out).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_dir_all(&tmp_dir);
    Ok(())
}

pub fn extract_all(archive: &str, dst: &str) -> CmdResult<()> {
    let (bin, kind) = find_tool().ok_or_else(|| NO_TOOL_HINT.to_string())?;
    let _ = std::fs::create_dir_all(dst);
    match kind {
        ToolKind::SevenZip => {
            let status = Command::new(&bin)
                .args(["x", archive, &format!("-o{dst}"), "-y"])
                .status()
                .map_err(|e| format!("调用 7z 解压失败: {e}"))?;
            if !status.success() {
                return Err("7z 解压失败".into());
            }
        }
        ToolKind::UnRar => {
            let status = Command::new(&bin)
                .args(["x", "-y", "-inul", archive, &format!("{dst}/")])
                .status()
                .map_err(|e| format!("调用 unrar 解压失败: {e}"))?;
            if !status.success() {
                return Err("unrar 解压失败".into());
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn rar_tool_available() -> bool {
    find_tool().is_some()
}
