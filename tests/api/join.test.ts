import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    family: { findUnique: vi.fn() },
    familyMember: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { POST } from "@/app/api/families/join/route";

describe("POST /api/families/join", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins an existing family with valid invite code", async () => {
    vi.mocked(db.family.findUnique).mockResolvedValue({ id: "fam_1", name: "Test Family", inviteCode: "ABC123" } as never);
    vi.mocked(db.familyMember.create).mockResolvedValue({ id: "mem_2", name: "Child", role: "child", color: "#4ECDC4", familyId: "fam_1" } as never);

    const request = new Request("http://localhost/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: "ABC123", name: "Child", role: "child", color: "#4ECDC4" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.member.name).toBe("Child");
    expect(data.familyId).toBe("fam_1");
  });

  it("returns 404 for invalid invite code", async () => {
    vi.mocked(db.family.findUnique).mockResolvedValue(null);
    const request = new Request("http://localhost/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: "XXXXXX", name: "Child", role: "child", color: "#4ECDC4" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
