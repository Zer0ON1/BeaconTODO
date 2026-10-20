import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { save, open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { call } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n";
import { loadWindowAlpha, setWindowAlpha } from "../lib/opacity";

interface Props {
  onClose: () => void;
}

export default function SettingsDialog({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { todos, loadBoot } = useAppStore();
  const [message, setMessage] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  // Opacity lives in the shell (layered window) and is persisted per scope.
  useEffect(() => {
    void loadWindowAlpha("main").then(setOpacity);
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
    setMessage(
      `${summary.groups} groups / ${summary.todos} todos / ${summary.nodes} nodes`
    );
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30" onClick={onClose}>
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="no-drag w-96 rounded-xl p-5 shadow-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("settings.title")}</h2>
          <button style={{ color: "var(--text-muted)" }} onClick={onClose}>
            ✕
          </button>
        </header>

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

          {/* 窗口透明度（主窗口） */}
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
              className="flex-1 rounded border py-1.5 transition-colors hover:bg-black/5" style={{ borderColor: "var(--border)" }}
              onClick={() => void doExport()}
            >
              {t("settings.export")}
            </button>
            <button
              className="flex-1 rounded border py-1.5 transition-colors hover:bg-black/5" style={{ borderColor: "var(--border)" }}
              onClick={() => void doImport()}
            >
              {t("settings.import")}
            </button>
          </div>

          {message && (
            <p className="break-all rounded bg-green-50 px-2 py-1 text-[11px] text-green-700">{message}</p>
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
