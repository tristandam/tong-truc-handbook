import "server-only";

import { env } from "~/env";

type DirectusListResponse<T> = {
  data: T;
};

type DirectusSingleResponse<T> = {
  data: T;
};

const DIRECTUS_URL = env.DIRECTUS_URL ?? process.env.DIRECTUS_URL;
const DIRECTUS_STATIC_TOKEN =
  env.DIRECTUS_STATIC_TOKEN ?? process.env.DIRECTUS_STATIC_TOKEN;

function getDirectusBaseUrl() {
  if (!DIRECTUS_URL) {
    throw new Error(
      "DIRECTUS_URL is not defined. Please set it in your environment variables.",
    );
  }

  return DIRECTUS_URL.replace(/\/$/, "");
}

function getDirectusHeaders(): HeadersInit {
  if (!DIRECTUS_STATIC_TOKEN) {
    throw new Error(
      "DIRECTUS_STATIC_TOKEN is not defined. Please set it in your environment variables.",
    );
  }

  return {
    Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function directusFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getDirectusBaseUrl();
  const response = await fetch(`${baseUrl}/${path}`, {
    ...init,
    headers: {
      ...getDirectusHeaders(),
      ...(init?.headers ?? {}),
    },
    // Always revalidate on demand; award data changes frequently during the event.
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Directus request failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export type CeremonyRecord = {
  id: number;
  name: string;
  order: number | null;
  notes?: string | null;
};

export async function getCeremonies(): Promise<CeremonyRecord[]> {
  const searchParams = new URLSearchParams({
    sort: "order",
  });

  const response = await directusFetch<DirectusListResponse<CeremonyRecord[]>>(
    `items/award_ceremonies?${searchParams.toString()}`,
  );

  return response.data ?? [];
}

type DirectusUser = {
  first_name?: string | null;
  last_name?: string | null;
};

type DirectusParticipant = {
  id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
};

type DirectusTeam = {
  id?: number | null;
  name?: string | null;
};

export type DirectusAwardRecord = {
  id: number;
  status: "pending" | "approved" | "rejected";
  type: "individual" | "team" | "overall" | null;
  submitted_at: string | null;
  approved_at: string | null;
  category: {
    name?: string | null;
    color?: string | null;
  } | null;
  participant_nominee: DirectusParticipant | null;
  team_nominee: DirectusTeam | null;
  submitted_by: DirectusUser | null;
  ceremony?: number | null;
};

export type AwardCategoryRecord = {
  id: number;
  name: string;
  color: string | null;
  type: Array<"individual" | "team" | "overall"> | null;
  description?: string | null;
};

export async function getAwardsByCeremony(
  ceremonyId?: number | null,
): Promise<DirectusAwardRecord[]> {
  const params = new URLSearchParams({
    fields: [
      "id",
      "status",
      "type",
      "submitted_at",
      "approved_at",
      "category.name",
      "category.color",
      "participant_nominee.id",
      "participant_nominee.first_name",
      "participant_nominee.last_name",
      "team_nominee.id",
      "team_nominee.name",
      "submitted_by.first_name",
      "submitted_by.last_name",
      "ceremony",
    ].join(","),
    sort: "-submitted_at",
    limit: "-1",
  });

  if (ceremonyId) {
    params.set("filter[ceremony][_eq]", String(ceremonyId));
  }

  const response = await directusFetch<
    DirectusListResponse<DirectusAwardRecord[]>
  >(`items/awards?${params.toString()}`);

  return response.data ?? [];
}

export async function getAwardCategories(): Promise<AwardCategoryRecord[]> {
  const params = new URLSearchParams({
    fields: ["id", "name", "color", "type", "description"].join(","),
    sort: "name",
    limit: "-1",
  });

  const response = await directusFetch<
    DirectusListResponse<AwardCategoryRecord[]>
  >(`items/award_categories?${params.toString()}`);

  return (
    response.data?.map((category) => ({
      ...category,
      type: category.type ?? [],
    })) ?? []
  );
}

export async function updateAwardStatus(
  awardId: number,
  status: "pending" | "approved" | "rejected",
): Promise<DirectusAwardRecord> {
  const payload: Record<string, unknown> = {
    status,
  };

  if (status === "approved") {
    payload.approved_at = new Date().toISOString();
  } else {
    payload.approved_at = null;
  }

  const response = await directusFetch<
    DirectusSingleResponse<DirectusAwardRecord>
  >(`items/awards/${awardId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function approveAward(
  awardId: number,
): Promise<DirectusAwardRecord> {
  return updateAwardStatus(awardId, "approved");
}

export function formatPersonName(person?: {
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  if (!person) {
    return "";
  }

  const parts = [person.first_name, person.last_name].filter(
    (part) => part && part.trim().length > 0,
  );

  return parts.join(" ");
}

export type CeremonySummary = {
  metrics: {
    pending: number;
    approved: number;
    individualsAwarded: number;
    teamsAwarded: number;
  };
  latestApproved: Array<{
    id: number;
    categoryName: string;
    categoryColor: string;
    status: DirectusAwardRecord["status"];
    type: DirectusAwardRecord["type"];
    nominee: string;
    submittedAt: string | null;
    submittedBy: string;
    ceremonyId: number | null;
  }>;
  latestPending: Array<{
    id: number;
    categoryName: string;
    categoryColor: string;
    type: DirectusAwardRecord["type"];
    nominee: string;
    submittedAt: string | null;
    submittedBy: string;
    ceremonyId: number | null;
  }>;
  colorBreakdown: Array<{
    color: string;
    count: number;
  }>;
};

function getNomineeLabel(award: DirectusAwardRecord): string {
  if (award.type === "individual" && award.participant_nominee) {
    const name = formatPersonName(award.participant_nominee);
    return name || "Individual nominee";
  }

  if (award.team_nominee?.name) {
    return award.team_nominee.name;
  }

  return "Nominee TBD";
}

export function buildCeremonySummary(
  awards: DirectusAwardRecord[],
): CeremonySummary {
  const approvedAwards = awards.filter((award) => award.status === "approved");
  const pendingCount = awards.filter((award) => award.status === "pending")
    .length;
  const approvedCount = approvedAwards.length;

  const latestApproved = [...approvedAwards]
    .sort((a, b) => {
      const dateA = Date.parse(a.approved_at ?? a.submitted_at ?? "") || 0;
      const dateB = Date.parse(b.approved_at ?? b.submitted_at ?? "") || 0;
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((award) => ({
      id: award.id,
      categoryName: award.category?.name ?? "Unknown category",
      categoryColor: award.category?.color ?? "gray",
      status: award.status,
      type: award.type,
      nominee: getNomineeLabel(award),
      submittedAt: award.approved_at ?? award.submitted_at ?? null,
      submittedBy: formatPersonName(award.submitted_by) || "Unknown referee",
      ceremonyId: award.ceremony ?? null,
    }));

  const pendingAwards = awards.filter((award) => award.status === "pending");
  const latestPending = pendingAwards
    .sort((a, b) => {
      const dateA = Date.parse(a.submitted_at ?? "") || 0;
      const dateB = Date.parse(b.submitted_at ?? "") || 0;
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((award) => ({
      id: award.id,
      categoryName: award.category?.name ?? "Unknown category",
      categoryColor: award.category?.color ?? "gray",
      type: award.type,
      nominee: getNomineeLabel(award),
      submittedAt: award.submitted_at ?? null,
      submittedBy: formatPersonName(award.submitted_by) || "Unknown referee",
      ceremonyId: award.ceremony ?? null,
    }));

  const uniqueParticipants = new Set(
    approvedAwards
      .filter((award) => award.type === "individual")
      .map((award) => formatPersonName(award.participant_nominee))
      .filter((name) => name.length > 0),
  );

  const uniqueTeams = new Set(
    approvedAwards
      .filter((award) => award.team_nominee?.name)
      .map((award) => award.team_nominee?.name ?? "")
      .filter((name) => name.length > 0),
  );

  const colorMap = new Map<string, number>();
  for (const award of approvedAwards) {
    const color = award.category?.color ?? "gray";
    colorMap.set(color, (colorMap.get(color) ?? 0) + 1);
  }

  return {
    metrics: {
      pending: pendingCount,
      approved: approvedCount,
      individualsAwarded: uniqueParticipants.size,
      teamsAwarded: uniqueTeams.size,
    },
    latestApproved,
    latestPending,
    colorBreakdown: Array.from(colorMap.entries()).map(([color, count]) => ({
      color,
      count,
    })),
  };
}

export type ParticipantRecord = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  team?: {
    id: number | null;
    name?: string | null;
  } | null;
  nganh?: string | null;
};

export async function getParticipants(): Promise<ParticipantRecord[]> {
  const params = new URLSearchParams({
    fields: [
      "id",
      "first_name",
      "last_name",
      "team.id",
      "team.name",
      "nganh",
    ].join(","),
    limit: "-1",
  });

  const response = await directusFetch<DirectusListResponse<ParticipantRecord[]>>(
    `items/participants?${params.toString()}`,
  );

  return response.data ?? [];
}

export type TeamRecord = {
  id: number;
  name?: string | null;
};

export async function getTeams(): Promise<TeamRecord[]> {
  const params = new URLSearchParams({
    fields: ["id", "name"].join(","),
    limit: "-1",
  });

  const response = await directusFetch<DirectusListResponse<TeamRecord[]>>(
    `items/teams?${params.toString()}`,
  );

  return response.data ?? [];
}

export type ParticipantStat = {
  id: number;
  name: string;
  teamName: string;
  nganh: string | null;
  awardCount: number;
  colorBreakdown: Array<{ color: string; count: number }>;
};

export type TeamAwardDetail = {
  id: number;
  kind: "team" | "participant";
  categoryName: string;
  categoryColor: string;
  type: DirectusAwardRecord["type"];
  nominee: string;
  submittedAt: string | null;
};

export type TeamStat = {
  id: number;
  name: string;
  awardCount: number;
  participantsRecognized: number;
  colorBreakdown: Array<{ color: string; count: number }>;
  teamAwards: TeamAwardDetail[];
  individualAwards: TeamAwardDetail[];
};

export type PendingAwardEntry = {
  id: number;
  categoryName: string;
  categoryColor: string;
  type: DirectusAwardRecord["type"];
  nominee: string;
  submittedAt: string | null;
  ceremonyId: number | null;
};

export type ParticipantTeamSummary = {
  metrics: {
    totalApprovedAwards: number;
    participantsAwarded: number;
    participantsAwaitingRecognition: number;
    teamsAwarded: number;
    teamsAwaitingRecognition: number;
  };
  participantLeaderboard: ParticipantStat[];
  participantsPendingRecognition: ParticipantStat[];
  teamLeaderboard: TeamStat[];
  teams: TeamStat[];
  teamsPendingRecognition: TeamStat[];
  pendingAwards: PendingAwardEntry[];
};

type ParticipantAccumulator = {
  record: ParticipantRecord | undefined;
  total: number;
  colors: Map<string, number>;
};

type TeamAccumulator = {
  record: TeamRecord | undefined;
  teamAwardCount: number;
  colors: Map<string, number>;
  participantsRecognized: Set<number>;
  teamAwards: TeamAwardDetail[];
  individualAwards: TeamAwardDetail[];
};

function toParticipantStat(
  id: number,
  entry: ParticipantAccumulator,
): ParticipantStat {
  const record = entry.record;
  const name =
    formatPersonName({
      first_name: record?.first_name,
      last_name: record?.last_name,
    }) || "Unknown participant";

  return {
    id,
    name,
    teamName: record?.team?.name ?? "Unassigned",
    nganh: record?.nganh ?? null,
    awardCount: entry.total,
    colorBreakdown: Array.from(entry.colors.entries()).map(([color, count]) => ({
      color,
      count,
    })),
  };
}

function toTeamStat(id: number, entry: TeamAccumulator): TeamStat {
  return {
    id,
    name: entry.record?.name ?? "Unknown team",
    awardCount: entry.teamAwardCount,
    participantsRecognized: entry.participantsRecognized.size,
    colorBreakdown: Array.from(entry.colors.entries()).map(([color, count]) => ({
      color,
      count,
    })),
    teamAwards: [...entry.teamAwards],
    individualAwards: [...entry.individualAwards],
  };
}

export function buildParticipantTeamSummary(
  awards: DirectusAwardRecord[],
  participants: ParticipantRecord[],
  teams: TeamRecord[],
): ParticipantTeamSummary {
  const participantMap = new Map<number, ParticipantAccumulator>();
  for (const participant of participants) {
    participantMap.set(participant.id, {
      record: participant,
      total: 0,
      colors: new Map(),
    });
  }

  const teamMap = new Map<number, TeamAccumulator>();
  for (const team of teams) {
    teamMap.set(team.id, {
      record: team,
      teamAwardCount: 0,
      colors: new Map(),
      participantsRecognized: new Set(),
      teamAwards: [],
      individualAwards: [],
    });
  }

  const approvedAwards = awards.filter((award) => award.status === "approved");
  const pendingAwards = awards
    .filter((award) => award.status === "pending")
    .map((award) => ({
      id: award.id,
      categoryName: award.category?.name ?? "Unknown category",
      categoryColor: award.category?.color ?? "gray",
      type: award.type,
      nominee:
        award.type === "individual"
          ? formatPersonName(award.participant_nominee) || "Individual nominee"
          : award.team_nominee?.name ?? "Team nominee",
      submittedAt: award.submitted_at ?? null,
      ceremonyId: award.ceremony ?? null,
    }))
    .sort((a, b) => {
      const dateA = Date.parse(a.submittedAt ?? "") || 0;
      const dateB = Date.parse(b.submittedAt ?? "") || 0;
      return dateB - dateA;
    });

  for (const award of approvedAwards) {
    const color = award.category?.color ?? "gray";

    if (award.type === "individual" && award.participant_nominee?.id) {
      const participantEntry = participantMap.get(award.participant_nominee.id);
      if (participantEntry) {
        participantEntry.total += 1;
        participantEntry.colors.set(
          color,
          (participantEntry.colors.get(color) ?? 0) + 1,
        );
      } else {
        participantMap.set(award.participant_nominee.id, {
          record: undefined,
          total: 1,
          colors: new Map([[color, 1]]),
        });
      }

      const participantRecord =
        participantEntry?.record ??
        participants.find((p) => p.id === award.participant_nominee?.id);
      const teamId = participantRecord?.team?.id;
      if (teamId) {
        const teamEntry = teamMap.get(teamId);
        if (teamEntry) {
          teamEntry.participantsRecognized.add(award.participant_nominee.id);
          teamEntry.individualAwards.push({
            id: award.id,
            kind: "participant",
            categoryName: award.category?.name ?? "Unknown category",
            categoryColor: color,
            type: award.type,
            nominee:
              formatPersonName(award.participant_nominee) ||
              "Individual nominee",
            submittedAt: award.submitted_at ?? award.approved_at ?? null,
          });
        } else {
          teamMap.set(teamId, {
            record: teams.find((team) => team.id === teamId),
            teamAwardCount: 0,
            colors: new Map(),
            participantsRecognized: new Set([award.participant_nominee.id]),
            teamAwards: [],
            individualAwards: [
              {
                id: award.id,
                kind: "participant",
                categoryName: award.category?.name ?? "Unknown category",
                categoryColor: color,
                type: award.type,
                nominee:
                  formatPersonName(award.participant_nominee) ||
                  "Individual nominee",
                submittedAt: award.submitted_at ?? award.approved_at ?? null,
              },
            ],
          });
        }
      }
    } else if (award.team_nominee?.id) {
      const teamEntry = teamMap.get(award.team_nominee.id);
      if (teamEntry) {
        teamEntry.teamAwardCount += 1;
        teamEntry.colors.set(color, (teamEntry.colors.get(color) ?? 0) + 1);
        teamEntry.teamAwards.push({
          id: award.id,
          kind: "team",
          categoryName: award.category?.name ?? "Unknown category",
          categoryColor: color,
          type: award.type,
          nominee: award.team_nominee.name ?? "Team nominee",
          submittedAt: award.submitted_at ?? award.approved_at ?? null,
        });
      } else {
        teamMap.set(award.team_nominee.id, {
          record: teams.find((team) => team.id === award.team_nominee?.id),
          teamAwardCount: 1,
          colors: new Map([[color, 1]]),
          participantsRecognized: new Set(),
          teamAwards: [
            {
              id: award.id,
              kind: "team",
              categoryName: award.category?.name ?? "Unknown category",
              categoryColor: color,
              type: award.type,
              nominee: award.team_nominee.name ?? "Team nominee",
              submittedAt: award.submitted_at ?? award.approved_at ?? null,
            },
          ],
          individualAwards: [],
        });
      }
    }
  }

  const participantAwardedAll = Array.from(participantMap.entries())
    .filter(([, entry]) => entry.total > 0)
    .map(([id, entry]) => toParticipantStat(id, entry))
    .sort((a, b) => b.awardCount - a.awardCount);

  const participantPendingAll = Array.from(participantMap.entries())
    .filter(([, entry]) => entry.total === 0)
    .map(([id, entry]) => toParticipantStat(id, entry))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  const teamAwardedAll = Array.from(teamMap.entries())
    .filter(([, entry]) => entry.teamAwardCount > 0)
    .map(([id, entry]) => {
      const stat = toTeamStat(id, entry);
      stat.teamAwards = [...entry.teamAwards].sort((a, b) => {
        const dateA = Date.parse(a.submittedAt ?? "") || 0;
        const dateB = Date.parse(b.submittedAt ?? "") || 0;
        return dateB - dateA;
      });
      stat.individualAwards = [...entry.individualAwards];
      return stat;
    })
    .sort((a, b) => b.awardCount - a.awardCount);

  const teamPendingAll = Array.from(teamMap.entries())
    .filter(([, entry]) => entry.teamAwardCount === 0)
    .map(([id, entry]) => toTeamStat(id, entry))
    .sort((a, b) => a.name.localeCompare(b.name));

  const participantLeaderboard = participantAwardedAll.slice(0, 10);
  const participantsPendingRecognition = participantPendingAll.slice(0, 10);
  const teamLeaderboard = teamAwardedAll.slice(0, 10);
  const teamsPendingRecognition = teamPendingAll.slice(0, 10);

  return {
    metrics: {
      totalApprovedAwards: approvedAwards.length,
      participantsAwarded: participantAwardedAll.length,
      participantsAwaitingRecognition: participantPendingAll.length,
      teamsAwarded: teamAwardedAll.length,
      teamsAwaitingRecognition: teamPendingAll.length,
    },
    participantLeaderboard,
    participantsPendingRecognition,
    teamLeaderboard,
    teams: teamAwardedAll,
    teamsPendingRecognition,
    pendingAwards,
  };
}

export type CreateAwardInput = {
  category: number;
  ceremony: number;
  type: "individual" | "team" | "overall";
  participant_nominee?: number | null;
  team_nominee?: number | null;
  notes?: string | null;
  status?: "pending" | "approved" | "rejected";
};

export async function createAward(
  input: CreateAwardInput,
): Promise<DirectusAwardRecord> {
  const payload: Record<string, unknown> = {
    category: input.category,
    ceremony: input.ceremony,
    type: input.type,
    participant_nominee: input.participant_nominee ?? null,
    team_nominee: input.team_nominee ?? null,
    status: input.status ?? "pending",
    submitted_at: new Date().toISOString(),
  };

  if (input.notes && input.notes.trim().length > 0) {
    payload.notes = input.notes;
  }

  const response = await directusFetch<
    DirectusSingleResponse<DirectusAwardRecord>
  >("items/awards", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

