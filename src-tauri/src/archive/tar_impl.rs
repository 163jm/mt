use crate::archive::Format;
use crate::error::{map_err, CmdResult};
use crate::models::ArchiveEntry;
use bzip2::read::{BzDecoder, BzEncoder};
use bzip2::Compression as BzCompression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression as GzCompression;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use tar::{Archive as TarArchive, Builder as TarBuilder};
use xz::read::XzDecoder;
use xz::write::XzEncoder;

/// 归档使用的压缩方式(独立于文件扩展名判定,便于内部函数复用)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Compression {
    None,
    Gz,
    Bz2,
    Xz,
}

fn entry_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn open_reader(path: &str, comp: Compression) -> Result<Box<dyn Read>, std::io::Error> {
    let f = fs::File::open(path)?;
    Ok(match comp {
        Compression::None => Box::new(f),
        Compression::Gz => Box::new(GzDecoder::new(f)),
        Compression::Bz2 => Box::new(BzDecoder::new(f)),
        Compression::Xz => Box::new(XzDecoder::new(f)),
    })
}

pub fn list(path: &str, comp: Compression) -> CmdResult<Vec<ArchiveEntry>> {
    let reader = open_reader(path, comp).map_err(map_err)?;
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

pub fn extract_entry(archive: &str, entry: &str, out: &Path, comp: Compression) -> CmdResult<()> {
    let reader = open_reader(archive, comp).map_err(map_err)?;
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
            if let Some(parent) = out.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(out, &buf).map_err(map_err)?;
            return Ok(());
        }
    }
    Err(format!("条目不存在: {entry}"))
}

/// 一次遍历解压若干指定条目到目标目录,保留相对路径结构
pub fn extract_selected(archive: &str, entries: &[String], dst: &str, comp: Compression) -> CmdResult<()> {
    let _ = fs::create_dir_all(dst);
    let want: std::collections::HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();
    let reader = open_reader(archive, comp).map_err(map_err)?;
    let mut arc = TarArchive::new(reader);
    for entry_it in arc.entries().map_err(|e| format!("读取 TAR 失败: {e}"))? {
        let mut e = match entry_it {
            Ok(e) => e,
            Err(_) => continue,
        };
        let p = e.path().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        if want.contains(p.as_str()) {
            let out_path = Path::new(dst).join(&p);
            if let Some(parent) = out_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if e.header().entry_type().is_dir() {
                let _ = fs::create_dir_all(&out_path);
            } else {
                let mut buf = Vec::with_capacity(e.size() as usize);
                e.read_to_end(&mut buf).map_err(map_err)?;
                fs::write(&out_path, &buf).map_err(map_err)?;
            }
        }
    }
    Ok(())
}

pub fn extract_all(archive: &str, dst: &str, comp: Compression) -> CmdResult<()> {
    let _ = fs::create_dir_all(dst);
    let reader = open_reader(archive, comp).map_err(map_err)?;
    let mut arc = TarArchive::new(reader);
    arc.unpack(dst).map_err(|e| format!("解压 TAR 失败: {e}"))?;
    Ok(())
}

/// 解压单文件压缩格式(.gz/.bz2/.xz,非 tar 归档)到 out 路径
pub fn extract_single_compressed(archive: &str, out: &Path, fmt: Format) -> CmdResult<()> {
    let f = fs::File::open(archive).map_err(map_err)?;
    let mut buf = Vec::new();
    match fmt {
        Format::Gz => {
            GzDecoder::new(f).read_to_end(&mut buf).map_err(map_err)?;
        }
        Format::Bz2 => {
            BzDecoder::new(f).read_to_end(&mut buf).map_err(map_err)?;
        }
        Format::Xz => {
            XzDecoder::new(f).read_to_end(&mut buf).map_err(map_err)?;
        }
        _ => return Err("不支持的单文件压缩格式".into()),
    }
    if out.is_dir() {
        let name = Path::new(archive)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "content".to_string());
        fs::write(out.join(name), &buf).map_err(map_err)?;
    } else {
        if let Some(parent) = out.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(out, &buf).map_err(map_err)?;
    }
    Ok(())
}

pub fn create(sources: &[String], dst: &str, comp: Compression) -> CmdResult<()> {
    let file = fs::File::create(dst).map_err(map_err)?;
    let writer: Box<dyn Write> = match comp {
        Compression::None => Box::new(file),
        Compression::Gz => Box::new(GzEncoder::new(file, GzCompression::default())),
        Compression::Bz2 => Box::new(BzEncoder::new(file, BzCompression::default())),
        Compression::Xz => Box::new(XzEncoder::new(file, 6)),
    };
    let mut tb = TarBuilder::new(writer);
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let base_name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "item".to_string());
        if p.is_dir() {
            tb.append_dir_all(&base_name, p)
                .map_err(|e| format!("添加 TAR 目录失败: {e}"))?;
        } else {
            tb.append_path_with_name(p, &base_name)
                .map_err(|e| format!("添加 TAR 文件失败: {e}"))?;
        }
    }
    tb.finish().map_err(|e| format!("关闭 TAR 失败: {e}"))?;
    Ok(())
}
