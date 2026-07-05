import { useState } from "react";
import { X, Search, FileSearch, ScanText, Regex, CaseSensitive, Binary, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/invoke";
import type { ContentHit, SearchHit } from "@/types";
import { formatSize, formatDate, dirname } from "@/utils/format";
import { getTypeInfo } from "@/utils/fileTypes";

type Mode = "name" | "content";

export default function SearchPanel() {
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const activePane = useStore((s) => s.activePane);
  const pane = useStore((s) => s.panes[activePane]);
  const navigate = useStore((s) => s.navigate);
  const openEditorForPath = useStore((s) => s.openEditorForPath);
  const toast = useStore((s) => s.toast);

  const [mode, setMode] = useState<Mode>("name");
  const [root, setRoot] = useState("");
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isHex, setIsHex] = useState(false);
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const [exts, setExts] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameHits, setNameHits] = useState<SearchHit[]>([]);
  const [contentHits, setContentHits] = useState<ContentHit[]>([]);

  if (!open) return null;

  const effectiveRoot = root || dirname(pane.path) || pane.path;

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      if (mode === "name") {
        const opts: api.NameSearchOpts = {
          regex,
          caseSensitive,
          sizeMin: sizeMin ? parseSize(sizeMin) : undefined,
          sizeMax: sizeMax ? parseSize(sizeMax) : undefined,
          dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
          dateTo: dateTo ? new Date(dateTo).getTime() + 86400000 : undefined,
          exts: exts ? exts.split(",").map((e) => e.trim().replace(/^\./, "").toLowerCase()).filter(Boolean) : undefined,
          maxResults: 1000,
        };
        const hits = await api.searchName(effectiveRoot, query, opts);
        setNameHits(hits);
        toast(`找到 ${hits.length} 个匹配`, "success");
      } else {
        const opts: api.ContentSearchOpts = { isHex, caseSensitive, maxResults: 300 };
        const hits = await api.searchContent(effectiveRoot, query, opts);
        setContentHits(hits);
        toast(`找到 ${hits.length} 个命中`, "success");
      }
    } catch (e) {
      toast(`搜索失败: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const openNameHit = (h: SearchHit) => {
    if (h.isDir) {
      navigate(activePane, h.path);
      setOpen(false);
    } else {
      openEditorForPath(h.path, "text");
    }
  };

  const openContentHit = async (h: ContentHit) => {
    await openEditorForPath(h.path, "text");
    setOpen(false);
  };

  const parseSize = (s: string): number => {
    const m = s.trim().match(/^([\d.]+)\s*([kmgt]?b?)$/i);
    if (!m) return parseInt(s) || 0;
    const n = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const mult = unit.startsWith("k") ? 1024 : unit.startsWith("m") ? 1024 ** 2 : unit.startsWith("g") ? 1024 ** 3 : unit.startsWith("t") ? 1024 ** 4 : 1;
    return Math.floor(n * mult);
  };

  return (
    <div className="modal-mask" onMouseDown={() => setOpen(false)}>
      <div
        className="modal"
        style={{ width: 760, maxWidth: "92vw", height: 600, maxHeight: "88vh", display: "flex", flexDirection: "column" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 px-4 h-11 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search size={16} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">搜索</span>
          {/* 模式切换 */}
          <div className="flex items-center gap-1 ml-3" style={{ background: "var(--panel-2)", borderRadius: 6, padding: 2 }}>
            <ModeBtn active={mode === "name"} onClick={() => setMode("name")} icon={FileSearch} label="文件名" />
            <ModeBtn active={mode === "content"} onClick={() => setMode("content")} icon={ScanText} label="内容" />
          </div>
          <div className="flex-1" />
          <button className="icon-btn" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* 搜索条件 */}
        <div className="p-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="flex items-center gap-2 mb-2">
            <input
              className="input"
              placeholder={mode === "name" ? "文件名(支持 * ? 通配符)" : isHex ? "HEX 字节序列,如 89504E47" : "搜索文本…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              autoFocus
            />
            <button className="btn primary" onClick={run} disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              搜索
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="input mono"
              style={{ width: 280 }}
              placeholder="搜索根目录(默认当前目录)"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
            />
            <Toggle active={regex} onClick={() => setRegex(!regex)} icon={Regex} label="正则" disabled={mode === "content"} />
            <Toggle active={caseSensitive} onClick={() => setCaseSensitive(!caseSensitive)} icon={CaseSensitive} label="区分大小写" />
            <Toggle active={isHex} onClick={() => setIsHex(!isHex)} icon={Binary} label="HEX" disabled={mode === "name"} />
          </div>
          {mode === "name" && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-xs" style={{ color: "var(--muted)" }}>大小:</span>
              <input className="input mono" style={{ width: 90 }} placeholder="最小" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} />
              <span style={{ color: "var(--muted)" }}>–</span>
              <input className="input mono" style={{ width: 90 }} placeholder="最大" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>日期:</span>
              <input type="date" className="input mono" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span style={{ color: "var(--muted)" }}>–</span>
              <input type="date" className="input mono" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>扩展名:</span>
              <input className="input mono" style={{ width: 140 }} placeholder="js,ts,tsx" value={exts} onChange={(e) => setExts(e.target.value)} />
            </div>
          )}
        </div>

        {/* 结果 */}
        <div className="flex-1 overflow-auto min-h-0">
          {mode === "name" ? (
            <table className="file-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th style={{ width: 220 }}>路径</th>
                  <th style={{ width: 80 }}>大小</th>
                  <th style={{ width: 120 }}>修改时间</th>
                </tr>
              </thead>
              <tbody>
                {nameHits.map((h, i) => {
                  const info = getTypeInfo(h.name);
                  return (
                    <tr key={i} className="file-row" onDoubleClick={() => openNameHit(h)}>
                      <td>
                        <span style={{ color: h.isDir ? "var(--accent-2)" : info.color }}>{h.name}</span>
                      </td>
                      <td className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{dirname(h.path)}</td>
                      <td className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{h.isDir ? "" : formatSize(h.size)}</td>
                      <td className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{formatDate(h.modified)}</td>
                    </tr>
                  );
                })}
                {nameHits.length === 0 && (
                  <tr><td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: 30 }}>
                    {loading ? "搜索中…" : "输入条件开始搜索"}
                  </td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="p-2">
              {contentHits.map((h, i) => (
                <div
                  key={i}
                  className="p-2 rounded cursor-pointer mb-1"
                  style={{ background: "var(--panel-2)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                  onDoubleClick={() => openContentHit(h)}
                >
                  <div className="text-xs mono truncate" style={{ color: "var(--accent)" }}>
                    {h.path}
                    <span style={{ color: "var(--muted)" }}> : {h.line}:{h.column}</span>
                  </div>
                  <div className="text-xs mono mt-1" style={{ color: "var(--fg)", background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}>
                    {h.preview}
                  </div>
                </div>
              ))}
              {contentHits.length === 0 && (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 30 }}>
                  {loading ? "搜索中…" : "输入内容开始搜索"}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="statusbar flex-shrink-0">
          <span>根目录: {effectiveRoot}</span>
          <span>结果: {mode === "name" ? nameHits.length : contentHits.length}</span>
          <span style={{ color: "var(--muted)" }}>双击结果打开</span>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#16191f" : "var(--muted)",
        fontWeight: active ? 600 : 400,
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function Toggle({ active, onClick, icon: Icon, label, disabled }: any) {
  return (
    <button
      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
      style={{
        background: active ? "var(--accent-soft)" : "var(--panel-2)",
        color: active ? "var(--accent)" : "var(--muted)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      title={label}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
