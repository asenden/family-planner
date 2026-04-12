import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite-code";

export async function POST(request: Request) {
  const body = await request.json();
  const { familyName, memberName, email, password, color } = body;

  if (!familyName || !memberName || !email || !password || !color) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const inviteCode = generateInviteCode();
  const family = await db.family.create({ data: { name: familyName, inviteCode } });
  const member = await db.familyMember.create({
    data: { name: memberName, email, password, color, role: "parent", familyId: family.id },
  });

  return NextResponse.json({
    family: { id: family.id, name: family.name, inviteCode: family.inviteCode },
    member: { id: member.id, name: member.name, email: member.email, role: member.role },
  }, { status: 201 });
}
