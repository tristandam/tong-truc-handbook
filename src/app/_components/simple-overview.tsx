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
import { AwardsModal } from "./awards-modal";

type CeremonyOption = CeremonyRecord & { label: string };

interface SimpleOverviewProps {
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

export function SimpleOverview({
  ceremonies,
  initialSummary,
  categories,
  participants,
  teams,
}: SimpleOverviewProps) {
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
  const [dialogConfig, setDialogConfig] = useState<{
    type: "individual" | "team" | "overall" | null;
    teamId: number | null;
    participantId: number | null;
  }>({
    type: null,
    teamId: null,
    participantId: null,
  });
  const [participantSearch, setParticipantSearch] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const [awardFilter, setAwardFilter] = useState<"all" | "with" | "without">("all");
  const [awardsModal, setAwardsModal] = useState<{
    open: boolean;
    type: "participant" | "team";
    id: number;
    name: string;
  }>({
    open: false,
    type: "participant",
    id: 0,
    name: "",
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

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

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

  const selectedCeremonyLabel =
    ceremonyOptions.find((option) => option.id === selectedCeremonyId)
      ?.label ?? "This ceremony";

  // Filter teams and participants by ceremony if selected
  const filteredTeams = useMemo(() => {
    if (selectedCeremonyId === 0) {
      return summary.teams;
    }
    // Filter teams that have awards for the selected ceremony
    // Since we don't have ceremony info in TeamStat, we'll show all teams
    // but the award counts will reflect the filtered ceremony
    return summary.teams;
  }, [summary.teams, selectedCeremonyId]);

  // Get all unique participants and teams with their award counts
  const allParticipants = useMemo(() => {
    const participantMap = new Map<number, ParticipantRecord & { awardCount: number }>();
    
    // Add participants from leaderboard
    for (const stat of summary.participantLeaderboard) {
      const participant = participantLookup.get(stat.id);
      if (participant) {
        participantMap.set(stat.id, { ...participant, awardCount: stat.awardCount });
      }
    }
    
    // Add participants pending recognition (with 0 awards)
    for (const stat of summary.participantsPendingRecognition) {
      if (!participantMap.has(stat.id)) {
        const participant = participantLookup.get(stat.id);
        if (participant) {
          participantMap.set(stat.id, { ...participant, awardCount: 0 });
        }
      }
    }
    
    // Add any remaining participants from the full list
    for (const participant of participants) {
      if (!participantMap.has(participant.id)) {
        participantMap.set(participant.id, { ...participant, awardCount: 0 });
      }
    }
    
    return Array.from(participantMap.values()).sort((a, b) => {
      // Sort by award count descending, then by name
      if (b.awardCount !== a.awardCount) {
        return b.awardCount - a.awardCount;
      }
      const nameA = `${a.first_name} ${a.last_name}`.trim();
      const nameB = `${b.first_name} ${b.last_name}`.trim();
      return nameA.localeCompare(nameB);
    });
  }, [summary.participantLeaderboard, summary.participantsPendingRecognition, participants, participantLookup]);

  // Filter participants based on search, team, and award filters
  const filteredParticipants = useMemo(() => {
    let filtered = allParticipants;

    // Filter by search query
    if (participantSearch.trim()) {
      const searchLower = participantSearch.toLowerCase();
      filtered = filtered.filter((p) => {
        const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.toLowerCase();
        const team = p.team?.name?.toLowerCase() ?? '';
        const nganh = p.nganh?.toLowerCase() ?? '';
        return name.includes(searchLower) || team.includes(searchLower) || nganh.includes(searchLower);
      });
    }

    // Filter by team
    if (teamFilter !== null) {
      filtered = filtered.filter((p) => p.team?.id === teamFilter);
    }

    // Filter by award count
    if (awardFilter === "with") {
      filtered = filtered.filter((p) => p.awardCount > 0);
    } else if (awardFilter === "without") {
      filtered = filtered.filter((p) => p.awardCount === 0);
    }

    return filtered;
  }, [allParticipants, participantSearch, teamFilter, awardFilter]);

  const allTeams = useMemo(() => {
    const teamMap = new Map<number, TeamRecord & { awardCount: number }>();
    
    // Add teams from summary
    for (const stat of summary.teams) {
      const team = teams.find(t => t.id === stat.id);
      if (team) {
        teamMap.set(stat.id, { ...team, awardCount: stat.awardCount });
      }
    }
    
    // Add teams pending recognition
    for (const stat of summary.teamsPendingRecognition) {
      if (!teamMap.has(stat.id)) {
        const team = teams.find(t => t.id === stat.id);
        if (team) {
          teamMap.set(stat.id, { ...team, awardCount: 0 });
        }
      }
    }
    
    // Add any remaining teams
    for (const team of teams) {
      if (!teamMap.has(team.id)) {
        teamMap.set(team.id, { ...team, awardCount: 0 });
      }
    }
    
    return Array.from(teamMap.values()).sort((a, b) => {
      // Sort by award count descending, then by name
      if (b.awardCount !== a.awardCount) {
        return b.awardCount - a.awardCount;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [summary.teams, summary.teamsPendingRecognition, teams]);

  return (
    <div className="space-y-6">
      <header className="sticky top-[57px] z-10 bg-slate-900 pb-4 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Overview
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
            Teams
            <span className="text-xs font-normal text-slate-400 ml-2">
              ({selectedCeremonyLabel})
            </span>
          </h2>
          <span className="text-xs text-slate-300">
            {allTeams.length} teams
          </span>
        </div>

        {loading && allTeams.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
            Loading teams…
          </div>
        ) : allTeams.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
            No teams found.
          </div>
        ) : (
          <div className="space-y-2">
            {allTeams.map((team) => {
              return (
                <article
                  key={team.id}
                  className="flex items-center justify-between rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setAwardsModal({
                            open: true,
                            type: "team",
                            id: team.id,
                            name: team.name ?? "Unknown Team",
                          })
                        }
                        className="text-left text-sm font-semibold text-white transition hover:text-slate-300"
                      >
                        {team.name}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {team.awardCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAwardsModal({
                            open: true,
                            type: "team",
                            id: team.id,
                            name: team.name ?? "Unknown Team",
                          })
                        }
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                      >
                        {team.awardCount} {team.awardCount === 1 ? 'award' : 'awards'}
                      </button>
                    )}
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
                      Nominate
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Participants
            <span className="text-xs font-normal text-slate-400 ml-2">
              ({selectedCeremonyLabel})
            </span>
          </h2>
          <span className="text-xs text-slate-300">
            Showing {filteredParticipants.length} of {allParticipants.length} participants
          </span>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, team, or ngành..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={teamFilter ?? ""}
              onChange={(e) => setTeamFilter(e.target.value ? Number.parseInt(e.target.value, 10) : null)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              value={awardFilter}
              onChange={(e) => setAwardFilter(e.target.value as "all" | "with" | "without")}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all">All Participants</option>
              <option value="with">With Awards</option>
              <option value="without">Without Awards</option>
            </select>
          </div>
        </div>

        {loading && filteredParticipants.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
            Loading participants…
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
            No participants found matching your filters.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredParticipants.map((participant) => {
              const participantTeamId = participant.team?.id ?? null;
              const participantName = `${participant.first_name ?? ''} ${participant.last_name ?? ''}`.trim() || 'Unknown';
              
              return (
                <article
                  key={participant.id}
                  className="flex items-center justify-between rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setAwardsModal({
                            open: true,
                            type: "participant",
                            id: participant.id,
                            name: participantName,
                          })
                        }
                        className="text-left text-sm font-semibold text-white transition hover:text-slate-300"
                      >
                        {participantName}
                      </button>
                      <p className="text-xs text-slate-300">
                        {participant.team?.name ?? 'Unassigned'} · {participant.nganh ?? 'Ngành ?'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {participant.awardCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAwardsModal({
                            open: true,
                            type: "participant",
                            id: participant.id,
                            name: participantName,
                          })
                        }
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                      >
                        {participant.awardCount} {participant.awardCount === 1 ? 'award' : 'awards'}
                      </button>
                    )}
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
                      Nominate
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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

      <AwardsModal
        open={awardsModal.open}
        onClose={() => setAwardsModal({ ...awardsModal, open: false })}
        type={awardsModal.type}
        id={awardsModal.id}
        name={awardsModal.name}
      />
    </div>
  );
}

