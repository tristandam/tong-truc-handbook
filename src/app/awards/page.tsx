import { Suspense } from "react";

import { AwardsPage } from "../_components/awards-page";

import {
  buildCeremonySummary,
  getAwardsByCeremony,
  getCeremonies,
  getAwardCategories,
  getParticipants,
  getTeams,
} from "~/lib/directus";

async function AwardsPageLoader() {
  const [ceremonies, awards, categories, participants, teams] = await Promise.all([
    getCeremonies(),
    getAwardsByCeremony(),
    getAwardCategories(),
    getParticipants(),
    getTeams(),
  ]);

  const summary = buildCeremonySummary(awards);

  return (
    <AwardsPage
      ceremonies={ceremonies}
      initialSummary={summary}
      categories={categories}
      participants={participants}
      teams={teams}
    />
  );
}

export default async function AwardsPageRoute() {
  return (
    <main className="min-h-screen bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <AwardsPageLoader />
        </Suspense>
      </div>
    </main>
  );
}

