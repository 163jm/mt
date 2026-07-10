import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { PaneSide } from "@/types";
import AddressBar from "./AddressBar";
import FileList from "./FileList";
import { Package } from "lucide-react";

export default function FilePane({ side }: { side: PaneSide }) {
  const pane = useStore((s) => s.panes[side]);
  const activePane = useStore((s) => s.activePane);
  const setActivePane = useStore((s) => s.setActivePane);
  const exitArchive = useStore((s) => s.exitArchive);
  const isActive = activePane === side;
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className="flex flex-col min-w-0 flex-1 relative"
      style={{ background: "var(--bg)", flex: pane ? undefined : 1 }}
      onMouseDown={() => setActivePane(side)}
      onDragOver={(e) => {
        if (useStore.getState().panes[side === "left" ? "right" : "left"].selected.size > 0) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        // 从另一窗格拖入:默认复制,按住 Shift 拖放则移动(贴合 Windows 资源管理器习惯)
        const other = side === "left" ? "right" : "left";
        const otherPane = useStore.getState().panes[other];
        const srcs = Array.from(otherPane.selected);
        if (!srcs.length) return;
        const wantMove = e.shiftKey;
        try {
          if (pane.archivePath) {
            // 目标是压缩包内部:视为"添加到压缩包"(仅 ZIP 支持)
            const { archiveAddEntries } = await import("@/lib/invoke");
            await archiveAddEntries(pane.archivePath, srcs, otherPane.path);
            await useStore.getState().refresh(side);
            useStore.getState().toast(`已添加 ${srcs.length} 项到压缩包`, "success");
            return;
          }
          if (otherPane.archivePath) {
            // 来源是压缩包内部:视为"解压到此处"
            const { archiveExtractSelected } = await import("@/lib/invoke");
            await archiveExtractSelected(otherPane.archivePath, srcs, pane.path);
            await useStore.getState().refresh(side);
            useStore.getState().toast(`已解压 ${srcs.length} 项到 ${pane.path}`, "success");
            return;
          }
          const { copyPaths, movePaths } = await import("@/lib/invoke");
          if (wantMove) {
            await movePaths(srcs, pane.path);
            await useStore.getState().refresh(other);
          } else {
            await copyPaths(srcs, pane.path);
          }
          await useStore.getState().refresh(side);
          useStore.getState().toast(`已${wantMove ? "移动" : "复制"}到 ${pane.path}`, "success");
        } catch (err) {
          useStore.getState().toast(`${wantMove ? "移动" : "复制"}失败: ${err}`, "error");
        }
      }}
    >
      {/* 激活指示条 */}
      <div
        style={{
          height: 2,
          background: isActive ? "var(--accent)" : "transparent",
          flex: "0 0 auto",
        }}
      />
      {pane.archivePath && (
        <div
          className="flex items-center gap-2 px-2.5 h-7 text-xs"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", borderBottom: "1px solid var(--border-soft)" }}
        >
          <Package size={13} />
          <span className="truncate flex-1">压缩包内部: {pane.archivePath}</span>
          <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => exitArchive(side)} title="退出压缩包">
            返回上级
          </button>
        </div>
      )}
      <AddressBar side={side} />
      <FileList side={side} dragOver={dragOver} />
    </div>
  );
}
