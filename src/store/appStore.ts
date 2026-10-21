import { create } from "zustand";
import { api } from "../lib/api";
import type {
  CreateNodeInput,
  CreateTodoInput,
  DeleteGroupInput,
  DraftNode,
  Group,
  Node,
  PinWindow,
  Priority,
  Todo,
  TodoStatus,
  UpdateGroupInput,
  UpdateNodeInput,
  UpdateTodoInput,
} from "../types";

export type View = "list" | "calendar" | "kanban";

/** Todo dialog is shared by the create and edit flows (#1 #4 #5). */
export type TodoDialogState = { mode: "create" } | { mode: "edit"; todoId: string };

export interface TodoFormInput {
  groupId: string;
  title: string;
  description: string;
  priority: Priority;
  status: TodoStatus;
  startDate: string | null;
  endDate: string | null;
}

interface AppState {
  view: View;
  groups: Group[];
  todos: Todo[];
  nodesByTodo: Record<string, Node[]>;
  pinWindows: PinWindow[];
  pinnedTodoIds: string[];
  selectedGroupId: string | null;
  dialog: TodoDialogState | null;
  loading: boolean;
  error: string | null;

  loadBoot: () => Promise<void>;
  setView: (view: View) => void;
  selectGroup: (id: string | null) => void;
  openCreateDialog: () => void;
  openEditor: (todoId: string) => void;
  closeDialog: () => void;
  saveTodoDialog: (
    mode: "create" | "edit",
    todoId: string | null,
    input: TodoFormInput,
    drafts: DraftNode[]
  ) => Promise<Todo | null>;

  createGroup: (name: string, color: string) => Promise<void>;
  updateGroup: (input: UpdateGroupInput) => Promise<void>;
  deleteGroup: (input: DeleteGroupInput) => Promise<void>;

