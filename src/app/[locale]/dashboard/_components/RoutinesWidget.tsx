"use client";

import { useTranslations } from "next-intl";
import { ListChecks, Star } from "lucide-react";

const WIDGET_COLOR = "#f59e0b";

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

interface ChildProgress {
  memberId: string;
  name: string;
  color: string;
  totalTasksToday: number;
  doneTasksToday: number;
  points: number;
}

interface RoutinesWidgetProps {
  routines: Routine[];
  completedTaskIds: string[];   // task IDs completed today (for the current user)
  pointsMap: Record<string, number>;
  members: { id: string; name: string; color: string; role: string }[];
  onTap: () => void;
}

function isScheduledToday(routine: Routine): boolean {
  const today = new Date().getDay(); // 0=Sun … 6=Sat
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
}: RoutinesWidgetProps) {
  const t = useTranslations("routines");

  const children = members.filter((m) => m.role === "child");

  const childProgress: ChildProgress[] = children.map((child) => {
    const todayRoutines = routines.filter(
      (r) => r.assignedTo === child.id && isScheduledToday(r)
    );
    const allTasks = todayRoutines.flatMap((r) => r.tasks);
    const doneTasks = allTasks.filter((t) => completedTaskIds.includes(t.id));

    return {
      memberId: child.id,
      name: child.name,
      color: child.color,
      totalTasksToday: allTasks.length,
      doneTasksToday: doneTasks.length,
      points: pointsMap[child.id] ?? 0,
    };
  });

  const hasAnyTasks = childProgress.some((c) => c.totalTasksToday > 0);

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

      {/* Per-child rows */}
      <div className="space-y-3">
        {!hasAnyTasks ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {children.length === 0 ? t("noRoutines") : t("noTasksToday")}
          </p>
        ) : (
          childProgress
            .filter((c) => c.totalTasksToday > 0)
            .map((child) => {
              const pct = child.totalTasksToday > 0
                ? Math.round((child.doneTasksToday / child.totalTasksToday) * 100)
                : 0;
              const allDone = child.doneTasksToday === child.totalTasksToday;

              return (
                <div key={child.memberId} className="space-y-1.5">
                  {/* Name row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: child.color, boxShadow: `0 0 6px ${child.color}60` }}
                      />
                      <span className="text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
                        {child.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={11} strokeWidth={1.5} style={{ color: WIDGET_COLOR }} />
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: WIDGET_COLOR }}>
                        {child.points}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: allDone
                          ? `linear-gradient(90deg, ${child.color}, #fde68a)`
                          : `linear-gradient(90deg, ${WIDGET_COLOR}cc, ${WIDGET_COLOR}66)`,
                        boxShadow: allDone ? `0 0 8px ${child.color}60` : undefined,
                      }}
                    />
                  </div>

                  {/* Count label */}
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {allDone
                      ? t("tasksComplete")
                      : t("taskProgress", { done: child.doneTasksToday, total: child.totalTasksToday })}
                  </p>
                </div>
              );
            })
        )}
      </div>
    </button>
  );
}
