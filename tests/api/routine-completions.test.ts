import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as toggleCompletion } from "@/app/api/families/[familyId]/routine-completions/route";

vi.mock("@/lib/db", () => ({
  db: {
    routineCompletion: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    routineTask: {
      findUnique: vi.fn().mockResolvedValue({ points: 5, routineId: "r1" }),
    },
    routine: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    bonusLog: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    streak: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "s1", memberId: "m1", current: 1, longest: 1, lastDate: null, frozenUntil: null }),
      update: vi.fn().mockResolvedValue({}),
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
    vi.mocked(db.routineTask.findUnique).mockResolvedValue({ points: 5, routineId: "r1" } as never);
    vi.mocked(db.routine.findMany).mockResolvedValue([] as never);
    vi.mocked(db.routineCompletion.findMany).mockResolvedValue([] as never);

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
    vi.mocked(db.routineTask.findUnique).mockResolvedValue({ points: 5, routineId: "r1" } as never);
    vi.mocked(db.routine.findMany).mockResolvedValue([] as never);
    vi.mocked(db.routineCompletion.findMany).mockResolvedValue([] as never);
    vi.mocked(db.streak.findUnique).mockResolvedValue(null as never);

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