  createTodo: (input: CreateTodoInput) => Promise<Todo | null>;
  updateTodo: (input: UpdateTodoInput) => Promise<void>;
  setTodoStatus: (id: string, status: string) => Promise<void>;
  setTodoPinned: (id: string, pinned: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;

  loadNodes: (todoId: string) => Promise<void>;
  createNode: (input: CreateNodeInput) => Promise<void>;
  updateNode: (input: UpdateNodeInput) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  reorderNodes: (todoId: string, ids: string[]) => Promise<void>;
  setNodeIsMilestone: (id: string, isMilestone: boolean) => Promise<void>;
  setNodeCompleted: (id: string, completed: boolean) => Promise<void>;

  openPin: (todoIds: string[]) => Promise<void>;
  pinAddMember: (id: string, todoId: string) => Promise<void>;
  pinRemoveMember: (id: string, todoId: string) => Promise<void>;
  pinSetActive: (id: string, todoId: string) => Promise<void>;
  pinSetTop: (id: string, value: boolean) => Promise<void>;
  pinClose: (id: string) => Promise<void>;
  refreshPinWindows: () => Promise<void>;
}

function fail(set: (partial: Partial<AppState>) => void, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  set({ error: message });
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "list",
  groups: [],
  todos: [],
  nodesByTodo: {},
  pinWindows: [],
  pinnedTodoIds: [],
  selectedGroupId: null,
  dialog: null,
  loading: false,
  error: null,

  loadBoot: async () => {
    set({ loading: true });
    try {
      const [groups, todos, pinWindows, allNodes] = await Promise.all([
        api.groups.list(false),
        api.todos.list(),
        api.pin.list(),
        api.nodes.listAll(),
      ]);
      const pinnedTodoIds = new Set<string>();
      pinWindows.forEach((w) => w.members.forEach((m) => pinnedTodoIds.add(m)));
      // Group nodes by todo so every card can render progress immediately.
      const nodesByTodo: Record<string, Node[]> = {};
      for (const node of allNodes) {
        (nodesByTodo[node.todoId] ??= []).push(node);
      }
      for (const list of Object.values(nodesByTodo)) {
        list.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      set({
        groups,
        todos,
        pinWindows,
        nodesByTodo,
        pinnedTodoIds: [...pinnedTodoIds],
        selectedGroupId: get().selectedGroupId ?? groups[0]?.id ?? null,
        loading: false,
      });
    } catch (e) {
      fail(set, e);
      set({ loading: false });
    }
  },

  setView: (view) => set({ view }),
  selectGroup: (id) => set({ selectedGroupId: id }),
  openCreateDialog: () => set({ dialog: { mode: "create" } }),
  openEditor: (todoId) => set({ dialog: { mode: "edit", todoId } }),
  closeDialog: () => set({ dialog: null }),

  /**
   * Commit a dialog: create the todo (or update it) and reconcile its nodes —
   * inserts, updates, deletes and the final ordering are all applied here.
   */
  saveTodoDialog: async (mode, todoId, input, drafts) => {
    try {
      let saved: Todo | null = null;
      if (mode === "create") {
        saved = await api.todos.create({
          groupId: input.groupId,
          title: input.title,
          description: input.description || undefined,
          priority: input.priority,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        const orderedIds: string[] = [];
        for (const draft of drafts) {
          const created = await api.nodes.create({
            todoId: saved.id,
            title: draft.title,
            isMilestone: draft.isMilestone,
          });
          orderedIds.push(created.id);
        }
        if (orderedIds.length > 0) await api.nodes.reorder(saved.id, orderedIds);
      } else if (todoId) {
        saved = await api.todos.update({
          id: todoId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: input.status,
          startDate: input.startDate,
          endDate: input.endDate,
          groupId: input.groupId,
        });
        const existing = await api.nodes.list(todoId);
        const keepIds = new Set(drafts.map((d) => d.id).filter(Boolean) as string[]);

        for (const old of existing) {
          if (!keepIds.has(old.id)) await api.nodes.remove(old.id);
        }

        const orderedIds: string[] = [];
        for (const draft of drafts) {
          if (draft.id) {
            const old = existing.find((n) => n.id === draft.id);
            const targetStatus = draft.completed ? "completed" : "notStarted";
            if (
              old &&
              (old.title !== draft.title ||
                old.isMilestone !== draft.isMilestone ||
                old.status !== targetStatus)
            ) {
              await api.nodes.update({
                id: draft.id,
                title: draft.title,
                isMilestone: draft.isMilestone,
                status: draft.completed ? "completed" : undefined,
              });
              if (!draft.completed && old.status === "completed") {
                await api.nodes.setCompleted(draft.id, false);
              }
            }
            orderedIds.push(draft.id);
          } else {
            const created = await api.nodes.create({
              todoId,
              title: draft.title,
              isMilestone: draft.isMilestone,
            });
            orderedIds.push(created.id);
          }
        }
        if (orderedIds.length > 0) await api.nodes.reorder(todoId, orderedIds);
        await get().loadNodes(todoId);
      }

      const [todos] = await Promise.all([api.todos.list()]);
      set({ todos, dialog: null });
      return saved;
    } catch (e) {
      fail(set, e);
      return null;
    }
  },

  createGroup: async (name, color) => {
    try {
      await api.groups.create(name, color);
      const groups = await api.groups.list(false);
      set({ groups });
    } catch (e) {
      fail(set, e);
    }
  },

  updateGroup: async (input) => {
    try {
      await api.groups.update(input);
      const groups = await api.groups.list(false);
      set({ groups });
    } catch (e) {
      fail(set, e);
    }
  },

  deleteGroup: async (input) => {
    try {
      await api.groups.remove(input);
      const [groups, todos] = await Promise.all([
        api.groups.list(false),
        api.todos.list(),
      ]);
      set({
        groups,
        todos,
        selectedGroupId:
          get().selectedGroupId === input.id ? null : get().selectedGroupId,
      });
    } catch (e) {
      fail(set, e);
    }
  },

  createTodo: async (input) => {
    try {
      const todo = await api.todos.create(input);
      const todos = await api.todos.list();
      set({ todos });
      return todo;
    } catch (e) {
      fail(set, e);
      return null;
    }
  },

  updateTodo: async (input) => {
    try {
      await api.todos.update(input);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  setTodoStatus: async (id, status) => {
    try {
      await api.todos.setStatus(id, status);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  setTodoPinned: async (id, pinned) => {
    try {
      await api.todos.setPinned(id, pinned);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  deleteTodo: async (id) => {
    try {
      await api.todos.remove(id);
      const todos = await api.todos.list();
      const { nodesByTodo, dialog, pinWindows } = get();
      const nextNodes = { ...nodesByTodo };
      delete nextNodes[id];
      set({
        todos,
        nodesByTodo: nextNodes,
        // Never leave the dialog pointing at a removed todo (this is what made
        // the editor reopen onto a deleted item and report "todo not found").
        dialog: dialog && dialog.mode === "edit" && dialog.todoId === id ? null : dialog,
        pinWindows,
      });
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  loadNodes: async (todoId) => {
    try {
      const nodes = await api.nodes.list(todoId);
      set({ nodesByTodo: { ...get().nodesByTodo, [todoId]: nodes } });
    } catch (e) {
      fail(set, e);
    }
  },

  createNode: async (input) => {
    try {
      await api.nodes.create(input);
      await get().loadNodes(input.todoId);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  updateNode: async (input) => {
    try {
      await api.nodes.update(input);
      const todoId = Object.keys(get().nodesByTodo).find((key) =>
        get().nodesByTodo[key].some((n) => n.id === input.id)
      );
      if (todoId) await get().loadNodes(todoId);
    } catch (e) {
      fail(set, e);
    }
  },

  deleteNode: async (id) => {
    try {
      const todoId = Object.keys(get().nodesByTodo).find((key) =>
        get().nodesByTodo[key].some((n) => n.id === id)
      );
      await api.nodes.remove(id);
      if (todoId) await get().loadNodes(todoId);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  reorderNodes: async (todoId, ids) => {
    try {
      await api.nodes.reorder(todoId, ids);
      await get().loadNodes(todoId);
    } catch (e) {
      fail(set, e);
    }
  },

  setNodeIsMilestone: async (id, isMilestone) => {
    try {
      await api.nodes.setIsMilestone(id, isMilestone);
      const todoId = Object.keys(get().nodesByTodo).find((key) =>
        get().nodesByTodo[key].some((n) => n.id === id)
      );
      if (todoId) await get().loadNodes(todoId);
    } catch (e) {
      fail(set, e);
    }
  },

  setNodeCompleted: async (id, completed) => {
    try {
      const todoId = Object.keys(get().nodesByTodo).find((key) =>
        get().nodesByTodo[key].some((n) => n.id === id)
      );
      await api.nodes.setCompleted(id, completed);
      if (todoId) await get().loadNodes(todoId);
      const todos = await api.todos.list();
      set({ todos });
    } catch (e) {
      fail(set, e);
    }
  },

  openPin: async (todoIds) => {
    try {
      await api.pin.open(todoIds);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  pinAddMember: async (id, todoId) => {
    try {
      await api.pin.addMember(id, todoId);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  pinRemoveMember: async (id, todoId) => {
    try {
      await api.pin.removeMember(id, todoId);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  pinSetActive: async (id, todoId) => {
    try {
      await api.pin.setActive(id, todoId);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  pinSetTop: async (id, value) => {
    try {
      await api.pin.setAlwaysOnTop(id, value);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  pinClose: async (id) => {
    try {
      await api.pin.close(id);
      await get().refreshPinWindows();
    } catch (e) {
      fail(set, e);
    }
  },

  refreshPinWindows: async () => {
    try {
      const pinWindows = await api.pin.list();
      const pinnedTodoIds = new Set<string>();
      pinWindows.forEach((w) => w.members.forEach((m) => pinnedTodoIds.add(m)));
      set({ pinWindows, pinnedTodoIds: [...pinnedTodoIds] });
    } catch (e) {
      fail(set, e);
    }
  },
}));
