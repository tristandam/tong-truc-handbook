import { NextResponse } from "next/server";

import {
  buildCeremonySummary,
  getAwardsByCeremony,
} from "~/lib/directus";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ceremonyParam = searchParams.get("ceremonyId");
  const ceremonyId = ceremonyParam ? Number.parseInt(ceremonyParam, 10) : null;

  try {
    const awards = await getAwardsByCeremony(ceremonyId ?? undefined);
    const summary = buildCeremonySummary(awards);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[api/overview] Failed to build summary", error);
    return NextResponse.json(
      {
        message: "Failed to load ceremony summary.",
      },
      { status: 500 },
    );
  }
}

