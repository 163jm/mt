import { invoke } from "@tauri-apps/api/core";
import type {
  ArchiveEntry,
  AppConfig,
  ContentHit,
  DirEntry,
  DriveInfo,
  FileStat,
  SearchHit,
} from "@/types";

// ===== 文件系统 =====
export const listDir = (path: string) => invoke<DirEntry[]>("list_dir", { path });
export const readFile = (path: string) => invoke<number[]>("read_file", { path });
export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });
export const writeFile = (path: string, data: number[]) =>
  invoke<void>("write_file", { path, data });
export const writeTextFile = (path: string, text: string) =>
  invoke<void>("write_text_file", { path, text });
export const copyPaths = (srcs: string[], dst: string) =>
  invoke<void>("copy_paths", { srcs, dst });
export const movePaths = (srcs: string[], dst: string) =>
  invoke<void>("move_paths", { srcs, dst });
export const deletePaths = (paths: string[]) => invoke<void>("delete_paths", { paths });
export const mkdir = (path: string) => invoke<void>("mkdir", { path });
export const rename = (src: string, dst: string) => invoke<void>("rename", { src, dst });
export const exists = (path: string) => invoke<boolean>("exists", { path });
export const stat = (path: string) => invoke<FileStat>("stat", { path });
export const drives = () => invoke<DriveInfo[]>("drives");
export const homeDir = () => invoke<string>("home_dir");
export const parentPath = (path: string) => invoke<string | null>("parent_path", { path });
export const joinPath = (base: string, name: string) =>
  invoke<string>("join_path", { base, name });

// ===== 压缩包 =====
export const archiveList = (path: string) =>
  invoke<ArchiveEntry[]>("archive_list", { path });
export const archiveExtractEntry = (archive: string, entry: string) =>
  invoke<string>("archive_extract_entry", { archive, entry });
export const archiveSaveEntry = (archive: string, entry: string, tempPath: string) =>
  invoke<void>("archive_save_entry", { archive, entry, tempPath });
export const archiveExtractAll = (archive: string, dst: string) =>
  invoke<void>("archive_extract_all", { archive, dst });
export const archiveCreate = (
  sources: string[],
  dst: string,
  format: "zip" | "7z" | "tar.gz" | "tar" | "tar.bz2" | "tar.xz"
) => invoke<void>("archive_create", { sources, dst, format });
export const archiveExtractSelected = (archive: string, entries: string[], dst: string) =>
  invoke<void>("archive_extract_selected", { archive, entries, dst });
export const archivePreviewEntry = (archive: string, entry: string) =>
  invoke<number[]>("archive_preview_entry", { archive, entry });
export const archiveRemoveEntries = (archive: string, entries: string[]) =>
  invoke<void>("archive_remove_entries", { archive, entries });
export const archiveAddEntries = (archive: string, sources: string[], baseDir: string) =>
  invoke<void>("archive_add_entries", { archive, sources, baseDir });
export const rarSupportAvailable = () => invoke<boolean>("rar_support_available");

// ===== 搜索 =====
export interface NameSearchOpts {
  regex: boolean;
  caseSensitive: boolean;
  sizeMin?: number;
  sizeMax?: number;
  dateFrom?: number;
  dateTo?: number;
  exts?: string[];
  maxResults?: number;
}
export const searchName = (root: string, query: string, opts: NameSearchOpts) =>
  invoke<SearchHit[]>("search_name", { root, query, opts });
export interface ContentSearchOpts {
  isHex: boolean;
  caseSensitive: boolean;
  maxResults?: number;
  maxFileSize?: number;
}
export const searchContent = (root: string, query: string, opts: ContentSearchOpts) =>
  invoke<ContentHit[]>("search_content", { root, query, opts });

// ===== 配置 =====
export const loadConfig = () => invoke<AppConfig>("load_config");
export const saveConfig = (config: AppConfig) => invoke<void>("save_config", { config });
