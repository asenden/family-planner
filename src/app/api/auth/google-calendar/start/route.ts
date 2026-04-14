import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const familyId = searchParams.get("familyId");

  if (!familyId) {
    return NextResponse.json({ error: "Missing familyId" }, { status: 400 });
  }

  const authUrl = buildGoogleAuthUrl(familyId);
  return NextResponse.redirect(authUrl);
}
