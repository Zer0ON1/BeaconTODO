import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import TodoCard from "./TodoCard";
import { PlusIcon } from "./Icons";

export default function ListView() {
  const { t } = useTranslation();
  const { todos, groups, selectedGroupId, openCreateDialog } = useAppStore();

  const visible = todos
    .filter((todo) => todo.status !== "archived")
    .filter((todo) => (selectedGroupId ? todo.groupId === selectedGroupId : true))
    .sort((a, b) => {
      // Pinned todos lead every view, then unfinished before completed.
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      return a.sortOrder - b.sortOrder;
    });

  return (
    <div className="h-full overflow-y-auto p-4">
      <motion.button
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs transition-colors"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
        onClick={openCreateDialog}
      >
        <PlusIcon />
        {t("todo.new")}
      </motion.button>

      {visible.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-center text-xs"
          style={{ color: "var(--text-faint)" }}
        >
          {t("common.empty")}
        </motion.p>
      ) : (
        <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-start gap-3">
          <AnimatePresence initial={false}>
            {visible.map((todo, index) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.12) }}
              >
                <TodoCard todo={todo} group={groups.find((g) => g.id === todo.groupId)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
