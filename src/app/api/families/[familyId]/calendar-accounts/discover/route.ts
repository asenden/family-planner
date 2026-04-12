import { NextResponse } from "next/server";
import { fetchCalendars } from "@/lib/caldav/client";
import type { CalendarSource } from "@/generated/prisma/enums";

export async function POST(request: Request) {
  const { provider, username, password, serverUrl } = await request.json();

  if (!provider || !username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  try {
    const calendars = await fetchCalendars({
      provider: provider as CalendarSource,
      serverUrl: serverUrl || "",
      username,
      password,
    });

    return NextResponse.json({
      calendars: calendars.map((c) => ({
        url: c.url,
        displayName: c.displayName || c.url,
      })),
    });
  } catch (error) {
    console.error("CalDAV discovery failed:", error);
    return NextResponse.json(
      { error: "Connection failed. Check credentials." },
      { status: 400 }
    );
  }
}
