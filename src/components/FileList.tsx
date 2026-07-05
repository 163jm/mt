import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import type { DirEntry, PaneSide } from "@/types";
import { formatSize, formatDate, extOf } from "@/utils/format";
import { getTypeInfo } from "@/utils/fileTypes";
import { openContextMenu } from "./ContextMenuHost";
import { Folder, FileText, Package, ChevronUp, ChevronDown } from "lucide-react";

export default function FileList({ side, dragOver }: { side: PaneSide; dragOver: boolean }) {
  const pane = useStore((s) => s.panes[side]);
  const activePane = useStore((s) => s.activePane);
  const select = useStore((s) => s.select);
  const clearSelect = useStore((s) => s.clearSelect);
  const openFile = useStore((s) => s.openFile);
  const setSort = useStore((s) => s.setSort);
  const navigate = useStore((s) => s.navigate);
  const setCursor = useStore((s) => s.setCursor);
  const openArchiveEntry = useStore((s) => s.openArchiveEntry);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = pane.showHidden ? pane.entries : pane.entries.filter((e) => !e.isHidden);
  const isActive = activePane === side;

  const onRowDoubleClick = (e: DirEntry) => {
    if (pane.archivePath) {
      // 压缩包内:双击文件 -> 编辑器打开
      if (!e.isDir) openArchiveEntry(pane.archivePath, e.path, e.name);
      return;
    }
    openFile(e, side);
  };

  const onRowContextMenu = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    if (!pane.selected.has(entry.path)) select(side, entry.path);
    openContextMenu(e.clientX, e.clientY, buildMenu(entry, side));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isActive) return;
    const list = entries;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let idx = pane.cursor ? list.findIndex((x) => x.path === pane.cursor) : -1;
      idx = idx + dir;
      if (idx < 0) idx = 0;
      if (idx >= list.length) idx = list.length - 1;
      if (list[idx]) {
        select(side, list[idx].path, { ctrl: e.ctrlKey, shift: e.shiftKey });
        // 滚动可见
        const row = listRef.current?.querySelector(`[data-path="${CSS.escape(list[idx].path)}"]`);
        row?.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      const cur = list.find((x) => x.path === pane.cursor);
      if (cur) onRowDoubleClick(cur);
    } else if (e.key === " ") {
      const cur = list.find((x) => x.path === pane.cursor);
      if (cur) select(side, cur.path, { ctrl: true });
    }
  };

  const headerCell = (key: "name" | "size" | "modified" | "ext", label: string, width: string | number, alignRight = false) => {
    const sorted = pane.sortKey === key;
    return (
      <th
        style={{ width, textAlign: alignRight ? "right" : "left" }}
        className={sorted ? "sorted" : ""}
        onClick={() => setSort(side, key)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sorted && (pane.sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </span>
      </th>
    );
  };

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-auto"
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ outline: "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearSelect(side);
      }}
    >
      {dragOver && (
        <div className="drag-over absolute inset-0 pointer-events-none z-10" />
      )}
      <table className="file-table">
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            {headerCell("name", "名称", "auto")}
            {headerCell("size", "大小", 90, true)}
            {headerCell("modified", "修改时间", 130)}
            <th style={{ width: 70 }}>类型</th>
          </tr>
        </thead>
        <tbody>
          {!pane.archivePath && pane.path !== "/" && !/^[a-zA-Z]:\\?$/.test(pane.path) && (
            <tr
              className="file-row"
              onDoubleClick={() => useStore.getState().goUp(side)}
            >
              <td colSpan={4} style={{ color: "var(--muted)", fontStyle: "italic" }}>
                ..
              </td>
            </tr>
          )}
          {entries.map((e) => {
            const info = getTypeInfo(e.name);
            const selected = pane.selected.has(e.path);
            const isCursor = pane.cursor === e.path;
            return (
              <tr
                key={e.path}
                data-path={e.path}
                className={`file-row ${selected ? (isActive ? "selected" : "inactive-selected") : ""}`}
                style={isCursor && !selected ? { background: "var(--row-hover)" } : undefined}
                draggable={!!pane.selected.size && pane.selected.has(e.path)}
                onClick={(ev) =>
                  select(side, e.path, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey })
                }
                onDoubleClick={() => onRowDoubleClick(e)}
                onContextMenu={(ev) => onRowContextMenu(ev, e)}
                onMouseMove={(ev) => {
                  if (ev.altKey) setCursor(side, e.path);
                }}
                onDragStart={(ev) => {
                  if (!pane.selected.has(e.path)) select(side, e.path);
                  ev.dataTransfer.setData("text/mt-files", JSON.stringify({ side, paths: Array.from(pane.selected) }));
                  ev.dataTransfer.effectAllowed = "copyMove";
                }}
              >
                <td>
                  <div className="flex items-center gap-2">
                    {e.isDir ? (
                      e.isArchive ? (
                        <Package size={14} style={{ color: "var(--accent)" }} />
                      ) : (
                        <Folder size={14} style={{ color: "var(--accent-2)" }} />
                      )
                    ) : (
                      <FileText size={14} style={{ color: info.color }} />
                    )}
                    <span className="truncate">{e.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: "right" }} className="mono" >
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                    {e.isDir ? "" : formatSize(e.size)}
                  </span>
                </td>
                <td className="mono" style={{ color: "var(--muted)", fontSize: 11.5 }}>
                  {formatDate(e.modified)}
                </td>
                <td>
                  {e.isDir ? (
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>
                      {e.isArchive ? "ARCH" : "DIR"}
                    </span>
                  ) : (
                    <span className="ext-badge" style={{ background: `${info.color}22`, color: info.color }}>
                      {info.label || extOf(e.name).toUpperCase().slice(0, 4) || "FILE"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: "30px" }}>
                {pane.loading ? "加载中…" : "空目录"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function buildMenu(entry: DirEntry, side: PaneSide): import("./ContextMenuHost").MenuItem[] {
  const s = () => useStore.getState();
  const isArc = entry.isArchive;
  return [
    { label: "打开", icon: "open", onClick: () => s().openFile(entry, side) },
    ...(entry.isDir || isArc
      ? []
      : [
          { label: "编辑", icon: "edit", onClick: () => s().openEditorForPath(entry.path, "text") },
          { label: "HEX 查看", icon: "hex", onClick: () => s().openEditorForPath(entry.path, "hex") },
        ]),
    { sep: true },
    { label: "复制", icon: "copy", onClick: async () => {
        const other = side === "left" ? "right" : "left";
        const { copyPaths } = await import("@/lib/invoke");
        await copyPaths([entry.path], s().panes[other].path);
        s().refresh(side); s().refresh(other);
      } },
    { label: "移动", icon: "move", onClick: async () => {
        const other = side === "left" ? "right" : "left";
        const { movePaths } = await import("@/lib/invoke");
        await movePaths([entry.path], s().panes[other].path);
        s().refresh(side); s().refresh(other);
      } },
    { label: "重命名", icon: "rename", onClick: async () => {
        const { promptDialog } = await import("./DialogHost");
        const name = await promptDialog("重命名", "新名称:", entry.name);
        if (!name || name === entry.name) return;
        const { rename, joinPath } = await import("@/lib/invoke");
        const { dirname } = await import("@/utils/format");
        const newPath = await joinPath(dirname(entry.path), name);
        await rename(entry.path, newPath);
        s().refresh(side);
      } },
    ...(isArc ? [{ label: "解压到…", icon: "extract", onClick: async () => {
        const other = side === "left" ? "right" : "left";
        const { archiveExtractAll } = await import("@/lib/invoke");
        await archiveExtractAll(entry.path, s().panes[other].path);
        s().refresh(other);
      } }] : []),
    { sep: true },
    { label: "收藏此路径", icon: "star", danger: false, onClick: () => {
        s().addBookmark({ name: entry.name, path: entry.path, group: "常用" });
      } },
    { label: "删除", icon: "delete", danger: true, onClick: async () => {
        const { confirmDialog } = await import("./DialogHost");
        if (!await confirmDialog("删除", `删除 "${entry.name}"?`)) return;
        const { deletePaths } = await import("@/lib/invoke");
        await deletePaths([entry.path]);
        s().refresh(side);
      } },
  ];
}
