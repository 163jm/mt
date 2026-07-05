import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import type { EditorTab } from "@/types";
import { useStore } from "@/store/useStore";

type Node = { key: string; value: any; path: string; type: string };

export default function JsonViewer({ tab }: { tab: EditorTab }) {
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState("");

  const { parsed, error } = useMemo(() => {
    try {
      return { parsed: JSON.parse(tab.text || "null"), error: null as string | null };
    } catch (e) {
      return { parsed: null, error: String(e) };
    }
  }, [tab.text]);

  const formatSize = (v: any): string => {
    if (Array.isArray(v)) return `${v.length} 项`;
    if (v && typeof v === "object") return `${Object.keys(v).length} 字段`;
    return "";
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" style={{ color: "var(--danger)" }}>
        <div className="text-sm font-semibold mb-2">JSON 解析失败</div>
        <pre className="text-xs mono" style={{ color: "var(--muted)", whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 px-3 h-9 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--panel-2)" }}>
        <span className="text-xs" style={{ color: "var(--accent)" }}>● 有效 JSON</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{formatSize(parsed)}</span>
        <div className="flex-1" />
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
              setCopied("ok"); toast("已复制格式化 JSON", "success");
              setTimeout(() => setCopied(""), 1200);
            } catch { toast("复制失败", "error"); }
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          格式化复制
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 selectable">
        <JsonNode k="根" value={parsed} path="$" depth={0} />
      </div>
    </div>
  );
}

const TYPE_COLOR: Record<string, string> = {
  string: "#3dd6c4", number: "#f0a020", boolean: "#e0556b", null: "var(--muted)",
  object: "var(--accent)", array: "var(--accent-2)",
};

function JsonNode({ k, value, path, depth }: { k: string; value: any; path: string; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const isContainer = type === "object" || type === "array";
  const entries = isContainer ? (type === "array" ? value.map((v: any, i: number) => [String(i), v]) : Object.entries(value)) : [];

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-row-hover rounded px-1"
        style={{ paddingLeft: depth * 16 }}
      >
        {isContainer ? (
          <button className="icon-btn" style={{ width: 14, height: 14 }} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}
        <span className="mono text-xs" style={{ color: "var(--fg)" }}>{k}</span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>:</span>
        {isContainer ? (
          <>
            <span className="text-xs mono" style={{ color: TYPE_COLOR[type] }}>
              {type === "array" ? `[${entries.length}]` : `{${entries.length}}`}
            </span>
            {!open && <span className="text-xs" style={{ color: "var(--muted)" }}>…</span>}
          </>
        ) : (
          <span className="text-xs mono ml-1" style={{ color: TYPE_COLOR[type] }}>
            {type === "string" ? `"${value}"` : String(value)}
          </span>
        )}
      </div>
      {isContainer && open && entries.map(([key, v]: any) => (
        <JsonNode key={key} k={String(key)} value={v} path={`${path}.${key}`} depth={depth + 1} />
      ))}
    </div>
  );
}
