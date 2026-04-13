# Streaks + Gamification Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add streaks, variable rewards (mystery spin, critical hits), and micro-celebrations (confetti, crowns, haptic feedback) on top of the Routines + Rewards system.

**Depends on:** `2026-04-13-routines-rewards.md` — all base tasks must be complete first.

**Architecture:** Extends Prisma with Streak and BonusLog models. Streak computation runs server-side on each completion toggle. Variable rewards use seeded PRNG. All animations CSS-only.

**Tech Stack:** Same as base — Next.js, Prisma, Tailwind, Lucide, CSS keyframes. No additional dependencies.

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── families/[familyId]/
│   │       ├── streaks/
│   │       │   └── route.ts
│   │       ├── bonus/
│   │       │   └── route.ts
│   │       ├── routine-completions/
│   │       │   └── route.ts            (modify — add gamification events)
│   │       └── points/
│   │           └── route.ts            (modify — include BonusLog)
│   └── [locale]/dashboard/
│       ├── _components/
│       │   ├── DashboardClient.tsx     (modify — GamificationProvider, overlays)
│       │   ├── RoutinesFullView.tsx    (modify — wire celebrations, streak badges)
│       │   ├── RoutinesWidget.tsx      (modify — best streak, PerfectDayCrown)
│       │   ├── StreakBadge.tsx         (new)
│       │   ├── StreakMilestoneModal.tsx (new)
│       │   ├── MysterySpinWheel.tsx    (new)
│       │   ├── CriticalHitFlash.tsx    (new)
│       │   ├── ConfettiCelebration.tsx (new)
│       │   └── PerfectDayCrown.tsx     (new)
│       └── page.tsx                    (modify — fetch streaks + bonus)
├── lib/
│   ├── gamification-constants.ts       (new)
│   ├── streaks.ts                      (new)
│   └── variable-rewards.ts             (new)
├── contexts/
│   └── GamificationContext.tsx         (new)
messages/
├── en.json                             (modify)
└── de.json                             (modify)
prisma/
└── schema.prisma                       (modify — Streak + BonusLog models)
```

---

### Task 1: Schema — Streak + BonusLog models

**Files:**
- Modify: `prisma/schema.prisma`

Add `Streak` and `BonusLog` models and wire relations to `FamilyMember`.

- [ ] **Step 1: Add Streak and BonusLog to schema.prisma**

In `prisma/schema.prisma`, add to `FamilyMember` (inside the model, after `photos`):

```prisma
  streaks    Streak[]
  bonusLogs  BonusLog[]
