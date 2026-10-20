import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Theme-aware confirmation dialog (replaces window.confirm). */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.16, ease: [0.34, 1.3, 0.64, 1] }}
          className="no-drag w-[360px] overflow-hidden rounded-xl shadow-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 px-4 pt-4">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{
                background: danger ? "rgba(239,68,68,0.12)" : "var(--accent-soft)",
                color: danger ? "#ef4444" : "var(--accent-text)",
              }}
            >
              {danger ? "!" : "?"}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {title}
              </h3>
              {message && (
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {message}
                </p>
              )}
            </div>
          </div>

          <div
            className="mt-4 flex justify-end gap-2 border-t px-4 py-2.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <button
              className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}
              onClick={onCancel}
            >
              {t("common.cancel")}
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-white shadow-sm"
              style={{ background: danger ? "#ef4444" : "var(--accent)" }}
              onClick={onConfirm}
            >
              {confirmLabel ?? t("common.confirm")}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
