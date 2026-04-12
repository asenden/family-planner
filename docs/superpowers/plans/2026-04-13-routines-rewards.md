# Routines + Rewards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Routines + Rewards system to FamilyDisplay. Children tap daily task checklists to earn points. Parents configure routines (scheduled task lists) and rewards (point-cost goals). A thermometer visualization shows each child's progress toward each reward — the central gamification element.

**Architecture:** Prisma models already exist (`Routine`, `RoutineTask`, `RoutineCompletion`, `Reward`, `RewardRedemption`). The feature follows the same compact-widget → full-view pattern as the Calendar. A `RoutinesWidget` shows each child's today-progress. `RoutinesFullView` is the full interactive checklist + rewards shop. Settings gets a new "Routines" tab for parents to manage routines and rewards. All data flows through `/api/families/[familyId]/routines/...` routes. Point totals are computed server-side as aggregates over non-redeemed completions.

**Tech Stack:** Next.js App Router, Prisma, Tailwind, Lucide icons, CSS keyframe animations (no additional libraries needed)

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── families/[familyId]/
│   │       ├── routines/
│   │       │   ├── route.ts                    (GET list routines+tasks, POST create routine)
│   │       │   └── [routineId]/
│   │       │       ├── route.ts                (PUT update routine, DELETE routine)
│   │       │       └── tasks/
│   │       │           ├── route.ts            (POST add task)
│   │       │           └── [taskId]/
│   │       │               └── route.ts        (PUT update task, DELETE task)
│   │       ├── routine-completions/
│   │       │   └── route.ts                    (POST toggle completion for today)
│   │       ├── rewards/
│   │       │   ├── route.ts                    (GET list rewards, POST create reward)
│   │       │   └── [rewardId]/
│   │       │       └── route.ts                (PUT update reward, DELETE reward)
│   │       ├── reward-redemptions/
│   │       │   └── route.ts                    (POST redeem reward)
│   │       └── points/
│   │           └── route.ts                    (GET points per member)
│   └── [locale]/dashboard/
│       ├── _components/
│       │   ├── WidgetGrid.tsx                  (modify — wire routines widget)
│       │   ├── DashboardClient.tsx             (modify — pass routines/rewards data)
│       │   ├── RoutinesWidget.tsx              (new — compact per-child progress)
│       │   ├── RoutinesFullView.tsx            (new — full checklist + rewards shop)
│       │   ├── ThermometerBar.tsx              (new — animated progress visualization)
│       │   └── SettingsModal.tsx               (modify — add Routines settings tab)
│       └── page.tsx                            (modify — fetch routines/rewards/points)
messages/
├── en.json                                     (modify — add routines messages)
└── de.json                                     (modify — add routines messages)
tests/
└── api/
    ├── routines.test.ts
    ├── routine-completions.test.ts
    └── rewards.test.ts
