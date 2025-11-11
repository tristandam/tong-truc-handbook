'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AwardCategoryRecord,
  CeremonyRecord,
  CeremonySummary,
  ParticipantRecord,
  TeamRecord,
} from "~/lib/directus";

import { AwardFormDialog } from "./award-form-dialog";

type CeremonyOption = CeremonyRecord & { label: string };

interface AwardsPageProps {
  ceremonies: CeremonyRecord[];
  initialSummary: CeremonySummary;
  categories: AwardCategoryRecord[];
  participants: ParticipantRecord[];
  teams: TeamRecord[];
}

const DEFAULT_COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#facc15",
  red: "#ef4444",
  brown: "#92400e",
  gold: "#f59e0b",
  co_danh_du: "#f97316",
  gray: "#94a3b8",
};

export function AwardsPage({
  ceremonies,
  initialSummary,
  categories,
  participants,
  teams,
}: AwardsPageProps) {
  const ceremonyOptions: CeremonyOption[] = useMemo(
    () => [
      { id: 0, name: "All ceremonies", order: 0, label: "All ceremonies" },
      ...ceremonies.map((ceremony) => ({
        ...ceremony,
        label: ceremony.name.replace(/_/g, " "),
      })),
    ],
    [ceremonies],
  );

  const [selectedCeremonyId, setSelectedCeremonyId] = useState<number>(0);
  const [summary, setSummary] = useState<CeremonySummary>(initialSummary);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    type: "individual" | "team" | "overall" | null;
    teamId: number | null;
    participantId: number | null;
  }>({
    type: null,
    teamId: null,
    participantId: null,
  });
  const [statusUpdate, setStatusUpdate] = useState<{
    id: number;
    status: "approved" | "pending" | "rejected";
  } | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);

  // Fetch all awards directly from API
  const [allAwardsData, setAllAwardsData] = useState<Array<{
    id: number;
    categoryName: string;
    categoryColor: string;
    status: "approved" | "pending" | "rejected";
    type: "individual" | "team" | "overall" | null;
    nominee: string;
    submittedAt: string | null;
  }>>([]);

  const refreshSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/overview", window.location.origin);
      if (selectedCeremonyId !== 0) {
        url.searchParams.set("ceremonyId", String(selectedCeremonyId));
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch ceremony summary.");
      }

      const data = (await response.json()) as CeremonySummary;
      setSummary(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load ceremony data right now.");
    } finally {
      setLoading(false);
    }
  }, [selectedCeremonyId]);

  const fetchAllAwards = useCallback(async () => {
    try {
      const url = new URL("/api/awards/all", window.location.origin);
      if (selectedCeremonyId !== 0) {
        url.searchParams.set("ceremonyId", String(selectedCeremonyId));
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch awards.");
      }

      const data = await response.json() as Array<{
        id: number;
        categoryName: string;
        categoryColor: string;
        status: "approved" | "pending" | "rejected";
        type: "individual" | "team" | "overall" | null;
        nominee: string;
        submittedAt: string | null;
      }>;
      setAllAwardsData(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load awards right now.");
    }
  }, [selectedCeremonyId]);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    void fetchAllAwards();
  }, [fetchAllAwards]);

  function openDialog(options: {
    type: "individual" | "team" | "overall" | null;
    teamId?: number | null;
    participantId?: number | null;
  }) {
    setDialogConfig({
      type: options.type ?? null,
      teamId: options.teamId ?? null,
      participantId: options.participantId ?? null,
    });
    setDialogOpen(true);
  }

  const handleStatusChange = useCallback(
    async (awardId: number, targetStatus: "approved" | "pending" | "rejected") => {
      setStatusUpdate({ id: awardId, status: targetStatus });
      setStatusMenuId(null);
      try {
        const response = await fetch(`/api/awards/${awardId}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: targetStatus }),
        });

        if (!response.ok) {
          throw new Error("Failed to update award.");
        }

        await refreshSummary();
        await fetchAllAwards();
      } catch (confirmError) {
        console.error(confirmError);
        setError("Unable to update award right now. Please try again.");
      } finally {
        setStatusUpdate(null);
      }
    },
    [refreshSummary, fetchAllAwards],
  );

  const toggleStatusMenu = useCallback((awardId: number) => {
    setStatusMenuId((current) => (current === awardId ? null : awardId));
  }, []);

  const selectedCeremonyLabel =
    ceremonyOptions.find((option) => option.id === selectedCeremonyId)
      ?.label ?? "This ceremony";

  // Combine all awards (approved and pending) for display
  const allAwards = useMemo(() => {
    return allAwardsData.sort((a, b) => {
      // Sort by status (pending first), then by date
      if (a.status !== b.status) {
        if (a.status === 'pending') return -1;
        if (b.status === 'pending') return 1;
        if (a.status === 'approved') return -1;
        if (b.status === 'approved') return 1;
      }
      const dateA = Date.parse(a.submittedAt ?? "") || 0;
      const dateB = Date.parse(b.submittedAt ?? "") || 0;
      return dateB - dateA;
    });
  }, [allAwardsData]);

  // Separate into individual and team awards
  const individualAwards = useMemo(() => {
    return allAwards.filter(award => award.type === 'individual');
  }, [allAwards]);

  const teamAwards = useMemo(() => {
    return allAwards.filter(award => award.type === 'team' || award.type === 'overall');
  }, [allAwards]);

  return (
    <div className="space-y-6">
      <header className="sticky top-[57px] z-10 bg-slate-900 pb-4 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Awards
            </h1>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ceremonyOptions.map((ceremony) => {
              const isActive = ceremony.id === selectedCeremonyId;
              return (
                <button
                  key={ceremony.id}
                  type="button"
                  onClick={() => setSelectedCeremonyId(ceremony.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {ceremony.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Submit an award
          </h2>
          <p className="text-sm text-slate-300">
            Open the award form to recognize a sa mạc sinh or a đội.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            onClick={() =>
              openDialog({
                type: "individual",
              })
            }
          >
            Nominate Individual Award
          </button>
          <button
            type="button"
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            onClick={() =>
              openDialog({
                type: "team",
              })
            }
          >
            Nominate Team Award
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Individual Awards
            <span className="text-xs font-normal text-slate-400 ml-2">
              ({selectedCeremonyLabel})
            </span>
          </h2>
          <span className="text-xs text-slate-300">
            {individualAwards.length} awards
          </span>
        </div>

        <div className="space-y-3">
          {loading && individualAwards.length === 0 ? (
            <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
              Loading awards…
            </div>
          ) : null}

          {!loading && individualAwards.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
              No individual awards for this ceremony.
            </div>
          ) : null}

          {individualAwards.map((award) => {
            const colorHex =
              DEFAULT_COLOR_MAP[award.categoryColor] ?? DEFAULT_COLOR_MAP.gray;

            return (
              <article
                key={`individual-${award.id}`}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
              >
                <div className="flex flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: colorHex }}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {award.categoryName} · {award.type ?? "—"}
                    </p>
                    <p className="text-sm text-slate-300">{award.nominee}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex min-w-[72px] justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                      award.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "bg-amber-500/20 text-amber-200"
                    }`}
                  >
                    {award.status}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => toggleStatusMenu(award.id)}
                      disabled={statusUpdate?.id === award.id}
                    >
                      {statusUpdate?.id === award.id ? "Updating…" : "Update status"}
                    </button>
                    {statusMenuId === award.id ? (
                      <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg bg-slate-900 p-1 text-left shadow-lg ring-1 ring-white/10">
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "approved")}
                        >
                          Set approved
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "pending")}
                        >
                          Set pending
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Team Awards
            <span className="text-xs font-normal text-slate-400 ml-2">
              ({selectedCeremonyLabel})
            </span>
          </h2>
          <span className="text-xs text-slate-300">
            {teamAwards.length} awards
          </span>
        </div>

        <div className="space-y-3">
          {loading && teamAwards.length === 0 ? (
            <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
              Loading awards…
            </div>
          ) : null}

          {!loading && teamAwards.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
              No team awards for this ceremony.
            </div>
          ) : null}

          {teamAwards.map((award) => {
            const colorHex =
              DEFAULT_COLOR_MAP[award.categoryColor] ?? DEFAULT_COLOR_MAP.gray;

            return (
              <article
                key={`team-${award.id}`}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
              >
                <div className="flex flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: colorHex }}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {award.categoryName} · {award.type ?? "—"}
                    </p>
                    <p className="text-sm text-slate-300">{award.nominee}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex min-w-[72px] justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                      award.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "bg-amber-500/20 text-amber-200"
                    }`}
                  >
                    {award.status}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => toggleStatusMenu(award.id)}
                      disabled={statusUpdate?.id === award.id}
                    >
                      {statusUpdate?.id === award.id ? "Updating…" : "Update status"}
                    </button>
                    {statusMenuId === award.id ? (
                      <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg bg-slate-900 p-1 text-left shadow-lg ring-1 ring-white/10">
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "approved")}
                        >
                          Set approved
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "pending")}
                        >
                          Set pending
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleStatusChange(award.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AwardFormDialog
        open={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={refreshSummary}
        ceremonies={ceremonies}
        categories={categories}
        teams={teams}
        participants={participants}
        initialCeremonyId={selectedCeremonyId === 0 ? null : selectedCeremonyId}
        initialType={dialogConfig.type}
        initialTeamId={dialogConfig.teamId}
        initialParticipantId={dialogConfig.participantId}
      />
    </div>
  );
}

