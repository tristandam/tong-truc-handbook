'use client';

import { useEffect, useState } from "react";

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

type AwardDisplay = {
  id: number;
  categoryName: string;
  categoryColor: string;
  status: "approved" | "pending" | "rejected";
  type: "individual" | "team" | "overall" | null;
  submittedAt: string | null;
  ceremonyId: number | null;
  ceremonyName: string | null;
  ceremonyOrder: number;
};

interface AwardsModalProps {
  open: boolean;
  onClose: () => void;
  type: "participant" | "team";
  id: number;
  name: string;
}

export function AwardsModal({ open, onClose, type, id, name }: AwardsModalProps) {
  const [awards, setAwards] = useState<AwardDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !id) {
      setAwards([]);
      return;
    }

    const fetchAwards = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL("/api/awards/by-entity", window.location.origin);
        if (type === "participant") {
          url.searchParams.set("participantId", String(id));
        } else {
          url.searchParams.set("teamId", String(id));
        }

        const response = await fetch(url.toString());
        
        if (!response.ok) {
          throw new Error("Failed to fetch awards.");
        }

        const data = (await response.json()) as AwardDisplay[];
        setAwards(data);
      } catch (fetchError) {
        console.error(fetchError);
        setError("Unable to load awards right now.");
      } finally {
        setLoading(false);
      }
    };

    void fetchAwards();
  }, [open, id, type]);

  if (!open) return null;

  // Group awards by ceremony, sorted by ceremony order
  const awardsByCeremony = awards.reduce((acc, award) => {
    const ceremonyKey = award.ceremonyId ?? 0;
    const ceremonyName = award.ceremonyName 
      ? award.ceremonyName.replace(/_/g, " ")
      : "No Ceremony";
    const ceremonyOrder = award.ceremonyOrder ?? 999;

    acc[ceremonyKey] ??= {
      ceremonyId: ceremonyKey,
      ceremonyName,
      ceremonyOrder,
      approved: [],
      pending: [],
      rejected: [],
    };

    if (award.status === "approved") {
      acc[ceremonyKey].approved.push(award);
    } else if (award.status === "pending") {
      acc[ceremonyKey].pending.push(award);
    } else if (award.status === "rejected") {
      acc[ceremonyKey].rejected.push(award);
    }

    return acc;
  }, {} as Record<number, {
    ceremonyId: number;
    ceremonyName: string;
    ceremonyOrder: number;
    approved: AwardDisplay[];
    pending: AwardDisplay[];
    rejected: AwardDisplay[];
  }>);

  // Sort ceremonies by order (starting from 1)
  const sortedCeremonies = Object.values(awardsByCeremony).sort(
    (a, b) => a.ceremonyOrder - b.ceremonyOrder
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-slate-800 shadow-xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            {name}&apos;s Awards
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-slate-300">Loading awards…</div>
          ) : error ? (
            <div className="py-8 text-center text-red-300">{error}</div>
          ) : awards.length === 0 ? (
            <div className="py-8 text-center text-slate-300">
              No awards found for {name}.
            </div>
          ) : (
            <div className="space-y-6">
              {sortedCeremonies.map((ceremony) => {
                const totalAwards = ceremony.approved.length + ceremony.pending.length + ceremony.rejected.length;
                if (totalAwards === 0) return null;

                return (
                  <div key={ceremony.ceremonyId} className="space-y-4">
                    <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                      {ceremony.ceremonyName}
                    </h3>

                    {ceremony.approved.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Approved ({ceremony.approved.length})
                        </h4>
                        <div className="space-y-2">
                          {ceremony.approved.map((award) => {
                            const colorHex =
                              DEFAULT_COLOR_MAP[award.categoryColor ?? ""] ?? DEFAULT_COLOR_MAP.gray;
                            return (
                              <div
                                key={award.id}
                                className="flex items-center gap-3 rounded-lg bg-slate-900/50 p-3"
                              >
                                <span
                                  aria-hidden
                                  className="h-3 w-3 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: colorHex }}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {award.categoryName}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {award.type ?? "—"} · {award.submittedAt ? new Date(award.submittedAt).toLocaleDateString() : "Date unknown"}
                                  </p>
                                </div>
                                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-100">
                                  Approved
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ceremony.pending.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Pending ({ceremony.pending.length})
                        </h4>
                        <div className="space-y-2">
                          {ceremony.pending.map((award) => {
                            const colorHex =
                              DEFAULT_COLOR_MAP[award.categoryColor ?? ""] ?? DEFAULT_COLOR_MAP.gray;
                            return (
                              <div
                                key={award.id}
                                className="flex items-center gap-3 rounded-lg bg-slate-900/50 p-3"
                              >
                                <span
                                  aria-hidden
                                  className="h-3 w-3 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: colorHex }}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {award.categoryName}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {award.type ?? "—"} · {award.submittedAt ? new Date(award.submittedAt).toLocaleDateString() : "Date unknown"}
                                  </p>
                                </div>
                                <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200">
                                  Pending
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ceremony.rejected.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Rejected ({ceremony.rejected.length})
                        </h4>
                        <div className="space-y-2">
                          {ceremony.rejected.map((award) => {
                            const colorHex =
                              DEFAULT_COLOR_MAP[award.categoryColor ?? ""] ?? DEFAULT_COLOR_MAP.gray;
                            return (
                              <div
                                key={award.id}
                                className="flex items-center gap-3 rounded-lg bg-slate-900/50 p-3 opacity-60"
                              >
                                <span
                                  aria-hidden
                                  className="h-3 w-3 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: colorHex }}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {award.categoryName}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {award.type ?? "—"} · {award.submittedAt ? new Date(award.submittedAt).toLocaleDateString() : "Date unknown"}
                                  </p>
                                </div>
                                <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-200">
                                  Rejected
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

