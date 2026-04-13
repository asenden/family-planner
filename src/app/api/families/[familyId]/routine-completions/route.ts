import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST { taskId, memberId, date: "YYYY-MM-DD", completed: boolean }
// completed=true  → upsert a RoutineCompletion record
// completed=false → delete the record (un-check)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  // familyId is available for auth checks but not used in queries (task ownership is implicit)
  await params; // consume the promise

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, memberId, date, completed } = body;

  if (!taskId || !memberId || !date) {
    return NextResponse.json(
      { error: "Missing required fields: taskId, memberId, date" },
      { status: 400 }
    );
  }

  const dateValue = new Date(date as string);

  try {
    if (completed === false) {
      // Remove completion
      await db.routineCompletion.deleteMany({
        where: { taskId: taskId as string, memberId: memberId as string, date: dateValue },
      });
      return NextResponse.json({ completed: false });
    }

    // Upsert completion
    const completion = await db.routineCompletion.upsert({
      where: {
        taskId_memberId_date: {
          taskId: taskId as string,
          memberId: memberId as string,
          date: dateValue,
        },
      },
      create: {
        taskId: taskId as string,
        memberId: memberId as string,
        date: dateValue,
      },
      update: {}, // already exists — no-op
    });

    return NextResponse.json({ completed: true, completion });
  } catch (error) {
    console.error("Failed to toggle completion:", error);
    return NextResponse.json({ error: "Failed to toggle completion" }, { status: 500 });
  }
}
