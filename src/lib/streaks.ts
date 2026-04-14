import { db } from "@/lib/db";
import { STREAK_TIERS, STREAK_MILESTONES } from "./gamification-constants";

export function getStreakTier(current: number) {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (current >= STREAK_TIERS[i].minDays) return STREAK_TIERS[i];
  }
  return STREAK_TIERS[0];
}

export function isStreakMilestone(current: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(current);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round(Math.abs(aDay - bDay) / msPerDay);
}

/**
 * Check if a child has completed ALL scheduled tasks for today.
 * Returns { isPerfectDay, totalTasks, completedTasks }
 */
export async function checkPerfectDay(
  memberId: string,
  familyId: string,
  today: Date
): Promise<{ isPerfectDay: boolean; totalTasks: number; completedTasks: number }> {
  const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayOfWeek = today.getDay();

  // Get all routines assigned to this child
  const routines = await db.routine.findMany({
    where: { familyId, assignedTo: memberId },
    include: { tasks: { select: { id: true } } },
  });

  // Filter to today's scheduled routines
  const scheduledRoutines = routines.filter((r) => {
    if (r.schedule === "daily") return true;
    if (r.schedule === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (r.schedule === "custom") return (r.customDays as number[]).includes(dayOfWeek);
    return false;
  });

  const allTaskIds = scheduledRoutines.flatMap((r) => r.tasks.map((t) => t.id));
  if (allTaskIds.length === 0) return { isPerfectDay: false, totalTasks: 0, completedTasks: 0 };

  const completions = await db.routineCompletion.findMany({
    where: { memberId, taskId: { in: allTaskIds }, date: todayStart },
  });

  return {
    isPerfectDay: completions.length >= allTaskIds.length,
    totalTasks: allTaskIds.length,
    completedTasks: completions.length,
  };
}

/**
 * Recompute streak for a child after a perfect day check.
 * Called when all tasks are completed (or unchecked).
 */
export async function recomputeStreak(
  memberId: string,
  today: Date
): Promise<{ current: number; longest: number; milestoneHit: number | null }> {
  const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const todayKey = toDateKey(today);

  let streak = await db.streak.findUnique({ where: { memberId } });
  if (!streak) {
    streak = await db.streak.create({
      data: { memberId, current: 0, longest: 0 },
    });
  }

  let newCurrent = streak.current;
  let newLongest = streak.longest;
  let milestoneHit: number | null = null;

  if (streak.lastDate) {
    const lastKey = toDateKey(streak.lastDate);
    const gap = daysBetween(streak.lastDate, today);

    if (lastKey === todayKey) {
      // Already counted today — no change
    } else if (gap === 1) {
      // Consecutive day
      newCurrent = streak.current + 1;
    } else if (gap === 2 && streak.frozenUntil && streak.frozenUntil >= todayStart) {
      // Freeze covers the gap
      newCurrent = streak.current + 1;
    } else {
      // Gap too large — reset
      newCurrent = 1;
    }
  } else {
    newCurrent = 1;
  }

  newLongest = Math.max(newLongest, newCurrent);

  if (newCurrent !== streak.current && isStreakMilestone(newCurrent)) {
    milestoneHit = newCurrent;
  }

  await db.streak.update({
    where: { id: streak.id },
    data: { current: newCurrent, longest: newLongest, lastDate: todayStart },
  });

  return { current: newCurrent, longest: newLongest, milestoneHit };
}

/**
 * Handle unchecking a task — potentially break today's perfect day and revert streak.
 */
export async function handleUncheck(memberId: string, today: Date): Promise<void> {
  const todayKey = toDateKey(today);
  const streak = await db.streak.findUnique({ where: { memberId } });

  if (streak?.lastDate && toDateKey(streak.lastDate) === todayKey) {
    // Today was counted — revert
    await db.streak.update({
      where: { id: streak.id },
      data: {
        current: Math.max(0, streak.current - 1),
        lastDate: streak.current > 1 ? (() => {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));
        })() : null,
      },
    });
  }
}
