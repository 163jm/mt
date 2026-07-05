import { useEffect, useState } from "react";
import {
  FolderOpen, Pencil, Binary, Copy, Scissors, Edit3, Download,
  Star, Trash2, FileText, Eye,
} from "lucide-react";

export interface MenuItem {
  label?: string;
  icon?: string;
  danger?: boolean;
  onClick?: () => void;
  sep?: boolean;
}

let current: { x: number; y: number; items: MenuItem[] } | null = null;
let listeners: Array<(v: typeof current) => void> = [];

export function openContextMenu(x: number, y: number, items: MenuItem[]) {
  current = { x, y, items };
  for (const l of listeners) l(current);
}

const ICONS: Record<string, any> = {
  open: FolderOpen, edit: Pencil, hex: Binary, copy: Copy, move: Scissors,
  rename: Edit3, extract: Download, star: Star, delete: Trash2, view: Eye, text: FileText,
};

export default function ContextMenuHost() {
  const [menu, setMenu] = useState(current);

  useEffect(() => {
    const l = (v: typeof current) => setMenu(v);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => {
      current = null;
      for (const l of listeners) l(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  if (!menu) return null;

  // 边界调整
  const w = 200;
  const h = menu.items.length * 30 + 10;
  const x = Math.min(menu.x, window.innerWidth - w - 4);
  const y = Math.min(menu.y, window.innerHeight - h - 4);

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) =>
        it.sep ? (
          <div key={i} className="context-menu-sep" />
        ) : (
          <div
            key={i}
            className={`context-menu-item ${it.danger ? "danger" : ""}`}
            onClick={() => {
              current = null;
              for (const l of listeners) l(null);
              it.onClick?.();
            }}
          >
            {it.icon && ICONS[it.icon] && (() => {
              const Ic = ICONS[it.icon];
              return <Ic size={14} />;
            })()}
            <span>{it.label}</span>
          </div>
        )
      )}
    </div>
  );
}
