pub mod sevenz_impl;
pub mod tar_impl;
pub mod zip_impl;

use crate::error::CmdResult;
use crate::models::ArchiveEntry;
use std::path::Path;

/// 判断压缩格式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Zip,
    SevenZ,
    Tar,
    TarGz,
    Gz,
    Rar,
    Unknown,
}

pub fn detect(path: &str) -> Format {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".zip") {
        Format::Zip
    } else if lower.ends_with(".7z") {
        Format::SevenZ
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Format::TarGz
    } else if lower.ends_with(".tar") {
        Format::Tar
    } else if lower.ends_with(".gz") {
        Format::Gz
    } else if lower.ends_with(".rar") {
        Format::Rar
    } else {
        Format::Unknown
    }
}

/// 列出压缩包内文件
#[tauri::command]
pub fn archive_list(path: String) -> CmdResult<Vec<ArchiveEntry>> {
    if !Path::new(&path).exists() {
        return Err(format!("压缩包不存在: {path}"));
    }
    match detect(&path) {
        Format::Zip => zip_impl::list(&path),
        Format::SevenZ => sevenz_impl::list(&path),
        Format::Tar | Format::TarGz => tar_impl::list(&path, detect(&path) == Format::TarGz),
        Format::Rar => Err("RAR 暂不支持列表(需 unrar 二进制)".into()),
        Format::Gz => {
            // 单文件 gzip:返回一个条目
            let name = Path::new(&path)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "content".to_string());
            Ok(vec![ArchiveEntry {
                path: name.clone(),
                name,
                is_dir: false,
                size: 0,
                compressed_size: std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                modified: 0,
            }])
        }
        Format::Unknown => Err("不支持的压缩格式".into()),
    }
}

/// 解压单个条目到临时区,返回临时文件路径
#[tauri::command]
pub fn archive_extract_entry(archive: String, entry: String) -> CmdResult<String> {
    let fmt = detect(&archive);
    // 临时目录
    let tmp = std::env::temp_dir().join("mt-manager-win");
    let _ = std::fs::create_dir_all(&tmp);
    // 安全文件名
    let safe = entry.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let out = tmp.join(format!(
        "{}_{}",
        Path::new(&archive)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "arc".into()),
        safe
    ));
    // 清理旧的临时文件(同名)
    let _ = std::fs::remove_file(&out);
    match fmt {
        Format::Zip => zip_impl::extract_entry(&archive, &entry, &out)?,
        Format::SevenZ => sevenz_impl::extract_entry(&archive, &entry, &out)?,
        Format::Tar | Format::TarGz => {
            tar_impl::extract_entry(&archive, &entry, &out, fmt == Format::TarGz)?
        }
        Format::Gz => {
            // 整个解压
            tar_impl::extract_gz_file(&archive, &out)?
        }
        Format::Rar => return Err("RAR 暂不支持解压".into()),
        Format::Unknown => return Err("不支持的压缩格式".into()),
    }
    Ok(out.to_string_lossy().to_string())
}

/// 把编辑后的临时文件回写进压缩包(目前仅 ZIP 支持原地修改)
#[tauri::command]
pub fn archive_save_entry(archive: String, entry: String, temp_path: String) -> CmdResult<()> {
    match detect(&archive) {
        Format::Zip => zip_impl::save_entry(&archive, &entry, &temp_path),
        _ => {
            // 其他格式:解压全部 -> 替换 -> 重新打包
            // 简化处理:对 7z/tar 不支持原地写,提示用户
            Err("该格式暂不支持直接回写,请解压后修改再重新打包".into())
        }
    }
}

/// 解压全部到目标目录
#[tauri::command]
pub fn archive_extract_all(archive: String, dst: String) -> CmdResult<()> {
    let _ = std::fs::create_dir_all(&dst);
    let fmt = detect(&archive);
    match fmt {
        Format::Zip => zip_impl::extract_all(&archive, &dst),
        Format::SevenZ => sevenz_impl::extract_all(&archive, &dst),
        Format::Tar | Format::TarGz => tar_impl::extract_all(&archive, &dst, fmt == Format::TarGz),
        Format::Gz => tar_impl::extract_gz_file(&archive, Path::new(&dst)),
        Format::Rar => Err("RAR 暂不支持解压".into()),
        Format::Unknown => Err("不支持的压缩格式".into()),
    }
}

/// 创建压缩包
#[tauri::command]
pub fn archive_create(
    sources: Vec<String>,
    dst: String,
    format: String,
) -> CmdResult<()> {
    let fmt = match format.as_str() {
        "zip" => Format::Zip,
        "7z" => Format::SevenZ,
        "tar.gz" | "targz" => Format::TarGz,
        "tar" => Format::Tar,
        _ => return Err(format!("不支持的格式: {format}")),
    };
    match fmt {
        Format::Zip => zip_impl::create(&sources, &dst),
        Format::SevenZ => sevenz_impl::create(&sources, &dst),
        Format::Tar | Format::TarGz => tar_impl::create(&sources, &dst, fmt == Format::TarGz),
        _ => Err("内部错误".into()),
    }
}

/// 内部工具:把修改时间转毫秒
pub(crate) fn dt_to_millis(dt: zip::DateTime) -> i64 {
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    let d = NaiveDate::from_ymd_opt(dt.year() as i32, dt.month() as u32, dt.day() as u32)
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(1970, 1, 1).unwrap());
    let t = NaiveTime::from_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32)
        .unwrap_or_else(|| NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    NaiveDateTime::new(d, t)
        .and_utc()
        .timestamp_millis()
}
