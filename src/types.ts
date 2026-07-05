// 与 Rust 后端 models 对应的前端类型

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number; // unix 毫秒
  isArchive: boolean;
  isReadOnly: boolean;
  isHidden: boolean;
}

export interface FileStat {
  size: number;
  modified: number;
  isDir: boolean;
  isReadOnly: boolean;
  isHidden: boolean;
}

export interface ArchiveEntry {
  path: string; // 包内完整路径
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  modified: number;
}

export interface SearchHit {
  path: string;
  name: string;
  size: number;
  modified: number;
  isDir: boolean;
}

export interface ContentHit {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface DriveInfo {
  letter: string; // "C:\\"
  name: string;
  total: number;
  free: number;
}

export interface Bookmark {
  name: string;
  path: string;
  group: string;
}

export interface AppConfig {
  theme: "dark" | "light";
  leftPath: string;
  rightPath: string;
  dualPane: boolean;
  splitRatio: number;
  bookmarks: Bookmark[];
  recentArchives: string[];
  editorFont: string;
  editorFontSize: number;
}

// 编辑器标签页
export type EditorKind = "text" | "hex" | "image" | "json" | "xml";

export interface EditorTab {
  id: string;
  title: string;
  kind: EditorKind;
  path: string; // 普通文件路径,或压缩包内条目时的临时路径
  /** 若为压缩包内文件,记录原始压缩包与条目,用于回写 */
  archiveRef?: { archive: string; entry: string };
  dirty: boolean;
  /** 已加载的内容(文本/字节);HEX/图片用 bytes */
  text?: string;
  bytes?: Uint8Array;
  language?: string;
}

export type PaneSide = "left" | "right";

export interface PaneState {
  path: string;
  history: string[];
  historyIndex: number;
  entries: DirEntry[];
  loading: boolean;
  selected: Set<string>; // 选中项的 path
  cursor: string | null; // 当前焦点行 path
  sortKey: "name" | "size" | "modified" | "ext";
  sortAsc: boolean;
  showHidden: boolean;
  /** 若在浏览压缩包内部,记录压缩包路径 */
  archivePath: string | null;
}
