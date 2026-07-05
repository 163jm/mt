import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-8 right-4 z-[950] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm shadow-lg"
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            boxShadow: "var(--shadow)",
            animation: "toastIn 0.18s ease-out",
          }}
        >
          {t.kind === "success" ? (
            <CheckCircle2 size={15} style={{ color: "var(--accent-2)" }} />
          ) : t.kind === "error" ? (
            <XCircle size={15} style={{ color: "var(--danger)" }} />
          ) : (
            <Info size={15} style={{ color: "var(--accent)" }} />
          )}
          <span style={{ maxWidth: 380 }}>{t.msg}</span>
          <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => dismiss(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
