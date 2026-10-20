import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import type { Group, Todo } from "../types";
import { PRIORITY_COLORS, PRIORITY_I18N, columnOf, isOverdue } from "../lib/visual";
import { useAppStore } from "../store/appStore";
import { PinIcon } from "./Icons";

interface Props {
  todo: Todo;
  group?: Group;
}

export default function TodoCard({ todo, group }: Props) {
  const { t } = useTranslation();
  const { openEditor, openPin, setTodoStatus, setNodeCompleted, loadNodes, pinnedTodoIds } =
    useAppStore();
  const nodes = useAppStore((s) => s.nodesByTodo[todo.id]);
  const [expanded, setExpanded] = useState(false);

  const total = nodes?.length ?? 0;
  const done = nodes?.filter((n) => n.status === "completed").length ?? 0;
  const milestones = nodes?.filter((n) => n.isMilestone) ?? [];
  const msDone = milestones.filter((n) => n.status === "completed").length;
  const pinned = pinnedTodoIds.includes(todo.id);
  const priorityColor = PRIORITY_COLORS[todo.priority as 0 | 1 | 2 | 3];
  const overdue = isOverdue(todo);

  // Clicking the card expands its node list instead of jumping into the editor.
  const toggleExpanded = () => {
    if (!expanded) void loadNodes(todo.id);
    setExpanded((v) => !v);
  };

  return (
    <motion.article
      layout
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className="cursor-pointer rounded-xl border p-3 shadow-sm"
      style={{
        background: "var(--surface)",
        borderColor: overdue ? "#ef4444" : "var(--border)",
        opacity: todo.status === "completed" ? 0.65 : 1,
      }}
      onClick={toggleExpanded}
    >
      <header className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: priorityColor }}
        >
          {t(PRIORITY_I18N[todo.priority as 0 | 1 | 2 | 3])}
        </span>
        {group && (
          <span className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
            {group.name}
          </span>
        )}
        {pinned && (
          <span className="text-[11px]" style={{ color: "var(--accent)" }} title={t("todo.pinned")}>
            <PinIcon />
          </span>
        )}
        {overdue && (
          <span className="ml-auto text-[11px] text-red-500">{t("calendar.overdue")}</span>
        )}
        <span
          className="ml-auto shrink-0 text-[10px] transition-transform"
          style={{
            color: "var(--text-faint)",
            transform: expanded ? "rotate(90deg)" : "none",
            marginLeft: overdue ? 6 : "auto",
          }}
        >
          ▸
        </span>
      </header>

      <h3 className="mt-1.5 text-sm font-medium" style={{ color: "var(--text)" }}>
        {todo.title}
      </h3>

      {todo.endDate && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
          {todo.startDate ? `${todo.startDate} ~ ` : ""}
          {t("node.end")} {todo.endDate}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              backgroundColor: todo.status === "completed" ? "#639922" : priorityColor,
            }}
          />
        </div>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-faint)" }}
          title={t("todo.subtasks", { done, total })}
        >
          {total > 0 ? `${Math.round((done / total) * 100)}%` : "—"}
        </span>
        {milestones.length > 0 && (
          <span
            className="shrink-0 text-[11px] tabular-nums"
            style={{ color: "var(--accent-text)" }}
            title={t("todo.milestoneProgress", { done: msDone, total: milestones.length })}
          >
            ◆ {msDone}/{milestones.length}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              {total === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {t("common.empty")}
                </p>
              ) : (
                nodes!.map((node) => (
                  <label
                    key={node.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-black/5"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 shrink-0 accent-[color:var(--accent)]"
                      checked={node.status === "completed"}
                      onChange={(e) => void setNodeCompleted(node.id, e.target.checked)}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-[11px] ${
                        node.status === "completed" ? "line-through" : ""
                      }`}
                      style={{
                        color:
                          node.status === "completed"
                            ? "var(--text-faint)"
                            : node.isMilestone
                              ? "var(--accent-text)"
                              : "var(--text)",
                      }}
                    >
                      {node.isMilestone ? "◆ " : ""}
                      {node.title}
                    </span>
                  </label>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-2 flex items-center gap-2.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
        <button
          className="transition-colors hover:text-green-600"
          onClick={(e) => {
            e.stopPropagation();
            void setTodoStatus(todo.id, todo.status === "completed" ? "inProgress" : "completed");
          }}
        >
          ✓ {t("common.complete")}
        </button>
        <button
          className="transition-colors hover:text-[color:var(--accent)]"
          onClick={(e) => {
            e.stopPropagation();
            openEditor(todo.id);
          }}
        >
          {t("common.edit")}
        </button>
        <button
          className="flex items-center gap-0.5 transition-colors hover:text-amber-500"
          onClick={(e) => {
            e.stopPropagation();
            void openPin([todo.id]);
          }}
        >
          <PinIcon />
          {t("todo.pinSingle")}
        </button>
        <span className="ml-auto">
          {t(
            `status.${
              todo.status === "completed"
                ? "completed"
                : columnOf(todo) === "overdue"
                  ? "overdue"
                  : todo.status
            }`
          )}
        </span>
      </footer>
    </motion.article>
  );
}
