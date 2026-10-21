import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import type { DraftNode, Priority, TodoStatus } from "../types";
import { useAppStore } from "../store/appStore";
import { PRIORITY_COLORS, PRIORITY_I18N } from "../lib/visual";
import TodoNodeList from "./TodoNodeList";
import ConfirmDialog from "./ConfirmDialog";
import GroupSelect from "./GroupSelect";
import DatePicker from "./DatePicker";

const PRIORITIES: Priority[] = [0, 1, 2, 3];
const STATUSES: TodoStatus[] = ["notStarted", "inProgress", "completed", "blocked"];

interface Props {
  mode: "create" | "edit";
  todoId?: string;
  onClose: () => void;
  /** Smaller layout used inside the always-on-top pin window. */
  compact?: boolean;
  /** Called after a successful save (used by the pin window to attach the todo). */
  onSaved?: (todoId: string) => void;
}

/**
 * One dialog for both creating and editing a todo (#1 #4 #5).
 * Everything is edited locally and committed on save, so cancel never leaves
 * half-written data behind.
 */
export default function TodoDialog({ mode, todoId, onClose, compact, onSaved }: Props) {
  const { t } = useTranslation();
  const { todos, groups, nodesByTodo, loadNodes, saveTodoDialog, deleteTodo } = useAppStore();

  const isEdit = mode === "edit";
  const todo = useMemo(
    () => (isEdit && todoId ? todos.find((item) => item.id === todoId) ?? null : null),
    [isEdit, todoId, todos]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [status, setStatus] = useState<TodoStatus>("notStarted");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ready, setReady] = useState(!isEdit);

  // Seed the form from the existing todo (edit mode).
  useEffect(() => {
    if (!isEdit || !todoId) return;
    void loadNodes(todoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, todoId]);

  useEffect(() => {
    if (!isEdit) {
      const fallback = useAppStore.getState();
      setGroupId(fallback.selectedGroupId ?? groups[0]?.id ?? "");
      return;
    }
    if (!todo) return;
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setGroupId(todo.groupId);
    setPriority(todo.priority);
    setStatus(todo.status);
    setStartDate(todo.startDate ?? "");
    setEndDate(todo.endDate ?? "");
  }, [isEdit, todo, groups]);

  // Nodes arrive asynchronously in edit mode; map them into drafts once.
  useEffect(() => {
    if (!isEdit || !todoId) return;
    const list = nodesByTodo[todoId];
    if (!list) return;
    setNodes(
      list
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((n) => ({
          key: n.id,
          id: n.id,
          title: n.title,
          isMilestone: n.isMilestone,
          completed: n.status === "completed",
        }))
    );
    setReady(true);
  }, [isEdit, todoId, nodesByTodo]);

  const titleError = title.trim().length === 0;
  const nodeError = nodes.filter((n) => n.title.trim()).length === 0;
  const canSubmit = !titleError && !nodeError && !!groupId && !submitting;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDelete) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmDelete]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const clean = nodes
      .filter((n) => n.title.trim())
      .map((n) => ({ ...n, title: n.title.trim() }));
    const saved = await saveTodoDialog(
      mode,
      todoId ?? null,
      {
        groupId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      clean
    );
    setSubmitting(false);
    if (saved) {
      onSaved?.(saved.id);
      onClose();
    }
  };

  const remove = async () => {
    if (!todoId) return;
    setConfirmDelete(false);
    await deleteTodo(todoId);
    onClose();
  };

  // Edit mode with a vanished todo (deleted elsewhere): close instead of
  // rendering an empty shell.
  if (isEdit && !todo) {
    return null;
  }

  const width = compact ? "w-[420px]" : "w-[560px]";

  return (
    <>
      <motion.div
        className="no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      >
        <motion.section
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.34, 1.3, 0.64, 1] }}
          className={`${width} flex max-h-[88vh] flex-col overflow-hidden rounded-xl shadow-2xl`}
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <header
            className="flex h-11 shrink-0 items-center justify-between border-b px-4"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {isEdit ? t("todo.edit") : t("todo.new")}
            </span>
            <button
              className="rounded p-1 text-sm transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}
              onClick={onClose}
              title={t("common.cancel")}
            >
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <input
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none transition-colors focus:border-[color:var(--accent)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
              placeholder={t("todo.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              rows={2}
              className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[color:var(--accent)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
              placeholder={t("todo.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {t("group.title")}
                </span>
                <GroupSelect
                  groups={groups}
                  value={groupId}
                  onChange={setGroupId}
                  countOf={(id) => todos.filter((item) => item.groupId === id).length}
                  compact={compact}
                />
              </div>

              {isEdit && (
                <label className="w-28 shrink-0">
                  <span className="mb-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t("todo.statusLabel")}
                  </span>
                  <select
                    className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TodoStatus)}
                  >
                    {STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {t(`status.${item}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div>
              <span className="mb-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("todo.priority")}
              </span>
              <div className="flex gap-1.5">
                {PRIORITIES.map((item) => (
                  <motion.button
                    key={item}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-1 rounded-lg border py-1.5 text-[11px] transition-all ${
                      priority === item ? "font-medium text-white shadow-sm" : ""
                    }`}
                    style={
                      priority === item
                        ? { backgroundColor: PRIORITY_COLORS[item], borderColor: PRIORITY_COLORS[item] }
                        : { borderColor: "var(--border)", color: "var(--text-muted)" }
                    }
                    onClick={() => setPriority(item)}
                  >
                    {t(PRIORITY_I18N[item])}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {t("node.start")}
                </span>
                <DatePicker value={startDate} onChange={setStartDate} compact={compact} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {t("node.end")}
                </span>
                <DatePicker value={endDate} onChange={setEndDate} compact={compact} />
              </div>
            </div>

            {ready ? (
              <TodoNodeList nodes={nodes} onChange={setNodes} compact={compact} />
            ) : (
              <div className="py-4 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
                {t("common.loading")}
              </div>
            )}
          </div>

          <footer
            className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div>
              {isEdit && (
                <button
                  className="rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-red-500/10"
                  style={{ color: "#ef4444" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t("common.delete")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
                {nodeError ? t("todo.nodeRequired") : ""}
              </span>
              <button
                className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
                style={{ color: "var(--text-muted)" }}
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="rounded-lg px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity"
                style={{
                  background: canSubmit ? "var(--accent)" : "var(--border)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.75,
                }}
                onClick={() => void submit()}
              >
                {isEdit ? t("common.save") : t("common.save")}
              </motion.button>
            </div>
          </footer>
        </motion.section>
      </motion.div>

      <AnimatePresence>
        {confirmDelete && todo && (
          <ConfirmDialog
            danger
            title={t("todo.deleteTitle")}
            message={t("todo.deleteMessage", { title: todo.title })}
            confirmLabel={t("common.delete")}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => void remove()}
          />
        )}
      </AnimatePresence>
    </>
  );
}
