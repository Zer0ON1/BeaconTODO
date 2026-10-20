import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../lib/api";
import { loadWindowAlpha, setWindowAlpha } from "../lib/opacity";
import { useAppStore } from "../store/appStore";
import { PRIORITY_COLORS, PRIORITY_I18N } from "../lib/visual";
import TodoDialog from "../components/TodoDialog";
import type { Node, Priority } from "../types";

function PinNodeRow({ node }: { node: Node }) {
  const { setNodeCompleted, deleteNode } = useAppStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: isDragging ? "var(--accent-soft)" : "transparent",
      }}
      className="flex items-center gap-1.5 rounded px-1 py-1"
    >
      <button className="cursor-grab text-[10px]" style={{ color: "var(--text-faint)" }} {...attributes} {...listeners}>
        ⋮⋮
      </button>
      <input
        type="checkbox"
        className="h-3 w-3 accent-[color:var(--accent)]"
        checked={node.status === "completed"}
        onChange={(e) => void setNodeCompleted(node.id, e.target.checked)}
      />
      <span
        className={`flex-1 truncate text-[11px] ${node.status === "completed" ? "line-through" : ""}`}
        style={{ color: node.status === "completed" ? "var(--text-faint)" : "var(--text)" }}
      >
        {node.isMilestone ? "◆ " : ""}
        {node.title}
      </span>
      <button
        className="text-[10px] hover:text-red-500"
        style={{ color: "var(--text-faint)" }}
        onClick={() => void deleteNode(node.id)}
      >
        ✕
      </button>
    </div>
  );
}

