import { call } from "./tauri";
import type {
  AppInfo,
  CreateNodeInput,
  CreateTodoInput,
  DeleteGroupInput,
  ExportData,
  Group,
  HealthStatus,
  ImportSummary,
  Node,
  PinWindow,
  Todo,
  UpdateGroupInput,
  UpdateNodeInput,
  UpdateTodoInput,
} from "../types";

export const api = {
  health: () => call<HealthStatus>("health_check"),
  appInfo: () => call<AppInfo>("app_info"),

  groups: {
    list: (includeArchived = false) =>
      call<Group[]>("groups_list", { includeArchived }),
    create: (name: string, color?: string, icon?: string) =>
      call<Group>("groups_create", { name, color, icon }),
    update: (input: UpdateGroupInput) => call<Group>("groups_update", { input }),
    remove: (input: DeleteGroupInput) => call<void>("groups_delete", { input }),
    reorder: (ids: string[]) => call<void>("groups_reorder", { input: { ids } }),
  },

  todos: {
    list: (groupId?: string) => call<Todo[]>("todos_list", { groupId }),
    create: (input: CreateTodoInput) => call<Todo>("todos_create", { ...input }),
    update: (input: UpdateTodoInput) => call<Todo>("todos_update", { input }),
    setPinned: (id: string, pinned: boolean) =>
      call<Todo>("todos_set_pinned", { id, pinned }),
    setStatus: (id: string, status: string) =>
      call<Todo>("todos_set_status", { id, status }),
    remove: (id: string) => call<void>("todos_delete", { id }),
    reorder: (ids: string[]) => call<void>("todos_reorder", { input: { ids } }),
  },

  nodes: {
    list: (todoId: string) => call<Node[]>("nodes_list", { todoId }),
    listAll: () => call<Node[]>("nodes_list_all"),
    create: (input: CreateNodeInput) => call<Node>("nodes_create", { ...input }),
    update: (input: UpdateNodeInput) => call<Node>("nodes_update", { input }),
    remove: (id: string) => call<void>("nodes_delete", { id }),
    reorder: (todoId: string, ids: string[]) =>
      call<void>("nodes_reorder", { todoId, input: { ids } }),
    setIsMilestone: (id: string, isMilestone: boolean) =>
      call<Node>("nodes_set_is_milestone", { id, isMilestone }),
    setCompleted: (id: string, completed: boolean) =>
      call<Node>("nodes_set_completed", { id, completed }),
  },

  pin: {
    list: () => call<PinWindow[]>("pin_windows_list"),
    get: (windowId: string) => call<PinWindow>("pin_get", { windowId }),
    open: (todoIds: string[]) => call<PinWindow>("pin_open", { todoIds }),
    addMember: (id: string, todoId: string) =>
      call<PinWindow>("pin_add_member", { id, todoId }),
    removeMember: (id: string, todoId: string) =>
      call<PinWindow>("pin_remove_member", { id, todoId }),
    reorderMembers: (id: string, ids: string[]) =>
      call<PinWindow>("pin_reorder_members", { id, ids }),
    setActive: (id: string, todoId: string) =>
      call<PinWindow>("pin_set_active", { id, todoId }),
    savePosition: (id: string, x: number, y: number, width: number, height: number) =>
      call<PinWindow>("pin_save_position", { id, x, y, width, height }),
    setAlwaysOnTop: (id: string, value: boolean) =>
      call<PinWindow>("pin_set_always_on_top", { id, value }),
    close: (id: string) => call<void>("pin_close", { id }),
  },

  settings: {
    get: (key: string) => call<string | null>("settings_get", { key }),
    set: (key: string, value: string) => call<void>("settings_set", { key, value }),
  },

  data: {
    exportJson: () => call<ExportData>("export_json"),
    importJson: (data: ExportData) => call<ImportSummary>("import_json", { data }),
  },
};
