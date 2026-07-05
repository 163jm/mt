use crate::error::{map_err, CmdResult};
use crate::models::{DirEntry, DriveInfo, FileStat};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const ARCHIVE_EXTS: &[&str] = &["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"];

fn modified_millis(md: &fs::Metadata) -> i64 {
    md.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(unix)]
fn is_hidden(_p: &Path, name: &str) -> bool {
    name.starts_with('.')
}
#[cfg(windows)]
fn is_hidden(p: &Path, name: &str) -> bool {
    use std::os::windows::fs::MetadataExt;
    if let Ok(md) = fs::metadata(p) {
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        return md.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 || name.starts_with('.');
    }
    name.starts_with('.')
}

fn is_read_only(md: &fs::Metadata) -> bool {
    md.permissions().readonly()
}

fn ext_of(name: &str) -> String {
    Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn build_entry(path: PathBuf) -> Option<DirEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    let md = fs::metadata(&path).ok()?;
    let is_dir = md.is_dir();
    let ext = ext_of(&name);
    let is_archive = !is_dir && ARCHIVE_EXTS.contains(&ext.as_str());
    Some(DirEntry {
        name: name.clone(),
        path: path.to_string_lossy().to_string(),
        is_dir,
        size: if is_dir { 0 } else { md.len() },
        modified: modified_millis(&md),
        is_archive,
        is_read_only: is_read_only(&md),
        is_hidden: is_hidden(&path, &name),
    })
}

/// 列出目录内容(目录优先,再按名称)
#[tauri::command]
pub fn list_dir(path: String) -> CmdResult<Vec<DirEntry>> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("路径不存在: {path}"));
    }
    let read = fs::read_dir(p).map_err(map_err)?;
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in read.flatten() {
        if let Some(e) = build_entry(entry.path()) {
            if e.is_dir {
                dirs.push(e);
            } else {
                files.push(e);
            }
        }
    }
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
pub fn read_file(path: String) -> CmdResult<Vec<u8>> {
    fs::read(&path).map_err(map_err)
}

#[tauri::command]
pub fn read_text_file(path: String) -> CmdResult<String> {
    let bytes = fs::read(&path).map_err(map_err)?;
    // 简易编码识别: BOM / UTF-8 / GBK 回退
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return Ok(String::from_utf8_lossy(&bytes[3..]).to_string());
    }
    match String::from_utf8(bytes.clone()) {
        Ok(s) => Ok(s),
        Err(_) => Ok(encoding_rs::GBK.decode(&bytes).0.to_string()),
    }
}

#[tauri::command]
pub fn write_file(path: String, data: Vec<u8>) -> CmdResult<()> {
    if let Some(parent) = Path::new(&path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, data).map_err(map_err)
}

#[tauri::command]
pub fn write_text_file(path: String, text: String) -> CmdResult<()> {
    write_file(path, text.into_bytes())
}

fn copy_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let name = entry.file_name();
            let s = entry.path();
            let d = dst.join(&name);
            copy_recursive(&s, &d)?;
        }
    } else {
        fs::copy(src, dst)?;
    }
    Ok(())
}

