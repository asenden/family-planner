import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/families/[familyId]/calendar/route";

describe("GET /api/families/[familyId]/calendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns events for the requested time range", async () => {
    vi.mocked(db.calendarEvent.findMany).mockResolvedValue([
      { id: "ev1", title: "Zahnarzt", start: new Date("2026-04-15T14:00:00Z"), end: new Date("2026-04-15T15:00:00Z"), allDay: false, source: "local", assignedTo: [{ id: "m1", name: "Mama", color: "#FF6B6B" }] },
    ] as never);

    const url = new URL("http://localhost/api/families/fam1/calendar?start=2026-04-14&end=2026-04-21");
    const request = new Request(url);
    const response = await GET(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.events).toHaveLength(1);
    expect(data.events[0].title).toBe("Zahnarzt");
  });
});

describe("POST /api/families/[familyId]/calendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a local event", async () => {
    vi.mocked(db.calendarEvent.create).mockResolvedValue({
      id: "ev2", title: "Schwimmen", start: new Date(), end: new Date(), allDay: false, source: "local",
    } as never);

    const request = new Request("http://localhost/api/families/fam1/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Schwimmen", start: "2026-04-16T09:00:00Z", end: "2026-04-16T10:00:00Z", allDay: false, assignedTo: ["member1"] }),
    });

    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.event.title).toBe("Schwimmen");
  });

  it("returns 400 if title is missing", async () => {
    const request = new Request("http://localhost/api/families/fam1/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: "2026-04-16T09:00:00Z", end: "2026-04-16T10:00:00Z" }),
    });
    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    expect(response.status).toBe(400);
  });
});
