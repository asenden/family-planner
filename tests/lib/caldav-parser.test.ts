import { describe, it, expect } from "vitest";
import { icsToEvent, eventToIcs } from "@/lib/caldav/parser";

const SAMPLE_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:test-uid-123@example.com
DTSTART:20260415T140000Z
DTEND:20260415T150000Z
SUMMARY:Zahnarzt
DESCRIPTION:Kontrolluntersuchung
END:VEVENT
END:VCALENDAR`;

const ALLDAY_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday-456@example.com
DTSTART;VALUE=DATE:20260420
DTEND;VALUE=DATE:20260421
SUMMARY:Familienausflug
END:VEVENT
END:VCALENDAR`;

describe("icsToEvent", () => {
  it("parses a timed event", () => {
    const event = icsToEvent(SAMPLE_ICS);
    expect(event.title).toBe("Zahnarzt");
    expect(event.description).toBe("Kontrolluntersuchung");
    expect(event.externalId).toBe("test-uid-123@example.com");
    expect(event.allDay).toBe(false);
    expect(event.start).toBeInstanceOf(Date);
    expect(event.end).toBeInstanceOf(Date);
  });

  it("parses an all-day event", () => {
    const event = icsToEvent(ALLDAY_ICS);
    expect(event.title).toBe("Familienausflug");
    expect(event.allDay).toBe(true);
    expect(event.externalId).toBe("allday-456@example.com");
  });

  it("returns null description when not present", () => {
    const event = icsToEvent(ALLDAY_ICS);
    expect(event.description).toBeNull();
  });
});

describe("eventToIcs", () => {
  it("generates valid ICS from event data", () => {
    const ics = eventToIcs({
      title: "Schwimmen",
      description: "Mit den Kindern",
      start: new Date("2026-04-16T09:00:00Z"),
      end: new Date("2026-04-16T10:00:00Z"),
      allDay: false,
      uid: "swim-789@familydisplay",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Schwimmen");
    expect(ics).toContain("DESCRIPTION:Mit den Kindern");
    expect(ics).toContain("UID:swim-789@familydisplay");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("generates all-day ICS with DATE values", () => {
    const ics = eventToIcs({
      title: "Geburtstag",
      description: null,
      start: new Date("2026-05-01T00:00:00Z"),
      end: new Date("2026-05-02T00:00:00Z"),
      allDay: true,
      uid: "bday-101@familydisplay",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260501");
    expect(ics).toContain("DTEND;VALUE=DATE:20260502");
    expect(ics).not.toContain("DESCRIPTION");
  });
});
