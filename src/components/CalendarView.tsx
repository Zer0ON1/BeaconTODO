import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import type { Node, Todo } from "../types";
import { useAppStore } from "../store/appStore";
import { calendarColor, isOverdue, PRIORITY_I18N, today } from "../lib/visual";

const WEEK_LABELS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DayItem {
  todo: Todo;
  isStart: boolean;
  isEnd: boolean;
}

export default function CalendarView() {
  const { t, i18n } = useTranslation();
  const { todos, groups, nodesByTodo, loadNodes, createTodo, openEditor } = useAppStore();
  const [cursor, setCursor] = useState(() => dayjs());

  useEffect(() => {
    todos.forEach((todo) => {
      void loadNodes(todo.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.length]);

  const weeks = useMemo(() => {
    const first = cursor.startOf("month");
    const start = first.subtract((first.day() + 6) % 7, "day");
    const last = cursor.endOf("month");
    const end = last.add(6 - ((last.day() + 6) % 7), "day");
    const days: dayjs.Dayjs[] = [];
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "day")) {
      days.push(current);
      current = current.add(1, "day");
    }
    const rows: dayjs.Dayjs[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const visibleTodos = todos.filter((todo) => todo.status !== "archived" && todo.startDate);
  const allNodes: Node[] = Object.values(nodesByTodo).flat();
  const allMilestones = allNodes.filter((n) => n.isMilestone);

  const itemsForDay = (day: dayjs.Dayjs): DayItem[] => {
    const key = day.format("YYYY-MM-DD");
    return visibleTodos
      .filter((todo) => {
        const end = todo.endDate ?? todo.startDate!;
        return key >= todo.startDate! && key <= end;
      })
      .map((todo) => ({
        todo,
        isStart: todo.startDate === key,
        isEnd: (todo.endDate ?? todo.startDate!) === key,
      }));
  };

  const quickCreate = (day: dayjs.Dayjs) => {
    const groupId = groups[0]?.id;
    if (!groupId) return;
    void createTodo({
      groupId,
      title: `${t("todo.new")} ${day.format("MM-DD")}`,
      startDate: day.format("YYYY-MM-DD"),
    });
  };

  const weekLabels = i18n.language === "zh-CN" ? WEEK_LABELS_ZH : WEEK_LABELS_EN;

  return (
    <div className="flex h-full flex-col p-4">
      <header className="mb-2 flex items-center gap-2">
        <button
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
          onClick={() => setCursor(dayjs())}
        >
          {t("common.today")}
        </button>
        <button
          className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          onClick={() => setCursor(cursor.subtract(1, "month"))}
        >
          ‹
        </button>
        <span className="text-sm font-medium text-slate-700">{cursor.format("YYYY 年 MM 月")}</span>
        <button
          className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          onClick={() => setCursor(cursor.add(1, "month"))}
        >
          ›
        </button>
        <span className="ml-auto text-[11px] text-slate-400">
          {i18n.language === "zh-CN" ? "双击空白日期快速创建" : "Double-click a day to create"}
        </span>
      </header>

      <div
        className="grid flex-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200"
        style={{ gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `auto repeat(${weeks.length}, 1fr)` }}
      >
        {weekLabels.map((label, index) => (
          <div
            key={index}
            className="bg-slate-50 px-2 py-1 text-center text-[11px] font-medium text-slate-500"
          >
            {label}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const key = day.format("YYYY-MM-DD");
          const isToday = key === today();
          const items = itemsForDay(day);
          const dayMilestones = allMilestones.filter(
            (m) => m.startDate && m.startDate <= key && key <= (m.endDate ?? m.startDate)
          );
          const dayNodes = allNodes.filter(
            (n) => !n.isMilestone && n.startDate && n.startDate <= key && key <= (n.endDate ?? n.startDate)
          );
          const total = items.length + dayMilestones.length + dayNodes.length;
          return (
            <div
              key={key}
              className={`flex min-h-0 flex-col bg-white p-1 ${
                day.month() !== cursor.month() ? "opacity-40" : ""
              }`}
              onDoubleClick={() => quickCreate(day)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] ${
                    isToday ? "rounded-full bg-blue-500 px-1.5 text-white" : "text-slate-400"
                  }`}
                >
                  {day.date()}
                </span>
                {total > 3 && <span className="text-[10px] text-slate-300">+{total - 3}</span>}
              </div>
              <div className="mt-0.5 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map(({ todo, isStart, isEnd }) => (
                  <button
                    key={todo.id}
                    className={`flex h-3.5 w-full items-center gap-1 overflow-hidden px-1 text-left text-[10px] leading-[14px] text-white ${
                      isStart ? "rounded-l" : "-ml-px"
                    } ${isEnd ? "rounded-r" : ""}`}
                    style={{ backgroundColor: calendarColor(todo) }}
                    title={`${todo.title}${isOverdue(todo) ? " · " + t("calendar.overdue") : ""}`}
                    onClick={() => openEditor(todo.id)}
                  >
                    {isStart ? (
                      <>
                        {/* 优先级短标：最急 / 紧急 / 中 / 闲 */}
                        <span className="shrink-0 rounded-[2px] bg-white/30 px-[3px] text-[9px] font-medium">
                          {t(PRIORITY_I18N[todo.priority])}
                        </span>
                        <span className="truncate">{todo.title}</span>
                      </>
                    ) : (
                      <span className="truncate">·</span>
                    )}
                  </button>
                ))}
                {dayMilestones.slice(0, Math.max(0, 3 - items.length)).map((m) => {
                  const owner = todos.find((td) => td.id === m.todoId);
                  return (
                    <div
                      key={m.id}
                      className="truncate text-[10px] font-medium"
                      style={{ color: owner ? calendarColor(owner) : "var(--text-muted)" }}
                      title={m.title}
                    >
                      ◆ {m.title}
                    </div>
                  );
                })}
                {dayNodes.slice(0, Math.max(0, 3 - items.length - dayMilestones.length)).map((n) => {
                  const todo = todos.find((td) => td.id === n.todoId);
                  // Only the first day of a node span shows its title; later
                  // days render a dot so multi-day nodes don't repeat text.
                  const isStart = n.startDate === key;
                  return (
                    <div key={n.id} className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: todo ? calendarColor(todo) : "#B4B2A9" }}
                      />
                      {isStart ? `${n.isMilestone ? "◆ " : ""}${n.title}` : "·"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
