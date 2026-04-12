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

  // If disabling, delete synced events from this calendar
  if (!syncEnabled) {
    const fullAccount = await db.calendarAccount.findUnique({
      where: { id: accountId },
      select: { familyId: true, provider: true, calendarId: true },
    });
    if (fullAccount) {
      await db.calendarEvent.deleteMany({
        where: {
          familyId: fullAccount.familyId,
          source: fullAccount.provider,
          externalId: { not: null },
          // Only delete events that came from this specific calendar
          // We can't filter by calendarId on events, so we rely on source + externalId
        },
      });
    }
  }

  return NextResponse.json({ account });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; accountId: string }> }
) {
  const { accountId } = await params;

  // Delete synced events before removing the account
  const account = await db.calendarAccount.findUnique({
    where: { id: accountId },
    select: { familyId: true, provider: true },
  });
  if (account) {
    await db.calendarEvent.deleteMany({
      where: {
        familyId: account.familyId,
        source: account.provider,
        externalId: { not: null },
      },
    });
  }

  await db.calendarAccount.delete({ where: { id: accountId } });

  return NextResponse.json({ success: true });
}
