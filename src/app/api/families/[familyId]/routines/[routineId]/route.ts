import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string }> }
) {
  const { routineId } = await params;

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

  try {
    const routine = await db.routine.update({
      where: { id: routineId },
      data: {
        title: title as string,
        icon: icon as string,
        schedule: schedule as "daily" | "weekdays" | "custom",
        customDays: (customDays as number[]) ?? [],
        assignedTo: assignedTo as string,
      },
      include: {
        tasks: { orderBy: { order: "asc" } },
        member: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ routine });
  } catch (error) {
    console.error("Failed to update routine:", error);
    return NextResponse.json({ error: "Failed to update routine" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string }> }
) {
  const { routineId } = await params;

  try {
    await db.routine.delete({ where: { id: routineId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete routine:", error);
    return NextResponse.json({ error: "Failed to delete routine" }, { status: 500 });
  }
}
