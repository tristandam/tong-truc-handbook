import { NextResponse } from "next/server";

import {
  buildParticipantTeamSummary,
  getAwardsByCeremony,
  getParticipants,
  getTeams,
} from "~/lib/directus";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ceremonyParam = searchParams.get("ceremonyId");
  const ceremonyId = ceremonyParam ? Number.parseInt(ceremonyParam, 10) : null;

  try {
    const [awards, participants, teams] = await Promise.all([
      getAwardsByCeremony(ceremonyId ?? undefined),
      getParticipants(),
      getTeams(),
    ]);

    const summary = buildParticipantTeamSummary(awards, participants, teams);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[api/overview/participants] Failed to build summary", error);
    return NextResponse.json(
      {
        message: "Failed to load participant/team summary.",
      },
      { status: 500 },
    );
  }
}

