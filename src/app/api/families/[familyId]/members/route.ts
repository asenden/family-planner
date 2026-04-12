import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  const members = await db.familyMember.findMany({
    where: { familyId },
    select: { id: true, name: true, role: true, color: true, avatar: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ members });
}
