import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { call } from "../lib/tauri";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";

export const SUPPORTED_LANGUAGES = ["zh-CN", "en-US"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_SETTING_KEY = "language";

void i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    "en-US": { translation: enUS },
  },
  lng: "zh-CN",
  fallbackLng: "zh-CN",
  interpolation: { escapeValue: false },
});

/**
 * Switch language and persist it, so the tray menu and the next launch use the
 * same language. Failures are silent — the UI has already switched.
 */
export async function setLanguage(lang: string): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await call<void>("settings_set", { key: LANGUAGE_SETTING_KEY, value: lang });
    await call<void>("refresh_tray");
  } catch {
    /* non-fatal: persistence only */
  }
}

/** Load the persisted language on boot (main window only). */
export async function restoreLanguage(): Promise<void> {
  try {
    const lang = await call<string | null>("settings_get", { key: LANGUAGE_SETTING_KEY });
    if (lang && lang !== i18n.language) await i18n.changeLanguage(lang);
  } catch {
    /* non-fatal */
  }
}

export default i18n;
