import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ familyId: string; accountId: string }> }
) {
  const { accountId } = await params;
  const { syncEnabled } = await request.json();

  const account = await db.calendarAccount.update({
    where: { id: accountId },
    data: { syncEnabled },
    select: { id: true, syncEnabled: true },
  });

  // If disabling, delete synced events from this specific calendar account
  if (!syncEnabled) {
    await db.calendarEvent.deleteMany({
      where: { calendarAccountId: accountId },
    });
  }

  return NextResponse.json({ account });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; accountId: string }> }
) {
  const { accountId } = await params;

  // Delete synced events from this specific account before removing it
  await db.calendarEvent.deleteMany({
    where: { calendarAccountId: accountId },
  });

  await db.calendarAccount.delete({ where: { id: accountId } });

  return NextResponse.json({ success: true });
}
