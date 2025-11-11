import { NextResponse } from "next/server";

import { updateAwardStatus } from "~/lib/directus";

type Params = {
  params: {
    awardId: string;
  };
};

type StatusRequestBody = {
  status?: "pending" | "approved" | "rejected";
};

export async function POST(request: Request, { params }: Params) {
  const awardId = Number.parseInt(params.awardId, 10);

  if (Number.isNaN(awardId)) {
    return NextResponse.json(
      { message: "Invalid award identifier." },
      { status: 400 },
    );
  }

  const body = (await request.json()) as StatusRequestBody;
  const status = body.status;

  if (!status) {
    return NextResponse.json(
      { message: "Missing target status." },
      { status: 400 },
    );
  }

  try {
    const award = await updateAwardStatus(awardId, status);
    return NextResponse.json(award, { status: 200 });
  } catch (error) {
    console.error("[api/awards/status] Failed to update award", error);
    return NextResponse.json(
      { message: "Failed to update award status." },
      { status: 500 },
    );
  }
}

