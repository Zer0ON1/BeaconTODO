import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Group } from "../types";

interface Props {
  groups: Group[];
  value: string;
  onChange: (groupId: string) => void;
  countOf?: (groupId: string) => number;
  /** Compact variant for the pin window dialog. */
  compact?: boolean;
}

/**
 * Theme-aware group picker — replaces the native <select>, which cannot be
 * styled consistently across platforms (#6).
 */
export default function GroupSelect({ groups, value, onChange, countOf, compact }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = groups.find((group) => group.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dot = (color: string) => (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color || "var(--accent)" }}
    />
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`no-drag flex w-full items-center gap-2 rounded-lg border px-2 transition-colors ${
          compact ? "py-1 text-[11px]" : "py-1.5 text-xs"
        }`}
        style={{
          borderColor: open ? "var(--accent)" : "var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? dot(selected.color) : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--border-strong)" }} />}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.name ?? t("group.title")}
        </span>
        {selected && countOf && (
          <span className="shrink-0 tabular-nums" style={{ color: "var(--text-faint)" }}>
            {countOf(selected.id)}
          </span>
        )}
        <span
          className="shrink-0 text-[9px] transition-transform"
          style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="no-drag absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border p-1"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
            }}
          >
            {groups.map((group) => {
              const active = group.id === value;
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    compact ? "text-[11px]" : "text-xs"
                  }`}
                  style={{
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => {
                    onChange(group.id);
                    setOpen(false);
                  }}
                >
                  {dot(group.color)}
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  {countOf && (
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--text-faint)" }}>
                      {countOf(group.id)}
                    </span>
                  )}
                  {active && <span className="shrink-0 text-[10px]">✓</span>}
                </button>
              );
            })}
            {groups.length === 0 && (
              <p className="px-2 py-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                {t("common.empty")}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
