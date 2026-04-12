import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidInviteCode } from "@/lib/invite-code";

export async function POST(request: Request) {
  const { code } = await request.json();

  if (!code || !isValidInviteCode(code.toUpperCase())) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const family = await db.family.findUnique({
    where: { inviteCode: code.toUpperCase() },
    select: { id: true, name: true },
  });

  if (!family) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Set HTTP-only cookie with the family code
  const response = NextResponse.json({ familyId: family.id, familyName: family.name });
  response.cookies.set("familyCode", code.toUpperCase(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return response;
}

// GET to check if cookie is valid
export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/familyCode=([A-Z0-9]{6})/);

  if (!match) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const code = match[1];
  const family = await db.family.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true },
  });

  if (!family) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, familyId: family.id, familyName: family.name });
}
