import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  if (!dateStr)
    return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const dateValue = new Date(dateStr);
  const dayStart = new Date(
    dateValue.getFullYear(),
    dateValue.getMonth(),
    dateValue.getDate()
  );

  try {
    const members = await db.familyMember.findMany({
      where: { familyId },
      select: { id: true },
    });
    const logs = await db.bonusLog.findMany({
      where: {
        memberId: { in: members.map((m) => m.id) },
        date: dayStart,
      },
      orderBy: { createdAt: "asc" },
    });
    const totals: Record<string, number> = {};
    for (const log of logs) {
      totals[log.memberId] = (totals[log.memberId] ?? 0) + log.points;
    }
    return NextResponse.json({ logs, totals });
  } catch (error) {
    console.error("Failed to fetch bonus:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
