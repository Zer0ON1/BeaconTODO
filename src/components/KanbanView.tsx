import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { Todo } from "../types";
import { useAppStore } from "../store/appStore";
import { columnOf, type KanbanColumn } from "../lib/visual";
import TodoCard from "./TodoCard";

const COLUMNS: { key: KanbanColumn; i18n: string; color: string }[] = [
  { key: "notStarted", i18n: "status.notStarted", color: "#888780" },
  { key: "inProgress", i18n: "status.inProgress", color: "#378ADD" },
  { key: "overdue", i18n: "status.overdue", color: "#E24B4A" },
  { key: "completed", i18n: "status.completed", color: "#639922" },
];

export default function KanbanView() {
  const { t } = useTranslation();
  const { todos, groups, selectedGroupId, setTodoStatus } = useAppStore();
  const [dragOver, setDragOver] = useState<KanbanColumn | null>(null);
  const [confirming, setConfirming] = useState<{ todo: Todo; column: KanbanColumn } | null>(null);

  const visible = todos
    .filter((todo) => todo.status !== "archived")
    .filter((todo) => (selectedGroupId ? todo.groupId === selectedGroupId : true));

  const moveTo = (todo: Todo, column: KanbanColumn) => {
    if (column === "overdue") return; // date-derived, not draggable
    const target =
      column === "completed"
        ? todo.status === "completed"
          ? null
          : "completed"
        : column === "inProgress"
          ? "inProgress"
          : "notStarted";
    if (!target || target === todo.status) return;
    if (column === "completed") {
      setConfirming({ todo, column });
      return;
    }
    void setTodoStatus(todo.id, target);
  };

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {COLUMNS.map((column) => {
        const items = visible
          .filter((todo) => columnOf(todo) === column.key)
          .sort((a, b) => a.priority - b.priority || (a.endDate ?? "9").localeCompare(b.endDate ?? "9"));
        return (
          <section
            key={column.key}
            className="flex min-w-[190px] flex-1 flex-col rounded-xl transition-shadow"
            style={{
              background: "var(--surface-2)",
              boxShadow: dragOver === column.key ? "0 0 0 2px var(--accent)" : "none",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(column.key);
            }}
            onDragLeave={() => setDragOver((current) => (current === column.key ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("text/beacon-todo");
              const todo = todos.find((item) => item.id === id);
              if (todo) moveTo(todo, column.key);
            }}
          >
            <header className="flex items-center gap-2 px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{t(column.i18n)}</span>
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{items.length}</span>
              {column.key === "overdue" && (
                <span className="ml-auto text-[10px] text-slate-300" title={t("kanban.derived")}>
                  {t("kanban.derived")}
                </span>
              )}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
              {items.map((todo) => (
                <div
                  key={todo.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/beacon-todo", todo.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <TodoCard todo={todo} group={groups.find((g) => g.id === todo.groupId)} />
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>{t("kanban.empty")}</p>
              )}
            </div>
          </section>
        );
      })}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="no-drag w-72 rounded-xl p-4 shadow-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text)" }}>
              {t("common.confirm")}：{t("common.complete")}「{confirming.todo.title}」？
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>{t("pin.orderHint")}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1 text-xs" style={{ color: "var(--text-muted)" }}
                onClick={() => setConfirming(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="rounded bg-green-600 px-3 py-1 text-xs text-white"
                onClick={() => {
                  void setTodoStatus(confirming.todo.id, "completed");
                  setConfirming(null);
                }}
              >
                {t("common.confirm")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
