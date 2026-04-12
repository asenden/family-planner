import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCalendarAccount } from "@/lib/caldav/sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db.calendarAccount.findMany({
    where: { syncEnabled: true },
    select: { id: true, provider: true, username: true, familyId: true },
  });

  const results = [];
  for (const account of accounts) {
    try {
      const result = await syncCalendarAccount(account.id);
      results.push({ accountId: account.id, ...result, status: "ok" });
    } catch (error) {
      console.error(`Sync failed for account ${account.id}:`, error);
      results.push({ accountId: account.id, status: "error", error: String(error) });
    }
  }

  return NextResponse.json({ synced: results.length, results, timestamp: new Date().toISOString() });
}
