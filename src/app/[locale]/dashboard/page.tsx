import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardClient } from "./_components/DashboardClient";
import { expandRecurringEvents } from "@/lib/calendar/expand-recurring";
import { fetchWeather } from "@/lib/weather";
import { syncCalendarAccount } from "@/lib/caldav/sync";
import type { WeatherData } from "@/lib/weather";

async function getFamilyData(locale: string) {
  const cookieStore = await cookies();
  const familyCode = cookieStore.get("familyCode")?.value;

  if (!familyCode) return null;

  const family = await db.family.findUnique({
    where: { inviteCode: familyCode },
    include: {
      members: { select: { id: true, name: true, color: true, avatar: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!family) return null;

  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAhead = new Date(now);
  ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);

  const events = await db.calendarEvent.findMany({
    where: { familyId: family.id, start: { gte: ninetyDaysAgo, lte: ninetyDaysAhead } },
    include: { assignedTo: { select: { id: true, name: true, color: true } } },
    orderBy: { start: "asc" },
  });

  // Sync CalDAV accounts — only if stale (> 5 minutes since last sync)
  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const accounts = await db.calendarAccount.findMany({
    where: { familyId: family.id, syncEnabled: true },
    select: { id: true, lastSyncAt: true },
  });

  const staleAccounts = accounts.filter(
    (a) => !a.lastSyncAt || now.getTime() - a.lastSyncAt.getTime() > SYNC_INTERVAL_MS
  );

  if (staleAccounts.length > 0) {
    await Promise.allSettled(
      staleAccounts.map((a) => syncCalendarAccount(a.id))
    );
  }

  // Re-fetch events after sync
  const syncedEvents = await db.calendarEvent.findMany({
    where: { familyId: family.id, start: { gte: ninetyDaysAgo, lte: ninetyDaysAhead } },
    include: { assignedTo: { select: { id: true, name: true, color: true } } },
    orderBy: { start: "asc" },
  });

  const expandedEvents = expandRecurringEvents(
    syncedEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      allDay: e.allDay,
      recurrence: e.recurrence,
      recurrenceEnd: e.recurrenceEnd?.toISOString() || null,
      assignedTo: e.assignedTo,
    })),
    ninetyDaysAgo,
    ninetyDaysAhead
  );

  let weather: WeatherData | null = null;
  if (family.latitude != null && family.longitude != null) {
    try {
      weather = await fetchWeather(family.latitude, family.longitude, locale);
    } catch {
      // Weather fetch failed — show dashboard without weather
    }
  }

  return {
    familyId: family.id,
    familyCode: family.inviteCode,
    members: family.members,
    events: expandedEvents,
    weather,
    city: family.city ?? null,
  };
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  let familyData = null;
  try { familyData = await getFamilyData(locale); } catch {}

  if (!familyData) {
    redirect("/");
  }

  return (
    <DashboardClient
      familyId={familyData.familyId}
      familyCode={familyData.familyCode}
      calendarEvents={familyData.events}
      familyMembers={familyData.members}
      weather={familyData.weather}
      city={familyData.city}
    />
  );
}
