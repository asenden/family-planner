# Calendar + CalDAV Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully interactive calendar to FamilyDisplay with bidirectional CalDAV sync supporting Google Calendar, iCloud, and any CalDAV-compatible server.

**Architecture:** A CalDAV client wrapper using `tsdav` handles all calendar provider communication via the standard CalDAV protocol. A sync engine runs every 5 minutes as a Next.js cron route, pulling remote events and pushing local changes. The calendar UI includes a compact dashboard widget showing upcoming events and a full-screen day/week view for creating and managing events.

**Tech Stack:** tsdav (CalDAV client), ical.js (ICS parsing), Next.js API Routes, Prisma, Server-Sent Events (for realtime widget updates later)

---

## File Structure

```
src/
├── lib/
│   ├── caldav/
│   │   ├── client.ts            (CalDAV client wrapper — connect, fetch, create, update, delete)
│   │   ├── parser.ts            (ICS ↔ CalendarEvent conversion)
│   │   └── sync.ts              (Bidirectional sync engine)
│   └── db.ts                    (existing — unchanged)
├── app/
│   ├── api/
│   │   ├── families/[familyId]/
│   │   │   ├── calendar/
│   │   │   │   ├── route.ts         (GET list events, POST create event)
│   │   │   │   └── [eventId]/
│   │   │   │       └── route.ts     (GET, PUT, DELETE single event)
│   │   │   ├── calendar-accounts/
│   │   │   │   ├── route.ts         (GET list, POST add account)
│   │   │   │   └── [accountId]/
│   │   │   │       └── route.ts     (DELETE remove account)
│   │   │   └── calendar-sync/
│   │   │       └── route.ts         (POST trigger sync for a family)
│   │   └── cron/
│   │       └── sync-calendars/
│   │           └── route.ts         (GET — cron endpoint, syncs all families)
│   └── [locale]/
│       └── dashboard/
│           ├── _components/
│           │   ├── WidgetGrid.tsx        (modify — wire calendar widget to data)
│           │   ├── CalendarWidget.tsx     (new — compact event list)
│           │   └── CalendarFullView.tsx   (new — full-screen day/week calendar)
│           └── page.tsx                  (modify — fetch calendar data)
├── app/[locale]/settings/
│   └── calendar/
│       └── page.tsx                      (new — CalDAV account management)
messages/
├── en.json                               (modify — add calendar messages)
└── de.json                               (modify — add calendar messages)
prisma/
└── schema.prisma                         (modify — add CalendarAccount model)
tests/
├── lib/
│   ├── caldav-parser.test.ts
│   └── caldav-sync.test.ts
└── api/
    ├── calendar.test.ts
    └── calendar-accounts.test.ts
```

---

### Task 1: Prisma Schema — Add CalendarAccount Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add CalendarAccount model and update relations**

Add to `prisma/schema.prisma` after the `CalendarSource` enum:

```prisma
model CalendarAccount {
  id         String         @id @default(cuid())
  provider   CalendarSource
  serverUrl  String
  username   String
  password   String         // App-specific password (iCloud) or encrypted refresh token (Google)
  calendarId String?        // Remote calendar ID/URL after discovery

  syncEnabled Boolean  @default(true)
  lastSyncAt  DateTime?

  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([memberId, serverUrl, username])
}
```

Add to `Family` model's relations:

```prisma
calendarAccounts CalendarAccount[]
```

Add to `FamilyMember` model's relations:

```prisma
calendarAccounts CalendarAccount[]
```

- [ ] **Step 2: Generate Prisma client**

Run:
```bash
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma src/generated
git commit -m "feat: add CalendarAccount model for CalDAV sync"
```

Note: Migration will be applied on the VPS separately using the builder image pattern established in Plan 1.

---

### Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install CalDAV and ICS libraries**

Run:
```bash
npm install tsdav ical.js
npm install -D @types/ical.js
```

`tsdav` is a TypeScript CalDAV/CardDAV client that supports Google, Apple, and generic CalDAV servers. `ical.js` parses and generates ICS (iCalendar) data.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add tsdav and ical.js for CalDAV sync"
```

---

### Task 3: ICS Parser (TDD)

**Files:**
- Create: `src/lib/caldav/parser.ts`
- Test: `tests/lib/caldav-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/caldav-parser.test.ts`:

```typescript
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
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Schwimmen");
    expect(ics).toContain("DESCRIPTION:Mit den Kindern");
    expect(ics).toContain("UID:swim-789@familydisplay");
    expect(ics).toContain("END:VEVENT");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/lib/caldav-parser.test.ts
```

Expected: FAIL — cannot find module `@/lib/caldav/parser`.

- [ ] **Step 3: Implement the parser**

Create `src/lib/caldav/parser.ts`:

```typescript
import ICAL from "ical.js";

export interface ParsedEvent {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  externalId: string;
}

export interface EventToIcsInput {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  uid: string;
}

export function icsToEvent(icsData: string): ParsedEvent {
  const jcal = ICAL.parse(icsData);
  const comp = new ICAL.Component(jcal);
  const vevent = comp.getFirstSubcomponent("vevent")!;
  const event = new ICAL.Event(vevent);

  const dtstart = vevent.getFirstProperty("dtstart")!;
  const isAllDay = dtstart.getParameter("value") === "DATE" ||
    (!dtstart.toJSON()[3].toString().includes("T"));

  return {
    title: event.summary || "",
    description: event.description || null,
    start: event.startDate.toJSDate(),
    end: event.endDate.toJSDate(),
    allDay: isAllDay,
    externalId: event.uid,
  };
}

