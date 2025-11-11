'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AwardCategoryRecord,
  CeremonyRecord,
  ParticipantTeamSummary,
  ParticipantRecord,
  TeamRecord,
} from "~/lib/directus";

import { AwardFormDialog } from "./award-form-dialog";

type CeremonyOption = CeremonyRecord & { label: string };

interface ParticipantTeamOverviewProps {
  ceremonies: CeremonyRecord[];
  initialSummary: ParticipantTeamSummary;
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

export function ParticipantTeamOverview({
  ceremonies,
  initialSummary,
  categories,
  participants,
  teams,
}: ParticipantTeamOverviewProps) {
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

  const ceremonyLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const option of ceremonyOptions) {
      map.set(option.id, option.label);
    }
    return map;
  }, [ceremonyOptions]);

  const participantLookup = useMemo(() => {
    const map = new Map<number, ParticipantRecord>();
    for (const participant of participants) {
      map.set(participant.id, participant);
    }
    return map;
  }, [participants]);

  const [selectedCeremonyId, setSelectedCeremonyId] = useState<number>(0);
  const [summary, setSummary] = useState<ParticipantTeamSummary>(initialSummary);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<{
    id: number;
    status: "approved" | "pending" | "rejected";
  } | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{
    type: "individual" | "team" | "overall" | null;
    teamId: number | null;
    participantId: number | null;
  }>({
    type: null,
    teamId: null,
    participantId: null,
  });

  const refreshSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(
        "/api/overview/participants",
        window.location.origin,
      );
      if (selectedCeremonyId !== 0) {
        url.searchParams.set("ceremonyId", String(selectedCeremonyId));
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to load participant/team summary.");
      }

      const data = (await response.json()) as ParticipantTeamSummary;
      setSummary(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load participant/team stats right now.");
    } finally {
      setLoading(false);
    }
  }, [selectedCeremonyId]);

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
          throw new Error("Failed to update award status.");
        }

        await refreshSummary();
      } catch (confirmError) {
        console.error(confirmError);
        setError("Unable to confirm award right now. Please try again.");
      } finally {
        setStatusUpdate(null);
      }
    },
    [refreshSummary],
  );

  const toggleStatusMenu = useCallback((awardId: number) => {
    setStatusMenuId((current) => (current === awardId ? null : awardId));
  }, []);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  const selectedCeremonyLabel =
    ceremonyOptions.find((option) => option.id === selectedCeremonyId)
      ?.label ?? "This ceremony";

  const metricCards = [
    {
      label: "Approved awards",
      value: summary.metrics.totalApprovedAwards,
      accent: "bg-emerald-100 text-emerald-800",
    },
    {
      label: "Participants awarded",
      value: summary.metrics.participantsAwarded,
      accent: "bg-sky-100 text-sky-800",
    },
    {
      label: "Individual Awards - Waiting for Confirmation",
      value: summary.metrics.participantsAwaitingRecognition,
      accent: "bg-amber-100 text-amber-800",
    },
    {
      label: "Team Awards Awarded",
      value: summary.metrics.teamsAwarded,
      accent: "bg-rose-100 text-rose-800",
    },
    {
      label: "Team Awards - Waiting for Confirmation",
      value: summary.metrics.teamsAwaitingRecognition,
      accent: "bg-purple-100 text-purple-800",
    },
  ];

  const teamsWithTeamAwards = summary.teams.filter(
    (team) => team.teamAwards.length > 0,
  );

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

  return (
    <div className="space-y-6">
      <header className="sticky top-[57px] z-10 bg-slate-900 pb-4 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Participants
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metricCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
          >
            <p className="text-sm font-medium text-slate-200">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {loading ? "…" : card.value}
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.accent}`}
            >
              {selectedCeremonyLabel}
            </span>
          </article>
        ))}
      </section>

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
            Awards awaiting confirmation
          </h2>
          <span className="text-xs text-slate-300">
            {summary.pendingAwards.length} pending
          </span>
        </div>

        {summary.pendingAwards.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
            No pending nominations right now.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.pendingAwards.map((award) => {
              const colorHex =
                DEFAULT_COLOR_MAP[award.categoryColor] ?? DEFAULT_COLOR_MAP.gray;
              return (
                <div
                  key={`pending-${award.id}`}
                  className="flex items-center justify-between rounded-xl bg-slate-800 p-3 shadow-sm ring-1 ring-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorHex }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {award.categoryName} · {award.type ?? "—"}
                      </p>
                      <p className="text-xs text-slate-300">
                        {award.nominee} ·{" "}
                        {award.ceremonyId
                          ? ceremonyLabelMap.get(award.ceremonyId) ??
                            `Ceremony ${award.ceremonyId}`
                          : "Ceremony TBD"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      Pending
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => toggleStatusMenu(award.id)}
                        disabled={statusUpdate?.id === award.id}
                      >
                        {statusUpdate?.id === award.id
                          ? "Updating…"
                          : "Update status"}
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Team Awards</h2>
          <span className="text-xs text-slate-300">
            Showing {teamsWithTeamAwards.length} teams
          </span>
        </div>

        {teamsWithTeamAwards.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
            No team awards have been logged yet.
          </div>
        ) : (
          <div className="space-y-3">
            {teamsWithTeamAwards.map((team) => (
              <article
                key={team.id}
                className="space-y-3 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {team.name}
                    </p>
                    <p className="text-xs text-slate-300">
                      {team.participantsRecognized} participants recognized
                    </p>
                  </div>
                  <span className="text-2xl font-semibold text-white">
                    {team.awardCount}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    onClick={() =>
                      openDialog({
                        type: "team",
                        teamId: team.id,
                      })
                    }
                  >
                    Nominate Team Award
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    onClick={() =>
                      openDialog({
                        type: "individual",
                        teamId: team.id,
                      })
                    }
                  >
                    Nominate Individual Award
                  </button>
                </div>

                {team.colorBreakdown.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {team.colorBreakdown.map((entry) => {
                      const colorHex =
                        DEFAULT_COLOR_MAP[entry.color] ?? DEFAULT_COLOR_MAP.gray;
                      return (
                        <span
                          key={entry.color}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                          style={{ backgroundColor: `${colorHex}33` }}
                        >
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: colorHex }}
                          />
                          {entry.color.replace(/_/g, " ")} · {entry.count}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                <div className="space-y-2">
                  {team.teamAwards.length === 0 ? (
                    <div className="rounded-lg bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                      No team awards yet.
                    </div>
                  ) : (
                    team.teamAwards.map((award) => {
                      const colorHex =
                        DEFAULT_COLOR_MAP[award.categoryColor] ??
                        DEFAULT_COLOR_MAP.gray;
                      return (
                        <div
                          key={`${team.id}-${award.id}`}
                          className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: colorHex }}
                            />
                            <div>
                              <p className="font-medium">
                                {award.categoryName}
                              </p>
                              <p className="text-xs text-slate-300">
                                {team.name}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Team
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Individual Awards
          </h2>
          <span className="text-xs text-slate-300">
            Showing top {summary.participantLeaderboard.length} participants
          </span>
        </div>

        <div className="space-y-3">
          {summary.participantLeaderboard.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
              No participants have been recognized yet. 
            </div>
          ) : (
            summary.participantLeaderboard.map((participant) => {
              const participantTeamId =
                participantLookup.get(participant.id)?.team?.id ?? null;

              return (
                <article
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {participant.name}
                    </p>
                    <p className="text-xs text-slate-300">
                      {participant.teamName} · {participant.nganh ?? "Ngành ?"}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {participant.colorBreakdown.map((entry) => {
                        const colorHex =
                          DEFAULT_COLOR_MAP[entry.color] ??
                          DEFAULT_COLOR_MAP.gray;
                        return (
                          <span
                            key={entry.color}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                            style={{ backgroundColor: `${colorHex}33` }}
                          >
                            <span
                              aria-hidden
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: colorHex }}
                            />
                            {entry.color.replace(/_/g, " ")} · {entry.count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-2xl font-semibold text-white">
                      {participant.awardCount}
                    </span>
                    <button
                      type="button"
                      className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                      onClick={() =>
                        openDialog({
                          type: "individual",
                          participantId: participant.id,
                          teamId: participantTeamId,
                        })
                      }
                    >
                      Nominate Individual Award
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Participants to spotlight
          </h2>
          <span className="text-xs text-slate-300">
            Next 10 who haven&apos;t received awards yet
          </span>
        </div>

        <div className="space-y-2">
          {summary.participantsPendingRecognition.length === 0 ? (
            <div className="rounded-xl bg-slate-800/60 p-4 text-sm text-slate-200">
              Every participant has received recognition this round. Amazing!
            </div>
          ) : (
            summary.participantsPendingRecognition.map((participant) => (
              <article
                key={participant.id}
                className="flex items-center justify-between rounded-xl bg-slate-800 p-3 shadow-sm ring-1 ring-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {participant.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {participant.teamName} · {participant.nganh ?? "Ngành ?"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                  onClick={() =>
                    openDialog({
                      type: "individual",
                      participantId: participant.id,
                      teamId:
                        participantLookup.get(participant.id)?.team?.id ?? null,
                    })
                  }
                >
                  Nominate Individual Award
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Teams awaiting recognition
          </h2>
          <span className="text-xs text-slate-300">
            Next {summary.teamsPendingRecognition.length} teams
          </span>
        </div>

        <div className="space-y-2">
          {summary.teamsPendingRecognition.length === 0 ? (
            <div className="rounded-xl bg-slate-800/60 p-4 text-sm text-slate-200">
              Every team has received recognition for this ceremony.
            </div>
          ) : (
            summary.teamsPendingRecognition.map((team) => (
              <article
                key={team.id}
                className="flex items-center justify-between rounded-xl bg-slate-800 p-3 shadow-sm ring-1 ring-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-white">{team.name}</p>
                  <p className="text-xs text-slate-400">
                    {team.participantsRecognized} participants recognized
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                  onClick={() =>
                    openDialog({
                      type: "team",
                      teamId: team.id,
                    })
                  }
                >
                  Nominate Team Award
                </button>
              </article>
            ))
          )}
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

