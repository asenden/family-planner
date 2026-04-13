import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
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

  const { title, icon, points } = body;

  if (!title || !icon) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon" },
      { status: 400 }
    );
  }

  try {
    // Determine next order value
    const lastTask = await db.routineTask.findFirst({
      where: { routineId },
      orderBy: { order: "desc" },
    });
    const order = (lastTask?.order ?? -1) + 1;

    const task = await db.routineTask.create({
      data: {
        title: title as string,
        icon: icon as string,
        points: (points as number) ?? 1,
        order,
        routineId,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
