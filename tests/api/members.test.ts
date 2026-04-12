import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    familyMember: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/families/[familyId]/members/route";

describe("GET /api/families/[familyId]/members", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all members of a family", async () => {
    vi.mocked(db.familyMember.findMany).mockResolvedValue([
      { id: "mem_1", name: "Parent", role: "parent", color: "#FF6B6B", avatar: null },
      { id: "mem_2", name: "Child", role: "child", color: "#4ECDC4", avatar: null },
    ] as never);

    const request = new Request("http://localhost/api/families/fam_1/members");
    const response = await GET(request, { params: Promise.resolve({ familyId: "fam_1" }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.members).toHaveLength(2);
  });
});
