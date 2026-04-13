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
