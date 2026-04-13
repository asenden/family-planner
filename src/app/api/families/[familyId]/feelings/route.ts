import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const { searchParams } = new URL(request.url);
  const historyDays = searchParams.get("history");

  try {
    // Verify family exists and get member IDs
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { members: { select: { id: true } } },
    });
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }
    const memberIds = family.members.map((m) => m.id);

    let dateFilter: { gte: Date; lte?: Date };

    if (historyDays) {
      const days = parseInt(historyDays, 10);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const start = new Date(todayStart);
      start.setDate(start.getDate() - (days - 1));
      dateFilter = { gte: start };
    } else {
      // Today only
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      dateFilter = { gte: todayStart, lte: todayEnd };
    }

    const feelings = await db.feelingCheckin.findMany({
      where: {
        memberId: { in: memberIds },
        date: dateFilter,
      },
      include: {
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ feelings });
  } catch (error) {
    console.error("Failed to fetch feelings:", error);
    return NextResponse.json({ error: "Failed to fetch feelings" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memberId, feeling, note } = body;

  if (!memberId || !feeling) {
    return NextResponse.json({ error: "Missing required fields: memberId, feeling" }, { status: 400 });
  }

  const validFeelings = ["happy", "neutral", "sad", "angry", "excited"];
  if (!validFeelings.includes(feeling as string)) {
    return NextResponse.json({ error: "Invalid feeling value" }, { status: 400 });
  }

  try {
    // Verify the member belongs to this family
    const member = await db.familyMember.findFirst({
      where: { id: memberId as string, familyId },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found in this family" }, { status: 404 });
    }

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const checkin = await db.feelingCheckin.upsert({
      where: {
        memberId_date: {
          memberId: memberId as string,
          date: todayDate,
        },
      },
      update: {
        feeling: feeling as "happy" | "neutral" | "sad" | "angry" | "excited",
        note: (note as string | null) ?? null,
      },
      create: {
        memberId: memberId as string,
        date: todayDate,
        feeling: feeling as "happy" | "neutral" | "sad" | "angry" | "excited",
        note: (note as string | null) ?? null,
      },
      include: {
        member: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ checkin }, { status: 200 });
  } catch (error) {
    console.error("Failed to save feeling check-in:", error);
    return NextResponse.json({ error: "Failed to save check-in" }, { status: 500 });
  }
}
