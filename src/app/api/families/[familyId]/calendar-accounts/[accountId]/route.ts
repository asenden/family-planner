import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; accountId: string }> }
) {
  const { accountId } = await params;

  await db.calendarAccount.delete({ where: { id: accountId } });

  return NextResponse.json({ success: true });
}
