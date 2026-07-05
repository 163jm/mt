import { useState } from "react";
import { Star, HardDrive, Plus, ChevronDown, ChevronRight, Folder, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/invoke";
import type { DriveInfo } from "@/types";
import { useEffect } from "react";
import { basename } from "@/utils/format";

export default function BookmarkSidebar() {
  const [open, setOpen] = useState(true);
  const bookmarks = useStore((s) => s.bookmarks);
  const activePane = useStore((s) => s.activePane);
  const navigate = useStore((s) => s.navigate);
  const addBookmark = useStore((s) => s.addBookmark);
  const removeBookmark = useStore((s) => s.removeBookmark);
  const pane = useStore((s) => s.panes[activePane]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.drives().then(setDrives).catch(() => setDrives([]));
  }, []);

  const groups = bookmarks.reduce<Record<string, typeof bookmarks>>((acc, b) => {
    (acc[b.group] = acc[b.group] || []).push(b);
    return acc;
  }, {});

  const addCurrent = () => {
    if (pane.archivePath) return;
    const name = basename(pane.path) || pane.path;
    addBookmark({ name, path: pane.path, group: "常用" });
  };

  const SidebarIcon = open ? PanelLeftIcon : PanelRightIcon;

  return (
    <div
      className="flex flex-col border-r flex-shrink-0 transition-all"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
        width: open ? 184 : 38,
      }}
    >
      <div className="flex items-center h-9 px-1.5 gap-1" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <button
          className="icon-btn"
          title={open ? "收起侧栏" : "展开侧栏"}
          onClick={() => setOpen(!open)}
        >
          {open ? <PanelLeftIcon /> : <PanelRightIcon />}
        </button>
        {open && (
          <>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              收藏夹
            </span>
            <div className="flex-1" />
            <button
              className="icon-btn"
              title="收藏当前路径 (Ctrl+D)"
              onClick={addCurrent}
              disabled={!!pane.archivePath}
            >
              <Plus size={14} />
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="flex-1 overflow-y-auto py-1.5">
          {/* 收藏分组 */}
          {Object.entries(groups).map(([group, list]) => {
            const isCol = collapsed[group];
            return (
              <div key={group} className="mb-1">
                <div
                  className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer"
                  style={{ color: "var(--muted)" }}
                  onClick={() => setCollapsed({ ...collapsed, [group]: !isCol })}
                >
                  {isCol ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="uppercase tracking-wide">{group}</span>
                </div>
                {!isCol &&
                  list.map((b) => (
                    <div
                      key={b.path}
                      className="group flex items-center gap-1.5 px-2 py-1 mx-1 rounded cursor-pointer text-xs"
                      style={{ color: "var(--fg)" }}
                      title={b.path}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      onClick={() => navigate(activePane, b.path)}
                    >
                      <Star size={12} style={{ color: "var(--accent)" }} />
                      <span className="truncate flex-1">{b.name}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 icon-btn"
                        style={{ width: 16, height: 16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(b.path);
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
              </div>
            );
          })}

          {/* 盘符 */}
          <div className="mt-2">
            <div className="flex items-center gap-1 px-2 py-1 text-xs" style={{ color: "var(--muted)" }}>
              <HardDrive size={12} />
              <span className="uppercase tracking-wide">本机</span>
            </div>
            {drives.map((d) => (
              <div
                key={d.letter}
                className="flex items-center gap-1.5 px-2 py-1 mx-1 rounded cursor-pointer text-xs"
                title={`${d.name}  可用 ${formatFree(d.free)}`}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                onClick={() => navigate(activePane, d.letter)}
              >
                <Folder size={12} style={{ color: "var(--accent-2)" }} />
                <span className="flex-1 truncate">{d.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{formatFree(d.free)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFree(b: number): string {
  if (!b) return "";
  if (b >= 1 << 30) return `${(b / (1 << 30)).toFixed(0)}GB`;
  if (b >= 1 << 20) return `${(b / (1 << 20)).toFixed(0)}MB`;
  return `${b}B`;
}

function PanelLeftIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
function PanelRightIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}
