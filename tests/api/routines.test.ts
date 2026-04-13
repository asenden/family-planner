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
