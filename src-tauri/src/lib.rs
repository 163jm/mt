mod archive;
mod config;
mod error;
mod fs_ops;
mod models;
mod search;

use archive::{
    archive_add_entries, archive_create, archive_extract_all, archive_extract_entry,
    archive_extract_selected, archive_list, archive_preview_entry, archive_remove_entries,
    archive_save_entry, rar_support_available,
};
use config::{load_config, save_config};
use fs_ops::{
    copy_paths, delete_paths, drives, exists, home_dir, join_path, list_dir, mkdir, move_paths,
    parent_path, read_file, read_text_file, rename, stat, write_file, write_text_file,
};
use search::{search_content, search_name};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // 文件系统
            list_dir,
            read_file,
            read_text_file,
            write_file,
            write_text_file,
            copy_paths,
            move_paths,
            delete_paths,
            mkdir,
            rename,
            exists,
            stat,
            drives,
            home_dir,
            parent_path,
            join_path,
            // 压缩包
            archive_list,
            archive_extract_entry,
            archive_extract_selected,
            archive_preview_entry,
            archive_save_entry,
            archive_extract_all,
            archive_create,
            archive_remove_entries,
            archive_add_entries,
            rar_support_available,
            // 搜索
            search_name,
            search_content,
            // 配置
            load_config,
            save_config,
        ])
        .run(tauri::generate_context!())
        .expect("运行 MT 管理器时出错");
}
