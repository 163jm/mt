import { useStore } from "@/store/useStore";
import { formatSize } from "@/utils/format";

export default function StatusBar() {
  const activePane = useStore((s) => s.activePane);
  const pane = useStore((s) => s.panes[activePane]);
  const dualPane = useStore((s) => s.dualPane);
  const theme = useStore((s) => s.theme);
  const tabsCount = useStore((s) => s.editorTabs.length);

  const selected = pane.entries.filter((e) => pane.selected.has(e.path));
  const selectedSize = selected.reduce((a, b) => a + b.size, 0);
  const totalFiles = pane.entries.filter((e) => !e.isDir).length;
  const totalDirs = pane.entries.filter((e) => e.isDir).length;

  return (
    <div className="statusbar">
      <span className="mono truncate" style={{ maxWidth: 360 }}>
        {pane.path}
      </span>
      <span style={{ color: "var(--accent)" }}>●</span>
      <span>
        {activePane === "left" ? "左" : "右"}窗格 · {dualPane ? "双窗格" : "单窗格"}
      </span>
      <span>
        共 {totalDirs} 文件夹 / {totalFiles} 文件
      </span>
      {selected.length > 0 && (
        <span style={{ color: "var(--accent)" }}>
          已选 {selected.length} 项 {selectedSize > 0 ? `· ${formatSize(selectedSize)}` : ""}
        </span>
      )}
      <div className="flex-1" />
      <span>{theme === "dark" ? "深色" : "浅色"}主题</span>
      <span>{tabsCount > 0 ? `${tabsCount} 标签页` : ""}</span>
    </div>
  );
}
