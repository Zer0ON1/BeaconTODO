import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { GROUP_COLORS } from "../lib/visual";

export default function Sidebar() {
  const { t } = useTranslation();
  const {
    groups,
    todos,
    selectedGroupId,
    selectGroup,
    createGroup,
    deleteGroup,
  } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);

  const visibleTodos = todos.filter((todo) => todo.status !== "archived");

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createGroup(trimmed, color);
    setName("");
    setCreating(false);
  };

  return (
    <aside
      className="flex h-full w-52 flex-col border-r"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex h-9 items-center justify-between px-3">
        <span className="text-xs font-medium ">{t("group.title")}</span>
        <button
          className="no-drag rounded px-1 text-sm transition-colors hover:bg-black/5" style={{ color: "var(--text-muted)" }}
          title={t("group.new")}
          onClick={() => setCreating((v) => !v)}
        >
          ＋
        </button>
      </div>

      {creating && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: [0.34, 1.3, 0.64, 1] }}
          className="mx-2 mb-2 rounded-xl border p-2.5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.10)",
          }}
        >
          <span className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            {t("group.new")}
          </span>
          <input
            autoFocus
            className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[color:var(--accent)]"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            placeholder={t("group.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                className="h-4 w-4 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  boxShadow:
                    color === c
                      ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}`
                      : "0 0 0 1px rgba(15,23,42,0.08)",
                }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <button
              className="rounded-lg px-2.5 py-1 text-[11px] transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setCreating(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="rounded-lg px-3 py-1 text-[11px] font-medium text-white shadow-sm transition-opacity"
              style={{ background: "var(--accent)", opacity: name.trim() ? 1 : 0.6 }}
              onClick={() => void submitCreate()}
            >
              {t("common.save")}
            </button>
          </div>
        </motion.div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <button
          className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
            selectedGroupId === null ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
          }`}
          onClick={() => selectGroup(null)}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
          <span className="flex-1 truncate">{t("common.all")}</span>
          <span style={{ color: "var(--text-faint)" }}>{visibleTodos.length}</span>
        </button>
        {groups.map((group) => {
          const groupTodos = visibleTodos.filter((todo) => todo.groupId === group.id);
          const done = groupTodos.filter((todo) => todo.status === "completed").length;
          return (
            <div
              key={group.id}
              className="group mb-0.5 flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors"
              style={
                selectedGroupId === group.id
                  ? { background: "var(--accent-soft)", color: "var(--accent-text)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <button
                className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                onClick={() => selectGroup(group.id)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="flex-1 truncate">{group.name}</span>
                <span className="text-slate-400">
                  {done}/{groupTodos.length}
                </span>
              </button>
              <button
                className="hidden hover:text-red-500 group-hover:block" style={{ color: "var(--text-faint)" }}
                title={t("common.delete")}
                onClick={() => {
                  if (groupTodos.length === 0) {
                    void deleteGroup({ id: group.id, mode: "cascade" });
                    return;
                  }
                  const mode = window.confirm(
                    `${t("group.deleteConfirmTitle")}: ${group.name}\n\n[OK] ${t("group.deleteMigrate")}\n[Cancel] ${t("group.deleteCascade")}`
                  )
                    ? "migrate"
                    : "cascade";
                  const others = groups.filter((g) => g.id !== group.id);
                  const target = others[0]?.id;
                  if (mode === "migrate" && !target) {
                    window.alert(t("group.deleteCascade"));
                    return;
                  }
                  void deleteGroup({
                    id: group.id,
                    mode,
                    targetGroupId: mode === "migrate" ? target : undefined,
                  });
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </nav>

      <div className="border-t px-3 py-2 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
        {t("group.todoCount", { count: visibleTodos.length })}
      </div>
    </aside>
  );
}
