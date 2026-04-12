import { db } from "@/lib/db";
import { TopBar } from "./_components/TopBar";
import { WidgetGrid } from "./_components/WidgetGrid";
import { IdleScreensaver } from "./_components/IdleScreensaver";
import { expandRecurringEvents } from "@/lib/calendar/expand-recurring";

async function getFamilyData() {
  const family = await db.family.findFirst({
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
    members: family.members,
    events: expandedEvents,
  };
}

export default async function DashboardPage() {
  let familyData = null;
  try { familyData = await getFamilyData(); } catch {}

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4" style={{ backgroundColor: "var(--color-background)" }}>
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
