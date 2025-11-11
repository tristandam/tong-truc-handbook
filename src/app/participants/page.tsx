import { Suspense } from "react";

import { ParticipantTeamOverview } from "../_components/participant-team-overview";

import {
  buildParticipantTeamSummary,
  getAwardCategories,
  getAwardsByCeremony,
  getCeremonies,
  getParticipants,
  getTeams,
} from "~/lib/directus";

async function ParticipantTeamOverviewLoader() {
  const [ceremonies, awards, participants, teams, categories] = await Promise.all([
    getCeremonies(),
    getAwardsByCeremony(),
    getParticipants(),
    getTeams(),
    getAwardCategories(),
  ]);

  const summary = buildParticipantTeamSummary(awards, participants, teams);

  return (
    <ParticipantTeamOverview
      ceremonies={ceremonies}
      initialSummary={summary}
      categories={categories}
      participants={participants}
      teams={teams}
    />
  );
}

export default async function ParticipantTeamPage() {
  return (
    <main className="min-h-screen bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="text-white">Loading stats…</div>}>
          <ParticipantTeamOverviewLoader />
        </Suspense>
      </div>
    </main>
  );
}

