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
