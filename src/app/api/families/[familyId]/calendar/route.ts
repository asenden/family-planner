import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const where: Record<string, unknown> = { familyId };
  if (startParam || endParam) {
    where.start = {};
    if (startParam) (where.start as Record<string, unknown>).gte = new Date(startParam);
    if (endParam) (where.start as Record<string, unknown>).lte = new Date(endParam);
  }

  try {
    const events = await db.calendarEvent.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, color: true } },
      },
      orderBy: { start: "asc" },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
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

  const { title, description, start, end, allDay, assignedTo, recurrence, recurrenceEnd } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "Missing required fields: title, start, end" }, { status: 400 });
  }

  try {
    const event = await db.calendarEvent.create({
      data: {
        title: title as string,
        description: (description as string) ?? null,
        start: new Date(start as string),
        end: new Date(end as string),
        allDay: (allDay as boolean) ?? false,
        source: "local",
        familyId,
        recurrence: (recurrence as string) ?? null,
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd as string) : null,
        ...(assignedTo && (assignedTo as string[]).length > 0
          ? { assignedTo: { connect: (assignedTo as string[]).map((id: string) => ({ id })) } }
          : {}),
      },
      include: {
        assignedTo: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return NextResponse.json({ error: "Failed to save event" }, { status: 500 });
  }
}
