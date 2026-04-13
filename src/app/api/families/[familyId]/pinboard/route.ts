import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const messages = await db.pinboardMessage.findMany({
      where: { familyId },
      include: {
        author: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch pinboard messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
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

  const { content, color, expiresAt, authorId } = body;

  if (!content || !authorId) {
    return NextResponse.json({ error: "Missing required fields: content, authorId" }, { status: 400 });
  }

  try {
    const message = await db.pinboardMessage.create({
      data: {
        content: content as string,
        color: (color as string) ?? "#fef08a",
        expiresAt: expiresAt ? new Date(expiresAt as string) : null,
        authorId: authorId as string,
        familyId,
      },
      include: {
        author: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Failed to create pinboard message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
