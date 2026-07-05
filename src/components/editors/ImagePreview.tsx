import { useEffect, useMemo, useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize, RefreshCw } from "lucide-react";
import type { EditorTab } from "@/types";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
};

export default function ImagePreview({ tab }: { tab: EditorTab }) {
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const ext = tab.title.split(".").pop()?.toLowerCase() || "png";
  const mime = EXT_TO_MIME[ext] || "image/png";

  const url = useMemo(() => {
    if (!tab.bytes) return "";
    const blob = new Blob([tab.bytes as unknown as BlobPart], { type: mime });
    return URL.createObjectURL(blob);
  }, [tab.bytes, mime]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div
        className="flex items-center gap-1 px-3 h-9 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--panel-2)" }}
      >
        <button className="icon-btn" title="缩小" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}>
          <ZoomOut size={14} />
        </button>
        <span className="text-xs mono" style={{ color: "var(--muted)", width: 50, textAlign: "center" }}>
          {(zoom * 100).toFixed(0)}%
        </span>
        <button className="icon-btn" title="放大" onClick={() => setZoom((z) => Math.min(8, z + 0.1))}>
          <ZoomIn size={14} />
        </button>
        <button className="icon-btn" title="原始大小" onClick={() => setZoom(1)}>
          <Maximize size={14} />
        </button>
        <div className="divider-v" />
        <button className="icon-btn" title="左旋转" onClick={() => setRot((r) => r - 90)}>
          <RotateCcw size={14} />
        </button>
        <button className="icon-btn" title="右旋转" onClick={() => setRot((r) => r + 90)}>
          <RotateCw size={14} />
        </button>
        <button className="icon-btn" title="重置" onClick={() => { setZoom(1); setRot(0); }}>
          <RefreshCw size={14} />
        </button>
        <div className="flex-1" />
        <span className="text-xs mono" style={{ color: "var(--muted)" }}>
          {tab.bytes ? `${tab.bytes.length} 字节` : ""}
        </span>
      </div>
      <div
        className="flex-1 overflow-auto flex items-center justify-center"
        style={{
          background:
            "repeating-conic-gradient(var(--panel) 0% 25%, var(--panel-2) 0% 50%) 0 / 20px 20px",
        }}
      >
        {url && (
          <img
            src={url}
            alt={tab.title}
            style={{
              transform: `scale(${zoom}) rotate(${rot}deg)`,
              transformOrigin: "center",
              maxWidth: "none",
              transition: "transform 0.1s",
              imageRendering: zoom >= 2 ? "pixelated" : "auto",
            }}
          />
        )}
      </div>
    </div>
  );
}
