import { create } from "zustand";
import type {
  AppConfig,
  Bookmark,
  DirEntry,
  EditorTab,
  PaneSide,
  PaneState,
} from "@/types";
import * as api from "@/lib/invoke";
import { dirname, joinPathLocal } from "@/utils/format";

interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  msg: string;
}

interface StoreState {
  // 全局
  theme: "dark" | "light";
  dualPane: boolean;
  splitRatio: number;
  activePane: PaneSide;
  bookmarks: Bookmark[];
  configLoaded: boolean;

  panes: Record<PaneSide, PaneState>;

  // 编辑器
  editorTabs: EditorTab[];
  activeTabId: string | null;
  editorFullscreen: boolean;

  // 搜索
  searchOpen: boolean;
  searchPane: PaneSide;

  // 进度/提示
  busy: boolean;
  toasts: Toast[];

  // ===== actions =====
  init: () => Promise<void>;
  setTheme: (t: "dark" | "light") => void;
  toggleTheme: () => void;
  setDualPane: (v: boolean) => void;
  setSplitRatio: (r: number) => void;
  setActivePane: (p: PaneSide) => void;

  navigate: (pane: PaneSide, path: string, pushHistory?: boolean) => Promise<void>;
  refresh: (pane: PaneSide) => Promise<void>;
  goBack: (pane: PaneSide) => Promise<void>;
  goForward: (pane: PaneSide) => Promise<void>;
  goUp: (pane: PaneSide) => Promise<void>;
  setSort: (pane: PaneSide, key: PaneState["sortKey"]) => void;
  toggleHidden: (pane: PaneSide) => void;
  select: (pane: PaneSide, path: string, opts?: { ctrl?: boolean; shift?: boolean }) => void;
  clearSelect: (pane: PaneSide) => void;
  setCursor: (pane: PaneSide, path: string | null) => void;
  enterArchive: (pane: PaneSide, archive: string) => Promise<void>;
  exitArchive: (pane: PaneSide) => void;

  addBookmark: (b: Bookmark) => void;
  removeBookmark: (path: string) => void;

  openFile: (entry: DirEntry, pane: PaneSide) => Promise<void>;
  openEditorForPath: (path: string, kind?: EditorTab["kind"]) => Promise<void>;
  openArchiveEntry: (archive: string, entry: string, name: string) => Promise<void>;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  updateTabText: (id: string, text: string) => void;
  saveTab: (id: string) => Promise<void>;
  setEditorFullscreen: (v: boolean) => void;

  setSearchOpen: (v: boolean) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  setBusy: (v: boolean) => void;

  persist: () => Promise<void>;
}

let toastSeq = 1;
let tabSeq = 1;

function emptyPane(path: string): PaneState {
  return {
    path,
    history: [path],
    historyIndex: 0,
    entries: [],
    loading: false,
    selected: new Set<string>(),
    cursor: null,
    sortKey: "name",
    sortAsc: true,
    showHidden: false,
    archivePath: null,
  };
}

function sortEntries(entries: DirEntry[], pane: PaneState): DirEntry[] {
  const { sortKey, sortAsc } = pane;
  const dir = sortAsc ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    else if (sortKey === "size") cmp = a.size - b.size;
    else if (sortKey === "modified") cmp = a.modified - b.modified;
    else cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    return cmp * dir;
  });
}