export function eventToIcs(input: EventToIcsInput): string {
  const comp = new ICAL.Component(["vcalendar", [], []]);
  comp.addPropertyWithValue("prodid", "-//FamilyDisplay//EN");
  comp.addPropertyWithValue("version", "2.0");

  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", input.uid);
  vevent.addPropertyWithValue("summary", input.title);

  if (input.description) {
    vevent.addPropertyWithValue("description", input.description);
  }

  if (input.allDay) {
    const dtstart = ICAL.Time.fromJSDate(input.start, true);
    dtstart.isDate = true;
    vevent.addPropertyWithValue("dtstart", dtstart);

    const dtend = ICAL.Time.fromJSDate(input.end, true);
    dtend.isDate = true;
    vevent.addPropertyWithValue("dtend", dtend);
  } else {
    vevent.addPropertyWithValue("dtstart", ICAL.Time.fromJSDate(input.start, false));
    vevent.addPropertyWithValue("dtend", ICAL.Time.fromJSDate(input.end, false));
  }

  vevent.addPropertyWithValue("dtstamp", ICAL.Time.now());
  comp.addSubcomponent(vevent);

  return comp.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/lib/caldav-parser.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/caldav/parser.ts tests/lib/caldav-parser.test.ts
git commit -m "feat: add ICS parser for CalDAV event conversion"
```

---

### Task 4: CalDAV Client Wrapper

**Files:**
- Create: `src/lib/caldav/client.ts`

- [ ] **Step 1: Implement CalDAV client wrapper**

Create `src/lib/caldav/client.ts`:

```typescript
import { createDAVClient, type DAVCalendar, type DAVObject } from "tsdav";
import type { CalendarSource } from "../../generated/prisma/enums";
import { icsToEvent, eventToIcs, type ParsedEvent, type EventToIcsInput } from "./parser";

interface CalDAVConnectOptions {
  provider: CalendarSource;
  serverUrl: string;
  username: string;
  password: string;
}

const PROVIDER_URLS: Partial<Record<CalendarSource, string>> = {
  apple: "https://caldav.icloud.com",
  google: "https://apidata.googleusercontent.com/caldav/v2/",
};

export async function connectCalDAV(options: CalDAVConnectOptions) {
  const serverUrl = PROVIDER_URLS[options.provider] || options.serverUrl;

  const client = await createDAVClient({
    serverUrl,
    credentials: {
      username: options.username,
      password: options.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  return client;
}

export async function fetchCalendars(options: CalDAVConnectOptions): Promise<DAVCalendar[]> {
  const client = await connectCalDAV(options);
  return client.fetchCalendars();
}

export async function fetchEvents(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  timeRange: { start: Date; end: Date }
): Promise<ParsedEvent[]> {
  const client = await connectCalDAV(options);

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c) => c.url === calendarUrl) || calendars[0];

  if (!calendar) return [];

  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
  });

  return objects
    .filter((obj): obj is DAVObject & { data: string } => typeof obj.data === "string")
    .map((obj) => {
      try {
        return icsToEvent(obj.data);
      } catch {
        return null;
      }
    })
    .filter((e): e is ParsedEvent => e !== null);
}

export async function createRemoteEvent(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  event: EventToIcsInput
): Promise<void> {
  const client = await connectCalDAV(options);

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c) => c.url === calendarUrl) || calendars[0];

  if (!calendar) throw new Error("Calendar not found");

  const icsData = eventToIcs(event);

  await client.createCalendarObject({
    calendar,
    filename: `${event.uid}.ics`,
    iCalString: icsData,
  });
}

