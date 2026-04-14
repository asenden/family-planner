# Google OAuth2 CalDAV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Google Calendar sync via OAuth2 instead of Basic Auth, while keeping Apple/Other CalDAV unchanged.

**Architecture:** OAuth2 Authorization Code Flow for Google auth. Token refresh handled in sync layer before each CalDAV connection. `tsdav` with `authMethod: "Oauth"` and `accessToken` credential for Google, `authMethod: "Basic"` for Apple/Other.

**Tech Stack:** Next.js API routes, Prisma, tsdav, Google OAuth2 endpoints (no additional npm packages)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add token fields to CalendarAccount |
| `src/lib/google-oauth.ts` | Create | Google OAuth2 helpers (URL builder, token exchange, refresh) |
| `src/app/api/auth/google-calendar/start/route.ts` | Create | OAuth start redirect |
| `src/app/api/auth/google-calendar/callback/route.ts` | Create | OAuth callback handler |
| `src/lib/caldav/client.ts` | Modify | Support OAuth credentials in connectCalDAV |
| `src/lib/caldav/sync.ts` | Modify | Build OAuth options, refresh tokens before sync |
| `src/app/api/families/[familyId]/calendar-accounts/route.ts` | Modify | Skip Basic Auth for Google provider |
| `src/app/[locale]/settings/calendar/page.tsx` | Modify | Google OAuth button instead of password form |

---

### Task 1: Add token fields to CalendarAccount schema

**Files:**
- Modify: `prisma/schema.prisma:102-125`

- [ ] **Step 1: Add three nullable fields to CalendarAccount**

In `prisma/schema.prisma`, add these fields after `calendarName`:

```prisma
model CalendarAccount {
  id           String         @id @default(cuid())
  provider     CalendarSource
  serverUrl    String
  username     String
  password     String
  calendarId   String?
  calendarName String?

  accessToken    String?
  refreshToken   String?
  tokenExpiresAt DateTime?

  syncEnabled Boolean  @default(true)
  lastSyncAt  DateTime?

  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  events CalendarEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([memberId, serverUrl, username, calendarId])
}
```

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/generated
git commit -m "feat: add OAuth token fields to CalendarAccount schema"
```

---

### Task 2: Create Google OAuth2 helper library

**Files:**
- Create: `src/lib/google-oauth.ts`

- [ ] **Step 1: Create the google-oauth.ts helper**

Create `src/lib/google-oauth.ts`:

```typescript
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly email";
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/google-calendar/callback`
  : "http://localhost:3000/api/auth/google-calendar/callback";

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET not set");
  return secret;
}

export function buildGoogleAuthUrl(familyId: string): string {
  const state = Buffer.from(JSON.stringify({ familyId })).toString("base64url");
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function parseState(state: string): { familyId: string } {
  return JSON.parse(Buffer.from(state, "base64url").toString());
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to fetch Google user info");

  const data = await res.json();
  return data.email;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/google-oauth.ts
git commit -m "feat: add Google OAuth2 helper library"
```

---

### Task 3: Create OAuth start route

**Files:**
- Create: `src/app/api/auth/google-calendar/start/route.ts`

- [ ] **Step 1: Create the start route**

Create `src/app/api/auth/google-calendar/start/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const familyId = searchParams.get("familyId");

  if (!familyId) {
    return NextResponse.json({ error: "Missing familyId" }, { status: 400 });
  }

  const authUrl = buildGoogleAuthUrl(familyId);
  return NextResponse.redirect(authUrl);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/google-calendar/start/route.ts
git commit -m "feat: add Google OAuth2 start route"
```

---

### Task 4: Create OAuth callback route

**Files:**
- Create: `src/app/api/auth/google-calendar/callback/route.ts`

- [ ] **Step 1: Create the callback route**

Create `src/app/api/auth/google-calendar/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  parseState,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google-oauth";
import { syncCalendarAccount } from "@/lib/caldav/sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Determine locale from cookie (default "de")
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "de";
  const settingsUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/${locale}/settings/calendar`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=oauth_denied`);
  }

  let familyId: string;
  try {
    ({ familyId } = parseState(state));
  } catch {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
  }

  try {
    // 1. Exchange code for tokens
    const { accessToken, refreshToken, expiresAt } =
      await exchangeCodeForTokens(code);

    // 2. Fetch user email
    const email = await fetchGoogleEmail(accessToken);

    // 3. Get first family member as default assignee
    const firstMember = await db.familyMember.findFirst({
      where: { familyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstMember) {
      return NextResponse.redirect(`${settingsUrl}?error=no_members`);
    }

    // 4. Create calendar account
    const account = await db.calendarAccount.create({
      data: {
        provider: "google",
        username: email,
        password: "",
        serverUrl: "https://apidata.googleusercontent.com/caldav/v2/",
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        syncEnabled: true,
        familyId,
        memberId: firstMember.id,
      },
    });

    // 5. Trigger initial sync (best-effort)
    try {
      await syncCalendarAccount(account.id);
    } catch (syncErr) {
      console.error("Initial Google sync failed:", syncErr);
    }

    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return NextResponse.redirect(`${settingsUrl}?error=oauth_failed`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/google-calendar/callback/route.ts
git commit -m "feat: add Google OAuth2 callback route"
```

