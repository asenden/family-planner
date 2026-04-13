"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, Square, Trophy, ChevronLeft, Star } from "lucide-react";
import { ThermometerBar } from "./ThermometerBar";

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

interface Reward {
  id: string;
  title: string;
  icon: string;
  cost: number;
  redemptions: { id: string; memberId: string }[];
}

interface Member {
  id: string;
  name: string;
  color: string;
  role: string;
}

interface RoutinesFullViewProps {
  familyId: string;
  routines: Routine[];
  rewards: Reward[];
  members: Member[];
  pointsMap: Record<string, number>;
  initialCompletedTaskIds: string[];
  onBack: () => void;
}

type Tab = "tasks" | "goals";

function isScheduledToday(routine: Routine): boolean {
  const today = new Date().getDay();
  if (routine.schedule === "daily") return true;
  if (routine.schedule === "weekdays") return today >= 1 && today <= 5;
  if (routine.schedule === "custom") return routine.customDays.includes(today);
  return false;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RoutinesFullView({
  familyId,
  routines,
  rewards,
  members,
  pointsMap: initialPointsMap,
  initialCompletedTaskIds,
  onBack,
}: RoutinesFullViewProps) {
  const t = useTranslations("routines");
  const [tab, setTab] = useState<Tab>("tasks");
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedTaskIds)
  );
  const [pointsMap, setPointsMap] = useState(initialPointsMap);
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(new Set());
  const [redeemConfirm, setRedeemConfirm] = useState<Reward | null>(null);
  const [redeemingFor, setRedeemingFor] = useState<string | null>(null);
  const [flashTaskId, setFlashTaskId] = useState<string | null>(null);

  const children = members.filter((m) => m.role === "child");
  const date = todayDateStr();

  const toggleTask = useCallback(async (taskId: string, memberId: string, task: RoutineTask) => {
    if (pendingTasks.has(taskId)) return;

    const wasCompleted = completedIds.has(taskId);
    const nowCompleted = !wasCompleted;

    // Optimistic update
    setPendingTasks((prev) => new Set(prev).add(taskId));
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (nowCompleted) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
    setPointsMap((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? 0) + (nowCompleted ? task.points : -task.points),
    }));

    if (nowCompleted) {
      setFlashTaskId(taskId);
      setTimeout(() => setFlashTaskId(null), 600);
    }

    try {
      await fetch(`/api/families/${familyId}/routine-completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, memberId, date, completed: nowCompleted }),
      });
    } catch {
      // Rollback on error
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (wasCompleted) next.add(taskId);
        else next.delete(taskId);
        return next;
      });
      setPointsMap((prev) => ({
        ...prev,
        [memberId]: (prev[memberId] ?? 0) + (nowCompleted ? -task.points : task.points),
      }));
    } finally {
      setPendingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [familyId, completedIds, pendingTasks, date]);

  async function handleRedeem(reward: Reward, memberId: string) {
    setRedeemConfirm(null);
    setRedeemingFor(memberId);

    try {
      const res = await fetch(`/api/families/${familyId}/reward-redemptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id, memberId }),
      });

      if (res.ok) {
        const data = await res.json();
        setPointsMap((prev) => ({ ...prev, [memberId]: data.newPoints }));
      }
    } finally {
      setRedeemingFor(null);
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div
        className="glass flex items-center justify-between px-5 py-4"
        style={{ borderRadius: "var(--border-radius)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
          <span className="text-sm font-semibold">{t("title")}</span>
        </button>

        {/* Tab switcher */}
        <div
          className="flex gap-1 p-1"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12 }}
        >
          {(["tasks", "goals"] as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 cursor-pointer font-semibold transition-all"
              style={{
                borderRadius: 10,
                backgroundColor: tab === key ? "var(--color-primary)" : "transparent",
                color: tab === key ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {key === "tasks" ? <CheckSquare size={14} strokeWidth={1.5} /> : <Trophy size={14} strokeWidth={1.5} />}
              {key === "tasks" ? t("title") : t("rewardsShop")}
            </button>
          ))}
        </div>

        {/* Total points display */}
        <div className="flex items-center gap-1.5">
          <Star size={16} strokeWidth={1.5} style={{ color: "#f59e0b" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "#f59e0b" }}>
            {Object.values(pointsMap).reduce((a, b) => a + b, 0)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {tab === "tasks" && (
          <>
            {children.length === 0 && (
              <div className="glass p-6 text-center" style={{ borderRadius: "var(--border-radius)" }}>
                <p style={{ color: "var(--color-text-muted)" }}>{t("noRoutines")}</p>
              </div>
            )}
            {children.map((child) => {
              // Collect today's tasks for this child across scheduled routines (flat)
              const allTasks = routines
                .filter((r) => r.assignedTo === child.id && isScheduledToday(r))
                .flatMap((r) => r.tasks);
              const childPoints = pointsMap[child.id] ?? 0;

              return (
                <div key={child.id} className="space-y-2">
                  {/* Child header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: child.color, boxShadow: `0 0 8px ${child.color}60` }}
                      />
                      <span className="font-bold text-base" style={{ color: "var(--color-text)" }}>
                        {child.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={14} strokeWidth={1.5} style={{ color: "#f59e0b" }} />
                      <span className="text-sm font-bold tabular-nums" style={{ color: "#f59e0b" }}>
                        {t("totalPoints", { count: childPoints })}
                      </span>
                    </div>
                  </div>

                  {allTasks.length === 0 ? (
                    <div
                      className="glass p-4"
                      style={{ borderRadius: "var(--border-radius)" }}
                    >
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        {t("noTasksToday")}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="glass p-4 space-y-1"
                      style={{ borderRadius: "var(--border-radius)" }}
                    >
                      {allTasks.map((task) => {
                        const done = completedIds.has(task.id);
                        const pending = pendingTasks.has(task.id);
                        const flashing = flashTaskId === task.id;

                        return (
                          <button
                            key={task.id}
                            disabled={pending}
                            onClick={() => toggleTask(task.id, child.id, task)}
                            className="flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-xl transition-all cursor-pointer"
                            style={{
                              backgroundColor: done ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
                              opacity: pending ? 0.6 : 1,
                              animation: flashing ? "task-complete 0.5s ease" : undefined,
                            }}
                          >
                            {done ? (
                              <CheckSquare
                                size={20}
                                strokeWidth={1.5}
                                style={{ color: "var(--color-primary)", flexShrink: 0 }}
                              />
                            ) : (
                              <Square
                                size={20}
                                strokeWidth={1.5}
                                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
                              />
                            )}
                            <span className="text-lg leading-none" aria-hidden="true">{task.icon}</span>
                            <span
                              className="flex-1 text-sm font-medium"
                              style={{
                                color: done ? "var(--color-text-muted)" : "var(--color-text)",
                                textDecoration: done ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </span>
                            <span
                              className="text-[11px] font-bold tabular-nums"
                              style={{ color: done ? "var(--color-primary)" : "#f59e0b" }}
                            >
                              +{task.points}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "goals" && (
          <>
            {rewards.length === 0 ? (
              <div className="glass p-6 text-center" style={{ borderRadius: "var(--border-radius)" }}>
                <p style={{ color: "var(--color-text-muted)" }}>{t("noRewards")}</p>
              </div>
            ) : (
              children.map((child) => {
                const childPoints = pointsMap[child.id] ?? 0;

                return (
                  <div key={child.id} className="space-y-2">
                    {/* Child header */}
                    <div className="flex items-center gap-2 px-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: child.color, boxShadow: `0 0 8px ${child.color}60` }}
                      />
                      <span className="font-bold text-base" style={{ color: "var(--color-text)" }}>
                        {child.name}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star size={14} strokeWidth={1.5} style={{ color: "#f59e0b" }} />
                        <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                          {t("totalPoints", { count: childPoints })}
                        </span>
                      </div>
                    </div>

                    {/* Rewards grid */}
                    <div
                      className="glass p-4"
                      style={{ borderRadius: "var(--border-radius)" }}
                    >
                      <div className="flex flex-wrap gap-4">
                        {rewards.map((reward) => {
                          const canAfford = childPoints >= reward.cost;
                          const pct = Math.min(100, Math.round((childPoints / reward.cost) * 100));
                          const rewardColor = canAfford ? "#f59e0b" : "#a78bfa";

                          return (
                            <div
                              key={reward.id}
                              className="flex flex-col items-center gap-2"
                              style={{ minWidth: 80 }}
                            >
                              {/* Thermometer */}
                              <ThermometerBar
                                current={childPoints}
                                cost={reward.cost}
                                color={rewardColor}
                                height={100}
                              />

                              {/* Reward info */}
                              <span className="text-2xl leading-none">{reward.icon}</span>
                              <span
                                className="text-[11px] font-semibold text-center leading-tight"
                                style={{ color: "var(--color-text)", maxWidth: 80 }}
                              >
                                {reward.title}
                              </span>
                              <span
                                className="text-[10px]"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                {t("progressLabel", { current: childPoints, cost: reward.cost })}
                              </span>

                              {canAfford ? (
                                <button
                                  onClick={() => { setRedeemConfirm(reward); setRedeemingFor(child.id); }}
                                  disabled={redeemingFor === child.id}
                                  className="text-[11px] font-bold px-3 py-1 rounded-lg cursor-pointer transition-all"
                                  style={{
                                    backgroundColor: "#f59e0b",
                                    color: "#1a1625",
                                    boxShadow: "0 0 12px rgba(245,158,11,0.4)",
                                  }}
                                >
                                  {t("redeemButton")}
                                </button>
                              ) : (
                                <span
                                  className="text-[10px]"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {pct}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Redeem confirm dialog */}
      {redeemConfirm && redeemingFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setRedeemConfirm(null)}
        >
          <div
            className="glass p-6 max-w-sm mx-4 text-center space-y-4"
            style={{ borderRadius: "var(--border-radius)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl">{redeemConfirm.icon}</span>
            <p className="font-bold text-lg" style={{ color: "var(--color-text)" }}>
              {t("redeemConfirm", { title: redeemConfirm.title, cost: redeemConfirm.cost })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRedeemConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold cursor-pointer"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "var(--color-text-muted)" }}
              >
                {t("title")}
              </button>
              <button
                onClick={() => handleRedeem(redeemConfirm, redeemingFor!)}
                className="flex-1 py-2.5 rounded-xl font-bold cursor-pointer"
                style={{ backgroundColor: "#f59e0b", color: "#1a1625", boxShadow: "0 0 12px rgba(245,158,11,0.4)" }}
              >
                {t("redeemButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes task-complete {
          0%   { transform: scale(1); background-color: rgba(167,139,250,0.0); }
          40%  { transform: scale(1.02); background-color: rgba(167,139,250,0.15); }
          100% { transform: scale(1); background-color: rgba(167,139,250,0.08); }
        }
      `}</style>
    </div>
  );
}
