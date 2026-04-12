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

  const events = await db.calendarEvent.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, color: true } },
    },
    orderBy: { start: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const body = await request.json();
  const { title, description, start, end, allDay, assignedTo } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "Missing required fields: title, start, end" }, { status: 400 });
  }

  const event = await db.calendarEvent.create({
    data: {
      title,
      description: description ?? null,
      start: new Date(start),
      end: new Date(end),
      allDay: allDay ?? false,
      source: "local",
      familyId,
      ...(assignedTo && assignedTo.length > 0
        ? { assignedTo: { connect: (assignedTo as string[]).map((id: string) => ({ id })) } }
        : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
