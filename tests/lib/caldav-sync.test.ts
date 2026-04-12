import { describe, it, expect } from "vitest";
import { reconcileEvents, type LocalEvent, type RemoteEvent } from "@/lib/caldav/sync";

describe("reconcileEvents", () => {
  it("identifies new remote events to create locally", () => {
    const local: LocalEvent[] = [];
    const remote: RemoteEvent[] = [
      { externalId: "remote-1", title: "Meeting", start: new Date("2026-04-15T10:00:00Z"), end: new Date("2026-04-15T11:00:00Z"), allDay: false, description: null },
    ];
    const result = reconcileEvents(local, remote);
    expect(result.toCreateLocally).toHaveLength(1);
    expect(result.toCreateLocally[0].externalId).toBe("remote-1");
    expect(result.toDeleteLocally).toHaveLength(0);
  });

  it("identifies deleted remote events to remove locally", () => {
    const local: LocalEvent[] = [
      { id: "local-1", externalId: "remote-1", title: "Old Meeting", start: new Date(), end: new Date(), allDay: false, description: null, source: "google" },
    ];
    const remote: RemoteEvent[] = [];
    const result = reconcileEvents(local, remote);
    expect(result.toDeleteLocally).toHaveLength(1);
    expect(result.toDeleteLocally[0]).toBe("local-1");
    expect(result.toCreateLocally).toHaveLength(0);
  });

  it("identifies updated remote events", () => {
    const local: LocalEvent[] = [
      { id: "local-1", externalId: "remote-1", title: "Old Title", start: new Date("2026-04-15T10:00:00Z"), end: new Date("2026-04-15T11:00:00Z"), allDay: false, description: null, source: "google" },
    ];
    const remote: RemoteEvent[] = [
      { externalId: "remote-1", title: "New Title", start: new Date("2026-04-15T10:00:00Z"), end: new Date("2026-04-15T11:00:00Z"), allDay: false, description: null },
    ];
    const result = reconcileEvents(local, remote);
    expect(result.toUpdateLocally).toHaveLength(1);
    expect(result.toUpdateLocally[0].title).toBe("New Title");
  });

  it("skips local-only events (no externalId)", () => {
    const local: LocalEvent[] = [
      { id: "local-1", externalId: null, title: "Local Event", start: new Date(), end: new Date(), allDay: false, description: null, source: "local" },
    ];
    const remote: RemoteEvent[] = [];
    const result = reconcileEvents(local, remote);
    expect(result.toDeleteLocally).toHaveLength(0);
  });
});
