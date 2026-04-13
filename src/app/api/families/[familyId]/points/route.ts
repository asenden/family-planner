import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET → returns { points: { [memberId]: number } }
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    // Get all members of this family
    const members = await db.familyMember.findMany({
      where: { familyId },
      select: { id: true },
    });

    const memberIds = members.map((m) => m.id);

    // Sum earned points per member
    const completions = await db.routineCompletion.findMany({
      where: { memberId: { in: memberIds } },
      include: { task: { select: { points: true } } },
    });

    // Sum spent points per member
    const redemptions = await db.rewardRedemption.findMany({
      where: { memberId: { in: memberIds } },
      include: { reward: { select: { cost: true } } },
    });

    const earned: Record<string, number> = {};
    const spent: Record<string, number> = {};

    for (const c of completions) {
      earned[c.memberId] = (earned[c.memberId] ?? 0) + c.task.points;
    }

    const bonusLogs = await db.bonusLog.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, points: true },
    });
    for (const b of bonusLogs) {
      earned[b.memberId] = (earned[b.memberId] ?? 0) + b.points;
    }

    for (const r of redemptions) {
      spent[r.memberId] = (spent[r.memberId] ?? 0) + r.reward.cost;
    }

    const points: Record<string, number> = {};
    for (const id of memberIds) {
      points[id] = (earned[id] ?? 0) - (spent[id] ?? 0);
    }

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Failed to fetch points:", error);
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}
