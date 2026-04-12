import { db } from "@/lib/db";
import { TopBar } from "./_components/TopBar";
import { WidgetGrid } from "./_components/WidgetGrid";
import { IdleScreensaver } from "./_components/IdleScreensaver";

async function getFamilyData() {
  const family = await db.family.findFirst({
    include: {
      members: { select: { id: true, name: true, color: true, avatar: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!family) return null;

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const events = await db.calendarEvent.findMany({
    where: { familyId: family.id, start: { gte: now } },
    include: { assignedTo: { select: { id: true, name: true, color: true } } },
    orderBy: { start: "asc" },
  });

  return {
    familyId: family.id,
    members: family.members,
    events: events.map((e) => ({
      id: e.id, title: e.title, description: e.description,
      start: e.start.toISOString(), end: e.end.toISOString(),
      allDay: e.allDay, assignedTo: e.assignedTo,
    })),
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
