use crate::error::{map_err, CmdResult};
use crate::models::ArchiveEntry;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tar::{Archive as TarArchive, Builder as TarBuilder};

fn entry_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn open_reader(path: &str, gz: bool) -> Result<Box<dyn Read>, std::io::Error> {
    let f = fs::File::open(path)?;
    if gz {
        Ok(Box::new(GzDecoder::new(f)))
    } else {
        Ok(Box::new(f))
    }
}

pub fn list(path: &str, gz: bool) -> CmdResult<Vec<ArchiveEntry>> {
    let reader = open_reader(path, gz).map_err(map_err)?;
    let mut arc = TarArchive::new(reader);
    let mut out = Vec::new();
    for entry in arc.entries().map_err(|e| format!("读取 TAR 失败: {e}"))? {
        let mut entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let p = entry.path().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        if p.is_empty() {
            continue;
        }
        let is_dir = entry.header().entry_type().is_dir();
        let size = entry.size();
        let compressed_size = size; // tar 不单独存压缩大小
        let modified = entry
            .header()
            .mtime()
            .unwrap_or(0)
            .min(i64::MAX as u64) as i64
            * 1000;
        // 推进读取以保证下一次 entries 正确
        let _ = entry.read_to_end(&mut Vec::new());
        out.push(ArchiveEntry {
            name: entry_name(&p),
            path: p,
            is_dir,
            size,
            compressed_size,
            modified,
        });
    }
    Ok(out)
}

pub fn extract_entry(archive: &str, entry: &str, out: &Path, gz: bool) -> CmdResult<()> {
    let reader = open_reader(archive, gz).map_err(map_err)?;
    let mut arc = TarArchive::new(reader);
    for entry_it in arc.entries().map_err(|e| format!("读取 TAR 失败: {e}"))? {
        let mut e = match entry_it {
            Ok(e) => e,
            Err(_) => continue,
        };
        let p = e.path().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        if p == entry {
            let mut buf = Vec::with_capacity(e.size() as usize);
            e.read_to_end(&mut buf).map_err(map_err)?;
            fs::write(out, &buf).map_err(map_err)?;
            return Ok(());
        }
    }
    Err(format!("条目不存在: {entry}"))
}

pub fn extract_all(archive: &str, dst: &str, gz: bool) -> CmdResult<()> {
    let _ = fs::create_dir_all(dst);
    let reader = open_reader(archive, gz).map_err(map_err)?;
    let mut arc = TarArchive::new(reader);
    arc.unpack(dst).map_err(|e| format!("解压 TAR 失败: {e}"))?;
    Ok(())
}

/// 解压单个 .gz 文件(非 tar.gz)到 out 路径
pub fn extract_gz_file(archive: &str, out: &Path) -> CmdResult<()> {
    let f = fs::File::open(archive).map_err(map_err)?;
    let mut dec = GzDecoder::new(f);
    let mut buf = Vec::new();
    dec.read_to_end(&mut buf).map_err(map_err)?;
    if out.is_dir() {
        // 给个默认文件名
        let name = Path::new(archive)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "content".to_string());
        fs::write(out.join(name), &buf).map_err(map_err)?;
    } else {
        fs::write(out, &buf).map_err(map_err)?;
    }
    Ok(())
}

fn add_path(tb: &mut TarBuilder<Box<dyn Write>>, base: &Path, rel: &Path) -> Result<(), String> {
    if base.is_dir() {
        let dir_name = rel.to_string_lossy().replace('\\', "/") + "/";
        tb.append_dir(PathBuf::from(&dir_name), base)
            .map_err(|e| format!("添加 TAR 目录失败: {e}"))?;
        for entry in fs::read_dir(base).map_err(map_err)? {
            let entry = entry.map_err(map_err)?;
            let name = entry.file_name();
            add_path(tb, &entry.path(), &rel.join(name))?;
        }
    } else {
        let file_name = rel.to_string_lossy().replace('\\', "/");
        tb.append_path_with_name(base, PathBuf::from(&file_name))
            .map_err(|e| format!("添加 TAR 文件失败: {e}"))?;
    }
    Ok(())
}

pub fn create(sources: &[String], dst: &str, gz: bool) -> CmdResult<()> {
    let file = fs::File::create(dst).map_err(map_err)?;
    let writer: Box<dyn Write> = if gz {
        Box::new(GzEncoder::new(file, Compression::default()))
    } else {
        Box::new(file)
    };
    let mut tb = TarBuilder::new(writer);
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let base = p
            .file_name()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("root"));
        add_path(&mut tb, p, &base)?;
    }
    tb.finish().map_err(|e| format!("关闭 TAR 失败: {e}"))?;
    Ok(())
}
