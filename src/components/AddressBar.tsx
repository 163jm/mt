import { useEffect, useRef, useState } from "react";
import { ChevronRight, Pencil, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { PaneSide } from "@/types";
import { pathParts } from "@/utils/format";

export default function AddressBar({ side }: { side: PaneSide }) {
  const pane = useStore((s) => s.panes[side]);
  const navigate = useStore((s) => s.navigate);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setVal(pane.path);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const parts = pane.archivePath ? [] : pathParts(pane.path);

  const submit = () => {
    setEditing(false);
    if (val && val !== pane.path) navigate(side, val);
  };

  return (
    <div
      className="flex items-center gap-1 px-2 h-8 flex-shrink-0"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--border-soft)" }}
    >
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="input mono"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="输入路径…"
          />
          <button className="icon-btn" onClick={() => setEditing(false)} title="取消">
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {parts.length === 0 ? (
              <span className="crumb mono" onClick={() => setEditing(true)}>
                {pane.archivePath ? pane.archivePath : pane.path}
              </span>
            ) : (
              parts.map((p, i) => (
                <div key={p.path} className="flex items-center flex-shrink-0">
                  <span className="crumb" onClick={() => navigate(side, p.path)}>
                    {p.name}
                  </span>
                  {i < parts.length - 1 && <ChevronRight size={11} style={{ color: "var(--muted)" }} />}
                </div>
              ))
            )}
          </div>
          <button
            className="icon-btn"
            onClick={() => setEditing(true)}
            title="编辑地址"
            disabled={!!pane.archivePath}
          >
            <Pencil size={13} />
          </button>
        </>
      )}
    </div>
  );
}
