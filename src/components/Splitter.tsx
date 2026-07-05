import { useCallback, useRef } from "react";

interface SplitterProps {
  orientation: "vertical" | "horizontal";
  ratio: number;
  onResize: (r: number) => void;
}

/** 可拖拽分隔条。vertical = 左右分屏;horizontal = 上下分屏(编辑器) */
export default function Splitter({ orientation, ratio, onResize }: SplitterProps) {
  const dragging = useRef(false);
  const startRef = useRef(0);
  const startRatio = useRef(ratio);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startRef.current = orientation === "vertical" ? e.clientX : e.clientY;
      startRatio.current = ratio;
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const size = orientation === "vertical" ? parent.clientWidth : parent.clientHeight;
      const move = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const cur = orientation === "vertical" ? ev.clientX : ev.clientY;
        const delta = (cur - startRef.current) / size;
        onResize(Math.min(0.85, Math.max(0.15, startRatio.current + delta)));
      };
      const up = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        document.body.style.cursor = "";
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";
    },
    [orientation, ratio, onResize]
  );

  const isV = orientation === "vertical";
  return (
    <div
      ref={containerRef}
      onMouseDown={onDown}
      style={{
        width: isV ? 5 : "100%",
        height: isV ? "100%" : 5,
        cursor: isV ? "col-resize" : "row-resize",
        background: "var(--border)",
        flex: "0 0 auto",
        position: "relative",
      }}
      className="group hover:bg-accent transition-colors"
    >
      <div
        style={{
          position: "absolute",
          inset: isV ? "0 -3px" : "-3px 0",
        }}
      />
    </div>
  );
}
