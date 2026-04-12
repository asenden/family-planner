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
      username: true,
      serverUrl: true,
      syncEnabled: true,
      lastSyncAt: true,
      calendarId: true,
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
  const { provider, username, password, serverUrl, memberId } = body;

  if (!provider || !username || !password) {
    return NextResponse.json({ error: "Missing required fields: provider, username, password" }, { status: 400 });
  }

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

  const firstCalendarId = calendars[0]?.url ?? null;

  const account = await db.calendarAccount.create({
    data: {
      provider: provider as CalendarSource,
      username,
      password,
      serverUrl: serverUrl ?? "",
      calendarId: firstCalendarId,
      syncEnabled: true,
      familyId,
      ...(memberId ? { memberId } : {}),
    },
    select: {
      id: true,
      provider: true,
      username: true,
      serverUrl: true,
      syncEnabled: true,
      lastSyncAt: true,
      calendarId: true,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
