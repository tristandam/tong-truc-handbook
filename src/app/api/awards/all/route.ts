import { NextResponse } from "next/server";

import {
  getAwardsByCeremony,
  getNomineeLabel,
  formatPersonName,
} from "~/lib/directus";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ceremonyParam = searchParams.get("ceremonyId");
  const ceremonyId = ceremonyParam ? Number.parseInt(ceremonyParam, 10) : null;

  try {
    const awards = await getAwardsByCeremony(ceremonyId ?? undefined);

    const formattedAwards = awards.map((award) => ({
      id: award.id,
      categoryName: award.category?.name ?? "Unknown category",
      categoryColor: award.category?.color ?? "gray",
      status: award.status,
      type: award.type,
      nominee: getNomineeLabel(award),
      submittedAt: award.submitted_at ?? award.approved_at ?? null,
    }));

    return NextResponse.json(formattedAwards);
  } catch (error) {
    console.error("[api/awards/all] Failed to fetch awards", error);
    return NextResponse.json(
      {
        message: "Failed to load awards.",
      },
      { status: 500 },
    );
  }
}

