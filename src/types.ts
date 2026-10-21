export type Priority = 0 | 1 | 2 | 3;

export type TodoStatus = "notStarted" | "inProgress" | "completed" | "blocked" | "archived";

export type NodeStatus = "notStarted" | "inProgress" | "completed";

export interface Group {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  groupId: string;
  title: string;
  description: string;
  priority: Priority;
  status: TodoStatus;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Node {
  id: string;
  todoId: string;
  title: string;
  note: string;
  /** Milestone is a per-node flag (v0.2). */
  isMilestone: boolean;
  startDate: string | null;
  endDate: string | null;
  status: NodeStatus;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PinWindow {
  id: string;
  members: string[];
  activeTodoId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthStatus {
  appVersion: string;
  dbOk: boolean;
  schemaVersion: number;
}

/** Runtime environment reported by the shell for the About panel. */
export interface AppInfo {
  version: string;
  os: string;
  arch: string;
  debug: boolean;
  dataDir: string;
  dbPath: string;
  logDir: string;
}

export interface GroupWithStats extends Group {
  todoCount: number;
  doneCount: number;
}

export interface CreateGroupInput {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateGroupInput {
  id: string;
  name?: string;
  color?: string;
  icon?: string;
  archived?: boolean;
  sortOrder?: number;
}

export interface DeleteGroupInput {
  id: string;
  mode: "migrate" | "cascade";
  targetGroupId?: string;
}

export interface CreateTodoInput {
  groupId: string;
  title: string;
  description?: string;
  priority?: Priority;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TodoStatus;
  startDate?: string | null;
  endDate?: string | null;
  groupId?: string;
  sortOrder?: number;
}

export interface CreateNodeInput {
  todoId: string;
  title: string;
  note?: string;
  isMilestone?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateNodeInput {
  id: string;
  title?: string;
  note?: string;
  isMilestone?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status?: NodeStatus;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  groups: Group[];
  todos: Todo[];
  nodes: Node[];
}

export interface ImportSummary {
  groups: number;
  todos: number;
  nodes: number;
  milestones: number;
}

/** Editable node row used by the create/edit todo dialog (not persisted until save). */
export interface DraftNode {
  /** Local identity key, stable while editing. */
  key: string;
  /** Present when the node already exists in the database. */
  id?: string;
  title: string;
  isMilestone: boolean;
  completed: boolean;
}