export default function PinApp() {
  const { t } = useTranslation();
  const {
    todos,
    groups,
    pinWindows,
    nodesByTodo,
    loadBoot,
    loadNodes,
    createNode,
    reorderNodes,
    updateTodo,
    refreshPinWindows,
  } = useAppStore();

  const label = getCurrentWebviewWindow().label;
  const shortId = label.replace(/^pin-/, "");
  const pinWindow = useMemo(
    () => pinWindows.find((w) => w.id.startsWith(shortId)) ?? null,
    [pinWindows, shortId]
  );
  const [gearOpen, setGearOpen] = useState(false);
  const [nodeDraft, setNodeDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(1);
  const saveTimer = useRef<number | null>(null);
  const gearRef = useRef<HTMLDivElement>(null);

  // Pin window opacity is persisted per scope (shared by all pin windows).
  useEffect(() => {
    void loadWindowAlpha("pin").then(setOpacity);
  }, []);

  const changeOpacity = async (value: number) => {
    setOpacity(value);
    setOpacity(await setWindowAlpha("pin", value));
  };

  // Click anywhere outside the gear panel closes it (#3).
  useEffect(() => {
    if (!gearOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (gearRef.current && target && !gearRef.current.contains(target)) {
        setGearOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [gearOpen]);

  // BUGFIX: the pin window is its own JS context — it must load data itself.
  useEffect(() => {
    void loadBoot().then(() => setLoadFailed(false)).catch(() => setLoadFailed(true));
  }, [loadBoot]);

  // Keep in sync when another window writes data (#7).
  useEffect(() => {
    let timer: number | undefined;
    const unlisten = listen("data-changed", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadBoot();
        void refreshPinWindows();
      }, 180);
    });
    return () => {
      window.clearTimeout(timer);
      void unlisten.then((fn) => fn());
    };
  }, [loadBoot, refreshPinWindows]);

  useEffect(() => {
    void refreshPinWindows();
  }, [refreshPinWindows]);

  const activeTodoId = pinWindow?.activeTodoId ?? pinWindow?.members[0] ?? null;
  const activeTodo = todos.find((todo) => todo.id === activeTodoId) ?? null;
  const nodes = activeTodoId ? nodesByTodo[activeTodoId] ?? [] : [];

  useEffect(() => {
    if (activeTodoId) {
      void loadNodes(activeTodoId);
    }
  }, [activeTodoId, loadNodes]);

  useEffect(() => {
    if (activeTodo) setTitleDraft(activeTodo.title);
  }, [activeTodo?.id, activeTodo?.title]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const scheduleSave = useCallback(() => {
    if (!pinWindow) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const win = getCurrentWebviewWindow();
      const [pos, size] = await Promise.all([win.outerPosition(), win.innerSize()]);
      await api.pin.savePosition(pinWindow.id, pos.x, pos.y, size.width, size.height);
    }, 400);
  }, [pinWindow]);

  useEffect(() => {
    const win = getCurrentWebviewWindow();
    const unlistenMove = win.onMoved(scheduleSave);
    const unlistenResize = win.onResized(scheduleSave);
    return () => {
      void unlistenMove.then((fn) => fn());
      void unlistenResize.then((fn) => fn());
    };
  }, [scheduleSave]);

  if (!pinWindow) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center text-[11px] shadow-lg"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span>{t("common.loading")}</span>
        <button
          className="rounded px-2 py-1 text-[10px]"
          style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
          onClick={() => void refreshPinWindows()}
        >
          {t("common.error")} · {t("settings.title")}
        </button>
      </div>
    );
  }

  const done = nodes.filter((n) => n.status === "completed").length;
  const msNodes = nodes.filter((n) => n.isMilestone);
  const msTotal = msNodes.length;
  const msDone = msNodes.filter((n) => n.status === "completed").length;
  const group = activeTodo ? groups.find((g) => g.id === activeTodo.groupId) : undefined;

  const onNodeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeTodoId) return;
    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(nodes, oldIndex, newIndex);
    void reorderNodes(
      activeTodoId,
      reordered.map((n) => n.id)
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className="relative flex h-full flex-col overflow-hidden rounded-lg border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
    >
      {/* Only the title bar is draggable — a full-window drag region swallows
          every click inside the window (feels frozen). */}
      <header
        data-tauri-drag-region
        className="drag-region flex h-7 shrink-0 items-center gap-1 border-b px-2"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
          ⋮⋮
        </span>
        {pinWindow.members.length > 1 ? (
          <div className="no-drag flex flex-1 gap-0.5 overflow-x-auto">
            {pinWindow.members.map((memberId) => {
              const member = todos.find((todo) => todo.id === memberId);
              if (!member) return null;
              return (
                <button
                  key={memberId}
                  className={`max-w-[110px] truncate rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    memberId === activeTodoId ? "font-medium" : ""
                  }`}
                  style={
                    memberId === activeTodoId
                      ? { background: "var(--accent)", color: "#fff" }
                      : { color: "var(--text-muted)" }
                  }
                  onClick={() => void api.pin.setActive(pinWindow.id, memberId).then(refreshPinWindows)}
                >
                  {member.title}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="flex-1 truncate text-[10px]" style={{ color: "var(--text-faint)" }}>
            BeaconTODO
          </span>
        )}
        <button
          className="no-drag rounded px-1 text-[11px] transition-colors hover:bg-black/5"
          style={{ color: "var(--text-muted)" }}
          title={t("pin.gear")}
          onClick={() => setGearOpen((v) => !v)}
        >
          ⚙
        </button>
        <button
          className="no-drag rounded px-1 text-[11px] transition-colors hover:bg-red-500 hover:text-white"
          style={{ color: "var(--text-muted)" }}
          title={t("pin.close")}
          onClick={() => void api.pin.close(pinWindow.id)}
        >
          ✕
        </button>
      </header>

      <AnimatePresence>
        {gearOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            ref={gearRef}
            className="no-drag absolute right-1 top-8 z-10 w-60 rounded-lg border p-2 shadow-xl"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <p className="px-1 pb-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
              {t("pin.members")}
            </p>
            <div className="space-y-0.5">
              {pinWindow.members.map((memberId) => {
                const member = todos.find((todo) => todo.id === memberId);
                return (
                  <div key={memberId} className="flex items-center gap-1 rounded px-1 py-0.5">
                    <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                      ⋮⋮
                    </span>
                    <span className="flex-1 truncate text-[11px]" style={{ color: "var(--text)" }}>
                      {member?.title ?? memberId}
                    </span>
                    <button
                      className="text-[10px] hover:text-red-500"
                      style={{ color: "var(--text-faint)" }}
                      onClick={() =>
                        void api.pin.removeMember(pinWindow.id, memberId).then(refreshPinWindows)
                      }
                    >
                      {t("pin.remove")}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <AddTodoSelect windowId={pinWindow.id} onDone={refreshPinWindows} />
              <button
                className="w-full rounded px-1 py-1 text-left text-[11px] transition-colors hover:bg-black/5"
                style={{ color: "var(--accent-text)" }}
                onClick={() => {
                  setGearOpen(false);
                  setCreating(true);
                }}
              >
                {t("pin.newTodo")}
              </button>
            </div>

            {/* Pin window opacity */}
            <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <span className="shrink-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                {t("settings.opacity")}
              </span>
              <input
                type="range"
                min={35}
                max={100}
                step={1}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-[color:var(--accent)]"
                value={Math.round(opacity * 100)}
                onChange={(e) => void changeOpacity(Number(e.target.value) / 100)}
              />
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums" style={{ color: "var(--text-faint)" }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / edit use the same dialog as the main window (#1 #5). */}
      {creating && (
        <TodoDialog
          mode="create"
          compact
          onClose={() => setCreating(false)}
          onSaved={(todoId) => {
            if (pinWindow) {
              void api.pin.addMember(pinWindow.id, todoId).then(refreshPinWindows);
            }
          }}
        />
      )}
      {editingTodoId && (
        <TodoDialog
          mode="edit"
          todoId={editingTodoId}
          compact
          onClose={() => setEditingTodoId(null)}
        />
      )}

      {activeTodo ? (
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <select
              className="no-drag rounded px-1 py-0.5 text-[10px] font-medium text-white outline-none"
              style={{ backgroundColor: PRIORITY_COLORS[activeTodo.priority as Priority] }}
              value={activeTodo.priority}
              onChange={(e) =>
                void updateTodo({ id: activeTodo.id, priority: Number(e.target.value) as Priority })
              }
            >
              {[0, 1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {t(PRIORITY_I18N[p as Priority])}
                </option>
              ))}
            </select>
            {editingTitle ? (
              <input
                autoFocus
                className="no-drag flex-1 rounded border px-1 py-0.5 text-xs outline-none"
                style={{ borderColor: "var(--accent)", background: "var(--surface)", color: "var(--text)" }}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  const trimmed = titleDraft.trim();
                  if (trimmed && trimmed !== activeTodo.title) {
                    void updateTodo({ id: activeTodo.id, title: trimmed });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            ) : (
              <button
                className="no-drag flex-1 truncate text-left text-xs font-medium"
                style={{ color: "var(--text)" }}
                onDoubleClick={() => setEditingTitle(true)}
                title={t("common.edit")}
              >
                {activeTodo.title}
              </button>
            )}
            {group && (
              <span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>
                {group.name}
              </span>
            )}
            <button
              className="no-drag shrink-0 rounded px-1 text-[11px] transition-colors hover:bg-black/5"
              style={{ color: "var(--text-faint)" }}
              title={t("common.edit")}
              onClick={() => setEditingTodoId(activeTodo.id)}
            >
              ✎
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: nodes.length > 0 ? `${(done / nodes.length) * 100}%` : "0%" }}
                transition={{ duration: 0.3 }}
                style={{ backgroundColor: PRIORITY_COLORS[activeTodo.priority as Priority] }}
              />
            </div>
            <span
              className="text-[10px] tabular-nums"
              style={{ color: "var(--text-faint)" }}
              title={t("todo.subtasks", { done, total: nodes.length })}
            >
              {nodes.length > 0 ? `${Math.round((done / nodes.length) * 100)}%` : "—"}
            </span>
            {msTotal > 0 && (
              <span
                className="shrink-0 text-[10px] tabular-nums"
                style={{ color: "var(--accent-text)" }}
                title={t("todo.milestoneProgress", { done: msDone, total: msTotal })}
              >
                ◆ {msDone}/{msTotal}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onNodeDragEnd}>
              <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {nodes.map((node) => (
                    <PinNodeRow key={node.id} node={node} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="p-2">
            <input
              className="no-drag w-full rounded border border-dashed px-2 py-1 text-[11px] outline-none transition-colors focus:border-[color:var(--accent)]"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              placeholder={t("pin.addNode")}
              value={nodeDraft}
              onChange={(e) => setNodeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nodeDraft.trim()) {
                  void createNode({ todoId: activeTodo.id, title: nodeDraft.trim() });
                  setNodeDraft("");
                }
              }}
            />
            <p className="mt-1 text-center text-[9px]" style={{ color: "var(--text-faint)" }}>
              {t("node.dragHint")}
            </p>
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center justify-center gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          <span>{t("common.empty")}</span>
          {loadFailed && (
            <button
              className="rounded px-2 py-1 text-[10px]"
              style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
              onClick={() => void loadBoot()}
            >
              {t("common.error")}
            </button>
          )}
        </main>
      )}
    </motion.div>
  );
}

function AddTodoSelect({ windowId, onDone }: { windowId: string; onDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const { todos, pinWindows } = useAppStore();
  const current = pinWindows.find((w) => w.id === windowId);
  const candidates = todos.filter(
    (todo) => todo.status !== "archived" && !current?.members.includes(todo.id)
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="w-full rounded px-1 py-1 text-left text-[11px] transition-colors"
        style={{ color: "var(--accent-text)" }}
        onClick={() => setOpen(true)}
      >
        {t("pin.addTodo")}
      </button>
    );
  }
  return (
    <div className="max-h-40 overflow-y-auto rounded border" style={{ borderColor: "var(--border)" }}>
      {candidates.length === 0 && (
        <p className="px-2 py-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
          {t("common.empty")}
        </p>
      )}
      {candidates.map((todo) => (
        <button
          key={todo.id}
          className="block w-full truncate px-2 py-1 text-left text-[11px] transition-colors hover:bg-black/5"
          style={{ color: "var(--text)" }}
          onClick={() => {
            void api.pin.addMember(windowId, todo.id).then(() => {
              setOpen(false);
              void onDone();
            });
          }}
        >
          {todo.title}
        </button>
      ))}
    </div>
  );
}
