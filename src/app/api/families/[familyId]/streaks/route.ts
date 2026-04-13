import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStreakTier } from "@/lib/streaks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;
  try {
    const members = await db.familyMember.findMany({
      where: { familyId },
      select: { id: true },
    });
    const streaks = await db.streak.findMany({
      where: { memberId: { in: members.map((m) => m.id) } },
    });
    const result: Record<
      string,
      {
        current: number;
        longest: number;
        tier: string;
        multiplier: number;
        tierIcon: string;
        flameFrom: string;
        flameTo: string;
      }
    > = {};
    for (const s of streaks) {
      const tier = getStreakTier(s.current);
      result[s.memberId] = {
        current: s.current,
        longest: s.longest,
        tier: tier.label,
        multiplier: tier.multiplier,
        tierIcon: tier.icon,
        flameFrom: tier.flameFrom,
        flameTo: tier.flameTo,
      };
    }
    return NextResponse.json({ streaks: result });
  } catch (error) {
    console.error("Failed to fetch streaks:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
