import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardClient } from "./_components/DashboardClient";
import { expandRecurringEvents } from "@/lib/calendar/expand-recurring";
import { fetchWeather } from "@/lib/weather";
import { syncCalendarAccount } from "@/lib/caldav/sync";
import type { WeatherData } from "@/lib/weather";
import { getStreakTier } from "@/lib/streaks";

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

  // Prepare date values
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const memberIds = family.members.map((m) => m.id);

  // Run all independent queries in parallel
  const [
    routines,
    completions,
    rewards,
    allCompletions,
    allRedemptions,
    allBonusLogs,
    streaks,
    yesterdayPerfects,
    feelingCheckins,
    pinboardMessages,
    weather,
  ] = await Promise.all([
    db.routine.findMany({
      where: { familyId: family.id },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.routineCompletion.findMany({
      where: { memberId: { in: memberIds }, date: todayStart },
      select: { taskId: true },
    }),
    db.reward.findMany({
      where: { familyId: family.id },
      include: { redemptions: { select: { id: true, memberId: true } } },
      orderBy: { cost: "asc" },
    }),
    db.routineCompletion.findMany({
      where: { memberId: { in: memberIds } },
      include: { task: { select: { points: true } } },
    }),
    db.rewardRedemption.findMany({
      where: { memberId: { in: memberIds } },
      include: { reward: { select: { cost: true } } },
    }),
    db.bonusLog.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, points: true },
    }),
    db.streak.findMany({
      where: { memberId: { in: memberIds } },
    }),
    db.bonusLog.findMany({
      where: { memberId: { in: memberIds }, date: yesterdayStart, type: "perfect_day" },
      select: { memberId: true },
    }),
    db.feelingCheckin.findMany({
      where: { memberId: { in: memberIds }, date: { gte: sevenDaysAgo } },
      include: { member: { select: { id: true, name: true, color: true } } },
      orderBy: { date: "asc" },
    }),
    db.pinboardMessage.findMany({
      where: {
        familyId: family.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      include: { author: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: "desc" },
    }),
    (async (): Promise<WeatherData | null> => {
      if (family.latitude != null && family.longitude != null) {
        try { return await fetchWeather(family.latitude, family.longitude, locale); } catch { return null; }
      }
      return null;
    })(),
  ]);

  const todayCompletedTaskIds = completions.map((c) => c.taskId);

  // Compute points per member
  const earned: Record<string, number> = {};
  for (const c of allCompletions) {
    earned[c.memberId] = (earned[c.memberId] ?? 0) + c.task.points;
  }
  const spent: Record<string, number> = {};
  for (const r of allRedemptions) {
    spent[r.memberId] = (spent[r.memberId] ?? 0) + r.reward.cost;
  }
  const bonus: Record<string, number> = {};
  for (const b of allBonusLogs) {
    bonus[b.memberId] = (bonus[b.memberId] ?? 0) + b.points;
  }
  const pointsMap: Record<string, number> = {};
  for (const id of memberIds) {
    pointsMap[id] = (earned[id] ?? 0) + (bonus[id] ?? 0) - (spent[id] ?? 0);
  }

  // Build streak map
  const streakMap: Record<string, { current: number; longest: number; tier: string; multiplier: number; tierIcon: string; flameFrom: string; flameTo: string }> = {};
  for (const s of streaks) {
    const tier = getStreakTier(s.current);
    streakMap[s.memberId] = {
      current: s.current, longest: s.longest,
      tier: tier.label, multiplier: tier.multiplier, tierIcon: tier.icon,
      flameFrom: tier.flameFrom, flameTo: tier.flameTo,
    };
  }

  const yesterdayPerfectMap: Record<string, boolean> = {};
  for (const p of yesterdayPerfects) yesterdayPerfectMap[p.memberId] = true;

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
    streakMap,
    yesterdayPerfectMap,
    feelingCheckins: feelingCheckins.map((f) => ({
      id: f.id,
      date: `${f.date.getFullYear()}-${String(f.date.getMonth() + 1).padStart(2, "0")}-${String(f.date.getDate()).padStart(2, "0")}`,
      feeling: f.feeling,
      note: f.note ?? null,
      member: f.member,
    })),
    pinboardMessages: pinboardMessages.map((m) => ({
      id: m.id,
      content: m.content,
      color: m.color,
      createdAt: m.createdAt.toISOString(),
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      author: m.author,
    })),
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
      streakMap={familyData.streakMap}
      yesterdayPerfectMap={familyData.yesterdayPerfectMap}
      feelingCheckins={familyData.feelingCheckins}
      pinboardMessages={familyData.pinboardMessages}
    />
  );
}
