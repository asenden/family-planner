import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchCalendars } from "@/lib/caldav/client";
import { syncCalendarAccount } from "@/lib/caldav/sync";
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
      username: true,
      serverUrl: true,
      syncEnabled: true,
      lastSyncAt: true,
      calendarId: true,
      calendarName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts });
}

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
