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
      members: { select: { id: true, name: true, color: true, avatar: true, role: true }, orderBy: { createdAt: "asc" } },
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

  // Fetch routines with tasks for this family
  const routines = await db.routine.findMany({
    where: { familyId: family.id },
    include: {
      tasks: { orderBy: { order: "asc" } },
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch today's completions
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const completions = await db.routineCompletion.findMany({
    where: {
      memberId: { in: family.members.map((m) => m.id) },
      date: todayStart,
    },
    select: { taskId: true },
  });
  const todayCompletedTaskIds = completions.map((c) => c.taskId);

  // Fetch rewards
  const rewards = await db.reward.findMany({
    where: { familyId: family.id },
    include: {
      redemptions: { select: { id: true, memberId: true } },
    },
    orderBy: { cost: "asc" },
  });

  // Compute points per member
  const memberIds = family.members.map((m) => m.id);

  // Earned points: sum of task points for all completions
  const allCompletions = await db.routineCompletion.findMany({
    where: { memberId: { in: memberIds } },
    include: { task: { select: { points: true } } },
  });
  const earned: Record<string, number> = {};
  for (const c of allCompletions) {
    earned[c.memberId] = (earned[c.memberId] ?? 0) + c.task.points;
  }

  // Spent points: sum of reward costs for all redemptions
  const allRedemptions = await db.rewardRedemption.findMany({
    where: { memberId: { in: memberIds } },
    include: { reward: { select: { cost: true } } },
  });
  const spent: Record<string, number> = {};
  for (const r of allRedemptions) {
    spent[r.memberId] = (spent[r.memberId] ?? 0) + r.reward.cost;
  }

  const pointsMap: Record<string, number> = {};
  for (const id of memberIds) {
    pointsMap[id] = (earned[id] ?? 0) - (spent[id] ?? 0);
  }

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
    routines: routines.map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      schedule: r.schedule,
      customDays: r.customDays,
      assignedTo: r.assignedTo,
      member: r.member,
      tasks: r.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        icon: t.icon,
        points: t.points,
        order: t.order,
      })),
    })),
    rewards: rewards.map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      cost: r.cost,
      assignedTo: r.assignedTo ?? null,
      redemptions: r.redemptions,
    })),
    todayCompletedTaskIds,
    pointsMap,
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
      routines={familyData.routines}
      rewards={familyData.rewards}
      todayCompletedTaskIds={familyData.todayCompletedTaskIds}
      pointsMap={familyData.pointsMap}
    />
  );
}
