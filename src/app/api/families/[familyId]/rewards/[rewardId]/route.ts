import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ familyId: string; rewardId: string }> }
) {
  const { rewardId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, icon, cost } = body;

  if (!title || !icon || cost === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, cost" },
      { status: 400 }
    );
  }

  try {
    const reward = await db.reward.update({
      where: { id: rewardId },
      data: {
        title: title as string,
        icon: icon as string,
        cost: cost as number,
      },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
      },
    });

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Failed to update reward:", error);
    return NextResponse.json({ error: "Failed to update reward" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ familyId: string; rewardId: string }> }
) {
  const { rewardId } = await params;

  try {
    await db.reward.delete({ where: { id: rewardId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reward:", error);
    return NextResponse.json({ error: "Failed to delete reward" }, { status: 500 });
  }
}
