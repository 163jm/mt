import { useEffect, useState } from "react";

// 全局对话框管理 — 通过模块级状态 + Promise 暴露 confirm/prompt
type DialogSpec =
  | { kind: "confirm"; title: string; message: string; resolve: (v: boolean) => void }
  | { kind: "prompt"; title: string; message: string; defaultValue: string; resolve: (v: string | null) => void };

let listeners: Array<(d: DialogSpec | null) => void> = [];
let current: DialogSpec | null = null;

function emit() {
  for (const l of listeners) l(current);
}

export function confirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    current = { kind: "confirm", title, message, resolve };
    emit();
  });
}

export function promptDialog(
  title: string,
  message: string,
  defaultValue = ""
): Promise<string | null> {
  return new Promise((resolve) => {
    current = { kind: "prompt", title, message, defaultValue, resolve };
    emit();
  });
}

function close(result: any) {
  if (!current) return;
  const cur = current;
  current = null;
  emit();
  if (cur.kind === "confirm") cur.resolve(result as boolean);
  else cur.resolve(result as string | null);
}

export default function DialogHost() {
  const [spec, setSpec] = useState<DialogSpec | null>(current);
  const [val, setVal] = useState("");

  useEffect(() => {
    const l = (d: DialogSpec | null) => {
      setSpec(d);
      if (d && d.kind === "prompt") setVal(d.defaultValue);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (spec.kind === "confirm") close(false);
        else close(null);
      } else if (e.key === "Enter") {
        if (spec.kind === "confirm") close(true);
        else close(val);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec, val]);

  if (!spec) return null;

  return (
    <div className="modal-mask" onMouseDown={() => (spec.kind === "confirm" ? close(false) : close(null))}>
      <div className="modal" style={{ width: 380 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-4 pt-3 pb-1 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          {spec.title}
        </div>
        <div className="px-4 py-3">
          <div className="text-sm mb-3" style={{ color: "var(--muted)" }}>
            {spec.message}
          </div>
          {spec.kind === "prompt" && (
            <input
              autoFocus
              className="input"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onSelect={(e) => e.stopPropagation()}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button
            className="btn"
            onClick={() => (spec.kind === "confirm" ? close(false) : close(null))}
          >
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => (spec.kind === "confirm" ? close(true) : close(val))}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