export async function deleteRemoteEvent(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  eventUid: string
): Promise<void> {
  const client = await connectCalDAV(options);

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c) => c.url === calendarUrl) || calendars[0];

  if (!calendar) return;

  const objects = await client.fetchCalendarObjects({ calendar });
  const target = objects.find((obj) =>
    typeof obj.data === "string" && obj.data.includes(`UID:${eventUid}`)
  );

  if (target?.url) {
    await client.deleteCalendarObject({ calendarObject: target });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/caldav/client.ts
git commit -m "feat: add CalDAV client wrapper for connect, fetch, create, delete"
```

---

### Task 5: Sync Engine (TDD)

**Files:**
- Create: `src/lib/caldav/sync.ts`
- Test: `tests/lib/caldav-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/caldav-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    expect(result.toUpdateLocally[0].externalId).toBe("remote-1");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/lib/caldav-sync.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the sync reconciliation logic**

Create `src/lib/caldav/sync.ts`:

```typescript
import { db } from "@/lib/db";
import { fetchEvents, type CalDAVConnectOptions } from "./client";
import type { ParsedEvent } from "./parser";

export interface LocalEvent {
  id: string;
  externalId: string | null;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  source: string;
}

export type RemoteEvent = ParsedEvent;

interface ReconcileResult {
  toCreateLocally: RemoteEvent[];
  toUpdateLocally: (RemoteEvent & { localId: string })[];
  toDeleteLocally: string[]; // local IDs to delete
}

export function reconcileEvents(
  localEvents: LocalEvent[],
  remoteEvents: RemoteEvent[]
): ReconcileResult {
  const remoteByUid = new Map(remoteEvents.map((e) => [e.externalId, e]));
  const localSynced = localEvents.filter((e) => e.externalId !== null);
  const localByUid = new Map(localSynced.map((e) => [e.externalId!, e]));

  const toCreateLocally: RemoteEvent[] = [];
  const toUpdateLocally: (RemoteEvent & { localId: string })[] = [];
  const toDeleteLocally: string[] = [];

  // New or updated remote events
  for (const [uid, remote] of remoteByUid) {
    const local = localByUid.get(uid);
    if (!local) {
      toCreateLocally.push(remote);
    } else if (hasChanged(local, remote)) {
      toUpdateLocally.push({ ...remote, localId: local.id });
    }
  }

  // Deleted remote events (synced local events whose UID no longer exists remotely)
  for (const local of localSynced) {
    if (!remoteByUid.has(local.externalId!)) {
      toDeleteLocally.push(local.id);
    }
  }

  return { toCreateLocally, toUpdateLocally, toDeleteLocally };
}

function hasChanged(local: LocalEvent, remote: RemoteEvent): boolean {
  return (
    local.title !== remote.title ||
    local.description !== remote.description ||
    local.start.getTime() !== remote.start.getTime() ||
    local.end.getTime() !== remote.end.getTime() ||
    local.allDay !== remote.allDay
  );
}

export async function syncCalendarAccount(
  accountId: string
): Promise<{ created: number; updated: number; deleted: number }> {
  const account = await db.calendarAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.syncEnabled) {
    return { created: 0, updated: 0, deleted: 0 };
  }

  const connectOptions: CalDAVConnectOptions = {
    provider: account.provider,
    serverUrl: account.serverUrl,
    username: account.username,
    password: account.password,
  };

  // Fetch remote events for the next 90 days
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const remoteEvents = await fetchEvents(
    connectOptions,
    account.calendarId || "",
    { start: now, end }
  );

  // Fetch local synced events for this account's source
  const localEvents = await db.calendarEvent.findMany({
    where: {
      familyId: account.familyId,
      source: account.provider,
      externalId: { not: null },
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      description: true,
      start: true,
      end: true,
      allDay: true,
      source: true,
    },
  });

  const { toCreateLocally, toUpdateLocally, toDeleteLocally } = reconcileEvents(
    localEvents.map((e) => ({ ...e, source: e.source as string })),
    remoteEvents
  );

  // Apply changes
  for (const event of toCreateLocally) {
    await db.calendarEvent.create({
      data: {
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        externalId: event.externalId,
        source: account.provider,
        familyId: account.familyId,
        lastSyncedAt: new Date(),
      },
    });
  }

  for (const event of toUpdateLocally) {
    await db.calendarEvent.update({
      where: { id: event.localId },
      data: {
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        lastSyncedAt: new Date(),
      },
    });
  }

  if (toDeleteLocally.length > 0) {
    await db.calendarEvent.deleteMany({
      where: { id: { in: toDeleteLocally } },
    });
  }

  // Update last sync timestamp
  await db.calendarAccount.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date() },
  });

  return {
    created: toCreateLocally.length,
    updated: toUpdateLocally.length,
    deleted: toDeleteLocally.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/lib/caldav-sync.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/caldav/sync.ts tests/lib/caldav-sync.test.ts
git commit -m "feat: add calendar sync engine with event reconciliation"
```

---

### Task 6: API Routes — Calendar Events (TDD)

**Files:**
- Create: `src/app/api/families/[familyId]/calendar/route.ts`, `src/app/api/families/[familyId]/calendar/[eventId]/route.ts`
- Test: `tests/api/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/calendar.test.ts`:

```typescript
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
    const mockEvents = [
      { id: "ev1", title: "Zahnarzt", start: new Date("2026-04-15T14:00:00Z"), end: new Date("2026-04-15T15:00:00Z"), allDay: false, source: "local", assignedTo: [{ id: "m1", name: "Mama", color: "#FF6B6B" }] },
    ];
    vi.mocked(db.calendarEvent.findMany).mockResolvedValue(mockEvents as never);

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
      body: JSON.stringify({
        title: "Schwimmen",
        start: "2026-04-16T09:00:00Z",
        end: "2026-04-16T10:00:00Z",
        allDay: false,
        assignedTo: ["member1"],
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.event.title).toBe("Schwimmen");
    expect(db.calendarEvent.create).toHaveBeenCalledOnce();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/api/calendar.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement GET and POST /api/families/[familyId]/calendar**

Create `src/app/api/families/[familyId]/calendar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const where: Record<string, unknown> = { familyId };

  if (start && end) {
    where.start = { gte: new Date(start) };
    where.end = { lte: new Date(end) };
  }

  const events = await db.calendarEvent.findMany({
    where,
    include: {
      assignedTo: {
        select: { id: true, name: true, color: true, avatar: true },
      },
    },
    orderBy: { start: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const body = await request.json();
  const { title, description, start, end, allDay, assignedTo } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const event = await db.calendarEvent.create({
      data: {
        title,
        description: description || null,
        start: new Date(start),
        end: new Date(end),
        allDay: allDay || false,
        source: "local",
        familyId,
        assignedTo: assignedTo?.length
          ? { connect: assignedTo.map((id: string) => ({ id })) }
          : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement single event routes (GET, PUT, DELETE)**

Create `src/app/api/families/[familyId]/calendar/[eventId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ familyId: string; eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { eventId } = await params;

  const event = await db.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignedTo: { select: { id: true, name: true, color: true, avatar: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PUT(request: Request, { params }: Params) {
  const { eventId } = await params;
  const body = await request.json();
  const { title, description, start, end, allDay, assignedTo } = body;

  try {
    const event = await db.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(start !== undefined && { start: new Date(start) }),
        ...(end !== undefined && { end: new Date(end) }),
        ...(allDay !== undefined && { allDay }),
        ...(assignedTo !== undefined && {
          assignedTo: { set: assignedTo.map((id: string) => ({ id })) },
        }),
      },
      include: {
        assignedTo: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { eventId } = await params;

  try {
    await db.calendarEvent.delete({ where: { id: eventId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests**

Run:
```bash
npx vitest run tests/api/calendar.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/families/\[familyId\]/calendar tests/api/calendar.test.ts
git commit -m "feat: add calendar event API routes (CRUD)"
```

---

### Task 7: API Routes — CalDAV Accounts (TDD)

**Files:**
- Create: `src/app/api/families/[familyId]/calendar-accounts/route.ts`, `src/app/api/families/[familyId]/calendar-accounts/[accountId]/route.ts`
- Test: `tests/api/calendar-accounts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/calendar-accounts.test.ts`:

```typescript
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

  it("returns all calendar accounts for a family", async () => {
    vi.mocked(db.calendarAccount.findMany).mockResolvedValue([
      { id: "acc1", provider: "apple", username: "user@icloud.com", serverUrl: "https://caldav.icloud.com", syncEnabled: true, lastSyncAt: null },
    ] as never);

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts");
    const response = await GET(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].provider).toBe("apple");
    // Password should not be returned
    expect(data.accounts[0].password).toBeUndefined();
  });
});

describe("POST /api/families/[familyId]/calendar-accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an account after verifying CalDAV connection", async () => {
    vi.mocked(fetchCalendars).mockResolvedValue([
      { url: "/cal/personal/", displayName: "Personal", ctag: "", syncToken: "", resourcetype: "" } as never,
    ]);

    vi.mocked(db.calendarAccount.create).mockResolvedValue({
      id: "acc2", provider: "apple", username: "user@icloud.com", calendarId: "/cal/personal/",
    } as never);

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        username: "user@icloud.com",
        password: "xxxx-xxxx-xxxx-xxxx",
        memberId: "member1",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.account.provider).toBe("apple");
    expect(fetchCalendars).toHaveBeenCalledOnce();
  });

  it("returns 400 if CalDAV connection fails", async () => {
    vi.mocked(fetchCalendars).mockRejectedValue(new Error("Authentication failed"));

    const request = new Request("http://localhost/api/families/fam1/calendar-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        username: "user@icloud.com",
        password: "wrong-password",
        memberId: "member1",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ familyId: "fam1" }) });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/api/calendar-accounts.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement account routes**

Create `src/app/api/families/[familyId]/calendar-accounts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchCalendars } from "@/lib/caldav/client";
import type { CalendarSource } from "@/generated/prisma/enums";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  const accounts = await db.calendarAccount.findMany({
    where: { familyId },
    select: {
      id: true,
      provider: true,
      serverUrl: true,
      username: true,
      calendarId: true,
      syncEnabled: true,
      lastSyncAt: true,
      memberId: true,
      member: { select: { name: true, color: true } },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const body = await request.json();
  const { provider, serverUrl, username, password, memberId } = body;

  if (!provider || !username || !password || !memberId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify connection by fetching calendars
  try {
    const calendars = await fetchCalendars({
      provider: provider as CalendarSource,
      serverUrl: serverUrl || "",
      username,
      password,
    });

    const primaryCalendar = calendars[0];

    const account = await db.calendarAccount.create({
      data: {
        provider: provider as CalendarSource,
        serverUrl: serverUrl || "",
        username,
        password,
        calendarId: primaryCalendar?.url || null,
        memberId,
        familyId,
      },
      select: {
        id: true,
        provider: true,
        serverUrl: true,
        username: true,
        calendarId: true,
        syncEnabled: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("CalDAV connection failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to calendar. Check your credentials." },
      { status: 400 }
    );
  }
}
```

Create `src/app/api/families/[familyId]/calendar-accounts/[accountId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; accountId: string }> }
) {
  const { accountId } = await params;

  try {
    await db.calendarAccount.delete({ where: { id: accountId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npx vitest run tests/api/calendar-accounts.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/families/\[familyId\]/calendar-accounts tests/api/calendar-accounts.test.ts
git commit -m "feat: add CalDAV account management API routes"
```

---

### Task 8: Sync Cron Route

**Files:**
- Create: `src/app/api/cron/sync-calendars/route.ts`

- [ ] **Step 1: Implement cron endpoint**

Create `src/app/api/cron/sync-calendars/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCalendarAccount } from "@/lib/caldav/sync";

export async function GET(request: Request) {
  // Simple auth: check for a secret header to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db.calendarAccount.findMany({
    where: { syncEnabled: true },
    select: { id: true, provider: true, username: true, familyId: true },
  });

  const results = [];

  for (const account of accounts) {
    try {
      const result = await syncCalendarAccount(account.id);
      results.push({ accountId: account.id, ...result, status: "ok" });
    } catch (error) {
      console.error(`Sync failed for account ${account.id}:`, error);
      results.push({ accountId: account.id, status: "error", error: String(error) });
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Add CRON_SECRET to .env.example**

Add to `.env.example`:
```env
# Cron (optional, for securing sync endpoint)
CRON_SECRET=""
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron .env.example
git commit -m "feat: add calendar sync cron endpoint"
```

---

### Task 9: i18n — Calendar Messages

**Files:**
- Modify: `messages/en.json`, `messages/de.json`

- [ ] **Step 1: Add calendar messages to English**

Add to `messages/en.json` at the top level:

```json
"calendar": {
  "title": "Calendar",
  "today": "Today",
  "tomorrow": "Tomorrow",
  "thisWeek": "This Week",
  "noEvents": "No upcoming events",
  "allDay": "All day",
  "addEvent": "Add Event",
  "editEvent": "Edit Event",
  "deleteEvent": "Delete Event",
  "eventTitle": "Title",
  "eventDescription": "Description",
  "eventStart": "Start",
  "eventEnd": "End",
  "eventAllDay": "All day",
  "eventAssignTo": "Assign to",
  "save": "Save",
  "cancel": "Cancel",
  "confirmDelete": "Delete this event?",
  "dayView": "Day",
  "weekView": "Week"
},
"calendarSettings": {
  "title": "Calendar Accounts",
  "addAccount": "Add Calendar",
  "provider": "Provider",
  "providerApple": "iCloud",
  "providerGoogle": "Google",
  "providerOther": "Other (CalDAV)",
  "username": "Email / Username",
  "password": "App-Specific Password",
  "passwordHint": "For iCloud: Settings → Apple ID → App-Specific Passwords",
  "serverUrl": "CalDAV Server URL",
  "connect": "Connect",
  "connected": "Connected",
  "lastSync": "Last sync: {time}",
  "neverSynced": "Never synced",
  "remove": "Remove",
  "syncNow": "Sync Now",
  "connectionFailed": "Connection failed. Check your credentials."
}
```

- [ ] **Step 2: Add calendar messages to German**

Add to `messages/de.json` at the top level:

```json
"calendar": {
  "title": "Kalender",
  "today": "Heute",
  "tomorrow": "Morgen",
  "thisWeek": "Diese Woche",
  "noEvents": "Keine anstehenden Termine",
  "allDay": "Ganztägig",
  "addEvent": "Termin hinzufügen",
  "editEvent": "Termin bearbeiten",
  "deleteEvent": "Termin löschen",
  "eventTitle": "Titel",
  "eventDescription": "Beschreibung",
  "eventStart": "Beginn",
  "eventEnd": "Ende",
  "eventAllDay": "Ganztägig",
  "eventAssignTo": "Zuweisen an",
  "save": "Speichern",
  "cancel": "Abbrechen",
  "confirmDelete": "Diesen Termin löschen?",
  "dayView": "Tag",
  "weekView": "Woche"
},
"calendarSettings": {
  "title": "Kalender-Konten",
  "addAccount": "Kalender hinzufügen",
  "provider": "Anbieter",
  "providerApple": "iCloud",
  "providerGoogle": "Google",
  "providerOther": "Andere (CalDAV)",
  "username": "E-Mail / Benutzername",
  "password": "App-spezifisches Passwort",
  "passwordHint": "Für iCloud: Einstellungen → Apple-ID → App-spezifische Passwörter",
  "serverUrl": "CalDAV-Server-URL",
  "connect": "Verbinden",
  "connected": "Verbunden",
  "lastSync": "Letzte Synchronisierung: {time}",
  "neverSynced": "Noch nie synchronisiert",
  "remove": "Entfernen",
  "syncNow": "Jetzt synchronisieren",
  "connectionFailed": "Verbindung fehlgeschlagen. Überprüfe deine Zugangsdaten."
}
```

- [ ] **Step 3: Commit**

```bash
git add messages
git commit -m "feat: add calendar i18n messages (English + German)"
```

---

### Task 10: Calendar Widget (Dashboard Compact View)

**Files:**
- Create: `src/app/[locale]/dashboard/_components/CalendarWidget.tsx`
- Modify: `src/app/[locale]/dashboard/_components/WidgetGrid.tsx`
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Create CalendarWidget**

Create `src/app/[locale]/dashboard/_components/CalendarWidget.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  assignedTo: { name: string; color: string }[];
}

interface CalendarWidgetProps {
  events: CalendarEvent[];
  onTap: () => void;
}

export function CalendarWidget({ events, onTap }: CalendarWidgetProps) {
  const t = useTranslations("calendar");
  const upcoming = events.slice(0, 4);

  return (
    <button
      onClick={onTap}
      className="w-full text-left p-4 transition-transform active:scale-[0.98] cursor-pointer"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📅</span>
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "#FF6B6B" }}
        >
          {t("title")}
        </span>
      </div>
      <div className="text-sm space-y-2">
        {upcoming.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
        ) : (
          upcoming.map((event) => (
            <div key={event.id} className="flex items-start gap-2">
              <div className="flex gap-0.5 mt-0.5">
                {event.assignedTo.map((member) => (
                  <div
                    key={member.name}
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: member.color }}
                    title={member.name}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--color-text)" }}>
                  {event.title}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {event.allDay
                    ? t("allDay")
                    : formatTime(event.start)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </button>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
```

- [ ] **Step 2: Update WidgetGrid to use CalendarWidget**

Modify `src/app/[locale]/dashboard/_components/WidgetGrid.tsx` — replace the entire file:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { WidgetCard } from "./WidgetCard";
import { CalendarWidget } from "./CalendarWidget";
import { CalendarFullView } from "./CalendarFullView";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  assignedTo: { name: string; color: string }[];
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface WidgetGridProps {
  calendarEvents?: CalendarEvent[];
  familyMembers?: FamilyMember[];
  familyId?: string;
}

export function WidgetGrid({ calendarEvents = [], familyMembers = [], familyId }: WidgetGridProps) {
  const t = useTranslations("dashboard");
  const [fullView, setFullView] = useState<string | null>(null);

  if (fullView === "calendar" && familyId) {
    return (
      <CalendarFullView
        familyId={familyId}
        events={calendarEvents}
        members={familyMembers}
        onBack={() => setFullView(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <CalendarWidget
        events={calendarEvents}
        onTap={() => setFullView("calendar")}
      />

      <WidgetCard title={t("widgets.routines")} icon="✅" color="#FF922B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.pinboard")} icon="📌" color="#6BCB77">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.meal")} icon="🍽" color="#4D96FF">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.feelings")} icon="💭" color="#E599F7">
        <div className="flex gap-3 text-2xl">
          <span>😊</span><span>😐</span><span>😢</span><span>😠</span><span>🤩</span>
        </div>
      </WidgetCard>

      <WidgetCard title={t("widgets.photos")} icon="🖼" color="#FFD93D">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/dashboard/_components/CalendarWidget.tsx src/app/\[locale\]/dashboard/_components/WidgetGrid.tsx
git commit -m "feat: add CalendarWidget and wire into dashboard grid"
```

---

### Task 11: Full-Screen Calendar View

**Files:**
- Create: `src/app/[locale]/dashboard/_components/CalendarFullView.tsx`

- [ ] **Step 1: Implement the full-screen calendar**

Create `src/app/[locale]/dashboard/_components/CalendarFullView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  allDay: boolean;
  assignedTo: { id: string; name: string; color: string }[];
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface CalendarFullViewProps {
  familyId: string;
  events: CalendarEvent[];
  members: FamilyMember[];
  onBack: () => void;
}

type ViewMode = "day" | "week";

export function CalendarFullView({
  familyId,
  events,
  members,
  onBack,
}: CalendarFullViewProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  const weekDays = getWeekDays(currentDate, locale);
  const dayEvents = viewMode === "day"
    ? getEventsForDay(events, currentDate)
    : null;

  function navigateDate(direction: number) {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        <button
          onClick={onBack}
          className="text-sm font-semibold cursor-pointer px-3 py-1"
          style={{
            color: "var(--color-primary)",
            backgroundColor: "var(--color-background)",
            borderRadius: "var(--border-radius)",
          }}
        >
          ← {t("cancel")}
        </button>

        <div className="flex items-center gap-3">
          <button onClick={() => navigateDate(-1)} className="text-lg cursor-pointer px-2">
            ‹
          </button>
          <span className="font-bold text-lg">
            {currentDate.toLocaleDateString(locale, {
              month: "long",
              year: "numeric",
              ...(viewMode === "day" && { day: "numeric", weekday: "long" }),
            })}
          </span>
          <button onClick={() => navigateDate(1)} className="text-lg cursor-pointer px-2">
            ›
          </button>
        </div>

        <div className="flex gap-1">
          {(["day", "week"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="text-sm px-3 py-1 cursor-pointer font-semibold"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor:
                  viewMode === mode ? "var(--color-primary)" : "var(--color-background)",
                color: viewMode === mode ? "#fff" : "var(--color-text)",
              }}
            >
              {t(`${mode}View`)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Body */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        {viewMode === "week" ? (
          <WeekView
            weekDays={weekDays}
            events={events}
            locale={locale}
            onDayClick={(date) => {
              setCurrentDate(date);
              setViewMode("day");
            }}
          />
        ) : (
          <DayView events={dayEvents || []} locale={locale} />
        )}
      </div>

      {/* Add Event Button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="w-full py-3 text-white font-bold cursor-pointer"
        style={{
          backgroundColor: "var(--color-primary)",
          borderRadius: "var(--border-radius)",
        }}
      >
        + {t("addEvent")}
      </button>

      {/* Add Event Modal */}
      {showAddForm && (
        <AddEventForm
          familyId={familyId}
          members={members}
          date={currentDate}
          onClose={() => setShowAddForm(false)}
          onSaved={() => {
            setShowAddForm(false);
            // Trigger a refresh — parent should re-fetch
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function WeekView({
  weekDays,
  events,
  locale,
  onDayClick,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  locale: string;
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const dayStr = day.toISOString().split("T")[0];
        const dayEvents = events.filter((e) => {
          const eventDay = new Date(e.start).toISOString().split("T")[0];
          return eventDay === dayStr;
        });

        const isToday = day.getTime() === today.getTime();

        return (
          <button
            key={dayStr}
            onClick={() => onDayClick(day)}
            className="text-left p-3 min-h-[120px] cursor-pointer transition-colors"
            style={{
              borderRadius: "calc(var(--border-radius) / 2)",
              backgroundColor: isToday
                ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                : "var(--color-background)",
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
              {day.toLocaleDateString(locale, { weekday: "short" })}
            </div>
            <div
              className="text-lg font-bold mb-2"
              style={{ color: isToday ? "var(--color-primary)" : "var(--color-text)" }}
            >
              {day.getDate()}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="text-xs px-1.5 py-0.5 rounded truncate"
                  style={{
                    backgroundColor:
                      event.assignedTo[0]?.color
                        ? `color-mix(in srgb, ${event.assignedTo[0].color} 20%, transparent)`
                        : "var(--color-accent)",
                    color: "var(--color-text)",
                  }}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  +{dayEvents.length - 3}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayView({ events, locale }: { events: CalendarEvent[]; locale: string }) {
  const t = useTranslations("calendar");

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex gap-3 p-3"
          style={{
            backgroundColor: "var(--color-background)",
            borderRadius: "calc(var(--border-radius) / 2)",
          }}
        >
          <div
            className="w-1 rounded-full shrink-0"
            style={{
              backgroundColor: event.assignedTo[0]?.color || "var(--color-primary)",
            }}
          />
          <div className="flex-1">
            <p className="font-semibold">{event.title}</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {event.allDay
                ? t("allDay")
                : `${formatTime(event.start, locale)} – ${formatTime(event.end, locale)}`}
            </p>
            {event.description && (
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                {event.description}
              </p>
            )}
            <div className="flex gap-1 mt-2">
              {event.assignedTo.map((m) => (
                <span
                  key={m.id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${m.color} 20%, transparent)`,
                    color: m.color,
                  }}
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddEventForm({
  familyId,
  members,
  date,
  onClose,
  onSaved,
}: {
  familyId: string;
  members: { id: string; name: string; color: string }[];
  date: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("calendar");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!title) return;
    setLoading(true);

    const dateStr = date.toISOString().split("T")[0];
    const start = allDay ? `${dateStr}T00:00:00Z` : `${dateStr}T${startTime}:00Z`;
    const end = allDay
      ? new Date(date.getTime() + 86400000).toISOString()
      : `${dateStr}T${endTime}:00Z`;

    await fetch(`/api/families/${familyId}/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        start,
        end,
        allDay,
        assignedTo: selectedMembers,
      }),
    });

    setLoading(false);
    onSaved();
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md p-6 mx-4"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">{t("addEvent")}</h2>

        <label className="block mb-1 text-sm font-semibold">{t("eventTitle")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 p-2 border border-gray-200 outline-none"
          style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
        />

        <label className="block mb-1 text-sm font-semibold">{t("eventDescription")}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mb-3 p-2 border border-gray-200 outline-none"
          style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
        />

        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span className="text-sm font-semibold">{t("eventAllDay")}</span>
        </label>

        {!allDay && (
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block mb-1 text-sm font-semibold">{t("eventStart")}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 border border-gray-200 outline-none"
                style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 text-sm font-semibold">{t("eventEnd")}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 border border-gray-200 outline-none"
                style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
              />
            </div>
          </div>
        )}

        <label className="block mb-1 text-sm font-semibold">{t("eventAssignTo")}</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => toggleMember(member.id)}
              className="text-sm px-3 py-1 cursor-pointer transition-all"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: selectedMembers.includes(member.id)
                  ? member.color
                  : "var(--color-background)",
                color: selectedMembers.includes(member.id) ? "#fff" : "var(--color-text)",
              }}
            >
              {member.name}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-background)",
            }}
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!title || loading}
            className="flex-1 py-2 text-white font-semibold disabled:opacity-50 cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-primary)",
            }}
          >
            {loading ? "..." : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function getWeekDays(date: Date, _locale: string): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Start on Monday
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dayStr = date.toISOString().split("T")[0];
  return events.filter((e) => new Date(e.start).toISOString().split("T")[0] === dayStr);
}

function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\[locale\]/dashboard/_components/CalendarFullView.tsx
git commit -m "feat: add full-screen calendar view with week/day modes and add-event form"
```

---

### Task 12: Wire Dashboard to Calendar Data

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Update dashboard page to fetch calendar data**

Replace `src/app/[locale]/dashboard/page.tsx`:

```tsx
import { db } from "@/lib/db";
import { TopBar } from "./_components/TopBar";
import { WidgetGrid } from "./_components/WidgetGrid";
import { IdleScreensaver } from "./_components/IdleScreensaver";
import { cookies } from "next/headers";

async function getFamilyData() {
  // For now, get the first family. Later: use session/cookie to determine family.
  const family = await db.family.findFirst({
    include: {
      members: {
        select: { id: true, name: true, color: true, avatar: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!family) return null;

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const events = await db.calendarEvent.findMany({
    where: {
      familyId: family.id,
      start: { gte: now },
      end: { lte: endOfWeek },
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { start: "asc" },
  });

  return {
    familyId: family.id,
    members: family.members,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      allDay: e.allDay,
      assignedTo: e.assignedTo,
    })),
  };
}

export default async function DashboardPage() {
  let familyData = null;
  try {
    familyData = await getFamilyData();
  } catch {
    // DB not available — show empty dashboard
  }

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <TopBar />
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <WidgetGrid
            calendarEvents={familyData?.events || []}
            familyMembers={familyData?.members || []}
            familyId={familyData?.familyId}
          />
        </div>
      </div>
      <IdleScreensaver />
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run:
```bash
npx vitest run
```

Expected: All tests PASS. (Note: WidgetGrid tests may need updating since props changed — see step 3.)

- [ ] **Step 3: Update WidgetGrid test to pass new props**

Update `tests/components/WidgetGrid.test.tsx` — replace the render calls:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetGrid } from "@/app/[locale]/dashboard/_components/WidgetGrid";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "widgets.calendar": "Kalender", "widgets.routines": "Routinen", "widgets.pinboard": "Pinnwand",
      "widgets.meal": "Mahlzeit", "widgets.feelings": "Gefühle", "widgets.photos": "Fotos",
      noEvents: "Keine Termine", noMessages: "Keine Nachrichten", tapToOpen: "Tippen zum Öffnen",
      title: "Kalender",
    };
    return map[key] || key;
  },
  useLocale: () => "de",
}));

describe("WidgetGrid", () => {
  it("renders all 6 widgets", () => {
    render(<WidgetGrid calendarEvents={[]} familyMembers={[]} />);
    expect(screen.getByText("Kalender")).toBeInTheDocument();
    expect(screen.getByText("Routinen")).toBeInTheDocument();
    expect(screen.getByText("Pinnwand")).toBeInTheDocument();
    expect(screen.getByText("Mahlzeit")).toBeInTheDocument();
    expect(screen.getByText("Gefühle")).toBeInTheDocument();
    expect(screen.getByText("Fotos")).toBeInTheDocument();
  });

  it("uses a 3-column grid layout", () => {
    const { container } = render(<WidgetGrid calendarEvents={[]} familyMembers={[]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-3");
  });
});
```

- [ ] **Step 4: Run all tests again**

Run:
```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 5: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/\[locale\]/dashboard/page.tsx tests/components/WidgetGrid.test.tsx
git commit -m "feat: wire dashboard to calendar data from database"
```

---

### Task 13: Calendar Settings Page

**Files:**
- Create: `src/app/[locale]/settings/calendar/page.tsx`

- [ ] **Step 1: Create the CalDAV account management page**

Create `src/app/[locale]/settings/calendar/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface CalendarAccount {
  id: string;
  provider: string;
  username: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  member: { name: string; color: string };
}

export default function CalendarSettingsPage() {
  const t = useTranslations("calendarSettings");
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch familyId from first family (simplified — later use session)
    fetch("/api/families")
      .then((r) => r.json())
      .then((data) => {
        if (data.familyId) {
          setFamilyId(data.familyId);
          return fetch(`/api/families/${data.familyId}/calendar-accounts`);
        }
        return null;
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});
  }, []);

  async function handleRemove(accountId: string) {
    if (!familyId) return;
    await fetch(`/api/families/${familyId}/calendar-accounts/${accountId}`, {
      method: "DELETE",
    });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Existing accounts */}
      <div className="space-y-3 mb-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--border-radius)",
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {account.provider === "apple" ? "🍎" : account.provider === "google" ? "📧" : "📅"}
                </span>
                <span className="font-semibold">{account.username}</span>
              </div>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                {account.lastSyncAt
                  ? t("lastSync", { time: new Date(account.lastSyncAt).toLocaleString() })
                  : t("neverSynced")}
              </p>
            </div>
            <button
              onClick={() => handleRemove(account.id)}
              className="text-sm px-3 py-1 cursor-pointer"
              style={{
                color: "#FF6B6B",
                backgroundColor: "var(--color-background)",
                borderRadius: "var(--border-radius)",
              }}
            >
              {t("remove")}
            </button>
          </div>
        ))}
      </div>

      {/* Add account */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 text-white font-bold cursor-pointer"
          style={{
            backgroundColor: "var(--color-primary)",
            borderRadius: "var(--border-radius)",
          }}
        >
          + {t("addAccount")}
        </button>
      ) : (
        <AddAccountForm
          familyId={familyId}
          onClose={() => setShowAdd(false)}
          onAdded={(account) => {
            setAccounts((prev) => [...prev, account]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function AddAccountForm({
  familyId,
  onClose,
  onAdded,
}: {
  familyId: string | null;
  onClose: () => void;
  onAdded: (account: CalendarAccount) => void;
}) {
  const t = useTranslations("calendarSettings");
  const [provider, setProvider] = useState<"apple" | "google" | "outlook">("apple");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!familyId || !username || !password) return;
    setError("");
    setLoading(true);

    const res = await fetch(`/api/families/${familyId}/calendar-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        username,
        password,
        serverUrl: provider === "outlook" ? serverUrl : undefined,
        memberId: "TODO", // Will come from session
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || t("connectionFailed"));
      return;
    }

    onAdded(data.account);
  }

  return (
    <div
      className="p-6"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <h2 className="text-lg font-bold mb-4">{t("addAccount")}</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <label className="block mb-1 text-sm font-semibold">{t("provider")}</label>
      <div className="flex gap-2 mb-4">
        {([
          ["apple", t("providerApple"), "🍎"],
          ["google", t("providerGoogle"), "📧"],
          ["outlook", t("providerOther"), "📅"],
        ] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setProvider(key as typeof provider)}
            className="flex-1 py-2 text-sm font-semibold cursor-pointer flex items-center justify-center gap-1"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: provider === key ? "var(--color-primary)" : "var(--color-background)",
              color: provider === key ? "#fff" : "var(--color-text)",
            }}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      <label className="block mb-1 text-sm font-semibold">{t("username")}</label>
      <input
        type="email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full mb-3 p-2 border border-gray-200 outline-none"
        style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
      />

      <label className="block mb-1 text-sm font-semibold">{t("password")}</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-1 p-2 border border-gray-200 outline-none"
        style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
      />
      <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
        {t("passwordHint")}
      </p>

      {provider === "outlook" && (
        <>
          <label className="block mb-1 text-sm font-semibold">{t("serverUrl")}</label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://caldav.example.com"
            className="w-full mb-3 p-2 border border-gray-200 outline-none"
            style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
          />
        </>
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 py-2 font-semibold cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--color-background)",
          }}
        >
          {t("cancel") || "Cancel"}
        </button>
        <button
          onClick={handleConnect}
          disabled={!username || !password || loading}
          className="flex-1 py-2 text-white font-semibold disabled:opacity-50 cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--color-primary)",
          }}
        >
          {loading ? "..." : t("connect")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add a helper API to get the current familyId**

Add a GET handler to `src/app/api/families/route.ts` (below the existing POST):

```typescript
export async function GET() {
  // Simplified: return first family. Later: use session to determine family.
  const family = await db.family.findFirst({ select: { id: true, name: true } });
  if (!family) {
    return NextResponse.json({ error: "No family found" }, { status: 404 });
  }
  return NextResponse.json({ familyId: family.id, familyName: family.name });
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/settings src/app/api/families/route.ts
git commit -m "feat: add calendar settings page for CalDAV account management"
```

---

### Task 14: Build Verification + Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run:
```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 2: Verify production build**

Run:
```bash
npm run build
```

Expected: Build succeeds with all calendar routes visible.

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: calendar feature build verification"
```

- [ ] **Step 4: Deploy to VPS**

Run:
```bash
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.superpowers' --exclude '.env.local' -e "ssh -i ~/.ssh/id_ed25519" /Users/asenden/Projekte/FamilyDisplay/ root@178.104.37.21:/opt/familydisplay/
```

Then rebuild and run migration on VPS:
```bash
ssh -i ~/.ssh/id_ed25519 root@178.104.37.21 "cd /opt/familydisplay && docker compose down && docker compose up -d --build"
```

Run migration from builder image:
```bash
ssh -i ~/.ssh/id_ed25519 root@178.104.37.21 "cd /opt/familydisplay && docker build --target builder -t familydisplay-builder . && docker run --rm --network familydisplay_default -e DATABASE_URL=postgresql://fd:fd@db:5432/familydisplay familydisplay-builder sh -c 'npx prisma migrate dev --name add-calendar-accounts'"
```

- [ ] **Step 5: Verify on VPS**

Open `http://178.104.37.21:3000` — dashboard should show the calendar widget. Navigate to settings to add a CalDAV account.

---

## Summary

After completing all 14 tasks, you will have:

- **CalendarAccount Prisma model** for storing CalDAV connection details
- **ICS parser** for converting between iCalendar format and local events
- **CalDAV client wrapper** using `tsdav` — supports iCloud, Google Calendar, and any CalDAV server
- **Sync engine** with bidirectional event reconciliation (remote → local)
- **Calendar event API** — full CRUD (GET, POST, PUT, DELETE)
- **CalDAV account API** — add/remove accounts with connection verification
- **Sync cron endpoint** — triggers sync for all enabled accounts
- **CalendarWidget** — compact dashboard widget showing next 4 events with member colors
- **CalendarFullView** — full-screen week/day view with event creation
- **Calendar settings page** — add iCloud/Google/CalDAV accounts
- **i18n messages** — all calendar strings in English and German
- **Test suite** — parser tests, sync reconciliation tests, API route tests
- **Deployed on VPS** with migration applied
