"use client";

import { useTranslations } from "next-intl";
import { ListChecks, Star, CheckCircle2, Circle } from "lucide-react";
import { StreakBadge } from "./StreakBadge";
import { PerfectDayCrown } from "./PerfectDayCrown";

const WIDGET_COLOR = "#f59e0b";
const MAX_TASKS_SHOWN = 4;

const TIME_SLOTS = [
  { key: "morning", icon: "🌅", title: "Morgens" },
  { key: "daytime", icon: "☀️", title: "Tagsüber" },
  { key: "evening", icon: "🌙", title: "Abends" },
] as const;

interface RoutineTask {
  id: string;
  title: string;
  icon: string;
  points: number;
  order: number;
}

interface Routine {
  id: string;
  title: string;
  icon: string;
  schedule: "daily" | "weekdays" | "custom";
  customDays: number[];
  assignedTo: string;
  tasks: RoutineTask[];
}

interface StreakInfo {
  current: number;
  longest: number;
  tier: string;
  multiplier: number;
  tierIcon: string;
  flameFrom: string;
  flameTo: string;
}

interface RoutinesWidgetProps {
  routines: Routine[];
  completedTaskIds: string[];
  pointsMap: Record<string, number>;
  members: { id: string; name: string; color: string; role: string }[];
  onTap: () => void;
  streakMap?: Record<string, StreakInfo>;
  yesterdayPerfectMap?: Record<string, boolean>;
}

function isScheduledToday(routine: Routine): boolean {
  const today = new Date().getDay();
  if (routine.schedule === "daily") return true;
  if (routine.schedule === "weekdays") return today >= 1 && today <= 5;
  if (routine.schedule === "custom") return routine.customDays.includes(today);
  return false;
}

export function RoutinesWidget({
  routines,
  completedTaskIds,
  pointsMap,
  members,
  onTap,
  streakMap = {},
  yesterdayPerfectMap = {},
}: RoutinesWidgetProps) {
  const t = useTranslations("routines");

  const children = members.filter((m) => m.role === "child");

  type SlotInfo = { key: string; icon: string; title: string };
  type GroupEntry = { slot: SlotInfo; tasks: RoutineTask[]; unfinished: RoutineTask[] };

  // Per child: group tasks by time slot, find first group with unfinished tasks
  const childData = children.map((child) => {
    const todayRoutines = routines.filter(
      (r) => r.assignedTo === child.id && isScheduledToday(r)
    );

    // Group by time slot
    const groups: GroupEntry[] = TIME_SLOTS.map((slot) => {
      const slotRoutines = todayRoutines.filter((r) => r.title === slot.title);
      const tasks = slotRoutines.flatMap((r) => r.tasks);
      const unfinished = tasks.filter((t) => !completedTaskIds.includes(t.id));
      return { slot, tasks, unfinished };
    });

    // Also collect tasks from routines that don't match a time slot
    const otherRoutines = todayRoutines.filter(
      (r) => !TIME_SLOTS.some((s) => s.title === r.title)
    );
    const otherTasks = otherRoutines.flatMap((r) => r.tasks);
    const otherUnfinished = otherTasks.filter((t) => !completedTaskIds.includes(t.id));
    if (otherTasks.length > 0) {
      groups.push({
        slot: { key: "other", icon: "📋", title: "Other" },
        tasks: otherTasks,
        unfinished: otherUnfinished,
      });
    }

    const totalTasks = groups.reduce((s, g) => s + g.tasks.length, 0);
    const allDone = totalTasks > 0 && groups.every((g) => g.unfinished.length === 0);

    // First group with unfinished tasks
    const activeGroup = groups.find((g) => g.unfinished.length > 0) ?? null;

    return {
      id: child.id,
      name: child.name,
      color: child.color,
      points: pointsMap[child.id] ?? 0,
      totalTasks,
      allDone,
      activeGroup,
    };
  });

  const hasAnyTasks = childData.some((c) => c.totalTasks > 0);

  return (
    <button
      onClick={onTap}
      className="glass glass-hover w-full text-left p-5 cursor-pointer animate-slide-up"
      style={{ borderRadius: "var(--border-radius)", animationDelay: "100ms" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${WIDGET_COLOR}20, ${WIDGET_COLOR}10)`,
            border: `1px solid ${WIDGET_COLOR}30`,
            boxShadow: `0 0 20px ${WIDGET_COLOR}15`,
            color: WIDGET_COLOR,
          }}
        >
          <ListChecks size={20} strokeWidth={1.8} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: WIDGET_COLOR }}>
          {t("title")}
        </span>
      </div>

      {/* Per-child task lists */}
      <div className="space-y-4">
        {!hasAnyTasks ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {children.length === 0 ? t("noRoutines") : t("noTasksToday")}
          </p>
        ) : (
          childData
            .filter((c) => c.totalTasks > 0)
            .map((child) => {
              return (
                <div key={child.id} className="space-y-1.5">
                  {/* Child name + points */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: child.color, boxShadow: `0 0 6px ${child.color}60` }}
                      />
                      <span className="text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
                        {child.name}
                      </span>
                      {streakMap[child.id] && streakMap[child.id].current > 0 && (
                        <StreakBadge
                          current={streakMap[child.id].current}
                          tier={streakMap[child.id].tier}
                          multiplier={streakMap[child.id].multiplier}
                          tierIcon={streakMap[child.id].tierIcon}
                          flameFrom={streakMap[child.id].flameFrom}
                          flameTo={streakMap[child.id].flameTo}
                          compact
                        />
                      )}
                      {yesterdayPerfectMap[child.id] && (
                        <PerfectDayCrown show />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={11} strokeWidth={1.5} style={{ color: WIDGET_COLOR }} />
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: WIDGET_COLOR }}>
                        {child.points}
                      </span>
                    </div>
                  </div>

                  {child.allDone ? (
                    <p className="text-[12px] font-semibold pl-1" style={{ color: "var(--color-primary)" }}>
                      {t("allDone")}
                    </p>
                  ) : child.activeGroup ? (
                    <div className="space-y-1">
                      {/* Group header */}
                      <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1" style={{ color: "var(--color-text-muted)" }}>
                        {child.activeGroup.slot.icon} {child.activeGroup.slot.title}
                      </p>
                      {/* Tasks */}
                      {child.activeGroup.tasks.slice(0, MAX_TASKS_SHOWN).map((task) => {
                        const done = completedTaskIds.includes(task.id);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 px-1"
                          >
                            {done ? (
                              <CheckCircle2
                                size={13}
                                strokeWidth={2}
                                style={{ color: "var(--color-primary)", flexShrink: 0 }}
                              />
                            ) : (
                              <Circle
                                size={13}
                                strokeWidth={1.5}
                                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
                              />
                            )}
                            <span className="text-[11px] leading-none" aria-hidden="true">{task.icon}</span>
                            <span
                              className="text-[12px] flex-1 truncate"
                              style={{
                                color: done ? "var(--color-text-muted)" : "var(--color-text)",
                                textDecoration: done ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </span>
                          </div>
                        );
                      })}
                      {child.activeGroup.tasks.length > MAX_TASKS_SHOWN && (
                        <p className="text-[10px] pl-5" style={{ color: "var(--color-text-muted)" }}>
                          +{child.activeGroup.tasks.length - MAX_TASKS_SHOWN} more
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
        )}
      </div>
    </button>
  );
}