export const useStore = create<StoreState>((set, get) => ({
  theme: "dark",
  dualPane: true,
  splitRatio: 0.5,
  activePane: "left",
  bookmarks: [],
  configLoaded: false,
  panes: {
    left: emptyPane(""),
    right: emptyPane(""),
  },
  editorTabs: [],
  activeTabId: null,
  editorFullscreen: false,
  searchOpen: false,
  searchPane: "left",
  busy: false,
  toasts: [],

  init: async () => {
    try {
      const cfg = await api.loadConfig();
      const left = cfg.leftPath || (await api.homeDir());
      const right = cfg.rightPath || left;
      set({
        theme: cfg.theme || "dark",
        dualPane: cfg.dualPane ?? true,
        splitRatio: cfg.splitRatio ?? 0.5,
        bookmarks: cfg.bookmarks || [],
        configLoaded: true,
        panes: {
          left: emptyPane(left),
          right: emptyPane(right),
        },
      });
      await get().navigate("left", left, false);
      await get().navigate("right", right, false);
    } catch (e) {
      const home = await api.homeDir().catch(() => "/");
      set({ configLoaded: true, panes: { left: emptyPane(home), right: emptyPane(home) } });
      await get().navigate("left", home, false);
      await get().navigate("right", home, false);
      get().toast(`配置加载失败: ${String(e)}`, "error");
    }
  },

  setTheme: (t) => {
    set({ theme: t });
    get().persist();
  },
  toggleTheme: () => {
    set({ theme: get().theme === "dark" ? "light" : "dark" });
    get().persist();
  },
  setDualPane: (v) => {
    set({ dualPane: v });
    get().persist();
  },
  setSplitRatio: (r) => {
    set({ splitRatio: Math.min(0.85, Math.max(0.15, r)) });
    get().persist();
  },
  setActivePane: (p) => set({ activePane: p }),

  navigate: async (pane, path, pushHistory = true) => {
    const st = get();
    set({ busy: true });
    try {
      // 如果是压缩包,进入包内浏览
      const lower = path.toLowerCase();
      const isArchive = /\.(zip|7z|tar|gz|tgz|rar|bz2|xz)$/.test(lower);
      let entries: DirEntry[] = [];
      let archivePath: string | null = null;
      if (isArchive && st.panes[pane].archivePath === null) {
        // 进入压缩包
        const arcEntries = await api.archiveList(path);
        archivePath = path;
        entries = arcEntries.map((a) => ({
          name: a.name,
          path: a.path,
          isDir: a.isDir,
          size: a.size,
          modified: a.modified,
          isArchive: false,
          isReadOnly: true,
          isHidden: false,
        }));
      } else {
        entries = await api.listDir(path);
      }
      const p = get().panes[pane];
      const next: PaneState = {
        ...p,
        path,
        entries: sortEntries(entries, p),
        loading: false,
        selected: new Set(),
        cursor: null,
        archivePath,
      };
      if (pushHistory) {
        const history = p.history.slice(0, p.historyIndex + 1);
        history.push(path);
        next.history = history;
        next.historyIndex = history.length - 1;
      }
      set({ panes: { ...get().panes, [pane]: next }, busy: false });
    } catch (e) {
      set({ busy: false });
      get().toast(`无法打开: ${String(e)}`, "error");
    }
  },

  refresh: async (pane) => {
    const p = get().panes[pane];
    if (p.archivePath) {
      // 刷新压缩包
      try {
        const arcEntries = await api.archiveList(p.archivePath);
        const entries = arcEntries.map((a) => ({
          name: a.name, path: a.path, isDir: a.isDir, size: a.size, modified: a.modified,
          isArchive: false, isReadOnly: true, isHidden: false,
        }));
        set({ panes: { ...get().panes, [pane]: { ...p, entries: sortEntries(entries, p), selected: new Set(), cursor: null } } });
      } catch (e) {
        get().toast(`刷新失败: ${String(e)}`, "error");
      }
      return;
    }
    await get().navigate(pane, p.path, false);
  },

  goBack: async (pane) => {
    const p = get().panes[pane];
    if (p.historyIndex > 0) {
      const idx = p.historyIndex - 1;
      const path = p.history[idx];
      set({ panes: { ...get().panes, [pane]: { ...p, historyIndex: idx } } });
      await get().navigate(pane, path, false);
    }
  },
  goForward: async (pane) => {
    const p = get().panes[pane];
    if (p.historyIndex < p.history.length - 1) {
      const idx = p.historyIndex + 1;
      const path = p.history[idx];
      set({ panes: { ...get().panes, [pane]: { ...p, historyIndex: idx } } });
      await get().navigate(pane, path, false);
    }
  },
  goUp: async (pane) => {
    const p = get().panes[pane];
    if (p.archivePath) {
      // 退出压缩包,回到压缩包所在目录
      const arc = p.archivePath;
      set({ panes: { ...get().panes, [pane]: { ...p, archivePath: null } } });
      await get().navigate(pane, dirname(arc), false);
      return;
    }
    const parent = await api.parentPath(p.path);
    if (parent) await get().navigate(pane, parent);
  },

  setSort: (pane, key) => {
    const p = get().panes[pane];
    const sortAsc = p.sortKey === key ? !p.sortAsc : key === "name" ? true : false;
    set({
      panes: {
        ...get().panes,
        [pane]: { ...p, sortKey: key, sortAsc, entries: sortEntries(p.entries, { ...p, sortKey: key, sortAsc }) },
      },
    });
  },
  toggleHidden: (pane) => {
    const p = get().panes[pane];
    set({ panes: { ...get().panes, [pane]: { ...p, showHidden: !p.showHidden } } });
  },

  select: (pane, path, opts) => {
    const p = get().panes[pane];
    const sel = new Set(p.selected);
    if (opts?.shift && p.cursor) {
      const list = p.entries;
      const i1 = list.findIndex((e) => e.path === p.cursor);
      const i2 = list.findIndex((e) => e.path === path);
      if (i1 >= 0 && i2 >= 0) {
        const [a, b] = i1 < i2 ? [i1, i2] : [i2, i1];
        for (let i = a; i <= b; i++) sel.add(list[i].path);
      }
    } else if (opts?.ctrl) {
      if (sel.has(path)) sel.delete(path);
      else sel.add(path);
    } else {
      sel.clear();
      sel.add(path);
    }
    set({ panes: { ...get().panes, [pane]: { ...p, selected: sel, cursor: path } } });
  },
  clearSelect: (pane) => {
    const p = get().panes[pane];
    set({ panes: { ...get().panes, [pane]: { ...p, selected: new Set(), cursor: null } } });
  },
  setCursor: (pane, path) => {
    const p = get().panes[pane];
    set({ panes: { ...get().panes, [pane]: { ...p, cursor: path } } });
  },

  enterArchive: async (pane, archive) => {
    await get().navigate(pane, archive, true);
  },
  exitArchive: (pane) => {
    const p = get().panes[pane];
    if (p.archivePath) {
      const arc = p.archivePath;
      set({ panes: { ...get().panes, [pane]: { ...p, archivePath: null } } });
      get().navigate(pane, dirname(arc), false);
    }
  },

  addBookmark: (b) => {
    const list = get().bookmarks.filter((x) => x.path !== b.path);
    list.push(b);
    set({ bookmarks: list });
    get().persist();
  },
  removeBookmark: (path) => {
    set({ bookmarks: get().bookmarks.filter((x) => x.path !== path) });
    get().persist();
  },

  openFile: async (entry, pane) => {
    if (entry.isDir) {
      await get().navigate(pane, entry.path);
      return;
    }
    if (entry.isArchive) {
      await get().enterArchive(pane, entry.path);
      return;
    }
    // 根据扩展名打开编辑器
    const { getTypeInfo } = await import("@/utils/fileTypes");
    const info = getTypeInfo(entry.name);
    await get().openEditorForPath(entry.path, info.editor);
  },

  openEditorForPath: async (path, kind = "text") => {
    // 已打开则切换
    const existing = get().editorTabs.find((t) => t.path === path && !t.archiveRef);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    set({ busy: true });
    try {
      const id = `tab-${tabSeq++}`;
      const name = path.replace(/^.*[\\/]/, "");
      const tab: EditorTab = {
        id, title: name, kind: kind || "text", path, dirty: false,
      };
      if (kind === "hex") {
        const bytes = await api.readFile(path);
        tab.bytes = new Uint8Array(bytes);
      } else if (kind === "image") {
        const bytes = await api.readFile(path);
        tab.bytes = new Uint8Array(bytes);
      } else {
        const text = await api.readTextFile(path);
        tab.text = text;
        const { getTypeInfo } = await import("@/utils/fileTypes");
        tab.language = getTypeInfo(name).language;
      }
      set({ editorTabs: [...get().editorTabs, tab], activeTabId: id, busy: false });
    } catch (e) {
      set({ busy: false });
      get().toast(`打开失败: ${String(e)}`, "error");
    }
  },

  openArchiveEntry: async (archive, entry, name) => {
    set({ busy: true });
    try {
      // 解压到临时区
      const tempPath = await api.archiveExtractEntry(archive, entry);
      const id = `tab-${tabSeq++}`;
      const { getTypeInfo } = await import("@/utils/fileTypes");
      const info = getTypeInfo(name);
      const kind = info.editor || "text";
      const tab: EditorTab = {
        id, title: name, kind: kind || "text", path: tempPath, dirty: false,
        archiveRef: { archive, entry },
      };
      if (kind === "hex") {
        const bytes = await api.readFile(tempPath);
        tab.bytes = new Uint8Array(bytes);
      } else if (kind === "image") {
        const bytes = await api.readFile(tempPath);
        tab.bytes = new Uint8Array(bytes);
      } else {
        const text = await api.readTextFile(tempPath);
        tab.text = text;
        tab.language = info.language;
      }
      set({ editorTabs: [...get().editorTabs, tab], activeTabId: id, busy: false });
    } catch (e) {
      set({ busy: false });
      get().toast(`打开压缩包内文件失败: ${String(e)}`, "error");
    }
  },

  closeTab: (id) => {
    const tab = get().editorTabs.find((t) => t.id === id);
    if (tab?.dirty) {
      if (!window.confirm(`"${tab.title}" 未保存,确定关闭?`)) return;
    }
    const tabs = get().editorTabs.filter((t) => t.id !== id);
    let active = get().activeTabId;
    if (active === id) {
      active = tabs.length ? tabs[tabs.length - 1].id : null;
    }
    set({ editorTabs: tabs, activeTabId: active });
  },
  setActiveTab: (id) => set({ activeTabId: id }),
  markDirty: (id, dirty) => {
    set({ editorTabs: get().editorTabs.map((t) => (t.id === id ? { ...t, dirty } : t)) });
  },
  updateTabText: (id, text) => {
    set({ editorTabs: get().editorTabs.map((t) => (t.id === id ? { ...t, text, dirty: true } : t)) });
  },
  saveTab: async (id) => {
    const tab = get().editorTabs.find((t) => t.id === id);
    if (!tab) return;
    set({ busy: true });
    try {
      if (tab.kind === "hex" || tab.kind === "image") {
        const arr = Array.from(tab.bytes || new Uint8Array());
        await api.writeFile(tab.path, arr);
      } else {
        await api.writeTextFile(tab.path, tab.text || "");
      }
      // 若是压缩包内文件,回写进压缩包
      if (tab.archiveRef) {
        await api.archiveSaveEntry(tab.archiveRef.archive, tab.archiveRef.entry, tab.path);
      }
      get().markDirty(id, false);
      get().toast("已保存", "success");
      set({ busy: false });
    } catch (e) {
      set({ busy: false });
      get().toast(`保存失败: ${String(e)}`, "error");
    }
  },
  setEditorFullscreen: (v) => set({ editorFullscreen: v }),

  setSearchOpen: (v) => set({ searchOpen: v }),
  toast: (msg, kind = "info") => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, kind, msg }] });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setBusy: (v) => set({ busy: v }),

  persist: async () => {
    const s = get();
    const cfg: AppConfig = {
      theme: s.theme,
      leftPath: s.panes.left.path,
      rightPath: s.panes.right.path,
      dualPane: s.dualPane,
      splitRatio: s.splitRatio,
      bookmarks: s.bookmarks,
      recentArchives: [],
      editorFont: "JetBrains Mono",
      editorFontSize: 13,
    };
    try {
      await api.saveConfig(cfg);
    } catch {
      /* 静默 */
    }
  },
}));

export { joinPathLocal };
