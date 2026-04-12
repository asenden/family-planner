import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; eventId: string }> }
) {
  const { eventId } = await params;

  const event = await db.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignedTo: { select: { id: true, name: true, color: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; eventId: string }> }
) {
  const { eventId } = await params;
  const body = await request.json();
  const { title, description, start, end, allDay, assignedTo } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "Missing required fields: title, start, end" }, { status: 400 });
  }

  const event = await db.calendarEvent.update({
    where: { id: eventId },
    data: {
      title,
      description: description ?? null,
      start: new Date(start),
      end: new Date(end),
      allDay: allDay ?? false,
      ...(assignedTo
        ? { assignedTo: { set: (assignedTo as string[]).map((id: string) => ({ id })) } }
        : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; eventId: string }> }
) {
  const { eventId } = await params;

  await db.calendarEvent.delete({ where: { id: eventId } });

  return NextResponse.json({ success: true });
}
