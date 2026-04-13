import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST { rewardId, memberId }
// Server validates that the member has enough points before redeeming.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rewardId, memberId } = body;

  if (!rewardId || !memberId) {
    return NextResponse.json(
      { error: "Missing required fields: rewardId, memberId" },
      { status: 400 }
    );
  }

  try {
    // Fetch reward cost
    const reward = await db.reward.findUnique({
      where: { id: rewardId as string, familyId },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Calculate current points for this member
    // Points = sum of task points for completions that have no redemption deducting them.
    // Simple model: all completions are worth their task.points; redemptions "spend" the cost.
    const completions = await db.routineCompletion.findMany({
      where: { memberId: memberId as string },
      include: { task: { select: { points: true } } },
    });

    const totalEarned = completions.reduce((sum, c) => sum + c.task.points, 0);

    const redemptions = await db.rewardRedemption.findMany({
      where: { memberId: memberId as string },
      include: { reward: { select: { cost: true } } },
    });

    const totalSpent = redemptions.reduce((sum, r) => sum + r.reward.cost, 0);
    const currentPoints = totalEarned - totalSpent;

    if (currentPoints < reward.cost) {
      return NextResponse.json(
        { error: "Not enough points", currentPoints, required: reward.cost },
        { status: 422 }
      );
    }

    // Create redemption
    const redemption = await db.rewardRedemption.create({
      data: {
        rewardId: rewardId as string,
        memberId: memberId as string,
      },
    });

    return NextResponse.json({ redemption, newPoints: currentPoints - reward.cost }, { status: 201 });
  } catch (error) {
    console.error("Failed to redeem reward:", error);
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
  }
}
