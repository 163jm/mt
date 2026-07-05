use crate::error::{map_err, CmdResult};
use crate::models::ArchiveEntry;
use sevenz_rust::{Password, SevenZArchiveEntry, SevenZReader, SevenZWriter};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

fn entry_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn ft_to_millis(ft: &sevenz_rust::nt_time::FileTime) -> i64 {
    // to_unix_time 在 0.6 中直接返回 i64(已为秒),无 Result
    ft.to_unix_time() * 1000
}

pub fn list(path: &str) -> CmdResult<Vec<ArchiveEntry>> {
    let archive = sevenz_rust::Archive::open(path)
        .map_err(|e| format!("打开 7z 失败: {e}"))?;
    let mut out = Vec::with_capacity(archive.files.len());
    for e in &archive.files {
        if e.is_anti_item() {
            continue;
        }
        let p = e.name().to_string();
        out.push(ArchiveEntry {
            name: entry_name(&p),
            path: p,
            is_dir: e.is_directory(),
            size: e.size(),
            compressed_size: e.compressed_size,
            modified: if e.has_last_modified_date {
                ft_to_millis(&e.last_modified_date())
            } else {
                0
            },
        });
    }
    Ok(out)
}

pub fn extract_entry(archive: &str, entry: &str, out: &Path) -> CmdResult<()> {
    let mut reader = SevenZReader::open(archive, Password::empty())
        .map_err(|e| format!("打开 7z 失败: {e}"))?;
    let mut found = false;
    let out_owned = out.to_path_buf();
    reader
        .for_each_entries(|e, r: &mut dyn Read| {
            if e.name() == entry {
                let mut buf = Vec::new();
                r.read_to_end(&mut buf)?;
                fs::write(&out_owned, &buf)?;
                found = true;
                Ok(false) // 停止遍历
            } else {
                Ok(true)
            }
        })
        .map_err(|e| format!("解压 7z 条目失败: {e}"))?;
    if !found {
        return Err(format!("条目不存在: {entry}"));
    }
    Ok(())
}

pub fn extract_all(archive: &str, dst: &str) -> CmdResult<()> {
    let _ = fs::create_dir_all(dst);
    sevenz_rust::decompress_file(archive, dst).map_err(|e| format!("解压 7z 失败: {e}"))?;
    Ok(())
}

fn push_path(zw: &mut SevenZWriter<fs::File>, base: &Path, rel: &Path) -> Result<(), String> {
    if base.is_dir() {
        for entry in fs::read_dir(base).map_err(map_err)? {
            let entry = entry.map_err(map_err)?;
            let name = entry.file_name();
            push_path(zw, &entry.path(), &rel.join(name))?;
        }
    } else {
        let entry_name = rel.to_string_lossy().replace('\\', "/");
        let entry = SevenZArchiveEntry::from_path(base, entry_name.clone());
        let reader = fs::File::open(base).map_err(map_err)?;
        zw.push_archive_entry(entry, Some(reader))
            .map_err(|e| format!("添加 7z 条目失败: {e}"))?;
    }
    Ok(())
}

pub fn create(sources: &[String], dst: &str) -> CmdResult<()> {
    let mut zw = SevenZWriter::create(dst).map_err(|e| format!("创建 7z 失败: {e}"))?;
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let base = p
            .file_name()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("root"));
        push_path(&mut zw, p, &base)?;
    }
    zw.finish().map_err(|e| format!("关闭 7z 失败: {e}"))?;
    Ok(())
}
