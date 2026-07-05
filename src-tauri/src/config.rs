use crate::error::{map_err, CmdResult};
use crate::models::AppConfig;
use std::fs;
use std::path::PathBuf;

fn config_path() -> CmdResult<PathBuf> {
    let base = if let Ok(p) = std::env::var("APPDATA") {
        PathBuf::from(p)
    } else if let Ok(p) = std::env::var("HOME") {
        PathBuf::from(p).join(".config")
    } else if let Ok(p) = std::env::var("USERPROFILE") {
        PathBuf::from(p).join("AppData").join("Roaming")
    } else {
        std::env::temp_dir()
    };
    let dir = base.join("mt-manager-win");
    let _ = fs::create_dir_all(&dir);
    Ok(dir.join("config.json"))
}

#[tauri::command]
pub fn load_config() -> CmdResult<AppConfig> {
    let p = config_path()?;
    if !p.exists() {
        return Ok(default_config());
    }
    let text = fs::read_to_string(&p).map_err(map_err)?;
    let cfg: AppConfig = serde_json::from_str(&text).unwrap_or_else(|_| default_config());
    Ok(cfg)
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> CmdResult<()> {
    let p = config_path()?;
    let text = serde_json::to_string_pretty(&config).map_err(map_err)?;
    fs::write(&p, text).map_err(map_err)?;
    Ok(())
}

pub fn default_config() -> AppConfig {
    let home = if let Ok(h) = std::env::var("USERPROFILE") {
        h
    } else if let Ok(h) = std::env::var("HOME") {
        h
    } else {
        "/".to_string()
    };
    AppConfig {
        theme: "dark".to_string(),
        left_path: home.clone(),
        right_path: home,
        dual_pane: true,
        split_ratio: 0.5,
        bookmarks: default_bookmarks(),
        recent_archives: vec![],
        editor_font: "JetBrains Mono".to_string(),
        editor_font_size: 13,
    }
}

fn default_bookmarks() -> Vec<crate::models::Bookmark> {
    use crate::models::Bookmark;
    let home = if let Ok(h) = std::env::var("USERPROFILE") {
        h
    } else if let Ok(h) = std::env::var("HOME") {
        h
    } else {
        "/".to_string()
    };
    vec![
        Bookmark {
            name: "主目录".to_string(),
            path: home.clone(),
            group: "常用".to_string(),
        },
        Bookmark {
            name: "桌面".to_string(),
            path: format!("{home}/Desktop"),
            group: "常用".to_string(),
        },
    ]
}
