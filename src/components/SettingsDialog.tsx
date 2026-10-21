import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { save, open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { call } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n";
import { loadWindowAlpha, setWindowAlpha } from "../lib/opacity";
import { ExternalIcon, GithubIcon } from "./Icons";
import type { AppInfo, HealthStatus } from "../types";

const REPO_URL = "https://github.com/Zer0ON1/BeaconTODO";

interface Props {
  onClose: () => void;
}

/**
 * Reads what only the webview knows: the WebView2 build and the Windows
 * version. Win10 and Win11 share "Windows NT 10.0" in the UA, so the real
 * platform version comes from userAgentData when the engine exposes it.
 */
async function detectEnvironment(): Promise<{ os: string; webview: string }> {
  const ua = navigator.userAgent;
  // UA reduction reports Edg/155.0.0.0, so this is only the fallback.
  let webview =
    ua.match(/Edg\/([\d.]+)/)?.[1] ?? ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "—";
  let os = "Windows";
  try {
    const uaData = (
      navigator as Navigator & {
        userAgentData?: {
          getHighEntropyValues?: (hints: string[]) => Promise<{
            platformVersion?: string;
            fullVersionList?: { brand: string; version: string }[];
          }>;
        };
      }
    ).userAgentData;
    if (uaData?.getHighEntropyValues) {
      const values = await uaData.getHighEntropyValues([
        "platformVersion",
        "fullVersionList",
      ]);
      const chromium = values.fullVersionList?.find((b) => b.brand === "Chromium");
      if (chromium?.version) webview = chromium.version;

      const version = values.platformVersion ?? "";
      const major = Number(version.split(".")[0] ?? 0);
      if (major >= 13) os = `Windows 11 (${version})`;
      else if (major > 0) os = `Windows 10 (${version})`;
    }
  } catch {
    /* keep the plain fallback label */
  }
  return { os, webview };
}

export default function SettingsDialog({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { todos, loadBoot } = useAppStore();
  const [tab, setTab] = useState<"general" | "about">("general");
  const [message, setMessage] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [env, setEnv] = useState<{ os: string; webview: string }>({
    os: "—",
    webview: "—",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadWindowAlpha("main").then(setOpacity);
    void api.appInfo().then(setInfo).catch(() => {});
    void api.health().then(setHealth).catch(() => {});
    void detectEnvironment().then(setEnv);
  }, []);

  const changeOpacity = async (value: number) => {
    setOpacity(value);
    const applied = await setWindowAlpha("main", value);
    setOpacity(applied);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doExport = async () => {
    const path = await save({
      defaultPath: `beacontodo-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const data = await api.data.exportJson();
    await call<void>("write_text_file", { path, contents: JSON.stringify(data, null, 2) });
    setMessage(path);
  };

  const doImport = async () => {
    const path = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path) return;
    const raw = await call<string>("read_text_file", { path });
    const summary = await api.data.importJson(JSON.parse(raw));
    await loadBoot();
    setMessage(`${summary.groups} groups / ${summary.todos} todos / ${summary.nodes} nodes`);
  };

  const envRow = (label: string, value: string, mono = false) => (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[11px] ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--text-muted)" }}
        title={value}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30" onClick={onClose}>
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="no-drag flex max-h-[86vh] w-[400px] flex-col overflow-hidden rounded-xl shadow-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {t("settings.title")}
          </h2>
          <button className="text-xs" style={{ color: "var(--text-muted)" }} onClick={onClose}>
            ✕
          </button>
        </header>

        {/* Tabs */}
        <div className="mt-3 flex gap-4 px-5">
          {(["general", "about"] as const).map((key) => (
            <button
              key={key}
              className="relative pb-1.5 text-xs transition-colors"
              style={{ color: tab === key ? "var(--accent-text)" : "var(--text-muted)" }}
              onClick={() => setTab(key)}
            >
              {t(key === "general" ? "settings.tabGeneral" : "settings.tabAbout")}
              {tab === key && (
                <motion.span
                  layoutId="settings-tab"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ background: "var(--accent)" }}
                  transition={{ duration: 0.18 }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="border-b" style={{ borderColor: "var(--border)" }} />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "general" ? (
            <div className="space-y-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <div className="flex items-center justify-between">
                <span>{t("settings.language")}</span>
                <div className="flex overflow-hidden rounded border" style={{ borderColor: "var(--border)" }}>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      className={`px-2 py-1 transition-colors ${i18n.language === lang ? "text-white" : ""}`}
                      style={i18n.language === lang ? { background: "var(--accent)" } : { color: "var(--text-muted)" }}
                      onClick={() => void setLanguage(lang)}
                    >
                      {lang === "zh-CN" ? "中文" : "EN"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span>{t("settings.autoComplete")}</span>
                <ToggleSetting settingKey="autoCompleteTodo" defaultValue />
              </div>

              <div className="flex items-center justify-between">
                <span>{t("settings.completedToBottom")}</span>
                <ToggleSetting settingKey="completedToBottom" defaultValue />
              </div>

              <div className="flex items-center justify-between">
                <span>{t("settings.calendarColor")}</span>
                <span style={{ color: "var(--text-faint)" }}>{t("settings.colorByStarted")}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="shrink-0">{t("settings.opacity")}</span>
                <input
                  type="range"
                  min={35}
                  max={100}
                  step={1}
                  className="h-1 flex-1 cursor-pointer accent-[color:var(--accent)]"
                  value={Math.round(opacity * 100)}
                  onChange={(e) => void changeOpacity(Number(e.target.value) / 100)}
                />
                <span className="w-9 shrink-0 text-right tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {Math.round(opacity * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <span>{t("settings.backupInfo")}</span>
                <span style={{ color: "var(--text-faint)" }}>{todos.length}</span>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 rounded border py-1.5 transition-colors hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => void doExport()}
                >
                  {t("settings.export")}
                </button>
                <button
                  className="flex-1 rounded border py-1.5 transition-colors hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => void doImport()}
                >
                  {t("settings.import")}
                </button>
              </div>

              {message && (
                <p className="break-all rounded bg-green-50 px-2 py-1 text-[11px] text-green-700">{message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* App identity */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  BeaconTODO
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] tabular-nums"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
                >
                  v{info?.version ?? "—"}
                </span>
                {info?.debug && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                    {t("about.devBuild")}
                  </span>
                )}
              </div>
              <p className="-mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                {t("about.tagline")}
              </p>

              {/* GitHub */}
              <button
                className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-black/[0.03]"
                style={{ borderColor: "var(--border)" }}
                title={REPO_URL}
                onClick={() => void openUrl(REPO_URL).catch(() => {})}
              >
                <span className="shrink-0" style={{ color: "var(--text)" }}>
                  <GithubIcon size={16} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                  github.com/Zer0ON1/BeaconTODO
                </span>
                <span className="shrink-0" style={{ color: "var(--text-faint)" }}>
                  <ExternalIcon />
                </span>
              </button>

              {/* Runtime environment */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {t("about.environment")}
                </p>
                <div
                  className="space-y-1.5 rounded-lg border p-2.5"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  {envRow(t("about.os"), env.os)}
                  {envRow(t("about.arch"), info?.arch ?? "—")}
                  {envRow(t("about.webview"), env.webview)}
                  {envRow(
                    t("about.database"),
                    health
                      ? `${health.dbOk ? t("about.dbOk") : t("about.dbError")} · ${t("about.schema", {
                          version: health.schemaVersion,
                        })}`
                      : "—"
                  )}
                  {envRow(t("about.dataDir"), info?.dataDir ?? "—", true)}
                </div>
              </div>
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".json" className="hidden" />
      </motion.section>
    </div>
  );
}

function ToggleSetting({ settingKey, defaultValue }: { settingKey: string; defaultValue: boolean }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <button
      className="toggle-track"
      data-on={value || undefined}
      onClick={() => {
        const next = !value;
        setValue(next);
        void api.settings.set(settingKey, String(next));
      }}
    >
      <span className="toggle-knob" />
    </button>
  );
}
