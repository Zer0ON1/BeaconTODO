import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import type { Group } from "../types";

interface Props {
  group: Group;
  todoCount: number;
  /** Where the todos move to when only the group is deleted. */
  migrateTarget: Group | null;
  onCancel: () => void;
  onMigrate: () => void;
  onCascade: () => void;
}

function OptionRow({
  title,
  hint,
  tone,
  disabled,
  onClick,
}: {
  title: string;
  hint: string;
  tone: "neutral" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const danger = tone === "danger";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        danger ? "hover:bg-red-500/5" : "hover:bg-black/[0.03]"
      }`}
      style={{
        borderColor: danger ? "rgba(239, 68, 68, 0.32)" : "var(--border)",
        background: "var(--surface)",
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-medium"
          style={{ color: danger ? "#ef4444" : "var(--text)" }}
        >
          {title}
        </span>
        {danger && (
          <span className="shrink-0 text-[10px]" style={{ color: "#ef4444" }}>
            {t("group.irreversible")}
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>
        {hint}
      </span>
    </button>
  );
}

/**
 * Deleting a group has two very different outcomes, so the choice lives in the
 * dialog as two explicit options instead of a window.confirm toggle (#delete).
 */
export default function DeleteGroupDialog({
  group,
  todoCount,
  migrateTarget,
  onCancel,
  onMigrate,
  onCascade,
}: Props) {
  const { t } = useTranslation();
  const empty = todoCount === 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <AnimatePresence>
      <motion.div
        className="no-drag fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
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
          className="w-[380px] overflow-hidden rounded-xl shadow-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3 px-4 pt-4">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}
            >
              !
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {t("group.deleteConfirmTitle")}
              </h3>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {empty
                  ? t("group.deleteEmpty", { name: group.name })
                  : t("group.deleteMessage", { name: group.name, count: todoCount })}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 px-4">
            <OptionRow
              title={t("group.optionMigrate")}
              hint={
                empty
                  ? t("group.optionMigrateHintEmpty")
                  : migrateTarget
                    ? t("group.optionMigrateHint", {
                        count: todoCount,
                        target: migrateTarget.name,
                      })
                    : t("group.noTargetHint")
              }
              tone="neutral"
              disabled={!empty && !migrateTarget}
              onClick={onMigrate}
            />
            <OptionRow
              title={t("group.optionCascade")}
              hint={
                empty
                  ? t("group.optionCascadeHintEmpty")
                  : t("group.optionCascadeHint", { count: todoCount })
              }
              tone="danger"
              onClick={onCascade}
            />
          </div>

          <div
            className="mt-3 flex justify-end border-t px-4 py-2.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <button
              className="rounded-lg px-3.5 py-1.5 text-xs transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}
              onClick={onCancel}
            >
              {t("common.cancel")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
