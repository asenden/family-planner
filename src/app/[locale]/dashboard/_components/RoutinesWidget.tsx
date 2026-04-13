"use client";

import { useTranslations } from "next-intl";
import { ListChecks, Star, CheckCircle2, Circle } from "lucide-react";

const WIDGET_COLOR = "#f59e0b";
const MAX_TASKS_SHOWN = 5;

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

interface RoutinesWidgetProps {
  routines: Routine[];
  completedTaskIds: string[];
  pointsMap: Record<string, number>;
  members: { id: string; name: string; color: string; role: string }[];
  onTap: () => void;
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
}: RoutinesWidgetProps) {
  const t = useTranslations("routines");

  const children = members.filter((m) => m.role === "child");

  // Collect all today's tasks per child (flat, from all routines)
  const childData = children.map((child) => {
    const todayTasks = routines
      .filter((r) => r.assignedTo === child.id && isScheduledToday(r))
      .flatMap((r) => r.tasks);
    return {
      id: child.id,
      name: child.name,
      color: child.color,
      tasks: todayTasks,
      points: pointsMap[child.id] ?? 0,
    };
  });

  const hasAnyTasks = childData.some((c) => c.tasks.length > 0);

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
            .filter((c) => c.tasks.length > 0)
            .map((child) => {
              const shown = child.tasks.slice(0, MAX_TASKS_SHOWN);
              const remaining = child.tasks.length - shown.length;

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
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={11} strokeWidth={1.5} style={{ color: WIDGET_COLOR }} />
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: WIDGET_COLOR }}>
                        {child.points}
                      </span>
                    </div>
                  </div>

                  {/* Mini task checklist */}
                  <div className="space-y-1">
                    {shown.map((task) => {
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
                    {remaining > 0 && (
                      <p className="text-[10px] pl-5" style={{ color: "var(--color-text-muted)" }}>
                        +{remaining} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </button>
  );
}
