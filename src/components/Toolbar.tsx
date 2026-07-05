import {
  ArrowLeft, ArrowRight, ArrowUp, RefreshCw, FolderPlus, Copy, Scissors,
  Trash2, Archive, FileSearch, Columns2, Eye, Sun, Moon, Download,
  PanelLeftClose, PanelLeftOpen, Maximize2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/invoke";
import { confirmDialog, promptDialog } from "@/components/DialogHost";
import { dirname } from "@/utils/format";

export default function Toolbar() {
  const activePane = useStore((s) => s.activePane);
  const pane = useStore((s) => s.panes[activePane]);
  const dualPane = useStore((s) => s.dualPane);
  const theme = useStore((s) => s.theme);
  const editorFullscreen = useStore((s) => s.editorFullscreen);
  const setEditorFullscreen = useStore((s) => s.setEditorFullscreen);
  const hasEditor = useStore((s) => s.editorTabs.length > 0);

  const goBack = useStore((s) => s.goBack);
  const goForward = useStore((s) => s.goForward);
  const goUp = useStore((s) => s.goUp);
  const refresh = useStore((s) => s.refresh);
  const navigate = useStore((s) => s.navigate);
  const toast = useStore((s) => s.toast);
  const setDualPane = useStore((s) => s.setDualPane);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setSearchOpen = useStore((s) => s.setSearchOpen);

  const other = activePane === "left" ? "right" : "left";
  const otherPane = useStore((s) => s.panes[other]);

  const selectedList = Array.from(pane.selected);

  const newFolder = async () => {
    const name = await promptDialog("新建文件夹", "名称:", "新建文件夹");
    if (!name) return;
    try {
      const target = pane.archivePath ? null : await api.joinPath(pane.path, name);
      if (!target) return;
      await api.mkdir(target);
      await refresh(activePane);
      toast("已创建", "success");
    } catch (e) {
      toast(`创建失败: ${e}`, "error");
    }
  };

  const copy = async () => {
    if (!selectedList.length) return;
    try {
      await api.copyPaths(selectedList, otherPane.path);
      await refresh(activePane);
      await refresh(other);
      toast(`已复制到 ${otherPane.path}`, "success");
    } catch (e) {
      toast(`复制失败: ${e}`, "error");
    }
  };

  const move = async () => {
    if (!selectedList.length) return;
    if (!await confirmDialog("移动", `移动 ${selectedList.length} 项到另一窗格?`)) return;
    try {
      await api.movePaths(selectedList, otherPane.path);
      await refresh(activePane);
      await refresh(other);
      toast("已移动", "success");
    } catch (e) {
      toast(`移动失败: ${e}`, "error");
    }
  };

  const del = async () => {
    if (!selectedList.length) return;
    if (!await confirmDialog("删除", `永久删除 ${selectedList.length} 项?此操作不可撤销。`)) return;
    try {
      await api.deletePaths(selectedList);
      await refresh(activePane);
      toast("已删除", "success");
    } catch (e) {
      toast(`删除失败: ${e}`, "error");
    }
  };

  const compress = async () => {
    if (!selectedList.length) return;
    const name = await promptDialog("压缩", "压缩包名(含扩展名 .zip/.7z/.tar.gz):", "archive.zip");
    if (!name) return;
    const fmt = name.toLowerCase().endsWith(".7z") ? "7z"
      : name.toLowerCase().endsWith(".tar.gz") || name.toLowerCase().endsWith(".tgz") ? "tar.gz"
      : name.toLowerCase().endsWith(".tar") ? "tar" : "zip";
    try {
      const target = await api.joinPath(otherPane.path, name);
      await api.archiveCreate(selectedList, target, fmt as "zip" | "7z" | "tar.gz" | "tar");
      await refresh(other);
      toast("已压缩", "success");
    } catch (e) {
      toast(`压缩失败: ${e}`, "error");
    }
  };

  const extract = async () => {
    if (!selectedList.length) return;
    for (const p of selectedList) {
      try {
        await api.archiveExtractAll(p, otherPane.path);
      } catch (e) {
        toast(`解压失败 ${p}: ${e}`, "error");
      }
    }
    await refresh(other);
    toast("已解压", "success");
  };

  const Btn = ({ icon: Icon, onClick, title, disabled }: any) => (
    <button className="icon-btn" title={title} onClick={onClick} disabled={disabled}>
      <Icon size={15} />
    </button>
  );

  const inArchive = !!pane.archivePath;

  return (
    <div
      className="flex items-center gap-0.5 px-2 h-11 border-b"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      <Btn icon={ArrowLeft} title="后退 (Alt+←)" onClick={() => goBack(activePane)} disabled={pane.historyIndex <= 0} />
      <Btn icon={ArrowRight} title="前进 (Alt+→)" onClick={() => goForward(activePane)} disabled={pane.historyIndex >= pane.history.length - 1} />
      <Btn icon={ArrowUp} title="上级目录 (Backspace)" onClick={() => goUp(activePane)} />
      <Btn icon={RefreshCw} title="刷新 (Ctrl+R)" onClick={() => refresh(activePane)} />
      <div className="divider-v" />
      <Btn icon={FolderPlus} title="新建文件夹 (F7)" onClick={newFolder} disabled={inArchive} />
      <Btn icon={Copy} title="复制到另一窗格 (F5)" onClick={copy} disabled={!selectedList.length || inArchive} />
      <Btn icon={Scissors} title="移动到另一窗格 (F6)" onClick={move} disabled={!selectedList.length || inArchive} />
      <Btn icon={Trash2} title="删除 (F8)" onClick={del} disabled={!selectedList.length || inArchive} />
      <div className="divider-v" />
      <Btn icon={Archive} title="压缩" onClick={compress} disabled={!selectedList.length || inArchive} />
      <Btn icon={Download} title="解压到另一窗格" onClick={extract} disabled={!selectedList.length} />
      <div className="divider-v" />
      <Btn icon={FileSearch} title="搜索 (Ctrl+F)" onClick={() => setSearchOpen(true)} />
      <Btn
        icon={dualPane ? Columns2 : PanelLeftClose}
        title={dualPane ? "切换单窗格 (Ctrl+1)" : "切换双窗格 (Ctrl+2)"}
        onClick={() => setDualPane(!dualPane)}
      />
      <Btn icon={Eye} title="显示/隐藏 隐藏文件" onClick={() => toggleHidden(activePane)}
        disabled={false}
      />
      <div className="flex-1" />
      {hasEditor && (
        <Btn
          icon={Maximize2}
          title={editorFullscreen ? "编辑器退出全屏" : "编辑器全屏"}
          onClick={() => setEditorFullscreen(!editorFullscreen)}
        />
      )}
      <Btn icon={theme === "dark" ? Sun : Moon} title="切换主题" onClick={toggleTheme} />
    </div>
  );
}