/// 复制:src 可为多项目标;dst 为目录或目标路径
#[tauri::command]
pub fn copy_paths(srcs: Vec<String>, dst: String) -> CmdResult<()> {
    let dst_path = Path::new(&dst);
    for s in &srcs {
        let src = Path::new(s);
        if !src.exists() {
            continue;
        }
        let name = src.file_name().unwrap_or_default();
        let target = if dst_path.is_dir() {
            dst_path.join(name)
        } else {
            dst_path.to_path_buf()
        };
        copy_recursive(src, &target).map_err(map_err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn move_paths(srcs: Vec<String>, dst: String) -> CmdResult<()> {
    let dst_path = Path::new(&dst);
    for s in &srcs {
        let src = Path::new(s);
        if !src.exists() {
            continue;
        }
        let name = src.file_name().unwrap_or_default();
        let target = if dst_path.is_dir() {
            dst_path.join(name)
        } else {
            dst_path.to_path_buf()
        };
        // 跨盘符需先复制再删
        if fs::rename(src, &target).is_err() {
            copy_recursive(src, &target).map_err(map_err)?;
            remove_path(src.to_string_lossy().as_ref())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_paths(paths: Vec<String>) -> CmdResult<()> {
    for p in &paths {
        remove_path(p)?;
    }
    Ok(())
}

fn remove_path(path: &str) -> CmdResult<()> {
    let p = Path::new(path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(map_err)?;
    } else {
        fs::remove_file(p).map_err(map_err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn mkdir(path: String) -> CmdResult<()> {
    fs::create_dir_all(&path).map_err(map_err)
}

#[tauri::command]
pub fn rename(src: String, dst: String) -> CmdResult<()> {
    fs::rename(&src, &dst).map_err(map_err)
}

#[tauri::command]
pub fn exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn stat(path: String) -> CmdResult<FileStat> {
    let p = Path::new(&path);
    let md = fs::metadata(p).map_err(map_err)?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(FileStat {
        size: if md.is_dir() { 0 } else { md.len() },
        modified: modified_millis(&md),
        is_dir: md.is_dir(),
        is_read_only: is_read_only(&md),
        is_hidden: is_hidden(p, &name),
    })
}

#[tauri::command]
pub fn home_dir() -> CmdResult<String> {
    dirs_or_home()
}

fn dirs_or_home() -> CmdResult<String> {
    // 不引入 dirs crate,简单取 HOME / USERPROFILE / 当前目录
    if let Ok(h) = std::env::var("HOME") {
        return Ok(h);
    }
    if let Ok(h) = std::env::var("USERPROFILE") {
        return Ok(h);
    }
    Ok(std::env::current_dir().map_err(map_err)?.to_string_lossy().to_string())
}

/// 盘符列表 — Windows 下枚举 A-Z;其他平台返回根目录
#[tauri::command]
pub fn drives() -> CmdResult<Vec<DriveInfo>> {
    let mut out = Vec::new();
    #[cfg(windows)]
    {
        for c in b'A'..=b'Z' {
            let letter = format!("{}:\\", c as char);
            if Path::new(&letter).exists() {
                let (total, free) = disk_space(&letter);
                out.push(DriveInfo {
                    letter: letter.clone(),
                    name: format!("{}:", c as char),
                    total,
                    free,
                });
            }
        }
    }
    #[cfg(not(windows))]
    {
        let (total, free) = disk_space("/");
        out.push(DriveInfo {
            letter: "/".to_string(),
            name: "根目录".to_string(),
            total,
            free,
        });
    }
    Ok(out)
}

#[cfg(windows)]
fn disk_space(root: &str) -> (u64, u64) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    unsafe {
        use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
        let wide: Vec<u16> = OsStr::new(root).encode_wide().chain(Some(0)).collect();
        let mut free_to_caller: u64 = 0;
        let mut total: u64 = 0;
        let mut total_free: u64 = 0;
        if GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_to_caller as *mut _ as *mut _,
            &mut total as *mut _ as *mut _,
            &mut total_free as *mut _ as *mut _,
        ) != 0
        {
            return (total, free_to_caller);
        }
        (0, 0)
    }
}
#[cfg(not(windows))]
fn disk_space(_root: &str) -> (u64, u64) {
    // 非 Windows 无法可靠获取,返回 0
    (0, 0)
}

#[tauri::command]
pub fn parent_path(path: String) -> CmdResult<Option<String>> {
    match Path::new(&path).parent() {
        Some(p) => Ok(Some(p.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn join_path(base: String, name: String) -> CmdResult<String> {
    Ok(Path::new(&base).join(&name).to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_archive_placeholder() -> CmdResult<()> {
    Ok(())
}