---

### Task 5: Update CalDAV client to support OAuth

**Files:**
- Modify: `src/lib/caldav/client.ts`

- [ ] **Step 1: Extend CalDAVConnectOptions and connectCalDAV**

Replace the full content of `src/lib/caldav/client.ts`:

```typescript
import {
  createDAVClient,
  type DAVCalendar,
  type DAVCalendarObject,
} from "tsdav";
import type { CalendarSource } from "../../generated/prisma/enums";
import {
  icsToEvent,
  eventToIcs,
  type ParsedEvent,
  type EventToIcsInput,
} from "./parser";

interface CalDAVConnectOptions {
  provider: CalendarSource;
  serverUrl: string;
  username: string;
  password: string;
  oauth?: {
    accessToken: string;
    refreshToken: string;
  };
}

const PROVIDER_URLS: Partial<Record<CalendarSource, string>> = {
  apple: "https://caldav.icloud.com",
  google: "https://apidata.googleusercontent.com/caldav/v2/",
};

export type { CalDAVConnectOptions };

export async function connectCalDAV(options: CalDAVConnectOptions) {
  const serverUrl = PROVIDER_URLS[options.provider] || options.serverUrl;

  if (options.oauth) {
    // Google: use OAuth with access token
    const client = await createDAVClient({
      serverUrl,
      credentials: {
        accessToken: options.oauth.accessToken,
        refreshToken: options.oauth.refreshToken,
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      authMethod: "Oauth",
      defaultAccountType: "caldav",
    });
    return client;
  }

  // Apple/Other: Basic Auth
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

export async function fetchCalendars(
  options: CalDAVConnectOptions,
): Promise<DAVCalendar[]> {
  const client = await connectCalDAV(options);
  return client.fetchCalendars();
}

export async function fetchEvents(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  timeRange: { start: Date; end: Date },
): Promise<ParsedEvent[]> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
  if (!calendar) return [];

  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
  });

  return objects
    .filter(
      (obj): obj is DAVCalendarObject & { data: string } =>
        typeof obj.data === "string",
    )
    .map((obj) => {
      try {
        return icsToEvent(obj.data);
      } catch (e) {
        console.error("Failed to parse ICS event:", e, obj.data?.substring(0, 200));
        return null;
      }
    })
    .filter((e): e is ParsedEvent => e !== null);
}

export async function createRemoteEvent(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  event: EventToIcsInput,
): Promise<void> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
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
  eventUid: string,
): Promise<void> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
  if (!calendar) return;

  const objects = await client.fetchCalendarObjects({ calendar });
  const target = objects.find(
    (obj) =>
      typeof obj.data === "string" && obj.data.includes(`UID:${eventUid}`),
  );
  if (target?.url) {
    await client.deleteCalendarObject({ calendarObject: target });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v tests/`
Expected: No errors related to caldav/client.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/caldav/client.ts
git commit -m "feat: support OAuth credentials in CalDAV client"
```

---

### Task 6: Update sync.ts to refresh tokens before Google sync

**Files:**
- Modify: `src/lib/caldav/sync.ts`

- [ ] **Step 1: Add token refresh logic to syncCalendarAccount**

Replace the full content of `src/lib/caldav/sync.ts`:

```typescript
import { db } from "@/lib/db";
import { fetchEvents } from "./client";
import type { ParsedEvent } from "./parser";
import type { CalDAVConnectOptions } from "./client";
import { refreshAccessToken } from "@/lib/google-oauth";

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
  toDeleteLocally: string[];
}

