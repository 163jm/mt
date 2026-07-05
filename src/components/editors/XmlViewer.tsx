import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { EditorTab } from "@/types";

export default function XmlViewer({ tab }: { tab: EditorTab }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const doc = useMemo(() => {
    try {
      const parser = new DOMParser();
      return parser.parseFromString(tab.text || "<root/>", "application/xml");
    } catch {
      return null;
    }
  }, [tab.text]);

  const parseError = doc?.getElementsByTagName("parsererror").length;

  if (parseError) {
    return (
      <div className="h-full flex items-center justify-center p-6" style={{ color: "var(--danger)" }}>
        <span className="text-sm">XML 解析失败</span>
      </div>
    );
  }

  const root = doc?.documentElement;
  if (!root) return null;

  const toggle = (id: string) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 px-3 h-9 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--panel-2)" }}>
        <span className="text-xs" style={{ color: "var(--accent)" }}>● 有效 XML</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>根元素: {root.tagName}</span>
      </div>
      <div className="flex-1 overflow-auto p-2 selectable">
        <XmlNode node={root} depth={0} openMap={openMap} toggle={toggle} path={root.tagName} />
      </div>
    </div>
  );
}

function XmlNode({
  node, depth, openMap, toggle, path,
}: {
  node: Element; depth: number; openMap: Record<string, boolean>; toggle: (id: string) => void; path: string;
}) {
  const children = Array.from(node.children);
  const hasChildren = children.length > 0;
  const attrs = Array.from(node.attributes);
  const text = node.textContent?.trim() || "";
  const isOpen = openMap[path] ?? depth < 2;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-row-hover rounded px-1"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button className="icon-btn" style={{ width: 14, height: 14 }} onClick={() => toggle(path)}>
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}
        <span className="mono text-xs" style={{ color: "#e37933" }}>&lt;{node.tagName}</span>
        {attrs.map((a) => (
          <span key={a.name} className="mono text-xs" style={{ color: "var(--accent)" }}>
            {" "}{a.name}=<span style={{ color: "#3dd6c4" }}>"{a.value}"</span>
          </span>
        ))}
        <span className="mono text-xs" style={{ color: "#e37933" }}>{hasChildren ? ">" : `>${text}</${node.tagName}>`}</span>
      </div>
      {hasChildren && isOpen && children.map((c, i) => (
        <XmlNode key={i} node={c} depth={depth + 1} openMap={openMap} toggle={toggle} path={`${path}.${c.tagName}[${i}]`} />
      ))}
      {hasChildren && isOpen && (
        <div style={{ paddingLeft: depth * 16 + 14 }}>
          <span className="mono text-xs" style={{ color: "#e37933" }}>&lt;/{node.tagName}&gt;</span>
        </div>
      )}
    </div>
  );
}
