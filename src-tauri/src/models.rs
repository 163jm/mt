use serde::{Deserialize, Serialize};

/// 目录项 — 列目录返回
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64, // unix 毫秒
    pub is_archive: bool,
    pub is_read_only: bool,
    pub is_hidden: bool,
}

/// 文件元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub size: u64,
    pub modified: i64,
    pub is_dir: bool,
    pub is_read_only: bool,
    pub is_hidden: bool,
}

/// 压缩包内条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub path: String, // 包内完整路径
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
    pub modified: i64,
}

/// 文件名搜索命中
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: i64,
    pub is_dir: bool,
}

/// 内容搜索命中
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentHit {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
}

/// 盘符信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub letter: String,   // "C:\\"
    pub name: String,     // 显示名
    pub total: u64,
    pub free: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub name: String,
    pub path: String,
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub theme: String,
    pub left_path: String,
    pub right_path: String,
    pub dual_pane: bool,
    pub split_ratio: f64,
    pub bookmarks: Vec<Bookmark>,
    pub recent_archives: Vec<String>,
    pub editor_font: String,
    pub editor_font_size: u32,
}
