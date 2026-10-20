import { invoke } from "@tauri-apps/api/core";

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string;

  constructor(code: string, message: string, requestId: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

interface ErrorPayload {
  code: string;
  message: string;
  request_id?: string;
}

function toApiError(e: unknown): ApiError {
  if (typeof e === "object" && e !== null) {
    const payload = e as Partial<ErrorPayload>;
    if (typeof payload.code === "string") {
      return new ApiError(payload.code, payload.message ?? "unknown error", payload.request_id ?? "");
    }
    if (typeof (e as Error).message === "string") {
      return new ApiError("UNKNOWN", (e as Error).message, "");
    }
  }
  return new ApiError("UNKNOWN", String(e), "");
}

/**
 * Commands that only read data. Everything else is a write and triggers a
 * cross-window refresh, so a todo created in a pin window shows up in the main
 * window immediately (each WebView has its own JS context).
 */
const READ_ONLY = new Set([
  "health_check",
  "groups_list",
  "todos_list",
  "nodes_list",
  "nodes_list_all",
  "milestones_list",
  "pin_windows_list",
  "pin_get",
  "settings_get",
  "export_json",
  "read_text_file",
  "get_window_opacity",
  "refresh_tray",
  "notify_changed",
]);

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const result = await invoke<T>(cmd, args);
    if (!READ_ONLY.has(cmd)) {
      void invoke("notify_changed").catch(() => {});
    }
    return result;
  } catch (e) {
    throw toApiError(e);
  }
}
