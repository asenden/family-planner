import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string; taskId: string }> }
) {
  const { taskId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, points, order } = body;

  if (!title || !icon) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon" },
      { status: 400 }
    );
  }

  try {
    const task = await db.routineTask.update({
      where: { id: taskId },
      data: {
        title: title as string,
        icon: icon as string,
        points: (points as number) ?? 1,
        ...(order !== undefined ? { order: order as number } : {}),
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; routineId: string; taskId: string }> }
) {
  const { taskId } = await params;

  try {
    await db.routineTask.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