export function reconcileEvents(
  localEvents: LocalEvent[],
  remoteEvents: RemoteEvent[],
): ReconcileResult {
  const remoteByUid = new Map(remoteEvents.map((e) => [e.externalId, e]));
  const localSynced = localEvents.filter((e) => e.externalId !== null);
  const localByUid = new Map(localSynced.map((e) => [e.externalId!, e]));

  const toCreateLocally: RemoteEvent[] = [];
  const toUpdateLocally: (RemoteEvent & { localId: string })[] = [];
  const toDeleteLocally: string[] = [];

  for (const [uid, remote] of remoteByUid) {
    const local = localByUid.get(uid);
    if (!local) {
      toCreateLocally.push(remote);
    } else if (hasChanged(local, remote)) {
      toUpdateLocally.push({ ...remote, localId: local.id });
    }
  }

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

async function buildConnectOptions(account: {
  provider: string;
  serverUrl: string;
  username: string;
  password: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  id: string;
}): Promise<CalDAVConnectOptions> {
  const base = {
    provider: account.provider as CalDAVConnectOptions["provider"],
    serverUrl: account.serverUrl,
    username: account.username,
    password: account.password,
  };

  if (account.provider !== "google" || !account.refreshToken) {
    return base;
  }

  // Refresh token if expired or expiring within 5 minutes
  let accessToken = account.accessToken ?? "";
  const fiveMinutes = 5 * 60 * 1000;
  const needsRefresh =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() <= Date.now() + fiveMinutes;

  if (needsRefresh) {
    try {
      const refreshed = await refreshAccessToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await db.calendarAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
    } catch (err) {
      console.error(`Failed to refresh Google token for account ${account.id}:`, err);
      throw err;
    }
  } else {
    accessToken = account.accessToken ?? "";
  }

  return {
    ...base,
    oauth: {
      accessToken,
      refreshToken: account.refreshToken,
    },
  };
}

export async function syncCalendarAccount(
  accountId: string,
): Promise<{ created: number; updated: number; deleted: number }> {
  const account = await db.calendarAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.syncEnabled) {
    return { created: 0, updated: 0, deleted: 0 };
  }

  const connectOptions = await buildConnectOptions(account);

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const remoteEvents = await fetchEvents(
    connectOptions,
    account.calendarId || "",
    { start, end },
  );

  const localEvents = await db.calendarEvent.findMany({
    where: {
      familyId: account.familyId,
      calendarAccountId: account.id,
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

  const { toCreateLocally, toUpdateLocally, toDeleteLocally } =
    reconcileEvents(
      localEvents.map((e) => ({ ...e, source: e.source as string })),
      remoteEvents,
    );

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
        calendarAccountId: account.id,
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v tests/`
Expected: No errors related to caldav/sync.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/caldav/sync.ts
git commit -m "feat: refresh Google OAuth tokens before CalDAV sync"
```

---

### Task 7: Update calendar-accounts POST route for Google

**Files:**
- Modify: `src/app/api/families/[familyId]/calendar-accounts/route.ts:31-110`

- [ ] **Step 1: Skip Basic Auth validation for Google provider**

Replace the POST handler in `src/app/api/families/[familyId]/calendar-accounts/route.ts`:

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const body = await request.json();
  const { provider, username, password, serverUrl, memberId, calendarId, calendarName } = body;

  // Google accounts are created via OAuth callback, not this endpoint
  if (provider === "google") {
    return NextResponse.json(
      { error: "Google accounts must be connected via OAuth. Use /api/auth/google-calendar/start" },
      { status: 400 }
    );
  }

  if (!provider || !username || !password) {
    return NextResponse.json({ error: "Missing required fields: provider, username, password" }, { status: 400 });
  }

  // If a specific calendarId is provided (from the 2-step discovery flow), use it directly.
  // Otherwise fall back to discovering and using the first calendar.
  let resolvedCalendarId: string | null = calendarId ?? null;

  if (!resolvedCalendarId) {
    let calendars;
    try {
      calendars = await fetchCalendars({
        provider: provider as CalendarSource,
        serverUrl: serverUrl ?? "",
        username,
        password,
      });
    } catch (error) {
      console.error("CalDAV connection failed:", error);
      return NextResponse.json({ error: "Connection failed. Check your credentials." }, { status: 400 });
    }
    resolvedCalendarId = calendars[0]?.url ?? null;
  }

  // If no memberId provided, use the first member of the family
  let resolvedMemberId = memberId;
  if (!resolvedMemberId) {
    const firstMember = await db.familyMember.findFirst({
      where: { familyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    resolvedMemberId = firstMember?.id;
  }

  if (!resolvedMemberId) {
    return NextResponse.json({ error: "No family member found" }, { status: 400 });
  }

  const account = await db.calendarAccount.create({
    data: {
      provider: provider as CalendarSource,
      username,
      password,
      serverUrl: serverUrl ?? "",
      calendarId: resolvedCalendarId,
      calendarName: calendarName ?? null,
      syncEnabled: true,
      familyId,
      memberId: resolvedMemberId,
    },
    select: {
      id: true,
      provider: true,
      username: true,
      serverUrl: true,
      syncEnabled: true,
      lastSyncAt: true,
      calendarId: true,
      calendarName: true,
    },
  });

  // Trigger initial sync immediately after connecting
  try {
    await syncCalendarAccount(account.id);
  } catch {
    // Sync failed — account is still saved, sync will retry on next page load
  }

  return NextResponse.json({ account }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/families/\[familyId\]/calendar-accounts/route.ts
git commit -m "feat: reject Google accounts via POST, require OAuth flow"
```

---

### Task 8: Update settings UI for Google OAuth button

**Files:**
- Modify: `src/app/[locale]/settings/calendar/page.tsx:155-323`

- [ ] **Step 1: Replace AddCalendarForm to show OAuth button for Google**

Replace the `AddCalendarForm` function in `src/app/[locale]/settings/calendar/page.tsx`:

```typescript
function AddCalendarForm({
  familyId,
  error,
  onError,
  onCancel,
  onAdded,
}: {
  familyId: string;
  error: string | null;
  onError: (msg: string) => void;
  onCancel: () => void;
  onAdded: (account: CalendarAccount) => void;
}) {
  const t = useTranslations("calendarSettings");
  const [provider, setProvider] = useState("apple");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);

  function handleGoogleConnect() {
    window.location.href = `/api/auth/google-calendar/start?familyId=${familyId}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    onError("");

    try {
      const res = await fetch(`/api/families/${familyId}/calendar-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, username, password, serverUrl: serverUrl || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.error || t("connectionFailed"));
      } else {
        onAdded(data.account);
      }
    } catch {
      onError(t("connectionFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text)" }}>
        {t("addAccount")}
      </h2>

      {error && (
        <p className="mb-3 text-sm font-semibold" style={{ color: "#FF6B6B" }}>
          {error}
        </p>
      )}

      {/* Provider */}
      <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {t("provider")}
      </label>
      <div className="flex gap-2 mb-3">
        {[
          { value: "apple", label: t("providerApple") },
          { value: "google", label: t("providerGoogle") },
          { value: "other", label: t("providerOther") },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setProvider(opt.value)}
            className="flex-1 py-2 text-sm font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: provider === opt.value ? "var(--color-primary)" : "var(--color-background)",
              color: provider === opt.value ? "#fff" : "var(--color-text)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {provider === "google" ? (
        /* Google: OAuth button */
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
            }}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleGoogleConnect}
            className="flex-1 py-2 text-white font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "#4285F4",
            }}
          >
            Mit Google verbinden
          </button>
        </div>
      ) : (
        /* Apple/Other: credential form */
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {t("username")}
          </label>
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            className="w-full mb-3 p-2 border border-gray-200 outline-none"
            style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
            required
          />

          {/* Password */}
          <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {t("password")}
          </label>
          {provider === "apple" && (
            <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
              {t("passwordHint")}
            </p>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 p-2 border border-gray-200 outline-none"
            style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
            required
          />

          {/* Server URL (only for "other") */}
          {provider === "other" && (
            <>
              <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {t("serverUrl")}
              </label>
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

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 font-semibold cursor-pointer"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
              }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
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
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v tests/`
Expected: No errors related to settings/calendar/page.tsx

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/settings/calendar/page.tsx
git commit -m "feat: show Google OAuth button instead of password form"
```

---

### Task 9: Configure environment variables and deploy

**Files:**
- Modify: `.env.local` (local dev)
- Modify: `.env` on VPS

- [ ] **Step 1: Set local env vars**

In `.env.local`, fill in the Google credentials:

```
GOOGLE_CLIENT_ID="<your-client-id>"
GOOGLE_CLIENT_SECRET="<your-client-secret>"
```

- [ ] **Step 2: Set VPS env vars**

SSH into VPS and update `/opt/familydisplay/.env` (or `.env.local`) with the same values.

- [ ] **Step 3: Push schema to production DB**

```bash
ssh -i ~/.ssh/id_ed25519 root@178.104.37.21 \
  "cd /opt/familydisplay && docker compose exec app npx prisma db push"
```

Or rebuild the container which runs `prisma generate` during build — the `db push` needs to be run separately.

- [ ] **Step 4: Deploy**

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  -e "ssh -i ~/.ssh/id_ed25519" \
  /Users/asenden/Projekte/FamilyDisplay/ root@178.104.37.21:/opt/familydisplay/

ssh -i ~/.ssh/id_ed25519 root@178.104.37.21 \
  "cd /opt/familydisplay && docker compose up -d --build"
```

- [ ] **Step 5: Test the full flow**

1. Open `https://dashboard.theasendens.com/de/settings/calendar`
2. Click "+ Kalender hinzufügen"
3. Select "Google"
4. Click "Mit Google verbinden"
5. Log into Google, grant calendar read access
6. Verify redirect back to settings page
7. Verify Google account appears in the list with email
8. Open dashboard, verify calendar events from Google appear

- [ ] **Step 6: Commit all changes**

```bash
git add -A
git commit -m "feat: complete Google OAuth2 CalDAV integration"
```
