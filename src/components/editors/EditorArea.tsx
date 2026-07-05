import { useStore } from "@/store/useStore";
import type { EditorTab } from "@/types";
import { X, Save, FileText, Binary, Image as ImageIcon, Code2 } from "lucide-react";
import MonacoTextEditor from "./MonacoTextEditor";
import HexEditor from "./HexEditor";
import ImagePreview from "./ImagePreview";
import JsonViewer from "./JsonViewer";
import XmlViewer from "./XmlViewer";

export default function EditorArea() {
  const tabs = useStore((s) => s.editorTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const saveTab = useStore((s) => s.saveTab);
  const setEditorFullscreen = useStore((s) => s.setEditorFullscreen);
  const editorFullscreen = useStore((s) => s.editorFullscreen);

  const active = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const iconFor = (kind: EditorTab["kind"]) => {
    switch (kind) {
      case "hex": return <Binary size={12} />;
      case "image": return <ImageIcon size={12} />;
      case "json": return <Code2 size={12} style={{ color: "var(--accent)" }} />;
      case "xml": return <Code2 size={12} style={{ color: "#e37933" }} />;
      default: return <FileText size={12} />;
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--panel)", borderTop: "1px solid var(--border)" }}>
      {/* 标签栏 */}
      <div className="flex items-stretch h-8 flex-shrink-0" style={{ background: "var(--panel-2)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`tab ${t.id === activeTabId ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(t.id);
              }}
              title={t.archiveRef ? `压缩包内: ${t.archiveRef.archive}` : t.path}
            >
              {iconFor(t.kind)}
              <span className="truncate" style={{ maxWidth: 140 }}>{t.title}</span>
              {t.dirty && <span className="dot" />}
              <button
                className="icon-btn"
                style={{ width: 16, height: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2 border-l" style={{ borderColor: "var(--border)" }}>
          {active && (
            <button
              className="icon-btn"
              title="保存 (Ctrl+S)"
              onClick={() => saveTab(active.id)}
              disabled={!active.dirty}
            >
              <Save size={14} />
            </button>
          )}
          <button
            className="icon-btn"
            title={editorFullscreen ? "退出全屏" : "全屏编辑器"}
            onClick={() => setEditorFullscreen(!editorFullscreen)}
          >
            {editorFullscreen ? "⤓" : "⤢"}
          </button>
        </div>
      </div>

      {/* 编辑器主体 */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((t) => (
          <div
            key={t.id}
            style={{
              position: "absolute",
              inset: 0,
              display: t.id === active?.id ? "block" : "none",
            }}
          >
            <EditorView tab={t} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="h-full flex items-center justify-center" style={{ color: "var(--muted)" }}>
            没有打开的文件
          </div>
        )}
      </div>
    </div>
  );
}

function EditorView({ tab }: { tab: EditorTab }) {
  switch (tab.kind) {
    case "hex":
      return <HexEditor tab={tab} />;
    case "image":
      return <ImagePreview tab={tab} />;
    case "json":
      return <JsonViewer tab={tab} />;
    case "xml":
      return <XmlViewer tab={tab} />;
    default:
      return <MonacoTextEditor tab={tab} />;
  }
}
