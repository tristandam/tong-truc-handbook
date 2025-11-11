import { NextResponse } from "next/server";

import { createAward } from "~/lib/directus";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  const ceremonyId =
    (typeof body.ceremonyId === "number" ? body.ceremonyId : null) ??
    (typeof body.ceremony === "number" ? body.ceremony : null);
  const categoryId =
    (typeof body.categoryId === "number" ? body.categoryId : null) ??
    (typeof body.category === "number" ? body.category : null);
  const type = body.type as "individual" | "team" | "overall" | undefined;
  const participantId =
    (typeof body.participantId === "number" ? body.participantId : null) ??
    (typeof body.participant_nominee === "number"
      ? body.participant_nominee
      : null);
  const teamId =
    (typeof body.teamId === "number" ? body.teamId : null) ??
    (typeof body.team_nominee === "number" ? body.team_nominee : null);
  const notes =
    typeof body.notes === "string"
      ? body.notes
      : typeof body.notes === "number"
        ? String(body.notes)
        : null;

  if (!ceremonyId || !categoryId || !type) {
    return NextResponse.json(
      { message: "Missing ceremony, category, or type information." },
      { status: 400 },
    );
  }

  if (
    type === "individual" &&
    (!participantId || Number.isNaN(participantId))
  ) {
    return NextResponse.json(
      { message: "Participant award requires a participant nominee." },
      { status: 400 },
    );
  }

  if (
    type !== "individual" &&
    (!teamId || Number.isNaN(teamId))
  ) {
    return NextResponse.json(
      { message: "Team or overall award requires a team nominee." },
      { status: 400 },
    );
  }

  try {
    const award = await createAward({
      ceremony: ceremonyId,
      category: categoryId,
      type,
      participant_nominee: type === "individual" ? participantId ?? null : null,
      team_nominee: type === "individual" ? null : teamId ?? null,
      notes,
    });

    return NextResponse.json(award, { status: 201 });
  } catch (error) {
    console.error("[api/awards] Failed to create award", error);
    return NextResponse.json(
      { message: "Failed to create award." },
      { status: 500 },
    );
  }
}
