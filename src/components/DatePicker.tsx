import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarIcon, ChevronIcon } from "./Icons";

interface Props {
  /** `YYYY-MM-DD` or empty string. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}

const WEEK_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Themed date picker. Replaces <input type="date">, whose click-to-select-field
 * behaviour (grabbing the year segment on focus) can't be suppressed.
 */
export default function DatePicker({ value, onChange, placeholder, compact }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const [month, setMonth] = useState<Dayjs>(() =>
    (value ? dayjs(value) : dayjs()).startOf("month")
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Re-sync the visible month whenever the value changes from outside.
  useEffect(() => {
    if (open) setMonth((value ? dayjs(value) : dayjs()).startOf("month"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      // Keep the 236px panel inside the viewport even near the right edge.
      setAnchor({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 244)),
        top: rect.bottom + 4,
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const cells = useMemo(() => {
    const start = month.startOf("month");
    const offset = (start.day() + 6) % 7; // Monday-first
    const days = month.daysInMonth();
    const list: (Dayjs | null)[] = Array.from({ length: offset }, () => null);
    for (let i = 0; i < days; i += 1) list.push(start.add(i, "day"));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [month]);

  const weekLabels = i18n.language === "zh-CN" ? WEEK_ZH : WEEK_EN;
  const today = dayjs().format("YYYY-MM-DD");
  const title =
    i18n.language === "zh-CN"
      ? `${month.year()} 年 ${month.month() + 1} 月`
      : month.format("MMM YYYY");

  const pick = (day: Dayjs) => {
    onChange(day.format("YYYY-MM-DD"));
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`no-drag flex w-full items-center gap-1.5 rounded-lg border px-2 transition-colors ${
          compact ? "py-1 text-[11px]" : "py-1.5 text-[11px]"
        }`}
        style={{
          borderColor: open ? "var(--accent)" : "var(--border)",
          background: "var(--surface)",
          color: value ? "var(--text)" : "var(--text-faint)",
        }}
        onClick={toggle}
      >
        <span className="shrink-0" style={{ color: "var(--text-faint)" }}>
          <CalendarIcon />
        </span>
        <span className="min-w-0 flex-1 truncate text-left tabular-nums">
          {value || placeholder || t("date.pick")}
        </span>
        {value && (
          <span
            className="shrink-0 px-0.5 transition-colors hover:text-red-500"
            style={{ color: "var(--text-faint)" }}
            title={t("common.clear")}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            ✕
          </span>
        )}
      </button>

      {/* Rendered into <body>: the dialog body scrolls, which would clip an
          absolutely-positioned panel. */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.13 }}
              className="no-drag w-[236px] rounded-lg border p-2"
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                zIndex: 200,
                background: "var(--surface)",
                borderColor: "var(--border)",
                boxShadow: "0 10px 28px rgba(15, 23, 42, 0.16)",
              }}
            >
            <div className="mb-1.5 flex items-center justify-between">
              <button
                type="button"
                className="rounded p-1 transition-colors hover:bg-black/[0.06]"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setMonth(month.subtract(1, "month"))}
              >
                <ChevronIcon dir="left" />
              </button>
              <span className="text-[11px] font-medium" style={{ color: "var(--text)" }}>
                {title}
              </span>
              <button
                type="button"
                className="rounded p-1 transition-colors hover:bg-black/[0.06]"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setMonth(month.add(1, "month"))}
              >
                <ChevronIcon dir="right" />
              </button>
            </div>

            <div className="mb-0.5 grid grid-cols-7 gap-0.5">
              {weekLabels.map((label) => (
                <span
                  key={label}
                  className="py-0.5 text-center text-[10px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} />;
                const key = day.format("YYYY-MM-DD");
                const selected = key === value;
                const isToday = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    className="rounded-md py-1 text-center text-[11px] tabular-nums transition-colors"
                    style={{
                      background: selected ? "var(--accent)" : "transparent",
                      color: selected
                        ? "#fff"
                        : isToday
                          ? "var(--accent-text)"
                          : "var(--text)",
                      boxShadow: !selected && isToday ? "inset 0 0 0 1px var(--accent)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) e.currentTarget.style.background = "transparent";
                    }}
                    onClick={() => pick(day)}
                  >
                    {day.date()}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-1.5 flex items-center justify-between border-t pt-1.5"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-black/[0.06]"
                style={{ color: "var(--accent-text)" }}
                onClick={() => pick(dayjs())}
              >
                {t("common.today")}
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-black/[0.06]"
                style={{ color: "var(--text-muted)" }}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {t("common.clear")}
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
