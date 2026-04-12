import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { inviteCode, name, role, color, email, password } = body;

  if (!inviteCode || !name || !role || !color) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const family = await db.family.findUnique({ where: { inviteCode } });
  if (!family) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const member = await db.familyMember.create({
    data: { name, role, color, email: email || null, password: password || null, familyId: family.id },
  });

  return NextResponse.json({
    familyId: family.id,
    familyName: family.name,
    member: { id: member.id, name: member.name, role: member.role },
  });
}
