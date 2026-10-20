import type { Priority, Todo } from "../types";

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: "#E24B4A",
  1: "#EF9F27",
  2: "#378ADD",
  3: "#888780",
};

export const PRIORITY_I18N: Record<Priority, string> = {
  0: "priority.p0",
  1: "priority.p1",
  2: "priority.p2",
  3: "priority.p3",
};

export const GROUP_COLORS = [
  "#378ADD",
  "#E24B4A",
  "#EF9F27",
  "#639922",
  "#7F77DD",
  "#D4537E",
  "#1D9E75",
  "#888780",
];

const RANDOM_PALETTE = [
  "#E24B4A",
  "#EF9F27",
  "#378ADD",
  "#639922",
  "#7F77DD",
  "#D4537E",
  "#1D9E75",
  "#BA7517",
];

export const NOT_STARTED_GRAY = "#B4B2A9";

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isOverdue(todo: Todo): boolean {
  return (
    todo.status !== "completed" &&
    !!todo.endDate &&
    todo.endDate < today()
  );
}

export function stableColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return RANDOM_PALETTE[hash % RANDOM_PALETTE.length];
}

/** Calendar default coloring: gray when not started, stable random when started. */
export function calendarColor(todo: Todo): string {
  return todo.status === "notStarted" ? NOT_STARTED_GRAY : stableColor(todo.id);
}

export type KanbanColumn = "notStarted" | "inProgress" | "overdue" | "completed";

export function columnOf(todo: Todo): KanbanColumn {
  if (todo.status === "completed") return "completed";
  if (isOverdue(todo)) return "overdue";
  if (todo.status === "inProgress") return "inProgress";
  return "notStarted";
}
