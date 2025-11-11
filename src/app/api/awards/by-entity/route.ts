import { NextResponse } from "next/server";

import { getAwardsByCeremony, getCeremonies } from "~/lib/directus";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const participantIdParam = searchParams.get("participantId");
  const teamIdParam = searchParams.get("teamId");

  const participantId = participantIdParam ? Number.parseInt(participantIdParam, 10) : null;
  const teamId = teamIdParam ? Number.parseInt(teamIdParam, 10) : null;

  if (!participantId && !teamId) {
    return NextResponse.json(
      { message: "Either participantId or teamId must be provided." },
      { status: 400 },
    );
  }

  try {
    // Get all awards (no ceremony filter to show awards from entire event)
    const allAwards = await getAwardsByCeremony();
    const ceremonies = await getCeremonies();

    // Create a map of ceremony ID to ceremony name and order
    const ceremonyMap = new Map(
      ceremonies.map((ceremony) => [
        ceremony.id,
        { name: ceremony.name, order: ceremony.order ?? 999 },
      ]),
    );

    // Filter awards based on participant or team
    const filteredAwards = allAwards.filter((award) => {
      if (participantId) {
        // For individual awards, check if the participant matches
        return (
          award.type === "individual" &&
          award.participant_nominee?.id === participantId
        );
      } else if (teamId) {
        // For team/overall awards, check if the team matches
        return (
          (award.type === "team" || award.type === "overall") &&
          award.team_nominee?.id === teamId
        );
      }
      return false;
    });

    // Format the awards for display
    const formattedAwards = filteredAwards.map((award) => {
      const ceremony = award.ceremony ? ceremonyMap.get(award.ceremony) : null;
      return {
        id: award.id,
        categoryName: award.category?.name ?? "Unknown category",
        categoryColor: award.category?.color ?? "gray",
        status: award.status,
        type: award.type,
        submittedAt: award.submitted_at ?? award.approved_at ?? null,
        ceremonyId: award.ceremony ?? null,
        ceremonyName: ceremony?.name ?? null,
        ceremonyOrder: ceremony?.order ?? 999,
      };
    });

    return NextResponse.json(formattedAwards);
  } catch (error) {
    console.error("[api/awards/by-entity] Failed to fetch awards", error);
    return NextResponse.json(
      {
        message: "Failed to load awards.",
      },
      { status: 500 },
    );
  }
}

