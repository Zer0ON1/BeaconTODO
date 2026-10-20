import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
import type { DraftNode } from "../types";
import { PlusIcon } from "./Icons";

interface Props {
  nodes: DraftNode[];
  onChange: (nodes: DraftNode[]) => void;
  /** Compact spacing for the pin window. */
  compact?: boolean;
}

function newKey(): string {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

function SortableRow({
  node,
  index,
  compact,
  onPatch,
  onRemove,
}: {
  node: DraftNode;
  index: number;
  compact?: boolean;
  onPatch: (patch: Partial<DraftNode>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: isDragging ? "var(--accent-soft)" : "var(--surface-2)",
        borderColor: "var(--border)",
        opacity: isDragging ? 0.9 : 1,
      }}
      className={`mb-1 flex items-center gap-1.5 rounded-lg border pr-1.5 ${
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      }`}
    >
      <button
        className="no-drag cursor-grab text-[10px]"
        style={{ color: "var(--text-faint)" }}
        title={t("node.dragHint")}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <input
        type="checkbox"
        className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 accent-[color:var(--accent)]`}
        checked={node.completed}
        onChange={(e) => onPatch({ completed: e.target.checked })}
        title={t("common.complete")}
      />

      <input
        className={`min-w-0 flex-1 truncate rounded bg-transparent outline-none ${
          compact ? "text-[11px]" : "text-xs"
        } ${node.completed ? "line-through" : ""}`}
        style={{ color: node.completed ? "var(--text-faint)" : "var(--text)" }}
        value={node.title}
        onChange={(e) => onPatch({ title: e.target.value })}
        placeholder={t("node.title")}
      />

      <label
        className="no-drag flex shrink-0 cursor-pointer items-center gap-1"
        title={t("node.isMilestoneHint")}
      >
        <span className="text-[10px]" style={{ color: node.isMilestone ? "var(--accent-text)" : "var(--text-faint)" }}>
          ◆
        </span>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={node.isMilestone}
          onChange={(e) => onPatch({ isMilestone: e.target.checked })}
        />
        <span className="toggle-track" data-on={node.isMilestone || undefined}>
          <span className="toggle-knob" />
        </span>
      </label>

      <span className="w-3 shrink-0 text-right text-[10px]" style={{ color: "var(--text-faint)" }}>
        {index + 1}
      </span>

      <button
        className="no-drag shrink-0 text-[10px] transition-colors hover:text-red-500"
        style={{ color: "var(--text-faint)" }}
        onClick={onRemove}
        title={t("common.delete")}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Controlled node editor shared by the create and edit dialogs.
 * Order changes stay local until the dialog is saved.
 */
export default function TodoNodeList({ nodes, onChange, compact }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const add = (isMilestone = false) => {
    const value = draft.trim();
    if (!value) return;
    onChange([...nodes, { key: newKey(), title: value, isMilestone, completed: false }]);
    setDraft("");
    inputRef.current?.focus();
  };

  const patch = (key: string, changes: Partial<DraftNode>) =>
    onChange(nodes.map((n) => (n.key === key ? { ...n, ...changes } : n)));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = nodes.findIndex((n) => n.key === active.id);
    const to = nodes.findIndex((n) => n.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(nodes, from, to));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("node.title")}
          <span className="ml-1 text-red-400">*</span>
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
          {nodes.length > 0 ? t("todo.nodeCount", { count: nodes.length }) : t("todo.nodeRequired")}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={nodes.map((n) => n.key)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {nodes.map((node, index) => (
              <motion.div
                key={node.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.13 }}
              >
                <SortableRow
                  node={node}
                  index={index}
                  compact={compact}
                  onPatch={(changes) => patch(node.key, changes)}
                  onRemove={() => onChange(nodes.filter((n) => n.key !== node.key))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      <div className="mt-1 flex gap-1.5">
        <input
          ref={inputRef}
          className={`min-w-0 flex-1 rounded-lg border border-dashed outline-none transition-colors focus:border-[color:var(--accent)] ${
            compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
          }`}
          style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text)" }}
          placeholder={t("node.placeholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="shrink-0 rounded-lg px-2 transition-colors"
          style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
          onClick={() => add(false)}
          title={t("node.add")}
        >
          <PlusIcon />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="shrink-0 rounded-lg px-2 text-[11px] transition-colors"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          onClick={() => add(true)}
          title={t("node.newMilestone")}
        >
          ◆
        </motion.button>
      </div>
    </div>
  );
}
