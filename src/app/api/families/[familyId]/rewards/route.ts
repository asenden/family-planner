import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  try {
    const rewards = await db.reward.findMany({
      where: { familyId },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
        member: { select: { name: true, color: true } },
      },
      orderBy: { cost: "asc" },
    });

    return NextResponse.json({ rewards: rewards.map((r) => ({ ...r, assignedTo: r.assignedTo ?? null })) });
  } catch (error) {
    console.error("Failed to fetch rewards:", error);
    return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
  }
}

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

  const { title, icon, cost, assignedTo } = body;

  if (!title || !icon || cost === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: title, icon, cost" },
      { status: 400 }
    );
  }

  if (typeof cost !== "number" || cost < 1) {
    return NextResponse.json({ error: "cost must be a positive integer" }, { status: 400 });
  }

  try {
    const reward = await db.reward.create({
      data: {
        title: title as string,
        icon: icon as string,
        cost: cost as number,
        familyId,
        ...(assignedTo ? { assignedTo: assignedTo as string } : {}),
      },
      include: {
        redemptions: { select: { id: true, memberId: true, redeemedAt: true } },
        member: { select: { name: true, color: true } },
      },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Failed to create reward:", error);
    return NextResponse.json({ error: "Failed to create reward" }, { status: 500 });
  }
}
