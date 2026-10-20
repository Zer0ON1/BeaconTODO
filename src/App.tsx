import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./store/appStore";
import Sidebar from "./components/Sidebar";
import ListView from "./components/ListView";
import CalendarView from "./components/CalendarView";
import KanbanView from "./components/KanbanView";
import TodoDialog from "./components/TodoDialog";
import SettingsDialog from "./components/SettingsDialog";
import { CloseIcon, LanguageIcon, MaximizeIcon, MinimizeIcon, RestoreIcon, SettingsIcon } from "./components/Icons";
import { restoreLanguage, setLanguage } from "./i18n";
import { loadWindowAlpha } from "./lib/opacity";

export default function App() {
  const { t, i18n } = useTranslation();
  const { view, setView, loadBoot, error, dialog, closeDialog, openEditor, openPin } =
    useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    void loadBoot();
    void restoreLanguage();
    void loadWindowAlpha("main");
  }, [loadBoot]);

  // Another window wrote data (e.g. a todo created in a pin window) → refresh.
  useEffect(() => {
    let timer: number | undefined;
    const unlisten = listen("data-changed", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadBoot(), 180);
    });
    return () => {
      window.clearTimeout(timer);
      void unlisten.then((fn) => fn());
    };
  }, [loadBoot]);

  useEffect(() => {
    const unlisten = listen("pin-shortcut", () => {
      const { dialog: current } = useAppStore.getState();
      if (current?.mode === "edit") void openPin([current.todoId]);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [openPin]);

  // Tray menu → open settings / open a specific todo.
  useEffect(() => {
    const unlistenSettings = listen("open-settings", () => setSettingsOpen(true));
    const unlistenTodo = listen<string>("open-todo", (event) => {
      if (event.payload) openEditor(event.payload);
    });
    return () => {
      void unlistenSettings.then((fn) => fn());
      void unlistenTodo.then((fn) => fn());
    };
  }, [openEditor]);

  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized());
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const toggleLanguage = () =>
    void setLanguage(i18n.language === "zh-CN" ? "en-US" : "zh-CN");

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* ===== 自绘标题栏：即窗口标签页 ===== */}
      <header
        className="drag-region flex h-11 shrink-0 items-center gap-1 border-b px-2"
        style={{ background: "var(--titlebar)", borderColor: "var(--border)" }}
      >
        <span className="flex items-center gap-1.5 pl-1 pr-2 text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          BeaconTODO
        </span>

        <nav className="no-drag flex items-center gap-0.5">
          {(["list", "calendar", "kanban"] as const).map((key) => (
            <button
              key={key}
              className={`relative rounded-md px-3 py-1.5 text-xs transition-colors ${
                view === key ? "font-medium text-white" : "hover:bg-black/5"
              }`}
              style={
                view === key
                  ? { backgroundColor: "var(--accent)" }
                  : { color: "var(--text-muted)" }
              }
              onClick={() => setView(key)}
            >
              {t(`nav.${key}`)}
            </button>
          ))}
        </nav>

        <div className="no-drag ml-auto flex items-center gap-0.5">
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
            title={t("settings.language")}
            onClick={toggleLanguage}
          >
            <LanguageIcon />
          </button>
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
            title={t("nav.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </button>
          <div className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
            title={t("app.minimize")}
            onClick={() => void appWindow.minimize()}
          >
            <MinimizeIcon />
          </button>
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
            title={maximized ? t("app.restore") : t("app.maximize")}
            onClick={() => void appWindow.toggleMaximize()}
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            className="rounded-md p-1.5 transition-colors hover:bg-red-500 hover:text-white"
            style={{ color: "var(--text-muted)" }}
            title={t("app.close")}
            onClick={() => void appWindow.close()}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden bg-red-50 px-4 py-1 text-[11px] text-red-600"
        >
          {error}
        </motion.div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="h-full w-full"
            >
              {view === "list" && <ListView />}
              {view === "calendar" && <CalendarView />}
              {view === "kanban" && <KanbanView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {dialog && (
          <TodoDialog
            key={dialog.mode === "edit" ? `edit-${dialog.todoId}` : "create"}
            mode={dialog.mode}
            todoId={dialog.mode === "edit" ? dialog.todoId : undefined}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && <SettingsDialog key="settings" onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
