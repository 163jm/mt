import { useEffect, useRef } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { EditorTab } from "@/types";
import { useStore } from "@/store/useStore";

// 使用本地打包的 monaco-editor,避免 Tauri 桌面端依赖 CDN
let configured = false;
function ensureLoader() {
  if (configured) return;
  loader.config({ monaco });
  configured = true;
}

export default function MonacoTextEditor({ tab }: { tab: EditorTab }) {
  const theme = useStore((s) => s.theme);
  const updateTabText = useStore((s) => s.updateTabText);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  ensureLoader();

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model && model.getValue() !== (tab.text || "")) {
      model.setValue(tab.text || "");
    }
  }, [tab.id]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme={theme === "dark" ? "vs-dark" : "vs"}
          language={tab.language || "plaintext"}
          value={tab.text}
          onChange={(val) => updateTabText(tab.id, val || "")}
          onMount={(editor, monacoApi) => {
            editorRef.current = editor;
            // 自定义 MT 主题
            monacoApi.editor.defineTheme("mt-dark", {
              base: "vs-dark",
              inherit: true,
              rules: [],
              colors: {
                "editor.background": "#16191f00",
              },
            });
          }}
          options={{
            fontFamily: "JetBrains Mono, Consolas, monospace",
            fontSize: 13,
            minimap: { enabled: true },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            renderWhitespace: "selection",
            tabSize: 2,
            wordWrap: "off",
            lineNumbersMinChars: 4,
          }}
        />
      </div>
      <EditorStatus tab={tab} />
    </div>
  );
}

function EditorStatus({ tab }: { tab: EditorTab }) {
  return (
    <div
      className="flex items-center gap-3 px-3 h-6 text-xs flex-shrink-0"
      style={{ background: "var(--panel-2)", borderTop: "1px solid var(--border-soft)", color: "var(--muted)" }}
    >
      <span className="mono">{tab.language || "plaintext"}</span>
      <span>UTF-8</span>
      <span className="mono truncate flex-1" style={{ opacity: 0.7 }}>
        {tab.path}
      </span>
      {tab.archiveRef && (
        <span style={{ color: "var(--accent)" }}>压缩包内文件 · 保存即回写</span>
      )}
      {tab.dirty && <span style={{ color: "var(--accent)" }}>● 未保存</span>}
    </div>
  );
}
