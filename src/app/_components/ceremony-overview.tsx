'use client';

import Link from "next/link";
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

interface CeremonyOverviewProps {
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

export function CeremonyOverview({
  ceremonies,
  initialSummary,
  categories,
  participants,
  teams,
}: CeremonyOverviewProps) {
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
      } catch (confirmError) {
        console.error(confirmError);
        setError("Unable to update award right now. Please try again.");
      } finally {
        setStatusUpdate(null);
      }
    },
    [refreshSummary],
  );

  const toggleStatusMenu = useCallback((awardId: number) => {
    setStatusMenuId((current) => (current === awardId ? null : awardId));
  }, []);

  const selectedCeremonyLabel =
    ceremonyOptions.find((option) => option.id === selectedCeremonyId)
      ?.label ?? "This ceremony";

  const metricCards = [
    {
      label: "Pending approvals",
      value: summary.metrics.pending,
      accent: "bg-amber-100 text-amber-800",
    },
    {
      label: "Awards approved",
      value: summary.metrics.approved,
      accent: "bg-emerald-100 text-emerald-800",
    },
    {
      label: "Individuals awarded",
      value: summary.metrics.individualsAwarded,
      accent: "bg-sky-100 text-sky-800",
    },
    {
      label: "Teams awarded",
      value: summary.metrics.teamsAwarded,
      accent: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-10 bg-slate-900 pb-4 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Ceremony overview
            </h1>
            <Link
              href="/participants"
              className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Participant dashboard
            </Link>
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Latest confirmed awards{" "}
            <span className="text-xs font-normal text-slate-400">
              ({selectedCeremonyLabel})
            </span>
          </h2>
        </div>

        <div className="space-y-3">
          {loading && summary.latestApproved.length === 0 ? (
            <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
              Loading awards…
            </div>
          ) : null}

          {!loading && summary.latestApproved.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
              No approved awards yet for this ceremony.
            </div>
          ) : null}

          {summary.latestApproved.map((award) => {
            const colorHex =
              DEFAULT_COLOR_MAP[award.categoryColor] ?? DEFAULT_COLOR_MAP.gray;

            return (
              <article
                key={`approved-${award.id}`}
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
                  <span className="inline-flex min-w-[72px] justify-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                    approved
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
            Pending nominations{" "}
            <span className="text-xs font-normal text-slate-400">
              ({selectedCeremonyLabel})
            </span>
          </h2>
        </div>

        <div className="space-y-3">
          {loading && summary.latestPending.length === 0 ? (
            <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
              Loading nominations…
            </div>
          ) : null}

          {!loading && summary.latestPending.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-200">
              No pending nominations for this ceremony.
            </div>
          ) : null}

          {summary.latestPending.map((award) => {
            const colorHex =
              DEFAULT_COLOR_MAP[award.categoryColor] ?? DEFAULT_COLOR_MAP.gray;

            return (
              <article
                key={`pending-${award.id}`}
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
                  <span className="inline-flex min-w-[72px] justify-center rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                    pending
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
          <h2 className="text-lg font-semibold text-white">Award colors</h2>
        </div>

        <div className="rounded-xl bg-slate-800 p-4 shadow-sm ring-1 ring-white/5">
          {summary.colorBreakdown.length === 0 ? (
            <p className="text-sm text-slate-300">
              No approved awards yet for this ceremony.
            </p>
          ) : (
            <ul className="space-y-3">
              {summary.colorBreakdown.map((entry) => {
                const colorHex =
                  DEFAULT_COLOR_MAP[entry.color] ?? DEFAULT_COLOR_MAP.gray;
                return (
                  <li key={entry.color} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorHex }}
                    />
                    <span className="text-sm text-slate-200">
                      {entry.color.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-white">
                      {loading ? "…" : entry.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <footer className="pb-12">
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-slate-100"
          onClick={() =>
            openDialog({
              type: null,
            })
          }
        >
          + New award
        </button>
      </footer>

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

