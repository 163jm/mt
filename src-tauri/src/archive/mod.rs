pub mod rar_impl;
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
    TarBz2,
    TarXz,
    Gz,
    Bz2,
    Xz,
    Rar,
    Unknown,
}

pub fn detect(path: &str) -> Format {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".zip") || lower.ends_with(".jar") || lower.ends_with(".apk") {
        Format::Zip
    } else if lower.ends_with(".7z") {
        Format::SevenZ
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Format::TarGz
    } else if lower.ends_with(".tar.bz2") || lower.ends_with(".tbz2") || lower.ends_with(".tbz") {
        Format::TarBz2
    } else if lower.ends_with(".tar.xz") || lower.ends_with(".txz") {
        Format::TarXz
    } else if lower.ends_with(".tar") {
        Format::Tar
    } else if lower.ends_with(".bz2") {
        Format::Bz2
    } else if lower.ends_with(".xz") {
        Format::Xz
    } else if lower.ends_with(".gz") {
        Format::Gz
    } else if lower.ends_with(".rar") {
        Format::Rar
    } else {
        Format::Unknown
    }
}

/// 常见压缩包扩展名,供前端识别 is_archive 使用(与 fs_ops::ARCHIVE_EXTS 保持一致)
pub const ARCHIVE_EXTENSIONS: &[&str] = &[
    "zip", "jar", "apk", "7z", "tar", "gz", "tgz", "bz2", "tbz2", "tbz", "xz", "txz", "rar",
];

/// 列出压缩包内文件
#[tauri::command]
pub fn archive_list(path: String) -> CmdResult<Vec<ArchiveEntry>> {
    if !Path::new(&path).exists() {
        return Err(format!("压缩包不存在: {path}"));
    }
    match detect(&path) {
        Format::Zip => zip_impl::list(&path),
        Format::SevenZ => sevenz_impl::list(&path),
        Format::Tar => tar_impl::list(&path, tar_impl::Compression::None),
        Format::TarGz => tar_impl::list(&path, tar_impl::Compression::Gz),
        Format::TarBz2 => tar_impl::list(&path, tar_impl::Compression::Bz2),
        Format::TarXz => tar_impl::list(&path, tar_impl::Compression::Xz),
        Format::Rar => rar_impl::list(&path),
        Format::Gz | Format::Bz2 | Format::Xz => {
            // 单文件压缩(非 tar 归档):返回一个虚拟条目,代表解压后的单一文件
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
        Format::Tar => tar_impl::extract_entry(&archive, &entry, &out, tar_impl::Compression::None)?,
        Format::TarGz => tar_impl::extract_entry(&archive, &entry, &out, tar_impl::Compression::Gz)?,
        Format::TarBz2 => tar_impl::extract_entry(&archive, &entry, &out, tar_impl::Compression::Bz2)?,
        Format::TarXz => tar_impl::extract_entry(&archive, &entry, &out, tar_impl::Compression::Xz)?,
        Format::Rar => rar_impl::extract_entry(&archive, &entry, &out)?,
        Format::Gz | Format::Bz2 | Format::Xz => {
            // 整个解压(单文件压缩没有内部条目概念)
            tar_impl::extract_single_compressed(&archive, &out, fmt)?
        }
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
        Format::Tar => tar_impl::extract_all(&archive, &dst, tar_impl::Compression::None),
        Format::TarGz => tar_impl::extract_all(&archive, &dst, tar_impl::Compression::Gz),
        Format::TarBz2 => tar_impl::extract_all(&archive, &dst, tar_impl::Compression::Bz2),
        Format::TarXz => tar_impl::extract_all(&archive, &dst, tar_impl::Compression::Xz),
        Format::Rar => rar_impl::extract_all(&archive, &dst),
        Format::Gz | Format::Bz2 | Format::Xz => {
            let name = Path::new(&archive)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "content".to_string());
            tar_impl::extract_single_compressed(&archive, &Path::new(&dst).join(name), fmt)
        }
        Format::Unknown => Err("不支持的压缩格式".into()),
    }
}

