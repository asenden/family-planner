import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const routines = await db.routine.findMany({
      where: { familyId },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ routines });
  } catch (error) {
    console.error("Failed to fetch routines:", error);
    return NextResponse.json({ error: "Failed to fetch routines" }, { status: 500 });
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

  const { title, icon, schedule, customDays, assignedTo } = body;

  if (!title || !icon || !schedule || !assignedTo) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, schedule, assignedTo" },
      { status: 400 }
    );
  }

  const validSchedules = ["daily", "weekdays", "custom"];
  if (!validSchedules.includes(schedule as string)) {
    return NextResponse.json({ error: "Invalid schedule value" }, { status: 400 });
  }

  try {
    const routine = await db.routine.create({
      data: {
        title: title as string,
        icon: icon as string,
        schedule: schedule as "daily" | "weekdays" | "custom",
        customDays: (customDays as number[]) ?? [],
        familyId,
        assignedTo: assignedTo as string,
      },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ routine }, { status: 201 });
  } catch (error) {
    console.error("Failed to create routine:", error);
    return NextResponse.json({ error: "Failed to create routine" }, { status: 500 });
  }
}
