import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    calendarAccount: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/caldav/client", () => ({
  fetchCalendars: vi.fn(),
}));

import { db } from "@/lib/db";
import { fetchCalendars } from "@/lib/caldav/client";
import { GET, POST } from "@/app/api/families/[familyId]/calendar-accounts/route";

describe("GET /api/families/[familyId]/calendar-accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all calendar accounts (without passwords)", async () => {
    vi.mocked(db.calendarAccount.findMany).mockResolvedValue([
      { id: "acc1", provider: "apple", username: "user@icloud.com", serverUrl: "https://caldav.icloud.com", syncEnabled: true, lastSyncAt: null },
    ] as never);

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts");
    const response = await GET(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
  });
});

describe("POST /api/families/[familyId]/calendar-accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates account after verifying connection", async () => {
    vi.mocked(fetchCalendars).mockResolvedValue([
      { url: "/cal/personal/", displayName: "Personal" } as never,
    ]);
    vi.mocked(db.calendarAccount.create).mockResolvedValue({
      id: "acc2", provider: "apple", username: "user@icloud.com", calendarId: "/cal/personal/",
    } as never);

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "apple", username: "user@icloud.com", password: "xxxx", memberId: "member1" }),
    });
    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    expect(response.status).toBe(201);
    expect(fetchCalendars).toHaveBeenCalledOnce();
  });

  it("returns 400 if connection fails", async () => {
    vi.mocked(fetchCalendars).mockRejectedValue(new Error("Auth failed"));

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "apple", username: "user@icloud.com", password: "wrong", memberId: "member1" }),
    });
    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    expect(response.status).toBe(400);
  });
});
