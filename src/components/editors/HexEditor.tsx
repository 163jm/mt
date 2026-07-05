import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import type { EditorTab } from "@/types";
import { useStore } from "@/store/useStore";

const ROW = 16;
const PAGE_ROWS = 32;
const PAGE_BYTES = ROW * PAGE_ROWS;

export default function HexEditor({ tab }: { tab: EditorTab }) {
  const saveTab = useStore((s) => s.saveTab);
  const markDirty = useStore((s) => s.markDirty);
  const data = tab.bytes || new Uint8Array();
  const [page, setPage] = useState(0);
  const [goto, setGoto] = useState("");
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_BYTES));

  const startByte = page * PAGE_BYTES;
  const endByte = Math.min(total, startByte + PAGE_BYTES);
  const rows = useMemo(() => {
    const r: { offset: number; bytes: number[] }[] = [];
    for (let off = startByte; off < endByte; off += ROW) {
      const bytes: number[] = [];
      for (let i = 0; i < ROW; i++) {
        if (off + i < total) bytes.push(data[off + i]);
        else bytes.push(-1);
      }
      r.push({ offset: off, bytes });
    }
    return r;
  }, [page, tab.id, total]);

  const setByte = (offset: number, value: number) => {
    if (!tab.bytes) return;
    tab.bytes[offset] = value & 0xff;
    markDirty(tab.id, true);
  };

  const doGoto = () => {
    const n = parseInt(goto, goto.toLowerCase().startsWith("0x") ? 16 : 10);
    if (!isNaN(n)) {
      const p = Math.floor(n / PAGE_BYTES);
      setPage(Math.min(pages - 1, Math.max(0, p)));
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* 工具条 */}
      <div className="flex items-center gap-2 px-3 h-9 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--panel-2)" }}>
        <span className="text-xs" style={{ color: "var(--muted)" }}>偏移</span>
        <input
          className="input mono"
          style={{ width: 120 }}
          value={goto}
          onChange={(e) => setGoto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doGoto()}
          placeholder="0x 或十进制"
        />
        <button className="icon-btn" title="跳转" onClick={doGoto}>
          <ChevronRight size={14} />
        </button>
        <div className="divider-v" />
        <button className="icon-btn" title="上一页" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs mono" style={{ color: "var(--muted)" }}>
          {page + 1} / {pages}
        </span>
        <button className="icon-btn" title="下一页" onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1}>
          <ChevronRight size={14} />
        </button>
        <div className="flex-1" />
        <span className="text-xs mono" style={{ color: "var(--muted)" }}>
          0x{startByte.toString(16).toUpperCase().padStart(8, "0")} – 0x{endByte.toString(16).toUpperCase().padStart(8, "0")} / {total} 字节
        </span>
        <button className="icon-btn" title="保存 (Ctrl+S)" onClick={() => saveTab(tab.id)} disabled={!tab.dirty}>
          <Save size={14} />
        </button>
      </div>

      {/* HEX 网格 */}
      <div className="flex-1 overflow-auto hex-grid p-2 selectable">
        {rows.map((row) => (
          <div key={row.offset} className="flex items-center" style={{ height: 20 }}>
            <span className="mono" style={{ color: "var(--muted)", width: 100, flexShrink: 0 }}>
              {row.offset.toString(16).toUpperCase().padStart(8, "0")}
            </span>
            <div className="flex" style={{ flexShrink: 0 }}>
              {row.bytes.map((b, i) =>
                b < 0 ? (
                  <span key={i} className="hex-cell" style={{ color: "var(--muted)" }}>··</span>
                ) : (
                  <HexCell key={i} value={b} onChange={(v) => setByte(row.offset + i, v)} />
                )
              )}
            </div>
            <span className="mono ml-4" style={{ color: "var(--fg)", opacity: 0.85 }}>
              {row.bytes.map((b) => (b < 0 ? " " : b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HexCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        className="hex-cell byte"
        style={{
          width: 22,
          height: 18,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          border: "1px solid var(--accent)",
          textAlign: "center",
          fontSize: 12,
          fontFamily: "inherit",
        }}
        value={val}
        onChange={(e) => setVal(e.target.value.slice(0, 2))}
        onBlur={() => {
          const n = parseInt(val, 16);
          if (!isNaN(n)) onChange(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = parseInt(val, 16);
            if (!isNaN(n)) onChange(n);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="hex-cell byte"
      style={{ color: value === 0 ? "var(--muted)" : "var(--fg)" }}
      onClick={() => {
        setVal(value.toString(16).toUpperCase().padStart(2, "0"));
        setEditing(true);
      }}
      title="点击编辑"
    >
      {value.toString(16).toUpperCase().padStart(2, "0")}
    </span>
  );
}