/// 解压选定的若干条目(而非全部)到目标目录,保留内部相对路径结构
#[tauri::command]
pub fn archive_extract_selected(archive: String, entries: Vec<String>, dst: String) -> CmdResult<()> {
    let _ = std::fs::create_dir_all(&dst);
    let fmt = detect(&archive);
    match fmt {
        Format::Zip => zip_impl::extract_selected(&archive, &entries, &dst),
        Format::SevenZ => sevenz_impl::extract_selected(&archive, &entries, &dst),
        Format::Tar => tar_impl::extract_selected(&archive, &entries, &dst, tar_impl::Compression::None),
        Format::TarGz => tar_impl::extract_selected(&archive, &entries, &dst, tar_impl::Compression::Gz),
        Format::TarBz2 => tar_impl::extract_selected(&archive, &entries, &dst, tar_impl::Compression::Bz2),
        Format::TarXz => tar_impl::extract_selected(&archive, &entries, &dst, tar_impl::Compression::Xz),
        Format::Rar => {
            // RAR 没有细粒度批量接口,逐条走单条目解压
            for e in &entries {
                let name = Path::new(e).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| e.clone());
                let out = Path::new(&dst).join(&name);
                rar_impl::extract_entry(&archive, e, &out)?;
            }
            Ok(())
        }
        _ => Err("该格式不支持按条目批量解压".into()),
    }
}

/// 读取压缩包内一个条目的原始字节,用于预览(先解压到临时区,再原样读回)
#[tauri::command]
pub fn archive_preview_entry(archive: String, entry: String) -> CmdResult<Vec<u8>> {
    let path = archive_extract_entry(archive, entry)?;
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// 从压缩包中删除若干条目(免二次手动解压/打包)
#[tauri::command]
pub fn archive_remove_entries(archive: String, entries: Vec<String>) -> CmdResult<()> {
    match detect(&archive) {
        Format::Zip => zip_impl::remove_entries(&archive, &entries),
        _ => Err("目前仅 ZIP 格式支持直接删除内部条目,其他格式请解压后修改再重新压缩".into()),
    }
}

/// 向压缩包添加/替换外部文件,免二次解压重新打包
#[tauri::command]
pub fn archive_add_entries(archive: String, sources: Vec<String>, base_dir: String) -> CmdResult<()> {
    match detect(&archive) {
        Format::Zip => zip_impl::add_entries(&archive, &sources, &base_dir),
        _ => Err("目前仅 ZIP 格式支持直接添加内部条目,其他格式请解压后修改再重新压缩".into()),
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
        "tar.bz2" | "tarbz2" => Format::TarBz2,
        "tar.xz" | "tarxz" => Format::TarXz,
        "tar" => Format::Tar,
        "rar" => return Err("RAR 为专有格式,暂不支持创建,可选择 ZIP/7z/TAR".into()),
        _ => return Err(format!("不支持的格式: {format}")),
    };
    match fmt {
        Format::Zip => zip_impl::create(&sources, &dst),
        Format::SevenZ => sevenz_impl::create(&sources, &dst),
        Format::Tar => tar_impl::create(&sources, &dst, tar_impl::Compression::None),
        Format::TarGz => tar_impl::create(&sources, &dst, tar_impl::Compression::Gz),
        Format::TarBz2 => tar_impl::create(&sources, &dst, tar_impl::Compression::Bz2),
        Format::TarXz => tar_impl::create(&sources, &dst, tar_impl::Compression::Xz),
        _ => Err("内部错误".into()),
    }
}

/// 检测系统是否具备读取 RAR 所需的外部工具(7-Zip 或 WinRAR)
#[tauri::command]
pub fn rar_support_available() -> bool {
    rar_impl::rar_tool_available()
}

/// 内部工具:把修改时间转毫秒(Option<DateTime> 兼容 zip 2.4)
pub(crate) fn dt_to_millis(dt: Option<zip::DateTime>) -> i64 {
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    let dt = match dt {
        Some(d) => d,
        None => return 0,
    };
    let d = NaiveDate::from_ymd_opt(dt.year() as i32, dt.month() as u32, dt.day() as u32)
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(1970, 1, 1).unwrap());
    let t = NaiveTime::from_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32)
        .unwrap_or_else(|| NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    NaiveDateTime::new(d, t)
        .and_utc()
        .timestamp_millis()
}
