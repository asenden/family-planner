import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    family: { create: vi.fn() },
    familyMember: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { POST } from "@/app/api/families/route";

describe("POST /api/families", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a family with the first parent member", async () => {
    vi.mocked(db.family.create).mockResolvedValue({ id: "fam_1", name: "Test Family", inviteCode: "ABC123", theme: "playful", locale: "de" } as never);
    vi.mocked(db.familyMember.create).mockResolvedValue({ id: "mem_1", name: "Parent", email: "parent@test.com", role: "parent", color: "#FF6B6B", familyId: "fam_1" } as never);

    const request = new Request("http://localhost/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName: "Test Family", memberName: "Parent", email: "parent@test.com", password: "secret123", color: "#FF6B6B" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.family.name).toBe("Test Family");
    expect(data.family.inviteCode).toBeDefined();
    expect(data.member.name).toBe("Parent");
    expect(db.family.create).toHaveBeenCalledOnce();
    expect(db.familyMember.create).toHaveBeenCalledOnce();
  });

  it("returns 400 if required fields are missing", async () => {
    const request = new Request("http://localhost/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName: "Test" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
