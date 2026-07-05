use crate::archive::dt_to_millis;
use crate::error::{map_err, CmdResult};
use crate::models::ArchiveEntry;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

fn entry_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

pub fn list(path: &str) -> CmdResult<Vec<ArchiveEntry>> {
    let file = fs::File::open(path).map_err(map_err)?;
    let mut arc = ZipArchive::new(file).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    let mut out = Vec::with_capacity(arc.len() as usize);
    for i in 0..arc.len() {
        if let Ok(e) = arc.by_index(i) {
            let p = e.name().to_string();
            let name = entry_name(&p);
            out.push(ArchiveEntry {
                path: p,
                name,
                is_dir: e.is_dir(),
                size: e.size(),
                compressed_size: e.compressed_size(),
                modified: dt_to_millis(e.last_modified()),
            });
        }
    }
    Ok(out)
}

pub fn extract_entry(archive: &str, entry: &str, out: &Path) -> CmdResult<()> {
    let file = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(file).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    // 精确匹配条目名
    let mut idx = None;
    for i in 0..arc.len() {
        if let Ok(e) = arc.by_index(i) {
            if e.name() == entry {
                idx = Some(i);
                break;
            }
        }
    }
    let idx = idx.ok_or_else(|| format!("条目不存在: {entry}"))?;
    let mut zf = arc.by_index(idx).map_err(|e| format!("读取条目失败: {e}"))?;
    let mut buf = Vec::with_capacity(zf.size() as usize);
    zf.read_to_end(&mut buf).map_err(map_err)?;
    fs::write(out, &buf).map_err(map_err)?;
    Ok(())
}

pub fn extract_all(archive: &str, dst: &str) -> CmdResult<()> {
    let file = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(file).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    for i in 0..arc.len() {
        let mut zf = arc
            .by_index(i)
            .map_err(|e| format!("读取条目 {i} 失败: {e}"))?;
        let outpath = match zf.enclosed_name() {
            Some(p) => Path::new(dst).join(p),
            None => continue,
        };
        if zf.is_dir() {
            let _ = fs::create_dir_all(&outpath);
            continue;
        }
        if let Some(p) = outpath.parent() {
            let _ = fs::create_dir_all(p);
        }
        let mut outfile = fs::File::create(&outpath).map_err(map_err)?;
        let mut buf = [0u8; 8192];
        loop {
            let n = zf.read(&mut buf).map_err(map_err)?;
            if n == 0 {
                break;
            }
            outfile.write_all(&buf[..n]).map_err(map_err)?;
        }
    }
    Ok(())
}

/// 把 temp_path 内容回写进 archive 的 entry(原地重写整个 zip)
/// 采用「解压全部 -> 替换目标 -> 重新打包」的稳妥方式,兼容性好
pub fn save_entry(archive: &str, entry: &str, temp_path: &str) -> CmdResult<()> {
    let src = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(src).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    let tmp_path = format!("{archive}.mt_tmp");
    let tmp_file = fs::File::create(&tmp_path).map_err(map_err)?;
    let mut zw = ZipWriter::new(tmp_file);
    let opts: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let new_data = fs::read(temp_path).map_err(map_err)?;
    for i in 0..arc.len() {
        let mut zf = arc
            .by_index(i)
            .map_err(|e| format!("读取条目 {i} 失败: {e}"))?;
        let name = zf.name().to_string();
        let is_dir = zf.is_dir();
        if is_dir {
            let dir_name = if name.ends_with('/') {
                name.clone()
            } else {
                format!("{name}/")
            };
            zw.add_directory(&dir_name, opts).map_err(|e| format!("写目录失败: {e}"))?;
        } else if name == entry {
            zw.start_file(&name, opts).map_err(|e| format!("写条目失败: {e}"))?;
            zw.write_all(&new_data).map_err(map_err)?;
        } else {
            // 解压其他条目并重新打包
            let mut buf = Vec::with_capacity(zf.size() as usize);
            zf.read_to_end(&mut buf).map_err(map_err)?;
            zw.start_file(&name, opts).map_err(|e| format!("写条目失败: {e}"))?;
            zw.write_all(&buf).map_err(map_err)?;
        }
    }
    zw.finish().map_err(|e| format!("关闭 ZIP 失败: {e}"))?;
    drop(arc);
    fs::rename(&tmp_path, archive).map_err(map_err)?;
    Ok(())
}

fn add_path(zw: &mut ZipWriter<fs::File>, base: &Path, rel: &Path, opts: SimpleFileOptions) -> Result<(), String> {
    if base.is_dir() {
        let dir_name = rel.to_string_lossy().replace('\\', "/") + "/";
        zw.add_directory(dir_name, opts).map_err(|e| format!("添加目录失败: {e}"))?;
        for entry in fs::read_dir(base).map_err(map_err)? {
            let entry = entry.map_err(map_err)?;
            let name = entry.file_name();
            add_path(zw, &entry.path(), &rel.join(name), opts)?;
        }
    } else {
        let file_name = rel.to_string_lossy().replace('\\', "/");
        zw.start_file(&file_name, opts).map_err(|e| format!("添加文件失败: {e}"))?;
        let data = fs::read(base).map_err(map_err)?;
        zw.write_all(&data).map_err(map_err)?;
    }
    Ok(())
}

pub fn create(sources: &[String], dst: &str) -> CmdResult<()> {
    let file = fs::File::create(dst).map_err(map_err)?;
    let mut zw = ZipWriter::new(file);
    let opts: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let base_name = p.file_name().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("root"));
        add_path(&mut zw, p, &base_name, opts)?;
    }
    zw.finish().map_err(|e| format!("关闭 ZIP 失败: {e}"))?;
    Ok(())
}
