import { call } from "./tauri";

export const MIN_OPACITY = 0.35;
export const DEFAULT_OPACITY = 1;

export type OpacityScope = "main" | "pin";

export function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return DEFAULT_OPACITY;
  return Math.min(1, Math.max(MIN_OPACITY, alpha));
}

/**
 * Opacity is applied in CSS (`--window-alpha`) to the background surfaces only,
 * so text stays crisp while the window lets the desktop through.
 */
export function applyWindowAlpha(alpha: number): number {
  const value = clampAlpha(alpha);
  document.documentElement.style.setProperty("--window-alpha", String(value));
  return value;
}

/** Load the persisted value for this window scope and apply it. */
export async function loadWindowAlpha(scope: OpacityScope): Promise<number> {
  try {
    const value = await call<number>("get_window_opacity", { label: scope });
    return applyWindowAlpha(value);
  } catch {
    return applyWindowAlpha(DEFAULT_OPACITY);
  }
}

/** Apply + persist. */
export async function setWindowAlpha(scope: OpacityScope, alpha: number): Promise<number> {
  const value = applyWindowAlpha(alpha);
  try {
    await call<number>("set_window_opacity", { label: scope, alpha: value });
  } catch {
    /* non-fatal: visual change already applied */
  }
  return value;
}