```

Append these models at the bottom of the file:

```prisma
model Streak {
  id           String    @id @default(cuid())
  current      Int       @default(0)
  longest      Int       @default(0)
  lastDate     DateTime? @db.Date
  frozenUntil  DateTime? @db.Date

  memberId  String
  member    FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  routineId String
  routine   Routine      @relation(fields: [routineId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([memberId, routineId])
}

model BonusLog {
  id       String   @id @default(cuid())
  date     DateTime @db.Date
  type     BonusType
  points   Int
  metadata Json?

  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([memberId, date])
}

enum BonusType {
  streak_milestone
  critical_hit
  mystery_spin
  perfect_day
  streak_multiplier
}
```

Also add the back-relation to `Routine`:

```prisma
  streaks Streak[]
```

(inside the `Routine` model, after `tasks`)

- [ ] **Step 2: Run prisma generate**

```bash
npx prisma generate
```

> Do NOT run `prisma migrate` in development yet — migrations are managed separately.

---

### Task 2: Gamification Constants

**Files:**
- Create: `src/lib/gamification-constants.ts`

- [ ] **Step 1: Create gamification-constants.ts**

```typescript
// src/lib/gamification-constants.ts

export type StreakTier = {
  name: string;
  label: string;
  icon: string;
  minStreak: number;
  multiplier: number;
  flameFrom: string;
  flameTo: string;
};

export const STREAK_TIERS: StreakTier[] = [
  {
    name: "starter",
    label: "Starter",
    icon: "🔥",
    minStreak: 0,
    multiplier: 1.0,
    flameFrom: "#f97316",
    flameTo: "#fbbf24",
  },
  {
    name: "rising",
    label: "Rising",
    icon: "🔥",
    minStreak: 3,
    multiplier: 1.25,
    flameFrom: "#f59e0b",
    flameTo: "#fde68a",
  },
  {
    name: "blazing",
    label: "Blazing",
    icon: "🔥",
    minStreak: 7,
    multiplier: 1.5,
    flameFrom: "#ef4444",
    flameTo: "#f97316",
  },
  {
    name: "inferno",
    label: "Inferno",
    icon: "🔥",
    minStreak: 14,
    multiplier: 1.75,
    flameFrom: "#dc2626",
    flameTo: "#7c3aed",
  },
  {
    name: "legendary",
    label: "Legendary",
    icon: "⚡",
    minStreak: 30,
    multiplier: 2.0,
    flameFrom: "#7c3aed",
    flameTo: "#a78bfa",
  },
  {
    name: "mythic",
    label: "Mythic",
    icon: "💎",
    minStreak: 100,
    multiplier: 2.5,
    flameFrom: "#67e8f9",
    flameTo: "#a78bfa",
  },
];

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

export const STREAK_FREEZE_COST = 50;

export const CRITICAL_HIT_CHANCE = 0.1;
export const CRITICAL_HIT_MULTIPLIER = 2.0;

export type SpinOutcome = {
  name: string;
  rarity: string;
  points: number;
  icon: string;
  weight: number;
  color: string;
};

export const MYSTERY_SPIN_OUTCOMES: SpinOutcome[] = [
  { name: "common",    rarity: "Common",    points: 3,  icon: "⭐", weight: 40, color: "#94a3b8" },
  { name: "uncommon",  rarity: "Uncommon",  points: 5,  icon: "💫", weight: 25, color: "#4ade80" },
  { name: "rare",      rarity: "Rare",      points: 10, icon: "✨", weight: 18, color: "#60a5fa" },
  { name: "epic",      rarity: "Epic",      points: 20, icon: "🌟", weight: 10, color: "#c084fc" },
  { name: "legendary", rarity: "Legendary", points: 35, icon: "🔮", weight: 5,  color: "#f59e0b" },
  { name: "mythic",    rarity: "Mythic",    points: 50, icon: "💎", weight: 2,  color: "#67e8f9" },
];

export const PERFECT_DAY_BONUS = 10;

export const FLAME_COLORS: Record<string, { from: string; to: string }> = {
  starter:   { from: "#f97316", to: "#fbbf24" },
  rising:    { from: "#f59e0b", to: "#fde68a" },
  blazing:   { from: "#ef4444", to: "#f97316" },
  inferno:   { from: "#dc2626", to: "#7c3aed" },
  legendary: { from: "#7c3aed", to: "#a78bfa" },
  mythic:    { from: "#67e8f9", to: "#a78bfa" },
};
```

---

### Task 3: Streaks utility

**Files:**
- Create: `src/lib/streaks.ts`

- [ ] **Step 1: Create streaks.ts**

```typescript
// src/lib/streaks.ts
import { db } from "@/lib/db";
import { STREAK_TIERS, STREAK_MILESTONES, type StreakTier } from "./gamification-constants";

export function getStreakTier(current: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) {
    if (current >= t.minStreak) tier = t;
  }
  return tier;
}

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

export type RecomputeResult = {
  current: number;
  longest: number;
  isMilestone: boolean;
  tier: StreakTier;
  wasExtended: boolean;
};

/**
 * Recomputes the streak for a member+routine after a completion toggle.
 * Checks whether ALL tasks in the routine are now complete for today.
 * Handles freeze logic (frozenUntil date absorbs a missed day).
 */
export async function recomputeStreak(
  memberId: string,
  routineId: string,
  today: Date
): Promise<RecomputeResult> {
  const todayStr = today.toISOString().split("T")[0];

  // Check if all tasks are done today
  const routine = await db.routine.findUnique({
    where: { id: routineId },
    include: { tasks: true },
  });
  if (!routine) throw new Error(`Routine ${routineId} not found`);

  const taskIds = routine.tasks.map((t) => t.id);
  const completions = await db.routineCompletion.findMany({
    where: {
      memberId,
      taskId: { in: taskIds },
      date: today,
    },
  });
  const allDone = completions.length === taskIds.length && taskIds.length > 0;

  // Load or create streak record
  let streak = await db.streak.findUnique({
    where: { memberId_routineId: { memberId, routineId } },
  });
  if (!streak) {
    streak = await db.streak.create({
      data: { memberId, routineId, current: 0, longest: 0 },
    });
  }

  if (!allDone) {
    return {
      current: streak.current,
      longest: streak.longest,
      isMilestone: false,
      tier: getStreakTier(streak.current),
      wasExtended: false,
    };
  }

  const lastDate = streak.lastDate ? streak.lastDate.toISOString().split("T")[0] : null;

  // Already counted today
  if (lastDate === todayStr) {
    return {
      current: streak.current,
      longest: streak.longest,
      isMilestone: isStreakMilestone(streak.current),
      tier: getStreakTier(streak.current),
      wasExtended: false,
    };
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newCurrent = 1;

  if (lastDate === yesterdayStr) {
    // Consecutive day
    newCurrent = streak.current + 1;
  } else if (
    streak.frozenUntil &&
    streak.frozenUntil.toISOString().split("T")[0] >= yesterdayStr
  ) {
    // Freeze absorbed the gap
    newCurrent = streak.current + 1;
  }
  // else: streak broken, restart from 1

  const newLongest = Math.max(streak.longest, newCurrent);
  const isMilestone = isStreakMilestone(newCurrent);

  await db.streak.update({
    where: { id: streak.id },
    data: {
      current: newCurrent,
      longest: newLongest,
      lastDate: today,
      frozenUntil: null,
    },
  });

  return {
    current: newCurrent,
    longest: newLongest,
    isMilestone,
    tier: getStreakTier(newCurrent),
    wasExtended: true,
  };
}

/**
 * Applies a streak freeze for a member+routine (costs STREAK_FREEZE_COST points).
 * Sets frozenUntil to tomorrow so the next missed day is forgiven.
 */
export async function applyStreakFreeze(
  memberId: string,
  routineId: string
): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const streak = await db.streak.findUnique({
    where: { memberId_routineId: { memberId, routineId } },
  });
  if (!streak) throw new Error("No streak to freeze");

  await db.streak.update({
    where: { id: streak.id },
    data: { frozenUntil: tomorrow },
  });

  // Log the spend as a negative bonus entry
  await db.bonusLog.create({
    data: {
      memberId,
      date: new Date(),
      type: "streak_milestone",
      points: 0,
      metadata: { action: "freeze_applied", routineId },
    },
  });
}
```

---

### Task 4: Variable rewards utility

**Files:**
- Create: `src/lib/variable-rewards.ts`

- [ ] **Step 1: Create variable-rewards.ts**

```typescript
// src/lib/variable-rewards.ts
import {
  CRITICAL_HIT_CHANCE,
  CRITICAL_HIT_MULTIPLIER,
  MYSTERY_SPIN_OUTCOMES,
  PERFECT_DAY_BONUS,
  type SpinOutcome,
} from "./gamification-constants";

/** Mulberry32 — fast, seedable PRNG returning [0, 1) */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a numeric seed from strings/numbers */
function buildSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type CriticalHitResult = {
  isCritical: boolean;
  multiplier: number;
};

/**
 * Rolls for a critical hit. Deterministic per (day, memberId, taskId).
 */
export function rollCriticalHit(
  memberId: string,
  taskId: string,
  date: Date
): CriticalHitResult {
  const seed = buildSeed(memberId, taskId, date.toISOString().split("T")[0]);
  const rand = mulberry32(seed)();
  const isCritical = rand < CRITICAL_HIT_CHANCE;
  return { isCritical, multiplier: isCritical ? CRITICAL_HIT_MULTIPLIER : 1.0 };
}

export type SpinResult = SpinOutcome;

/**
 * Spins the mystery wheel. Deterministic per (day, memberId, routineId).
 * Returns the weighted random outcome.
 */
export function spinMysteryWheel(
  memberId: string,
  routineId: string,
  date: Date
): SpinResult {
  const seed = buildSeed(memberId, routineId, date.toISOString().split("T")[0]);
  const rand = mulberry32(seed);

  const totalWeight = MYSTERY_SPIN_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  const roll = rand() * totalWeight;

  let cumulative = 0;
  for (const outcome of MYSTERY_SPIN_OUTCOMES) {
    cumulative += outcome.weight;
    if (roll < cumulative) return outcome;
  }
  return MYSTERY_SPIN_OUTCOMES[0];
}

export type PerfectDayResult = {
  isPerfect: boolean;
  bonusPoints: number;
};

/**
 * Checks if ALL routines scheduled for today are fully complete for the member.
 * Call after a completion toggle with the current completedRoutineIds set.
 */
export function getPerfectDayBonus(
  scheduledRoutineCount: number,
  completedRoutineCount: number
): PerfectDayResult {
  const isPerfect =
    scheduledRoutineCount > 0 && completedRoutineCount >= scheduledRoutineCount;
  return { isPerfect, bonusPoints: isPerfect ? PERFECT_DAY_BONUS : 0 };
}
```

---

### Task 5: API — Streaks + Bonus routes

**Files:**
- Create: `src/app/api/families/[familyId]/streaks/route.ts`
- Create: `src/app/api/families/[familyId]/bonus/route.ts`

- [ ] **Step 1: Create streaks GET route**

Create `src/app/api/families/[familyId]/streaks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStreakTier } from "@/lib/streaks";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const streaks = await db.streak.findMany({
      where: { member: { familyId } },
      include: {
        member: { select: { id: true, name: true, color: true } },
        routine: { select: { id: true, title: true, icon: true } },
      },
    });

    const enriched = streaks.map((s) => ({
      id: s.id,
      memberId: s.memberId,
      routineId: s.routineId,
      current: s.current,
      longest: s.longest,
      lastDate: s.lastDate,
      frozenUntil: s.frozenUntil,
      tier: getStreakTier(s.current),
      member: s.member,
      routine: s.routine,
    }));

    return NextResponse.json({ streaks: enriched });
  } catch (error) {
    console.error("Failed to fetch streaks:", error);
    return NextResponse.json({ error: "Failed to fetch streaks" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create bonus GET route**

Create `src/app/api/families/[familyId]/bonus/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  try {
    const logs = await db.bonusLog.findMany({
      where: {
        member: { familyId },
        date: new Date(dateStr),
      },
      include: {
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byMember: Record<string, { memberId: string; totalBonus: number; logs: typeof logs }> = {};
    for (const log of logs) {
      if (!byMember[log.memberId]) {
        byMember[log.memberId] = { memberId: log.memberId, totalBonus: 0, logs: [] };
      }
      byMember[log.memberId].totalBonus += log.points;
      byMember[log.memberId].logs.push(log);
    }

    return NextResponse.json({ bonus: Object.values(byMember) });
  } catch (error) {
    console.error("Failed to fetch bonus:", error);
    return NextResponse.json({ error: "Failed to fetch bonus" }, { status: 500 });
  }
}
```

---

### Task 6: Modify completion API

**Files:**
- Modify: `src/app/api/families/[familyId]/routine-completions/route.ts`

Extend the existing POST handler (from the base plan) to run gamification after toggling.

- [ ] **Step 1: Augment routine-completions POST**

Replace the existing `route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recomputeStreak } from "@/lib/streaks";
import { rollCriticalHit, spinMysteryWheel, getPerfectDayBonus } from "@/lib/variable-rewards";
import { CRITICAL_HIT_MULTIPLIER } from "@/lib/gamification-constants";

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

  const { taskId, memberId, date } = body as {
    taskId: string;
    memberId: string;
    date: string;
  };

  if (!taskId || !memberId || !date) {
    return NextResponse.json(
      { error: "Missing required fields: taskId, memberId, date" },
      { status: 400 }
    );
  }

  const dateObj = new Date(date);

  try {
    // Validate task belongs to this family
    const task = await db.routineTask.findFirst({
      where: { id: taskId, routine: { familyId } },
      include: { routine: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const existing = await db.routineCompletion.findUnique({
      where: { taskId_memberId_date: { taskId, memberId, date: dateObj } },
    });

    let completion;
    let toggled: "completed" | "uncompleted";

    if (existing) {
      await db.routineCompletion.delete({ where: { id: existing.id } });
      toggled = "uncompleted";
      completion = null;
    } else {
      completion = await db.routineCompletion.create({
        data: { taskId, memberId, date: dateObj },
      });
      toggled = "completed";
    }

    // --- Gamification (only on completion, not removal) ---
    const events: Record<string, unknown> = {};

    if (toggled === "completed") {
      const routineId = task.routineId;

      // 1. Streak recomputation
      const streakResult = await recomputeStreak(memberId, routineId, dateObj);
      events.streak = streakResult;

      // 2. Streak multiplier bonus points
      if (streakResult.wasExtended && streakResult.tier.multiplier > 1.0) {
        const basePoints = task.points;
        const bonusPoints = Math.floor(
          basePoints * (streakResult.tier.multiplier - 1.0)
        );
        if (bonusPoints > 0) {
          await db.bonusLog.create({
            data: {
              memberId,
              date: dateObj,
              type: "streak_multiplier",
              points: bonusPoints,
              metadata: {
                routineId,
                taskId,
                multiplier: streakResult.tier.multiplier,
                tier: streakResult.tier.name,
              },
            },
          });
          events.streakBonus = bonusPoints;
        }
      }

      // 3. Streak milestone bonus
      if (streakResult.isMilestone && streakResult.wasExtended) {
        const milestoneBonus = streakResult.current * 2;
        await db.bonusLog.create({
          data: {
            memberId,
            date: dateObj,
            type: "streak_milestone",
            points: milestoneBonus,
            metadata: { routineId, streak: streakResult.current },
          },
        });
        events.streakMilestone = { streak: streakResult.current, bonus: milestoneBonus };
      }

      // 4. Critical hit roll
      const critResult = rollCriticalHit(memberId, taskId, dateObj);
      if (critResult.isCritical) {
        const critBonus = Math.floor(task.points * (CRITICAL_HIT_MULTIPLIER - 1.0));
        await db.bonusLog.create({
          data: {
            memberId,
            date: dateObj,
            type: "critical_hit",
            points: critBonus,
            metadata: { taskId, basePoints: task.points, multiplier: CRITICAL_HIT_MULTIPLIER },
          },
        });
        events.criticalHit = { bonus: critBonus };
      }

      // 5. Mystery spin on full routine completion
      const routineTasks = await db.routineTask.findMany({
        where: { routineId },
      });
      const todayCompletions = await db.routineCompletion.findMany({
        where: {
          memberId,
          taskId: { in: routineTasks.map((t) => t.id) },
          date: dateObj,
        },
      });

      const justCompletedRoutine =
        todayCompletions.length === routineTasks.length && routineTasks.length > 0;

      if (justCompletedRoutine) {
        // Spin only once per routine per day (check BonusLog)
        const existingSpin = await db.bonusLog.findFirst({
          where: {
            memberId,
            date: dateObj,
            type: "mystery_spin",
            metadata: { path: ["routineId"], equals: routineId },
          },
        });

        if (!existingSpin) {
          const spinResult = spinMysteryWheel(memberId, routineId, dateObj);
          await db.bonusLog.create({
            data: {
              memberId,
              date: dateObj,
              type: "mystery_spin",
              points: spinResult.points,
              metadata: {
                routineId,
                outcome: spinResult.name,
                rarity: spinResult.rarity,
                icon: spinResult.icon,
              },
            },
          });
          events.mysterySpin = spinResult;
        }
      }

      // 6. Perfect day check
      const allMemberRoutines = await db.routine.findMany({
        where: { familyId, assignedTo: memberId },
        include: { tasks: true },
      });

      const today = new Date();
      const todayDow = today.getDay();
      const scheduledRoutines = allMemberRoutines.filter((r) => {
        if (r.schedule === "daily") return true;
        if (r.schedule === "weekdays") return todayDow >= 1 && todayDow <= 5;
        if (r.schedule === "custom") return r.customDays.includes(todayDow);
        return false;
      });

      let completedRoutineCount = 0;
      for (const r of scheduledRoutines) {
        const tIds = r.tasks.map((t) => t.id);
        const comps = await db.routineCompletion.findMany({
          where: { memberId, taskId: { in: tIds }, date: dateObj },
        });
        if (comps.length === tIds.length && tIds.length > 0) completedRoutineCount++;
      }

      const pdResult = getPerfectDayBonus(scheduledRoutines.length, completedRoutineCount);
      if (pdResult.isPerfect) {
        const existingPd = await db.bonusLog.findFirst({
          where: { memberId, date: dateObj, type: "perfect_day" },
        });
        if (!existingPd) {
          await db.bonusLog.create({
            data: {
              memberId,
              date: dateObj,
              type: "perfect_day",
              points: pdResult.bonusPoints,
              metadata: { routinesCompleted: completedRoutineCount },
            },
          });
          events.perfectDay = { bonus: pdResult.bonusPoints };
        }
      }
    }

    return NextResponse.json({ completion, toggled, events });
  } catch (error) {
    console.error("Failed to toggle completion:", error);
    return NextResponse.json({ error: "Failed to toggle completion" }, { status: 500 });
  }
}
```

---

### Task 7: Update points API

**Files:**
- Modify: `src/app/api/families/[familyId]/points/route.ts`

- [ ] **Step 1: Include BonusLog in point totals**

Replace the points route with:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const members = await db.familyMember.findMany({
      where: { familyId },
      select: { id: true, name: true, color: true, role: true },
    });

    const points = await Promise.all(
      members.map(async (member) => {
        // Base points from completions (minus redeemed)
        const completionPoints = await db.routineCompletion.aggregate({
          where: {
            memberId: member.id,
            task: { routine: { familyId } },
          },
          _sum: { task: { points: true } } as never,
        });

        // Fetch completions with task points manually for accuracy
        const completions = await db.routineCompletion.findMany({
          where: { memberId: member.id, task: { routine: { familyId } } },
          include: { task: { select: { points: true } } },
        });
        const basePoints = completions.reduce((s, c) => s + c.task.points, 0);

        // Redeemed points
        const redemptions = await db.rewardRedemption.findMany({
          where: { memberId: member.id, reward: { familyId } },
          include: { reward: { select: { cost: true } } },
        });
        const redeemedPoints = redemptions.reduce((s, r) => s + r.reward.cost, 0);

        // Bonus points
        const bonusLogs = await db.bonusLog.findMany({
          where: { memberId: member.id },
          select: { points: true },
        });
        const bonusPoints = bonusLogs.reduce((s, b) => s + b.points, 0);

        const total = basePoints + bonusPoints - redeemedPoints;

        return {
          memberId: member.id,
          name: member.name,
          color: member.color,
          role: member.role,
          basePoints,
          bonusPoints,
          redeemedPoints,
          total: Math.max(0, total),
        };
      })
    );

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Failed to fetch points:", error);
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}
```

---

### Task 8: i18n

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add English gamification messages**

Merge into the `routines` key in `messages/en.json`:

```json
{
  "routines": {
    "streak": "Streak",
    "streakFire": "{count} day streak!",
    "streakMilestone": "🔥 {count} day milestone!",
    "streakMilestoneSub": "You earned {bonus} bonus points!",
    "multiplier": "{value}x multiplier active",
    "criticalHit": "CRITICAL HIT!",
    "criticalHitSub": "+{bonus} bonus points",
    "mysteryBonus": "Mystery bonus!",
    "mysteryBonusRarity": "{rarity} reward: +{points} pts",
    "perfectDay": "Perfect Day!",
    "perfectDayCrown": "All routines done! +{bonus} bonus",
    "bonusToday": "+{points} bonus today",
    "tierStarter": "Starter",
    "tierRising": "Rising",
    "tierBlazing": "Blazing",
    "tierInferno": "Inferno",
    "tierLegendary": "Legendary",
    "tierMythic": "Mythic",
    "streakFreeze": "Freeze Streak",
    "streakFreezeCost": "Costs {cost} pts",
    "streakFreezeActive": "Streak frozen until tomorrow",
    "bestStreak": "Best: {count}"
  }
}
```

- [ ] **Step 2: Add German gamification messages**

Merge into the `routines` key in `messages/de.json`:

```json
{
  "routines": {
    "streak": "Serie",
    "streakFire": "{count} Tage Serie!",
    "streakMilestone": "🔥 {count}-Tage-Meilenstein!",
    "streakMilestoneSub": "Du hast {bonus} Bonuspunkte verdient!",
    "multiplier": "{value}x Multiplikator aktiv",
    "criticalHit": "VOLLTREFFER!",
    "criticalHitSub": "+{bonus} Bonuspunkte",
    "mysteryBonus": "Mystischer Bonus!",
    "mysteryBonusRarity": "{rarity}-Belohnung: +{points} Pkt.",
    "perfectDay": "Perfekter Tag!",
    "perfectDayCrown": "Alle Routinen geschafft! +{bonus} Bonus",
    "bonusToday": "+{points} Bonus heute",
    "tierStarter": "Anfänger",
    "tierRising": "Aufsteigend",
    "tierBlazing": "Brennend",
    "tierInferno": "Inferno",
    "tierLegendary": "Legendär",
    "tierMythic": "Mythisch",
    "streakFreeze": "Serie einfrieren",
    "streakFreezeCost": "Kostet {cost} Pkt.",
    "streakFreezeActive": "Serie bis morgen eingefroren",
    "bestStreak": "Rekord: {count}"
  }
}
```

---

### Task 9: GamificationProvider

**Files:**
- Create: `src/contexts/GamificationContext.tsx`

- [ ] **Step 1: Create GamificationContext.tsx**

```typescript
// src/contexts/GamificationContext.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { SpinOutcome, StreakTier } from "@/lib/gamification-constants";

export type CriticalHitEvent = { bonus: number };
export type MysterySpinEvent = SpinOutcome;
export type PerfectDayEvent = { bonus: number };
export type StreakMilestoneEvent = { streak: number; bonus: number; tier: StreakTier };

interface GamificationState {
  criticalHit: CriticalHitEvent | null;
  mysterySpin: MysterySpinEvent | null;
  perfectDay: PerfectDayEvent | null;
  streakMilestone: StreakMilestoneEvent | null;
  confettiActive: boolean;
}

interface GamificationContextValue extends GamificationState {
  triggerCriticalHit: (event: CriticalHitEvent) => void;
  triggerMysterySpin: (event: MysterySpinEvent) => void;
  triggerPerfectDay: (event: PerfectDayEvent) => void;
  triggerStreakMilestone: (event: StreakMilestoneEvent) => void;
  triggerConfetti: () => void;
  clearCriticalHit: () => void;
  clearMysterySpin: () => void;
  clearPerfectDay: () => void;
  clearStreakMilestone: () => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

const AUTO_CLEAR_MS = {
  criticalHit: 2500,
  confetti: 3500,
} as const;

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GamificationState>({
    criticalHit: null,
    mysterySpin: null,
    perfectDay: null,
    streakMilestone: null,
    confettiActive: false,
  });

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleAutoClear = useCallback(
    (key: keyof GamificationState, delay: number) => {
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        setState((prev) => ({ ...prev, [key]: key === "confettiActive" ? false : null }));
      }, delay);
    },
    []
  );

  const triggerCriticalHit = useCallback(
    (event: CriticalHitEvent) => {
      setState((prev) => ({ ...prev, criticalHit: event, confettiActive: true }));
      scheduleAutoClear("criticalHit", AUTO_CLEAR_MS.criticalHit);
      scheduleAutoClear("confettiActive", AUTO_CLEAR_MS.confetti);
    },
    [scheduleAutoClear]
  );

  const triggerMysterySpin = useCallback((event: MysterySpinEvent) => {
    setState((prev) => ({ ...prev, mysterySpin: event }));
  }, []);

  const triggerPerfectDay = useCallback(
    (event: PerfectDayEvent) => {
      setState((prev) => ({ ...prev, perfectDay: event, confettiActive: true }));
      scheduleAutoClear("confettiActive", AUTO_CLEAR_MS.confetti);
    },
    [scheduleAutoClear]
  );

  const triggerStreakMilestone = useCallback(
    (event: StreakMilestoneEvent) => {
      setState((prev) => ({ ...prev, streakMilestone: event, confettiActive: true }));
      scheduleAutoClear("confettiActive", AUTO_CLEAR_MS.confetti);
    },
    [scheduleAutoClear]
  );

  const triggerConfetti = useCallback(() => {
    setState((prev) => ({ ...prev, confettiActive: true }));
    scheduleAutoClear("confettiActive", AUTO_CLEAR_MS.confetti);
  }, [scheduleAutoClear]);

  const clearCriticalHit = useCallback(() => setState((prev) => ({ ...prev, criticalHit: null })), []);
  const clearMysterySpin = useCallback(() => setState((prev) => ({ ...prev, mysterySpin: null })), []);
  const clearPerfectDay = useCallback(() => setState((prev) => ({ ...prev, perfectDay: null })), []);
  const clearStreakMilestone = useCallback(() => setState((prev) => ({ ...prev, streakMilestone: null })), []);

  return (
    <GamificationContext.Provider
      value={{
        ...state,
        triggerCriticalHit,
        triggerMysterySpin,
        triggerPerfectDay,
        triggerStreakMilestone,
        triggerConfetti,
        clearCriticalHit,
        clearMysterySpin,
        clearPerfectDay,
        clearStreakMilestone,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextValue {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error("useGamification must be used inside GamificationProvider");
  return ctx;
}
```

---

### Task 10: Celebration components

**Files:**
- Create: `src/app/[locale]/dashboard/_components/StreakBadge.tsx`
- Create: `src/app/[locale]/dashboard/_components/StreakMilestoneModal.tsx`
- Create: `src/app/[locale]/dashboard/_components/MysterySpinWheel.tsx`
- Create: `src/app/[locale]/dashboard/_components/CriticalHitFlash.tsx`
- Create: `src/app/[locale]/dashboard/_components/ConfettiCelebration.tsx`
- Create: `src/app/[locale]/dashboard/_components/PerfectDayCrown.tsx`

- [ ] **Step 1: StreakBadge.tsx**

```typescript
// src/app/[locale]/dashboard/_components/StreakBadge.tsx
"use client";

import { useTranslations } from "next-intl";
import { getStreakTier } from "@/lib/streaks";

interface StreakBadgeProps {
  current: number;
  showMultiplier?: boolean;
  size?: "sm" | "md";
}

export function StreakBadge({ current, showMultiplier = false, size = "md" }: StreakBadgeProps) {
  const t = useTranslations("routines");
  const tier = getStreakTier(current);
  const isHot = current >= 7;

  const sizeClasses = size === "sm"
    ? "text-xs px-2 py-0.5 gap-1"
    : "text-sm px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses}`}
      style={{
        background: `linear-gradient(135deg, ${tier.flameFrom}22, ${tier.flameTo}22)`,
        border: `1px solid ${tier.flameFrom}55`,
        color: tier.flameFrom,
      }}
    >
      <span
        className={isHot ? "streak-flicker" : ""}
        style={{ display: "inline-block" }}
        aria-hidden="true"
      >
        {tier.icon}
      </span>
      <span
        style={{
          background: `linear-gradient(90deg, ${tier.flameFrom}, ${tier.flameTo})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {current}
      </span>
      {showMultiplier && tier.multiplier > 1.0 && (
        <span
          className="opacity-80"
          style={{
            background: `linear-gradient(90deg, ${tier.flameFrom}, ${tier.flameTo})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t("multiplier", { value: tier.multiplier.toFixed(2).replace(".00", "") })}
        </span>
      )}
      <style>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1) rotate(-2deg); }
          25% { transform: scaleY(1.08) rotate(2deg); }
          50% { transform: scaleY(0.95) rotate(-1deg); }
          75% { transform: scaleY(1.05) rotate(3deg); }
        }
        .streak-flicker { animation: flicker 0.8s ease-in-out infinite; }
      `}</style>
    </span>
  );
}
```

- [ ] **Step 2: StreakMilestoneModal.tsx**

```typescript
// src/app/[locale]/dashboard/_components/StreakMilestoneModal.tsx
"use client";

import { useTranslations } from "next-intl";
import { useGamification } from "@/contexts/GamificationContext";

export function StreakMilestoneModal() {
  const t = useTranslations("routines");
  const { streakMilestone, clearStreakMilestone } = useGamification();

  if (!streakMilestone) return null;

  const { streak, bonus, tier } = streakMilestone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={clearStreakMilestone}
    >
      <div
        className="glass rounded-3xl p-10 text-center max-w-sm w-full mx-4 milestone-pop"
        style={{
          border: `2px solid ${tier.flameFrom}88`,
          boxShadow: `0 0 60px ${tier.flameFrom}44, 0 0 120px ${tier.flameTo}22`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl mb-4 milestone-bounce" aria-hidden="true">
          {tier.icon}
        </div>
        <div
          className="text-7xl font-black mb-2 tabular-nums"
          style={{
            background: `linear-gradient(135deg, ${tier.flameFrom}, ${tier.flameTo})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {streak}
        </div>
        <p className="text-2xl font-bold text-white mb-1">
          {t("streakMilestone", { count: streak })}
        </p>
        <p className="text-base mb-6" style={{ color: "var(--color-text-muted)" }}>
          {t("streakMilestoneSub", { bonus })}
        </p>
        <button
          className="glass rounded-xl px-8 py-3 font-semibold text-white transition-all hover:opacity-80 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${tier.flameFrom}44, ${tier.flameTo}44)` }}
          onClick={clearStreakMilestone}
        >
          🎉
        </button>
      </div>
      <style>{`
        @keyframes milestone-pop {
          0% { transform: scale(0.6) translateY(40px); opacity: 0; }
          70% { transform: scale(1.05) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes milestone-bounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-12px) rotate(5deg); }
        }
        .milestone-pop { animation: milestone-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .milestone-bounce { animation: milestone-bounce 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: MysterySpinWheel.tsx**

```typescript
// src/app/[locale]/dashboard/_components/MysterySpinWheel.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MYSTERY_SPIN_OUTCOMES } from "@/lib/gamification-constants";
import { useGamification } from "@/contexts/GamificationContext";

export function MysterySpinWheel() {
  const t = useTranslations("routines");
  const { mysterySpin, clearMysterySpin } = useGamification();
  const [displayIndex, setDisplayIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!mysterySpin) {
      setRevealed(false);
      setSpinning(false);
      return;
    }
    setSpinning(true);
    setRevealed(false);
    let count = 0;
    const totalSpins = 20 + Math.floor(Math.random() * 10);
    const interval = setInterval(() => {
      setDisplayIndex((i) => (i + 1) % MYSTERY_SPIN_OUTCOMES.length);
      count++;
      if (count >= totalSpins) {
        clearInterval(interval);
        const finalIdx = MYSTERY_SPIN_OUTCOMES.findIndex((o) => o.name === mysterySpin.name);
        setDisplayIndex(finalIdx >= 0 ? finalIdx : 0);
        setSpinning(false);
        setRevealed(true);
      }
    }, 80 + (count / totalSpins) * 120);
    return () => clearInterval(interval);
  }, [mysterySpin]);

  if (!mysterySpin) return null;

  const current = spinning ? MYSTERY_SPIN_OUTCOMES[displayIndex] : mysterySpin;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={revealed ? clearMysterySpin : undefined}
    >
      <div
        className="glass rounded-3xl p-8 text-center max-w-xs w-full mx-4 spin-appear"
        style={{ border: `2px solid ${current.color}55` }}
      >
        <p className="text-sm font-semibold mb-4 uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          {t("mysteryBonus")}
        </p>
        <div
          className={`text-7xl mb-4 ${spinning ? "spin-icon" : "spin-reveal"}`}
          aria-hidden="true"
        >
          {current.icon}
        </div>
        {revealed && (
          <div className="result-fade-in">
            <p className="text-2xl font-black mb-1" style={{ color: current.color }}>
              {current.rarity}
            </p>
            <p className="text-4xl font-black text-white mb-4">+{mysterySpin.points}</p>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              {t("mysteryBonusRarity", { rarity: current.rarity, points: mysterySpin.points })}
            </p>
            <button
              className="glass rounded-xl px-6 py-2 text-white font-semibold hover:opacity-80 transition-opacity"
              onClick={clearMysterySpin}
            >
              ✓
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin-appear {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin-icon {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15) rotate(10deg); }
        }
        @keyframes spin-reveal {
          0% { transform: scale(0.5) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes result-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin-appear { animation: spin-appear 0.3s ease forwards; }
        .spin-icon { animation: spin-icon 0.15s ease-in-out infinite; }
        .spin-reveal { animation: spin-reveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .result-fade-in { animation: result-fade-in 0.3s ease 0.1s both; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: CriticalHitFlash.tsx**

```typescript
// src/app/[locale]/dashboard/_components/CriticalHitFlash.tsx
"use client";

import { useTranslations } from "next-intl";
import { useGamification } from "@/contexts/GamificationContext";

export function CriticalHitFlash() {
  const t = useTranslations("routines");
  const { criticalHit } = useGamification();

  if (!criticalHit) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
      aria-live="assertive"
    >
      {/* Radial golden flash */}
      <div className="crit-radial-flash" aria-hidden="true" />
      <div className="crit-text-wrapper">
        <p className="crit-label font-black tracking-widest uppercase">
          {t("criticalHit")}
        </p>
        <p className="crit-sub font-bold">
          {t("criticalHitSub", { bonus: criticalHit.bonus })}
        </p>
      </div>
      <style>{`
        @keyframes crit-flash {
          0% { opacity: 0; transform: scale(0.2); }
          20% { opacity: 0.7; transform: scale(1.5); }
          100% { opacity: 0; transform: scale(3); }
        }
        @keyframes crit-label-in {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          50% { opacity: 1; transform: scale(1.1) translateY(-4px); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9) translateY(-10px); }
        }
        @keyframes crit-sub-in {
          0%, 20% { opacity: 0; transform: translateY(8px); }
          50%, 80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }
        .crit-radial-flash {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, #fbbf2488 0%, #f59e0b22 40%, transparent 70%);
          animation: crit-flash 1.5s ease forwards;
        }
        .crit-text-wrapper {
          position: relative;
          text-align: center;
        }
        .crit-label {
          font-size: clamp(2rem, 8vw, 4rem);
          background: linear-gradient(135deg, #fbbf24, #f59e0b, #fde68a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px #fbbf2466);
          animation: crit-label-in 2s ease forwards;
        }
        .crit-sub {
          font-size: clamp(1rem, 4vw, 1.5rem);
          color: #fde68a;
          filter: drop-shadow(0 0 8px #fbbf2466);
          animation: crit-sub-in 2s ease forwards;
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: ConfettiCelebration.tsx**

```typescript
// src/app/[locale]/dashboard/_components/ConfettiCelebration.tsx
"use client";

import { useMemo } from "react";
import { useGamification } from "@/contexts/GamificationContext";

const COLORS = ["#a78bfa", "#67e8f9", "#fbbf24", "#f472b6", "#4ade80", "#fb923c"];
const PARTICLE_COUNT = 40;

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

export function ConfettiCelebration() {
  const { confettiActive } = useGamification();

  const particles = useMemo(() => {
    const rand = seededRand(0xdeadbeef);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 1.2,
      duration: 1.8 + rand() * 1.4,
      size: 6 + rand() * 8,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      rotation: rand() * 360,
      xDrift: (rand() - 0.5) * 200,
      shape: rand() > 0.5 ? "circle" : "rect",
    }));
  }, []);

  if (!confettiActive) return null;

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-10px",
            left: `${p.left}%`,
            width: p.shape === "circle" ? p.size : p.size * 0.6,
            height: p.shape === "circle" ? p.size : p.size * 1.4,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${p.rotation}deg)`,
            "--x-drift": `${p.xDrift}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: rotate(0deg) translateX(0);
            opacity: 1;
            top: -10px;
          }
          80% { opacity: 1; }
          100% {
            transform: rotate(720deg) translateX(var(--x-drift));
            opacity: 0;
            top: 110vh;
          }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 6: PerfectDayCrown.tsx**

```typescript
// src/app/[locale]/dashboard/_components/PerfectDayCrown.tsx
"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGamification } from "@/contexts/GamificationContext";

interface PerfectDayCrownProps {
  /** If true, shows inline badge (widget mode). If false, shows modal-style overlay. */
  inline?: boolean;
  bonusPoints?: number;
}

export function PerfectDayCrown({ inline = false, bonusPoints }: PerfectDayCrownProps) {
  const t = useTranslations("routines");
  const { perfectDay, clearPerfectDay } = useGamification();

  if (inline) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold crown-glow"
        style={{
          background: "linear-gradient(135deg, #fbbf2422, #f59e0b22)",
          border: "1px solid #fbbf2455",
          color: "#fbbf24",
        }}
        title={t("perfectDay")}
      >
        <Crown size={12} aria-hidden="true" />
        {bonusPoints !== undefined && `+${bonusPoints}`}
        <style>{`
          @keyframes crown-bob {
            0%, 100% { transform: translateY(0) rotate(-5deg); }
            50% { transform: translateY(-3px) rotate(5deg); }
          }
          @keyframes crown-glow-pulse {
            0%, 100% { box-shadow: 0 0 6px #fbbf2433; }
            50% { box-shadow: 0 0 14px #fbbf2466; }
          }
          .crown-glow { animation: crown-bob 1.5s ease-in-out infinite, crown-glow-pulse 2s ease-in-out infinite; }
        `}</style>
      </span>
    );
  }

  if (!perfectDay) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={clearPerfectDay}
    >
      <div
        className="glass rounded-3xl p-10 text-center max-w-sm w-full mx-4 crown-modal-pop"
        style={{
          border: "2px solid #fbbf2466",
          boxShadow: "0 0 60px #fbbf2433, 0 0 120px #f59e0b22",
        }}
      >
        <Crown
          size={80}
          className="mx-auto mb-4 crown-bob-big"
          style={{ color: "#fbbf24", filter: "drop-shadow(0 0 16px #fbbf2466)" }}
          aria-hidden="true"
        />
        <p className="text-3xl font-black text-white mb-2">{t("perfectDay")}</p>
        <p className="text-lg mb-6" style={{ color: "var(--color-text-muted)" }}>
          {t("perfectDayCrown", { bonus: perfectDay.bonus })}
        </p>
        <button
          className="glass rounded-xl px-8 py-3 font-semibold text-white hover:opacity-80 transition-opacity"
          style={{ background: "linear-gradient(135deg, #fbbf2444, #f59e0b44)" }}
          onClick={clearPerfectDay}
        >
          ✓
        </button>
      </div>
      <style>{`
        @keyframes crown-modal-pop {
          0% { transform: scale(0.7) translateY(30px); opacity: 0; }
          70% { transform: scale(1.04) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes crown-bob-big {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-10px) rotate(8deg); }
        }
        .crown-modal-pop { animation: crown-modal-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .crown-bob-big { animation: crown-bob-big 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
```

---

### Task 11: Integrate into RoutinesFullView

**Files:**
- Modify: `src/app/[locale]/dashboard/_components/RoutinesFullView.tsx`

- [ ] **Step 1: Wire gamification into toggleTask**

In `RoutinesFullView.tsx`, import the context and celebration components, then update `toggleTask`:

```typescript
// Add to imports
import { useGamification } from "@/contexts/GamificationContext";
import { StreakBadge } from "./StreakBadge";
import type { StreakTier } from "@/lib/gamification-constants";

// In the component, add:
const {
  triggerCriticalHit,
  triggerMysterySpin,
  triggerPerfectDay,
  triggerStreakMilestone,
} = useGamification();

// Extend the streak type for local state:
type StreakInfo = {
  current: number;
  longest: number;
  tier: StreakTier;
};

// Add state for streaks:
const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
// key: routineId

// Updated toggleTask function:
async function toggleTask(taskId: string, routineId: string) {
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`/api/families/${familyId}/routine-completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, memberId: selectedMemberId, date: today }),
  });
  if (!res.ok) return;

  const data = await res.json();
  const events = data.events ?? {};

  // Update local completions state (existing logic)
  // ... existing toggle logic ...

  // Handle gamification events
  if (events.criticalHit) {
    triggerCriticalHit(events.criticalHit);
    haptic("critical");
  }
  if (events.mysterySpin) {
    triggerMysterySpin(events.mysterySpin);
  }
  if (events.perfectDay) {
    triggerPerfectDay(events.perfectDay);
    haptic("success");
  }
  if (events.streakMilestone) {
    triggerStreakMilestone({
      ...events.streakMilestone,
      tier: events.streak.tier,
    });
    haptic("success");
  }
  if (events.streak) {
    setStreaks((prev) => ({
      ...prev,
      [routineId]: {
        current: events.streak.current,
        longest: events.streak.longest,
        tier: events.streak.tier,
      },
    }));
    if (events.streak.wasExtended) haptic("tap");
  }
}
```

Show `StreakBadge` in the routine header row:

```tsx
{/* In the routine card header, alongside the routine title: */}
{streaks[routine.id] && streaks[routine.id].current > 0 && (
  <StreakBadge
    current={streaks[routine.id].current}
    showMultiplier
    size="sm"
  />
)}
```

Show adjusted point display when multiplier is active:

```tsx
{/* For each task, display earned points with multiplier: */}
{(() => {
  const tier = streaks[task.routineId]?.tier;
  const multiplied = tier && tier.multiplier > 1.0;
  return (
    <span
      className="text-xs font-semibold"
      style={{
        color: multiplied ? tier!.flameFrom : "var(--color-text-muted)",
      }}
    >
      {multiplied
        ? `${task.points} ×${tier!.multiplier}`
        : `+${task.points}`}
    </span>
  );
})()}
```

Add streak freeze button in routine options (shown to owner):

```tsx
{/* Streak freeze button — shown only when member has a streak */}
{streaks[routine.id]?.current > 0 && (
  <button
    className="glass rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
    style={{ color: "#67e8f9", border: "1px solid #67e8f933" }}
    onClick={async () => {
      await fetch(`/api/families/${familyId}/routine-completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "freeze",
          routineId: routine.id,
          memberId: selectedMemberId,
        }),
      });
    }}
  >
    🧊 {t("streakFreeze")}
    <span style={{ color: "var(--color-text-muted)" }}>
      ({t("streakFreezeCost", { cost: 50 })})
    </span>
  </button>
)}
```

> Note: wire the `action: "freeze"` branch in the completions route (check `body.action === "freeze"` early and call `applyStreakFreeze`).

---

### Task 12: Integrate into RoutinesWidget

**Files:**
- Modify: `src/app/[locale]/dashboard/_components/RoutinesWidget.tsx`

- [ ] **Step 1: Show best streak + PerfectDayCrown**

```typescript
// Add to RoutinesWidget props:
interface RoutinesWidgetProps {
  familyId: string;
  familyMembers: FamilyMember[];
  streaks?: Array<{
    memberId: string;
    routineId: string;
    current: number;
    tier: { flameFrom: string; flameTo: string; icon: string };
  }>;
  yesterdayPerfect?: string[]; // memberIds who had a perfect day yesterday
}

// Inside the widget, per-member row, show best streak badge:
const memberStreaks = streaks?.filter((s) => s.memberId === member.id) ?? [];
const bestStreak = memberStreaks.reduce((best, s) => Math.max(best, s.current), 0);
const bestStreakInfo = memberStreaks.find((s) => s.current === bestStreak);

{bestStreak > 0 && bestStreakInfo && (
  <StreakBadge current={bestStreak} size="sm" />
)}

{yesterdayPerfect?.includes(member.id) && (
  <PerfectDayCrown inline bonusPoints={undefined} />
)}
```

---

### Task 13: Wire dashboard

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `src/app/[locale]/dashboard/_components/DashboardClient.tsx`

- [ ] **Step 1: Fetch streaks + bonus in page.tsx**

In the server component `page.tsx`, add parallel fetches alongside existing data:

```typescript
// Add alongside existing fetches (inside Promise.all or separate):
const [streaksRes, bonusRes] = await Promise.all([
  fetch(`${baseUrl}/api/families/${family.id}/streaks`, { cache: "no-store" }),
  fetch(`${baseUrl}/api/families/${family.id}/bonus`, { cache: "no-store" }),
]);

const streaksData = streaksRes.ok ? await streaksRes.json() : { streaks: [] };
const bonusData = bonusRes.ok ? await bonusRes.json() : { bonus: [] };
```

Pass to `DashboardClient`:

```tsx
<DashboardClient
  familyId={family.id}
  familyCode={family.inviteCode}
  calendarEvents={events}
  familyMembers={members}
  weather={weather}
  city={family.city}
  streaks={streaksData.streaks}
  bonusData={bonusData.bonus}
/>
```

- [ ] **Step 2: Wrap with GamificationProvider + render overlays**

In `DashboardClient.tsx`:

```typescript
import { GamificationProvider } from "@/contexts/GamificationContext";
import { CriticalHitFlash } from "./CriticalHitFlash";
import { ConfettiCelebration } from "./ConfettiCelebration";
import { StreakMilestoneModal } from "./StreakMilestoneModal";
import { MysterySpinWheel } from "./MysterySpinWheel";
import { PerfectDayCrown } from "./PerfectDayCrown";

// Wrap the return:
return (
  <GamificationProvider>
    <div className="grain min-h-screen p-5 flex flex-col gap-5 relative z-10">
      <TopBar ... />
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <WidgetGrid
            calendarEvents={calendarEvents}
            familyMembers={familyMembers}
            familyId={familyId}
            streaks={streaks}
          />
        </div>
      </div>
      <IdleScreensaver />
      {/* Celebration overlays — rendered at root level */}
      <ConfettiCelebration />
      <CriticalHitFlash />
      <StreakMilestoneModal />
      <MysterySpinWheel />
      <PerfectDayCrown />
      {/* Existing modals */}
      {showWeather && weather && <WeatherModal ... />}
      {showSettings && <SettingsModal ... />}
    </div>
  </GamificationProvider>
);
```

Update `DashboardClientProps`:

```typescript
interface DashboardClientProps {
  familyId: string;
  familyCode: string;
  calendarEvents: CalendarEvent[];
  familyMembers: FamilyMember[];
  weather?: WeatherData | null;
  city?: string | null;
  streaks?: StreakData[];
  bonusData?: BonusEntry[];
}
```

---

### Task 14: Haptic feedback

**Files:**
- Create: `src/lib/haptics.ts`
- Modify: `src/app/[locale]/dashboard/_components/RoutinesFullView.tsx`

- [ ] **Step 1: Create haptics.ts**

```typescript
// src/lib/haptics.ts

type HapticPattern = "tap" | "success" | "critical";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [30, 50, 30],
  critical: [50, 30, 50, 30, 100],
};

/**
 * Fires the device vibration API if available. Silently no-ops if not.
 */
export function haptic(pattern: HapticPattern): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Ignore — some browsers throw on vibrate
  }
}
```

- [ ] **Step 2: Import and use haptic in RoutinesFullView**

```typescript
import { haptic } from "@/lib/haptics";

// On task toggle (already wired in Task 11):
// haptic("tap")    — task checked/unchecked
// haptic("success") — milestone or perfect day
// haptic("critical") — critical hit
```

---

### Task 15: Deploy + tuning guide

- [ ] **Step 1: Deploy steps**

```bash
# 1. Generate Prisma client (no migration yet — run migration on staging first)
npx prisma generate

# 2. Create and run migration on staging DB
npx prisma migrate dev --name add_streak_bonus_models

# 3. Build
npm run build

# 4. Deploy (fly.io example)
fly deploy

# 5. Smoke test: complete a routine → check /api/families/[id]/streaks returns streak > 0
```

- [ ] **Step 2: Parameter tuning table**

| Parameter | Location | Default | Effect |
|---|---|---|---|
| `CRITICAL_HIT_CHANCE` | `gamification-constants.ts` | `0.10` | % chance of critical hit per task completion |
| `CRITICAL_HIT_MULTIPLIER` | `gamification-constants.ts` | `2.0` | Bonus points = `basePoints × (multiplier - 1)` |
| `STREAK_FREEZE_COST` | `gamification-constants.ts` | `50` | Points cost to buy a one-day streak freeze |
| `PERFECT_DAY_BONUS` | `gamification-constants.ts` | `10` | Flat bonus for completing all daily routines |
| Tier thresholds | `STREAK_TIERS[].minStreak` | 0/3/7/14/30/100 | Days needed to reach each tier |
| Tier multipliers | `STREAK_TIERS[].multiplier` | 1.0→2.5 | Bonus points factor for streak tier |
| Mystery spin weights | `MYSTERY_SPIN_OUTCOMES[].weight` | 40/25/18/10/5/2 | Relative probability of each rarity |
| Mystery spin points | `MYSTERY_SPIN_OUTCOMES[].points` | 3→50 | Points awarded per rarity |
| Confetti count | `ConfettiCelebration.tsx` `PARTICLE_COUNT` | `40` | Number of confetti particles |
| Auto-clear timers | `GamificationContext.tsx` `AUTO_CLEAR_MS` | 2500/3500ms | How long overlays auto-dismiss |
| Milestone list | `STREAK_MILESTONES` | [3,7,14,...,365] | Which streak counts trigger milestone modal |

> **Tuning advice:** Start conservative with mystery spin mythic weight (2) — increase to 3–4 if children disengage. Lower `STREAK_FREEZE_COST` to 30 for younger children who miss days more often. The deterministic PRNG means the same child gets the same outcome for a given day; rotate by adding a `nonce` field to `BonusLog` if you want repeatable rerolls.
