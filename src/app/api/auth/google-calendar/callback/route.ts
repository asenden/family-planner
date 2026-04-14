import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  parseState,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google-oauth";
import { syncCalendarAccount } from "@/lib/caldav/sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Determine locale from cookie (default "de")
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "de";
  const settingsUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/${locale}/settings/calendar`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=oauth_denied`);
  }

  let familyId: string;
  try {
    ({ familyId } = parseState(state));
  } catch {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
  }

  try {
    // 1. Exchange code for tokens
    const { accessToken, refreshToken, expiresAt } =
      await exchangeCodeForTokens(code);

    // 2. Fetch user email
    const email = await fetchGoogleEmail(accessToken);

    // 3. Get first family member as default assignee
    const firstMember = await db.familyMember.findFirst({
      where: { familyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstMember) {
      return NextResponse.redirect(`${settingsUrl}?error=no_members`);
    }

    // 4. Create or update calendar account
    const account = await db.calendarAccount.upsert({
      where: {
        memberId_serverUrl_username_calendarId: {
          memberId: firstMember.id,
          serverUrl: "https://apidata.googleusercontent.com/caldav/v2/",
          username: email,
          calendarId: "",
        },
      },
      update: {
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        syncEnabled: true,
      },
      create: {
        provider: "google",
        username: email,
        password: "",
        serverUrl: "https://apidata.googleusercontent.com/caldav/v2/",
        calendarId: "",
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        syncEnabled: true,
        familyId,
        memberId: firstMember.id,
      },
    });

    // 5. Trigger initial sync (best-effort)
    try {
      await syncCalendarAccount(account.id);
    } catch (syncErr) {
      console.error("Initial Google sync failed:", syncErr);
    }

    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return NextResponse.redirect(`${settingsUrl}?error=oauth_failed`);
  }
}
