import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardClient } from "./_components/DashboardClient";
import { expandRecurringEvents } from "@/lib/calendar/expand-recurring";

async function getFamilyData() {
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

  const expandedEvents = expandRecurringEvents(
    events.map((e) => ({
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

  return {
    familyId: family.id,
    familyCode: family.inviteCode,
    members: family.members,
    events: expandedEvents,
  };
}

export default async function DashboardPage() {
  let familyData = null;
  try { familyData = await getFamilyData(); } catch {}

  if (!familyData) {
    redirect("/");
  }

  return (
    <DashboardClient
      familyId={familyData.familyId}
      familyCode={familyData.familyCode}
      calendarEvents={familyData.events}
      familyMembers={familyData.members}
    />
  );
}
