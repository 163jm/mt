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

/// 解压若干指定条目到目标目录,保留内部相对路径结构
pub fn extract_selected(archive: &str, entries: &[String], dst: &str) -> CmdResult<()> {
    let want: std::collections::HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();
    let file = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(file).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    for i in 0..arc.len() {
        let mut zf = arc
            .by_index(i)
            .map_err(|e| format!("读取条目 {i} 失败: {e}"))?;
        if !want.contains(zf.name()) {
            continue;
        }
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

/// 从 ZIP 中删除若干条目(含目录时会一并删除其下所有条目),同样采用重写整个包的方式
pub fn remove_entries(archive: &str, entries: &[String]) -> CmdResult<()> {
    let remove_set: std::collections::HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();
    let src = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(src).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    let tmp_path = format!("{archive}.mt_tmp");
    let tmp_file = fs::File::create(&tmp_path).map_err(map_err)?;
    let mut zw = ZipWriter::new(tmp_file);
    let opts: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let should_remove = |name: &str| -> bool {
        remove_set.contains(name)
            || remove_set.iter().any(|r| {
                let prefix = if r.ends_with('/') { r.to_string() } else { format!("{r}/") };
                name.starts_with(&prefix)
            })
    };

    for i in 0..arc.len() {
        let mut zf = arc
            .by_index(i)
            .map_err(|e| format!("读取条目 {i} 失败: {e}"))?;
        let name = zf.name().to_string();
        if should_remove(&name) {
            continue;
        }
        if zf.is_dir() {
            let dir_name = if name.ends_with('/') { name.clone() } else { format!("{name}/") };
            zw.add_directory(&dir_name, opts).map_err(|e| format!("写目录失败: {e}"))?;
        } else {
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

/// 把外部若干文件/目录添加(或替换同名条目)进已存在的 ZIP,免二次手动解压重新打包
pub fn add_entries(archive: &str, sources: &[String], base_dir: &str) -> CmdResult<()> {
    let src = fs::File::open(archive).map_err(map_err)?;
    let mut arc = ZipArchive::new(src).map_err(|e| format!("打开 ZIP 失败: {e}"))?;
    let tmp_path = format!("{archive}.mt_tmp");
    let tmp_file = fs::File::create(&tmp_path).map_err(map_err)?;
    let mut zw = ZipWriter::new(tmp_file);
    let opts: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // 计算待添加文件在包内的相对路径,用于识别与旧条目的名称冲突(冲突则以新文件覆盖)
    let mut incoming_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    fn collect_names(base: &Path, rel: &Path, out: &mut std::collections::HashSet<String>) {
        if base.is_dir() {
            if let Ok(rd) = fs::read_dir(base) {
                for e in rd.flatten() {
                    let name = e.file_name();
                    collect_names(&e.path(), &rel.join(name), out);
                }
            }
        } else {
            out.insert(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let rel = p.file_name().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("file"));
        collect_names(p, &rel, &mut incoming_names);
    }

    // 先写旧条目中未被覆盖的部分
    for i in 0..arc.len() {
        let mut zf = arc
            .by_index(i)
            .map_err(|e| format!("读取条目 {i} 失败: {e}"))?;
        let name = zf.name().to_string();
        if incoming_names.contains(&name) {
            continue; // 将被新文件覆盖,跳过旧版本
        }
        if zf.is_dir() {
            let dir_name = if name.ends_with('/') { name.clone() } else { format!("{name}/") };
            zw.add_directory(&dir_name, opts).map_err(|e| format!("写目录失败: {e}"))?;
        } else {
            let mut buf = Vec::with_capacity(zf.size() as usize);
            zf.read_to_end(&mut buf).map_err(map_err)?;
            zw.start_file(&name, opts).map_err(|e| format!("写条目失败: {e}"))?;
            zw.write_all(&buf).map_err(map_err)?;
        }
    }
    drop(arc);

    // 再写入新文件(相对 base_dir 计算路径,若不在其下则仅用文件名作为顶层条目)
    let base = Path::new(base_dir);
    for s in sources {
        let p = Path::new(s);
        if !p.exists() {
            continue;
        }
        let rel = p
            .strip_prefix(base)
            .map(|r| r.to_path_buf())
            .unwrap_or_else(|_| p.file_name().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("file")));
        add_path(&mut zw, p, &rel, opts)?;
    }

    zw.finish().map_err(|e| format!("关闭 ZIP 失败: {e}"))?;
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
