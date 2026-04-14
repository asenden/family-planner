import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkPerfectDay,
  recomputeStreak,
  handleUncheck,
  getStreakTier,
} from "@/lib/streaks";
import {
  rollCriticalHit,
  getCriticalMultiplier,
  spinMysteryWheel,
  getPerfectDayBonus,
} from "@/lib/variable-rewards";

// POST { taskId, memberId, date: "YYYY-MM-DD", completed: boolean }
// completed=true  → upsert a RoutineCompletion record
// completed=false → delete the record (un-check)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, memberId, date, completed } = body;

  if (!taskId || !memberId || !date) {
    return NextResponse.json(
      { error: "Missing required fields: taskId, memberId, date" },
      { status: 400 }
    );
  }

  const dateStr = date as string;
  const dateValue = new Date(dateStr); // "YYYY-MM-DD" → UTC midnight
  const todayStart = dateValue;

  try {
    // 1. Toggle the completion
    if (completed === false) {
      await db.routineCompletion.deleteMany({
        where: {
          taskId: taskId as string,
          memberId: memberId as string,
          date: dateValue,
        },
      });
    } else {
      await db.routineCompletion.upsert({
        where: {
          taskId_memberId_date: {
            taskId: taskId as string,
            memberId: memberId as string,
            date: dateValue,
          },
        },
        create: {
          taskId: taskId as string,
          memberId: memberId as string,
          date: dateValue,
        },
        update: {}, // already exists — no-op
      });
    }

    // 2. Fetch the task for points info
    const task = await db.routineTask.findUnique({
      where: { id: taskId as string },
      select: { points: true, routineId: true },
    });

    // 3. Critical hit (only on check, not uncheck)
    let criticalHit = false;
    let criticalBonusPoints = 0;
    if (completed !== false && task) {
      criticalHit = rollCriticalHit(dateStr, memberId as string, taskId as string);
      if (criticalHit) {
        criticalBonusPoints = Math.round(
          task.points * (getCriticalMultiplier() - 1)
        );
        await db.bonusLog.create({
          data: {
            memberId: memberId as string,
            date: todayStart,
            type: "critical_hit",
            points: criticalBonusPoints,
            metadata: { taskId },
          },
        });
      }
    }

    // 4. Perfect day check
    const { isPerfectDay, totalTasks, completedTasks } = await checkPerfectDay(
      memberId as string,
      familyId,
      todayStart
    );

    let streakData = null;
    let milestoneHit: number | null = null;
    let perfectDayBonus = 0;
    let mysterySpinResult = null;

    if (isPerfectDay && completed !== false) {
      // Recompute streak
      const streakResult = await recomputeStreak(memberId as string, todayStart);
      const tier = getStreakTier(streakResult.current);
      streakData = {
        ...streakResult,
        tier: tier.label,
        multiplier: tier.multiplier,
        tierIcon: tier.icon,
      };
      milestoneHit = streakResult.milestoneHit;

      // Perfect day bonus (once per day)
      const existingPerfect = await db.bonusLog.findFirst({
        where: {
          memberId: memberId as string,
          date: todayStart,
          type: "perfect_day",
        },
      });
      if (!existingPerfect) {
        perfectDayBonus = getPerfectDayBonus();
        await db.bonusLog.create({
          data: {
            memberId: memberId as string,
            date: todayStart,
            type: "perfect_day",
            points: perfectDayBonus,
          },
        });
      }

      // Mystery spin (once per day per member)
      const existingSpin = await db.bonusLog.findFirst({
        where: {
          memberId: memberId as string,
          date: todayStart,
          type: "mystery_spin",
        },
      });
      if (!existingSpin) {
        const spin = spinMysteryWheel(dateStr, memberId as string);
        const multipliedPoints = Math.round(spin.points * tier.multiplier);
        await db.bonusLog.create({
          data: {
            memberId: memberId as string,
            date: todayStart,
            type: "mystery_spin",
            points: multipliedPoints,
            metadata: {
              ...spin,
              basePoints: spin.points,
              multiplier: tier.multiplier,
            },
          },
        });
        mysterySpinResult = { ...spin, points: multipliedPoints };
      }

      // Milestone bonus
      if (milestoneHit) {
        await db.bonusLog.create({
          data: {
            memberId: memberId as string,
            date: todayStart,
            type: "streak_milestone",
            points: milestoneHit,
            metadata: { milestone: milestoneHit },
          },
        });
      }
    } else if (completed === false) {
      await handleUncheck(memberId as string, todayStart);
    }

    return NextResponse.json({
      completed: completed !== false,
      totalTasks,
      completedTasks,
      isPerfectDay,
      criticalHit,
      criticalBonusPoints,
      streakData,
      milestoneHit,
      perfectDayBonus,
      mysterySpinResult,
    });
  } catch (error) {
    console.error("Failed to toggle completion:", error);
    return NextResponse.json({ error: "Failed to toggle completion" }, { status: 500 });
  }
}
