import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; messageId: string }> }
) {
  const { familyId, messageId } = await params;

  try {
    const message = await db.pinboardMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.familyId !== familyId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await db.pinboardMessage.delete({ where: { id: messageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete pinboard message:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
