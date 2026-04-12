import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite-code";

export async function GET() {
  const family = await db.family.findFirst({ select: { id: true, name: true } });
  if (!family) return NextResponse.json({ error: "No family found" }, { status: 404 });
  return NextResponse.json({ familyId: family.id, familyName: family.name });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { familyName, memberName, email, password, color } = body;

  if (!familyName || !memberName || !email || !password || !color) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const inviteCode = generateInviteCode();
    const family = await db.family.create({ data: { name: familyName, inviteCode } });
    const member = await db.familyMember.create({
      data: { name: memberName, email, password, color, role: "parent", familyId: family.id },
    });

    return NextResponse.json({
      family: { id: family.id, name: family.name, inviteCode: family.inviteCode },
      member: { id: member.id, name: member.name, email: member.email, role: member.role },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create family:", error);
    return NextResponse.json(
      { error: "Database connection failed. Is PostgreSQL running?" },
      { status: 500 }
    );
  }
}