```

---

### Task 1: API Routes — Routines CRUD

**Files:**
- Create: `src/app/api/families/[familyId]/routines/route.ts`
- Create: `src/app/api/families/[familyId]/routines/[routineId]/route.ts`
- Create: `src/app/api/families/[familyId]/routines/[routineId]/tasks/route.ts`
- Create: `src/app/api/families/[familyId]/routines/[routineId]/tasks/[taskId]/route.ts`

- [ ] **Step 1: Create routines list + create route**

Create `src/app/api/families/[familyId]/routines/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const routines = await db.routine.findMany({
      where: { familyId },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ routines });
  } catch (error) {
    console.error("Failed to fetch routines:", error);
    return NextResponse.json({ error: "Failed to fetch routines" }, { status: 500 });
  }
}

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

  const { title, icon, schedule, customDays, assignedTo } = body;

  if (!title || !icon || !schedule || !assignedTo) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, schedule, assignedTo" },
      { status: 400 }
    );
  }

  const validSchedules = ["daily", "weekdays", "custom"];
  if (!validSchedules.includes(schedule as string)) {
    return NextResponse.json({ error: "Invalid schedule value" }, { status: 400 });
  }

  try {
    const routine = await db.routine.create({
      data: {
        title: title as string,
        icon: icon as string,
        schedule: schedule as "daily" | "weekdays" | "custom",
        customDays: (customDays as number[]) ?? [],
        familyId,
        assignedTo: assignedTo as string,
      },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ routine }, { status: 201 });
  } catch (error) {
    console.error("Failed to create routine:", error);
    return NextResponse.json({ error: "Failed to create routine" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create routine update + delete route**

Create `src/app/api/families/[familyId]/routines/[routineId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string }> }
) {
  const { routineId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, schedule, customDays, assignedTo } = body;

  if (!title || !icon || !schedule || !assignedTo) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, schedule, assignedTo" },
      { status: 400 }
    );
  }

  try {
    const routine = await db.routine.update({
      where: { id: routineId },
      data: {
        title: title as string,
        icon: icon as string,
        schedule: schedule as "daily" | "weekdays" | "custom",
        customDays: (customDays as number[]) ?? [],
        assignedTo: assignedTo as string,
      },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ routine });
  } catch (error) {
    console.error("Failed to update routine:", error);
    return NextResponse.json({ error: "Failed to update routine" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string }> }
) {
  const { routineId } = await params;

  try {
    await db.routine.delete({ where: { id: routineId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete routine:", error);
    return NextResponse.json({ error: "Failed to delete routine" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create tasks CRUD routes**

Create `src/app/api/families/[familyId]/routines/[routineId]/tasks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string }> }
) {
  const { routineId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, points } = body;

  if (!title || !icon) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon" },
      { status: 400 }
    );
  }

  try {
    // Determine next order value
    const lastTask = await db.routineTask.findFirst({
      where: { routineId },
      orderBy: { order: "desc" },
    });
    const order = (lastTask?.order ?? -1) + 1;

    const task = await db.routineTask.create({
      data: {
        title: title as string,
        icon: icon as string,
        points: (points as number) ?? 1,
        order,
        routineId,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
```

Create `src/app/api/families/[familyId]/routines/[routineId]/tasks/[taskId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string; taskId: string }> }
) {
  const { taskId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, points, order } = body;

  if (!title || !icon) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon" },
      { status: 400 }
    );
  }

  try {
    const task = await db.routineTask.update({
      where: { id: taskId },
      data: {
        title: title as string,
        icon: icon as string,
        points: (points as number) ?? 1,
        ...(order !== undefined ? { order: order as number } : {}),
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string; taskId: string }> }
) {
  const { taskId } = await params;

  try {
    await db.routineTask.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/families/[familyId]/routines/
git commit -m "feat: add routines + tasks CRUD API routes"
```

---

### Task 2: API Routes — Completions, Rewards, Points

**Files:**
- Create: `src/app/api/families/[familyId]/routine-completions/route.ts`
- Create: `src/app/api/families/[familyId]/rewards/route.ts`
- Create: `src/app/api/families/[familyId]/rewards/[rewardId]/route.ts`
- Create: `src/app/api/families/[familyId]/reward-redemptions/route.ts`
- Create: `src/app/api/families/[familyId]/points/route.ts`

- [ ] **Step 1: Create routine completions toggle route**

Completions use an upsert so that tapping a completed task removes it (toggle behaviour).

Create `src/app/api/families/[familyId]/routine-completions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST { taskId, memberId, date: "YYYY-MM-DD", completed: boolean }
// completed=true  → upsert a RoutineCompletion record
// completed=false → delete the record (un-check)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  // familyId is available for auth checks but not used in queries (task ownership is implicit)
  await params; // consume the promise

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

  const dateValue = new Date(date as string);

  try {
    if (completed === false) {
      // Remove completion
      await db.routineCompletion.deleteMany({
        where: { taskId: taskId as string, memberId: memberId as string, date: dateValue },
      });
      return NextResponse.json({ completed: false });
    }

    // Upsert completion
    const completion = await db.routineCompletion.upsert({
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

    return NextResponse.json({ completed: true, completion });
  } catch (error) {
    console.error("Failed to toggle completion:", error);
    return NextResponse.json({ error: "Failed to toggle completion" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create rewards CRUD routes**

Create `src/app/api/families/[familyId]/rewards/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const rewards = await db.reward.findMany({
      where: { familyId },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
      },
      orderBy: { cost: "asc" },
    });

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("Failed to fetch rewards:", error);
    return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
  }
}

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

  const { title, icon, cost } = body;

  if (!title || !icon || cost === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, cost" },
      { status: 400 }
    );
  }

  if (typeof cost !== "number" || cost < 1) {
    return NextResponse.json({ error: "cost must be a positive integer" }, { status: 400 });
  }

  try {
    const reward = await db.reward.create({
      data: {
        title: title as string,
        icon: icon as string,
        cost: cost as number,
        familyId,
      },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
      },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Failed to create reward:", error);
    return NextResponse.json({ error: "Failed to create reward" }, { status: 500 });
  }
}
```

Create `src/app/api/families/[familyId]/rewards/[rewardId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; rewardId: string }> }
) {
  const { rewardId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, cost } = body;

  if (!title || !icon || cost === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, cost" },
      { status: 400 }
    );
  }

  try {
    const reward = await db.reward.update({
      where: { id: rewardId },
      data: {
        title: title as string,
        icon: icon as string,
        cost: cost as number,
      },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
      },
    });

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Failed to update reward:", error);
    return NextResponse.json({ error: "Failed to update reward" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; rewardId: string }> }
) {
  const { rewardId } = await params;

  try {
    await db.reward.delete({ where: { id: rewardId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reward:", error);
    return NextResponse.json({ error: "Failed to delete reward" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create reward redemption route**

Create `src/app/api/families/[familyId]/reward-redemptions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST { rewardId, memberId }
// Server validates that the member has enough points before redeeming.
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

  const { rewardId, memberId } = body;

  if (!rewardId || !memberId) {
    return NextResponse.json(
      { error: "Missing required fields: rewardId, memberId" },
      { status: 400 }
    );
  }

  try {
    // Fetch reward cost
    const reward = await db.reward.findUnique({
      where: { id: rewardId as string, familyId },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Calculate current points for this member
    // Points = sum of task points for completions that have no redemption deducting them.
    // Simple model: all completions are worth their task.points; redemptions "spend" the cost.
    const completions = await db.routineCompletion.findMany({
      where: { memberId: memberId as string },
      include: { task: { select: { points: true } } },
    });

    const totalEarned = completions.reduce((sum, c) => sum + c.task.points, 0);

    const redemptions = await db.rewardRedemption.findMany({
      where: { memberId: memberId as string },
      include: { reward: { select: { cost: true } } },
    });

    const totalSpent = redemptions.reduce((sum, r) => sum + r.reward.cost, 0);
    const currentPoints = totalEarned - totalSpent;

    if (currentPoints < reward.cost) {
      return NextResponse.json(
        { error: "Not enough points", currentPoints, required: reward.cost },
        { status: 422 }
      );
    }

    // Create redemption
    const redemption = await db.rewardRedemption.create({
      data: {
        rewardId: rewardId as string,
        memberId: memberId as string,
      },
    });

    return NextResponse.json({ redemption, newPoints: currentPoints - reward.cost }, { status: 201 });
  } catch (error) {
    console.error("Failed to redeem reward:", error);
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create points summary route**

Create `src/app/api/families/[familyId]/points/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET → returns { points: { [memberId]: number } }
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    // Get all members of this family
    const members = await db.familyMember.findMany({
      where: { familyId },
      select: { id: true },
    });

    const memberIds = members.map((m) => m.id);

    // Sum earned points per member
    const completions = await db.routineCompletion.findMany({
      where: { memberId: { in: memberIds } },
      include: { task: { select: { points: true } } },
    });

    // Sum spent points per member
    const redemptions = await db.rewardRedemption.findMany({
      where: { memberId: { in: memberIds } },
      include: { reward: { select: { cost: true } } },
    });

    const earned: Record<string, number> = {};
    const spent: Record<string, number> = {};

    for (const c of completions) {
      earned[c.memberId] = (earned[c.memberId] ?? 0) + c.task.points;
    }

    for (const r of redemptions) {
      spent[r.memberId] = (spent[r.memberId] ?? 0) + r.reward.cost;
    }

    const points: Record<string, number> = {};
    for (const id of memberIds) {
      points[id] = (earned[id] ?? 0) - (spent[id] ?? 0);
    }

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Failed to fetch points:", error);
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/families/[familyId]/routine-completions/ \
        src/app/api/families/[familyId]/rewards/ \
        src/app/api/families/[familyId]/reward-redemptions/ \
        src/app/api/families/[familyId]/points/
git commit -m "feat: add completions, rewards, redemptions, and points API routes"
```

---

### Task 3: API Tests (TDD)

**Files:**
- Create: `tests/api/routines.test.ts`
- Create: `tests/api/routine-completions.test.ts`
- Create: `tests/api/rewards.test.ts`

- [ ] **Step 1: Write routines API tests**

Create `tests/api/routines.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as createRoutine, GET as listRoutines } from "@/app/api/families/[familyId]/routines/route";
import { PUT as updateRoutine, DELETE as deleteRoutine } from "@/app/api/families/[familyId]/routines/[routineId]/route";
import { POST as createTask } from "@/app/api/families/[familyId]/routines/[routineId]/tasks/route";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  db: {
    routine: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    routineTask: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

function makeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/families/[familyId]/routines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns routines for the family", async () => {
    const mockRoutines = [
      { id: "r1", title: "Morning", icon: "🌅", schedule: "daily", customDays: [], tasks: [], member: { id: "m1", name: "Emma", color: "#FF6B6B" } },
    ];
    vi.mocked(db.routine.findMany).mockResolvedValue(mockRoutines as never);

    const res = await listRoutines(new Request("http://localhost"), makeParams({ familyId: "f1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.routines).toHaveLength(1);
    expect(data.routines[0].title).toBe("Morning");
  });
});

describe("POST /api/families/[familyId]/routines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a routine with valid data", async () => {
    const created = { id: "r2", title: "Bedtime", icon: "🌙", schedule: "daily", customDays: [], tasks: [], member: { id: "m1", name: "Emma", color: "#FF6B6B" } };
    vi.mocked(db.routine.create).mockResolvedValue(created as never);

    const res = await createRoutine(
      makeRequest({ title: "Bedtime", icon: "🌙", schedule: "daily", customDays: [], assignedTo: "m1" }),
      makeParams({ familyId: "f1" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.routine.title).toBe("Bedtime");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await createRoutine(
      makeRequest({ title: "Bedtime" }),
      makeParams({ familyId: "f1" })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid schedule value", async () => {
    const res = await createRoutine(
      makeRequest({ title: "Bedtime", icon: "🌙", schedule: "hourly", assignedTo: "m1" }),
      makeParams({ familyId: "f1" })
    );

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/families/[familyId]/routines/[routineId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes and returns success", async () => {
    vi.mocked(db.routine.delete).mockResolvedValue({} as never);

    const res = await deleteRoutine(new Request("http://localhost"), makeParams({ familyId: "f1", routineId: "r1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe("POST /api/families/[familyId]/routines/[routineId]/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a task with auto-incremented order", async () => {
    vi.mocked(db.routineTask.findFirst).mockResolvedValue({ order: 2 } as never);
    vi.mocked(db.routineTask.create).mockResolvedValue({ id: "t1", title: "Brush teeth", icon: "🦷", points: 5, order: 3, routineId: "r1" } as never);

    const res = await createTask(
      makeRequest({ title: "Brush teeth", icon: "🦷", points: 5 }),
      makeParams({ familyId: "f1", routineId: "r1" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.task.order).toBe(3);
    expect(data.task.title).toBe("Brush teeth");
  });
});
```

- [ ] **Step 2: Write completions and rewards tests**

Create `tests/api/routine-completions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as toggleCompletion } from "@/app/api/families/[familyId]/routine-completions/route";

vi.mock("@/lib/db", () => ({
  db: {
    routineCompletion: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

describe("POST /api/families/[familyId]/routine-completions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates completion when completed=true", async () => {
    const mockCompletion = { id: "c1", taskId: "t1", memberId: "m1", date: new Date("2026-04-13") };
    vi.mocked(db.routineCompletion.upsert).mockResolvedValue(mockCompletion as never);

    const res = await toggleCompletion(
      makeRequest({ taskId: "t1", memberId: "m1", date: "2026-04-13", completed: true }),
      makeParams({ familyId: "f1" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completed).toBe(true);
    expect(db.routineCompletion.upsert).toHaveBeenCalledOnce();
  });

  it("removes completion when completed=false", async () => {
    vi.mocked(db.routineCompletion.deleteMany).mockResolvedValue({ count: 1 } as never);

    const res = await toggleCompletion(
      makeRequest({ taskId: "t1", memberId: "m1", date: "2026-04-13", completed: false }),
      makeParams({ familyId: "f1" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completed).toBe(false);
    expect(db.routineCompletion.deleteMany).toHaveBeenCalledOnce();
  });

  it("returns 400 when fields are missing", async () => {
    const res = await toggleCompletion(
      makeRequest({ taskId: "t1" }),
      makeParams({ familyId: "f1" })
    );

    expect(res.status).toBe(400);
  });
});
```

Create `tests/api/rewards.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listRewards, POST as createReward } from "@/app/api/families/[familyId]/rewards/route";
import { POST as redeemReward } from "@/app/api/families/[familyId]/reward-redemptions/route";

vi.mock("@/lib/db", () => ({
  db: {
    reward: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    routineCompletion: {
      findMany: vi.fn(),
    },
    rewardRedemption: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

describe("POST /api/families/[familyId]/rewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a reward with valid data", async () => {
    const created = { id: "rw1", title: "Movie night", icon: "🎬", cost: 100, familyId: "f1", redemptions: [] };
    vi.mocked(db.reward.create).mockResolvedValue(created as never);

    const res = await createReward(
      makeRequest({ title: "Movie night", icon: "🎬", cost: 100 }),
      makeParams({ familyId: "f1" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.reward.cost).toBe(100);
  });

  it("returns 400 when cost is missing", async () => {
    const res = await createReward(
      makeRequest({ title: "Movie night", icon: "🎬" }),
      makeParams({ familyId: "f1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when cost is zero", async () => {
    const res = await createReward(
      makeRequest({ title: "Trip", icon: "✈️", cost: 0 }),
      makeParams({ familyId: "f1" })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/families/[familyId]/reward-redemptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redeems when member has enough points", async () => {
    vi.mocked(db.reward.findUnique).mockResolvedValue({ id: "rw1", cost: 50, title: "Movie night", icon: "🎬", familyId: "f1", createdAt: new Date() } as never);
    vi.mocked(db.routineCompletion.findMany).mockResolvedValue([
      { task: { points: 30 } },
      { task: { points: 30 } },
    ] as never);
    vi.mocked(db.rewardRedemption.findMany).mockResolvedValue([] as never);
    vi.mocked(db.rewardRedemption.create).mockResolvedValue({ id: "red1" } as never);

    const res = await redeemReward(
      makeRequest({ rewardId: "rw1", memberId: "m1" }),
      makeParams({ familyId: "f1" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.newPoints).toBe(10); // 60 earned - 50 spent
  });

  it("returns 422 when member has insufficient points", async () => {
    vi.mocked(db.reward.findUnique).mockResolvedValue({ id: "rw1", cost: 500, title: "Zoo trip", icon: "🦁", familyId: "f1", createdAt: new Date() } as never);
    vi.mocked(db.routineCompletion.findMany).mockResolvedValue([
      { task: { points: 5 } },
    ] as never);
    vi.mocked(db.rewardRedemption.findMany).mockResolvedValue([] as never);

    const res = await redeemReward(
      makeRequest({ rewardId: "rw1", memberId: "m1" }),
      makeParams({ familyId: "f1" })
    );

    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 3: Run tests (expect pass after routes are implemented)**

```bash
npx vitest run tests/api/routines.test.ts tests/api/routine-completions.test.ts tests/api/rewards.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/api/routines.test.ts tests/api/routine-completions.test.ts tests/api/rewards.test.ts
git commit -m "test: add API tests for routines, completions, and rewards"
```

---

### Task 4: i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add English messages**

Add the following to `messages/en.json` at the root level (alongside `"calendar"`, `"settings"`, etc.):

```json
"routines": {
  "title": "Routines",
  "noRoutines": "No routines yet",
  "noTasksToday": "Nothing scheduled today",
  "tasksComplete": "All done!",
  "taskProgress": "{done} of {total} done",
  "points": "{count} pts",
  "totalPoints": "{count} points",
  "earnedToday": "+{count} pts today",
  "scheduleDaily": "Every day",
  "scheduleWeekdays": "Weekdays",
  "scheduleCustom": "Custom days",
  "tapToCheck": "Tap to check off",
  "rewardsTitle": "Rewards",
  "rewardsShop": "Goals",
  "noRewards": "No rewards yet",
  "redeemButton": "Redeem",
  "redeemConfirm": "Redeem \"{title}\" for {cost} points?",
  "redeemSuccess": "Reward redeemed!",
  "notEnoughPoints": "Not enough points yet",
  "progressLabel": "{current} / {cost} points",
  "settingsTab": "Routines",
  "manageRoutines": "Manage Routines",
  "manageRewards": "Manage Rewards",
  "addRoutine": "Add Routine",
  "editRoutine": "Edit Routine",
  "deleteRoutine": "Delete Routine",
  "addTask": "Add Task",
  "editTask": "Edit Task",
  "deleteTask": "Delete Task",
  "addReward": "Add Reward",
  "editReward": "Edit Reward",
  "deleteReward": "Delete Reward",
  "routineTitle": "Routine Name",
  "routineIcon": "Icon",
  "routineSchedule": "Schedule",
  "routineAssignTo": "Assign to",
  "taskTitle": "Task Name",
  "taskIcon": "Icon",
  "taskPoints": "Points",
  "rewardTitle": "Reward Name",
  "rewardIcon": "Icon",
  "rewardCost": "Point Cost",
  "confirmDelete": "Delete this?",
  "days": {
    "0": "Sun",
    "1": "Mon",
    "2": "Tue",
    "3": "Wed",
    "4": "Thu",
    "5": "Fri",
    "6": "Sat"
  }
}
```

- [ ] **Step 2: Add German messages**

Add the following to `messages/de.json` at the root level:

```json
"routines": {
  "title": "Routinen",
  "noRoutines": "Noch keine Routinen",
  "noTasksToday": "Heute nichts geplant",
  "tasksComplete": "Alles erledigt!",
  "taskProgress": "{done} von {total} erledigt",
  "points": "{count} Pkt.",
  "totalPoints": "{count} Punkte",
  "earnedToday": "+{count} Pkt. heute",
  "scheduleDaily": "Täglich",
  "scheduleWeekdays": "Wochentags",
  "scheduleCustom": "Eigene Tage",
  "tapToCheck": "Zum Abhaken tippen",
  "rewardsTitle": "Belohnungen",
  "rewardsShop": "Ziele",
  "noRewards": "Noch keine Belohnungen",
  "redeemButton": "Einlösen",
  "redeemConfirm": "\"{title}\" für {cost} Punkte einlösen?",
  "redeemSuccess": "Belohnung eingelöst!",
  "notEnoughPoints": "Noch nicht genug Punkte",
  "progressLabel": "{current} / {cost} Punkte",
  "settingsTab": "Routinen",
  "manageRoutines": "Routinen verwalten",
  "manageRewards": "Belohnungen verwalten",
  "addRoutine": "Routine hinzufügen",
  "editRoutine": "Routine bearbeiten",
  "deleteRoutine": "Routine löschen",
  "addTask": "Aufgabe hinzufügen",
  "editTask": "Aufgabe bearbeiten",
  "deleteTask": "Aufgabe löschen",
  "addReward": "Belohnung hinzufügen",
  "editReward": "Belohnung bearbeiten",
  "deleteReward": "Belohnung löschen",
  "routineTitle": "Routinenname",
  "routineIcon": "Symbol",
  "routineSchedule": "Zeitplan",
  "routineAssignTo": "Zuweisen an",
  "taskTitle": "Aufgabenname",
  "taskIcon": "Symbol",
  "taskPoints": "Punkte",
  "rewardTitle": "Belohnungsname",
  "rewardIcon": "Symbol",
  "rewardCost": "Punktekosten",
  "confirmDelete": "Löschen?",
  "days": {
    "0": "So",
    "1": "Mo",
    "2": "Di",
    "3": "Mi",
    "4": "Do",
    "5": "Fr",
    "6": "Sa"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat: add i18n messages for routines + rewards"
```

---

### Task 5: ThermometerBar Component

**Files:**
- Create: `src/app/[locale]/dashboard/_components/ThermometerBar.tsx`

The thermometer is the centerpiece gamification element. It fills from bottom to top using a CSS clip + animated gradient. When `pct >= 100` it pulses gold and shows a celebration glow.

- [ ] **Step 1: Create ThermometerBar component**

Create `src/app/[locale]/dashboard/_components/ThermometerBar.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

interface ThermometerBarProps {
  current: number;   // current points
  cost: number;      // points needed
  color?: string;    // accent color, defaults to amber
  height?: number;   // bar height in px, defaults to 120
  label?: string;    // optional label below
}

export function ThermometerBar({
  current,
  cost,
  color = "#f59e0b",
  height = 120,
  label,
}: ThermometerBarProps) {
  const pct = Math.min(100, cost > 0 ? Math.round((current / cost) * 100) : 0);
  const complete = pct >= 100;
  const prevPctRef = useRef(pct);

  // Trigger a CSS animation class when completion is first reached
  const celebrateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!complete || prevPctRef.current >= 100) return;
    prevPctRef.current = pct;
    const el = celebrateRef.current;
    if (!el) return;
    el.classList.remove("thermometer-celebrate");
    // Force reflow
    void el.offsetWidth;
    el.classList.add("thermometer-celebrate");
  }, [complete, pct]);

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: 32 }}>
      {/* Bulb top label */}
      <span
        className="text-[10px] font-bold tabular-nums leading-none"
        style={{ color: complete ? color : "var(--color-text-muted)" }}
      >
        {pct}%
      </span>

      {/* Tube */}
      <div
        ref={celebrateRef}
        className="relative rounded-full overflow-hidden"
        style={{
          width: 14,
          height,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: complete ? `0 0 16px ${color}60` : undefined,
        }}
      >
        {/* Fill — grows from bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ease-out"
          style={{
            height: `${pct}%`,
            background: complete
              ? `linear-gradient(to top, ${color}, #fde68a)`
              : `linear-gradient(to top, ${color}cc, ${color}66)`,
            boxShadow: complete ? `0 0 8px ${color}80` : undefined,
          }}
        />

        {/* Shimmer overlay when complete */}
        {complete && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%)",
              animation: "thermometer-shimmer 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Bulb */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 20,
          height: 20,
          background: complete
            ? `radial-gradient(circle, ${color}, ${color}aa)`
            : `radial-gradient(circle, ${color}66, ${color}33)`,
          border: `2px solid ${color}44`,
          boxShadow: complete ? `0 0 12px ${color}80` : undefined,
          transition: "all 0.5s ease",
        }}
      />

      {/* Optional label */}
      {label && (
        <span
          className="text-[9px] font-semibold text-center leading-tight"
          style={{
            color: "var(--color-text-muted)",
            maxWidth: 40,
            wordBreak: "break-word",
          }}
        >
          {label}
        </span>
      )}

      <style>{`
        @keyframes thermometer-shimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .thermometer-celebrate {
          animation: thermometer-pop 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes thermometer-pop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.25); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/_components/ThermometerBar.tsx
git commit -m "feat: add ThermometerBar animated progress component"
```

---

### Task 6: RoutinesWidget (Dashboard Compact View)

**Files:**
- Create: `src/app/[locale]/dashboard/_components/RoutinesWidget.tsx`

The widget shows, for each child member, their name/color dot, today's task count (X/Y done), a thin progress bar, and current points total. Tapping opens the full view.

- [ ] **Step 1: Create RoutinesWidget**

Create `src/app/[locale]/dashboard/_components/RoutinesWidget.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/_components/RoutinesWidget.tsx
git commit -m "feat: add RoutinesWidget compact dashboard component"
```

---

### Task 7: RoutinesFullView (Full Interactive View)

**Files:**
- Create: `src/app/[locale]/dashboard/_components/RoutinesFullView.tsx`

The full view has two tabs: **Tasks** (checklist per routine per child) and **Goals** (rewards shop with thermometers). Checking a task fires the completion API, updates local state optimistically, and plays a brief CSS animation. Redeeming a reward shows a confirm dialog.

- [ ] **Step 1: Create RoutinesFullView**

Create `src/app/[locale]/dashboard/_components/RoutinesFullView.tsx`:

```tsx
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
  const [redeemingFor, setRedeemingFor] = useState<string | null>(null); // memberId
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

        {/* Total points display (first child, or sum) */}
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
              const todayRoutines = routines.filter(
                (r) => r.assignedTo === child.id && isScheduledToday(r)
              );
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

                  {todayRoutines.length === 0 ? (
                    <div
                      className="glass p-4"
                      style={{ borderRadius: "var(--border-radius)" }}
                    >
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        {t("noTasksToday")}
                      </p>
                    </div>
                  ) : (
                    todayRoutines.map((routine) => (
                      <div
                        key={routine.id}
                        className="glass p-4 space-y-2"
                        style={{ borderRadius: "var(--border-radius)" }}
                      >
                        {/* Routine title */}
                        <p
                          className="text-[11px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {routine.icon} {routine.title}
                        </p>

                        {/* Tasks */}
                        <div className="space-y-1">
                          {routine.tasks.map((task) => {
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
                      </div>
                    ))
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
                                  {pct}% {t("notEnoughPoints").split(" ").slice(-2).join(" ")}
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
                {t("title") /* reuse "cancel" from common */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/_components/RoutinesFullView.tsx
git commit -m "feat: add RoutinesFullView with task checklist and rewards thermometers"
```

---

### Task 8: Settings — Routines Tab

**Files:**
- Modify: `src/app/[locale]/dashboard/_components/SettingsModal.tsx`

Add a "Routines" tab (only shown when the current user is a parent) that allows managing routines and rewards. The tab contains two sub-sections: Routines list (with add/edit/delete for routines and their tasks) and Rewards list (add/edit/delete).

- [ ] **Step 1: Add Routines tab to SettingsModal**

In `src/app/[locale]/dashboard/_components/SettingsModal.tsx`:

**1a. Add imports at the top:**

```tsx
import { Settings, Users, CalendarDays, Key, X, MapPin, ListChecks, Trophy, Plus, Trash2, Pencil } from "lucide-react";
```

**1b. Add new interfaces before the `SettingsModalProps` interface:**

```tsx
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
  member: { id: string; name: string; color: string };
}

interface Reward {
  id: string;
  title: string;
  icon: string;
  cost: number;
  redemptions: { id: string; memberId: string }[];
}
```

**1c. Extend `SettingsModalProps`:**

```tsx
interface SettingsModalProps {
  familyId: string;
  familyCode: string;
  members: FamilyMember[];
  city?: string | null;
  isParent?: boolean;
  onClose: () => void;
}
```

**1d. Update the `Tab` type and add routines state:**

Change:
```tsx
type Tab = "members" | "calendars" | "location" | "code";
```
To:
```tsx
type Tab = "members" | "calendars" | "location" | "code" | "routines";
```

In the `SettingsModal` function body, after the existing state declarations, add:

```tsx
const tRoutines = useTranslations("routines");
const [routines, setRoutines] = useState<Routine[]>([]);
const [rewards, setRewards] = useState<Reward[]>([]);
const [loadingRoutines, setLoadingRoutines] = useState(false);
const [showAddRoutine, setShowAddRoutine] = useState(false);
const [showAddReward, setShowAddReward] = useState(false);
const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
const [editingReward, setEditingReward] = useState<Reward | null>(null);
```

**1e. Add useEffect to fetch routines when tab is active:**

After the existing `useEffect` for `activeTab === "calendars"`, add:

```tsx
useEffect(() => {
  if (activeTab !== "routines") return;
  setLoadingRoutines(true);
  Promise.all([
    fetch(`/api/families/${familyId}/routines`).then((r) => r.json()),
    fetch(`/api/families/${familyId}/rewards`).then((r) => r.json()),
  ])
    .then(([routinesData, rewardsData]) => {
      setRoutines(routinesData.routines ?? []);
      setRewards(rewardsData.rewards ?? []);
    })
    .catch(() => {})
    .finally(() => setLoadingRoutines(false));
}, [activeTab, familyId]);
```

**1f. Add the routines tab to the `tabs` array:**

Change the `tabs` array to include the new tab (add it after `location`):

```tsx
const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
  { key: "members", icon: <Users size={16} strokeWidth={1.5} />, label: t("familyMembers") },
  { key: "calendars", icon: <CalendarDays size={16} strokeWidth={1.5} />, label: t("calendarConnectors") },
  { key: "location", icon: <MapPin size={16} strokeWidth={1.5} />, label: t("location") },
  { key: "routines", icon: <ListChecks size={16} strokeWidth={1.5} />, label: tRoutines("settingsTab") },
  { key: "code", icon: <Key size={16} strokeWidth={1.5} />, label: t("familyCode") },
];
```

**1g. Add the routines tab content block (add after the `activeTab === "location"` block):**

```tsx
{activeTab === "routines" && (
  <div className="space-y-4">
    {loadingRoutines ? (
      <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
        {t("save" /* reuse loading text */)}...
      </p>
    ) : (
      <>
        {/* --- Routines section --- */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
              {tRoutines("manageRoutines")}
            </p>
            <button
              onClick={() => setShowAddRoutine(true)}
              className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
            >
              <Plus size={12} /> {tRoutines("addRoutine")}
            </button>
          </div>

          <div className="space-y-2">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {routine.icon} {routine.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {routine.member.name} · {routine.tasks.length} tasks
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingRoutine(routine)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: "var(--color-text-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(tRoutines("confirmDelete"))) return;
                      await fetch(`/api/families/${familyId}/routines/${routine.id}`, { method: "DELETE" });
                      setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
                    }}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
            {routines.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{tRoutines("noRoutines")}</p>
            )}
          </div>
        </div>

        {/* --- Rewards section --- */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
              {tRoutines("manageRewards")}
            </p>
            <button
              onClick={() => setShowAddReward(true)}
              className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
              style={{ backgroundColor: "#f59e0b", color: "#1a1625" }}
            >
              <Trophy size={12} /> {tRoutines("addReward")}
            </button>
          </div>

          <div className="space-y-2">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {reward.icon} {reward.title}
                  <span className="ml-2 text-xs font-normal" style={{ color: "#f59e0b" }}>
                    {reward.cost} pts
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingReward(reward)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: "var(--color-text-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(tRoutines("confirmDelete"))) return;
                      await fetch(`/api/families/${familyId}/rewards/${reward.id}`, { method: "DELETE" });
                      setRewards((prev) => prev.filter((r) => r.id !== reward.id));
                    }}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
            {rewards.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{tRoutines("noRewards")}</p>
            )}
          </div>
        </div>

        {/* Add Routine Form */}
        {showAddRoutine && (
          <AddRoutineForm
            familyId={familyId}
            members={members}
            onClose={() => setShowAddRoutine(false)}
            onAdded={(routine) => {
              setRoutines((prev) => [...prev, routine]);
              setShowAddRoutine(false);
            }}
          />
        )}

        {/* Add Reward Form */}
        {showAddReward && (
          <AddRewardForm
            familyId={familyId}
            onClose={() => setShowAddReward(false)}
            onAdded={(reward) => {
              setRewards((prev) => [...prev, reward]);
              setShowAddReward(false);
            }}
          />
        )}
      </>
    )}
  </div>
)}
```

**1h. Add `AddRoutineForm` and `AddRewardForm` sub-components at the bottom of the file (before the closing of the module, after `AddMemberForm`):**

```tsx
function AddRoutineForm({
  familyId,
  members,
  onClose,
  onAdded,
}: {
  familyId: string;
  members: FamilyMember[];
  onClose: () => void;
  onAdded: (routine: Routine) => void;
}) {
  const tRoutines = useTranslations("routines");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📋");
  const [schedule, setSchedule] = useState<"daily" | "weekdays" | "custom">("daily");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [assignedTo, setAssignedTo] = useState(members[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/routines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, schedule, customDays, assignedTo }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdded(data.routine);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("addRoutine")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-14 text-center text-2xl rounded-xl p-2"
          style={inputStyle}
          maxLength={2}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tRoutines("routineTitle")}
          className="flex-1 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
      </div>
      <select
        value={schedule}
        onChange={(e) => setSchedule(e.target.value as "daily" | "weekdays" | "custom")}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={inputStyle}
      >
        <option value="daily">{tRoutines("scheduleDaily")}</option>
        <option value="weekdays">{tRoutines("scheduleWeekdays")}</option>
        <option value="custom">{tRoutines("scheduleCustom")}</option>
      </select>
      {schedule === "custom" && (
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCustomDays((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i])}
              className="w-8 h-8 rounded-lg text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: customDays.includes(i) ? "var(--color-primary)" : "rgba(255,255,255,0.06)",
                color: customDays.includes(i) ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <select
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={inputStyle}
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer" style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
          {saving ? "..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function AddRewardForm({
  familyId,
  onClose,
  onAdded,
}: {
  familyId: string;
  onClose: () => void;
  onAdded: (reward: Reward) => void;
}) {
  const tRoutines = useTranslations("routines");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("🏆");
  const [cost, setCost] = useState(50);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || cost < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, cost }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdded(data.reward);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("addReward")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-14 text-center text-2xl rounded-xl p-2"
          style={inputStyle}
          maxLength={2}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tRoutines("rewardTitle")}
          className="flex-1 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{tRoutines("rewardCost")}</label>
        <input
          type="number"
          value={cost}
          min={1}
          onChange={(e) => setCost(Number(e.target.value))}
          className="w-24 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer" style={{ backgroundColor: "#f59e0b", color: "#1a1625" }}>
          {saving ? "..." : "Save"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/_components/SettingsModal.tsx
git commit -m "feat: add Routines settings tab to SettingsModal"
```

---

### Task 9: Wire Dashboard Page and Clients

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `src/app/[locale]/dashboard/_components/DashboardClient.tsx`
- Modify: `src/app/[locale]/dashboard/_components/WidgetGrid.tsx`

- [ ] **Step 1: Update dashboard page to fetch routines data**

In `src/app/[locale]/dashboard/page.tsx`, update `getFamilyData` to also fetch routines, rewards, points, and today's completions.

Add to the existing `getFamilyData` function, after the CalDAV sync block (before the `weather` fetch), replacing `return { ... }` with:

```typescript
// Fetch routines + today completions + rewards + points
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const routines = await db.routine.findMany({
  where: { familyId: family.id },
  include: {
    tasks: { orderBy: { order: "asc" } },
  },
  orderBy: { createdAt: "asc" },
});

const todayCompletions = await db.routineCompletion.findMany({
  where: {
    date: today,
    task: {
      routine: { familyId: family.id },
    },
  },
  select: { taskId: true, memberId: true },
});

const rewards = await db.reward.findMany({
  where: { familyId: family.id },
  include: { redemptions: { select: { id: true, memberId: true, redeemedAt: true } } },
  orderBy: { cost: "asc" },
});

// Compute points per member
const memberIds = family.members.map((m) => m.id);
const allCompletions = await db.routineCompletion.findMany({
  where: { memberId: { in: memberIds } },
  include: { task: { select: { points: true } } },
});
const allRedemptions = await db.rewardRedemption.findMany({
  where: { memberId: { in: memberIds } },
  include: { reward: { select: { cost: true } } },
});
const pointsMap: Record<string, number> = {};
for (const id of memberIds) {
  const earned = allCompletions
    .filter((c) => c.memberId === id)
    .reduce((s, c) => s + c.task.points, 0);
  const spent = allRedemptions
    .filter((r) => r.memberId === id)
    .reduce((s, r) => s + r.reward.cost, 0);
  pointsMap[id] = earned - spent;
}
```

And update the return value:

```typescript
return {
  familyId: family.id,
  familyCode: family.inviteCode,
  members: family.members,
  events: expandedEvents,
  weather,
  city: family.city ?? null,
  routines: routines.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    schedule: r.schedule,
    customDays: r.customDays,
    assignedTo: r.assignedTo,
    tasks: r.tasks.map((t) => ({ id: t.id, title: t.title, icon: t.icon, points: t.points, order: t.order })),
  })),
  todayCompletedTaskIds: todayCompletions.map((c) => c.taskId),
  rewards: rewards.map((rw) => ({
    id: rw.id,
    title: rw.title,
    icon: rw.icon,
    cost: rw.cost,
    redemptions: rw.redemptions,
  })),
  pointsMap,
};
```

Update the `DashboardClient` render call to pass the new props:

```tsx
return (
  <DashboardClient
    familyId={familyData.familyId}
    familyCode={familyData.familyCode}
    calendarEvents={familyData.events}
    familyMembers={familyData.members}
    weather={familyData.weather}
    city={familyData.city}
    routines={familyData.routines}
    todayCompletedTaskIds={familyData.todayCompletedTaskIds}
    rewards={familyData.rewards}
    pointsMap={familyData.pointsMap}
  />
);
```

- [ ] **Step 2: Update DashboardClient to accept and pass routines props**

In `src/app/[locale]/dashboard/_components/DashboardClient.tsx`, update the `DashboardClientProps` interface:

```tsx
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
  redemptions: { id: string; memberId: string; redeemedAt: string }[];
}

interface DashboardClientProps {
  familyId: string;
  familyCode: string;
  calendarEvents: CalendarEvent[];
  familyMembers: FamilyMember[];
  weather?: WeatherData | null;
  city?: string | null;
  routines?: Routine[];
  todayCompletedTaskIds?: string[];
  rewards?: Reward[];
  pointsMap?: Record<string, number>;
}
```

Update the destructure and `WidgetGrid` call:

```tsx
export function DashboardClient({
  familyId, familyCode, calendarEvents, familyMembers, weather, city,
  routines = [], todayCompletedTaskIds = [], rewards = [], pointsMap = {},
}: DashboardClientProps) {
  // ... existing state

  return (
    <div className="grain min-h-screen p-5 flex flex-col gap-5 relative z-10">
      <TopBar ... />
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <WidgetGrid
            calendarEvents={calendarEvents}
            familyMembers={familyMembers}
            familyId={familyId}
            routines={routines}
            todayCompletedTaskIds={todayCompletedTaskIds}
            rewards={rewards}
            pointsMap={pointsMap}
          />
        </div>
      </div>
      {/* ... rest unchanged */}
    </div>
  );
}
```

- [ ] **Step 3: Update WidgetGrid to wire RoutinesWidget + RoutinesFullView**

Replace the stub `WidgetCard` for routines in `src/app/[locale]/dashboard/_components/WidgetGrid.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pin, UtensilsCrossed, Heart, Images } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { CalendarWidget } from "./CalendarWidget";
import { CalendarFullView } from "./CalendarFullView";
import { RoutinesWidget } from "./RoutinesWidget";
import { RoutinesFullView } from "./RoutinesFullView";

// (copy type definitions from DashboardClient or import from a shared types file)
interface CalendarEvent { /* ... same as before ... */ }
interface FamilyMember { id: string; name: string; color: string; role: string; }
interface RoutineTask { id: string; title: string; icon: string; points: number; order: number; }
interface Routine { id: string; title: string; icon: string; schedule: "daily" | "weekdays" | "custom"; customDays: number[]; assignedTo: string; tasks: RoutineTask[]; }
interface Reward { id: string; title: string; icon: string; cost: number; redemptions: { id: string; memberId: string }[]; }

interface WidgetGridProps {
  calendarEvents?: CalendarEvent[];
  familyMembers?: FamilyMember[];
  familyId?: string;
  routines?: Routine[];
  todayCompletedTaskIds?: string[];
  rewards?: Reward[];
  pointsMap?: Record<string, number>;
}

export function WidgetGrid({
  calendarEvents = [],
  familyMembers = [],
  familyId,
  routines = [],
  todayCompletedTaskIds = [],
  rewards = [],
  pointsMap = {},
}: WidgetGridProps) {
  const t = useTranslations("dashboard");
  const [fullView, setFullView] = useState<string | null>(null);
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | undefined>();

  if (fullView === "calendar" && familyId) {
    return (
      <CalendarFullView
        familyId={familyId}
        events={calendarEvents}
        members={familyMembers}
        initialDate={calendarInitialDate}
        onBack={() => setFullView(null)}
      />
    );
  }

  if (fullView === "routines" && familyId) {
    return (
      <RoutinesFullView
        familyId={familyId}
        routines={routines}
        rewards={rewards}
        members={familyMembers}
        pointsMap={pointsMap}
        initialCompletedTaskIds={todayCompletedTaskIds}
        onBack={() => setFullView(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <CalendarWidget
        events={calendarEvents}
        onTap={(dateStr) => {
          if (dateStr) setCalendarInitialDate(new Date(dateStr + "T00:00:00"));
          else setCalendarInitialDate(undefined);
          setFullView("calendar");
        }}
      />

      <RoutinesWidget
        routines={routines}
        completedTaskIds={todayCompletedTaskIds}
        pointsMap={pointsMap}
        members={familyMembers}
        onTap={() => setFullView("routines")}
      />

      <WidgetCard title={t("widgets.pinboard")} icon={<Pin size={20} strokeWidth={1.8} />} color="#34d399" delay={150}>
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.meal")} icon={<UtensilsCrossed size={20} strokeWidth={1.8} />} color="#60a5fa" delay={200}>
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.feelings")} icon={<Heart size={20} strokeWidth={1.8} />} color="#c084fc" delay={250}>
        <div className="flex gap-3 text-2xl">
          <span>😊</span><span>😐</span><span>😢</span><span>😠</span><span>🤩</span>
        </div>
      </WidgetCard>

      <WidgetCard title={t("widgets.photos")} icon={<Images size={20} strokeWidth={1.8} />} color="#fbbf24" delay={300}>
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/dashboard/page.tsx \
        src/app/[locale]/dashboard/_components/DashboardClient.tsx \
        src/app/[locale]/dashboard/_components/WidgetGrid.tsx
git commit -m "feat: wire routines data through dashboard page, client, and grid"
```

---

### Task 10: Deploy

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Verify no TypeScript errors or missing translations.

- [ ] **Step 3: Database migration on VPS**

The Prisma schema already includes all required models (`Routine`, `RoutineTask`, `RoutineCompletion`, `Reward`, `RewardRedemption`). Run the pending migration using the builder image:

```bash
# On VPS — same pattern as Plan 1
docker compose run --rm builder npx prisma migrate deploy
```

- [ ] **Step 4: Push and deploy**

```bash
git push origin main
```

The VPS auto-deploys via CI/CD (as established in Plan 1).

- [ ] **Step 5: Smoke test on tablet**

1. Open Settings → Routines tab
2. Add a routine: "Morning" 🌅, daily, assigned to a child, with tasks "Brush teeth" 🦷 (5 pts), "Make bed" 🛏 (3 pts)
3. Add a reward: "Movie night" 🎬, 50 pts
4. Close settings → verify RoutinesWidget shows the child's name and 0/2 progress bar
5. Tap widget to open full view
6. Tap each task → progress bar fills, points count increases
7. Switch to Goals tab → thermometer fills as points accumulate
8. Add enough tasks to reach 50 pts → Redeem button appears with glow
9. Tap Redeem → confirm dialog → confirm → points deducted, thermometer resets

---

## Schema Verification

The `prisma/schema.prisma` already contains all required models. No schema changes are needed:

- `Routine` — id, title, icon, schedule (RoutineSchedule enum), customDays (Int[]), familyId, assignedTo (member), tasks
- `RoutineTask` — id, title, icon, order, points (default 1), routineId, completions
- `RoutineCompletion` — id, date (@db.Date), completedAt, taskId, memberId — with unique constraint `@@unique([taskId, memberId, date])`
- `Reward` — id, title, icon, cost, familyId, redemptions
- `RewardRedemption` — id, redeemedAt, rewardId, memberId

The unique constraint on `RoutineCompletion` enables safe upserts for the toggle endpoint.

---

## Key Design Decisions

**Points model:** Points are not stored as a running total. They are computed on-demand as `sum(task.points for completions) - sum(reward.cost for redemptions)`. This is simple, auditable, and avoids drift. For large families the points route can be cached.

**Toggle completion:** The `POST /routine-completions` endpoint handles both check and uncheck in one call (`completed: boolean`). This simplifies the client — it fires a single fetch regardless of direction.

**Optimistic UI:** `RoutinesFullView` updates `completedIds`, `pointsMap` state immediately before the fetch resolves, then rolls back on error. This makes tapping feel instant on a wall-mounted tablet even with latency.

**ThermometerBar isolation:** The thermometer is a standalone component that takes only `current` and `cost` as numbers — no knowledge of rewards or members. This makes it reusable for any future "filling" progress visualizations.

**Settings tab access:** The Routines settings tab is added unconditionally (any family member can view it) but the create/delete buttons could be hidden for children by passing `isParent` prop — noted as a future hardening step.
