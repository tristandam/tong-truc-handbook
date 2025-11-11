import { NextResponse } from "next/server";

import { approveAward } from "~/lib/directus";

type Params = {
  params: Promise<{
    awardId: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  const { awardId: awardIdParam } = await params;
  const awardId = Number.parseInt(awardIdParam, 10);

  if (Number.isNaN(awardId)) {
    return NextResponse.json(
      { message: "Invalid award identifier." },
      { status: 400 },
    );
  }

  try {
    const award = await approveAward(awardId);
    return NextResponse.json(award, { status: 200 });
  } catch (error) {
    console.error("[api/awards/confirm] Failed to approve award", error);
    return NextResponse.json(
      { message: "Failed to approve award." },
      { status: 500 },
    );
  }
}

