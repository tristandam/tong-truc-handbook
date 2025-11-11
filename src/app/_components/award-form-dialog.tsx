'use client';

import { useEffect, useMemo, useState } from "react";

import type {
  AwardCategoryRecord,
  CeremonyRecord,
  ParticipantRecord,
  TeamRecord,
} from "~/lib/directus";

type AwardType = "individual" | "team" | "overall";

type AwardFormState = {
  ceremonyId: number | null;
  categoryId: number | null;
  type: AwardType | null;
  participantId: number | null;
  teamId: number | null;
  notes: string;
  submitting: boolean;
  error: string | null;
};

type AwardFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ceremonies: CeremonyRecord[];
  categories: AwardCategoryRecord[];
  teams: TeamRecord[];
  participants: ParticipantRecord[];
  initialCeremonyId?: number | null;
  initialType?: AwardType | null;
  initialTeamId?: number | null;
  initialParticipantId?: number | null;
};

const DEFAULT_FORM_STATE: AwardFormState = {
  ceremonyId: null,
  categoryId: null,
  type: null,
  participantId: null,
  teamId: null,
  notes: "",
  submitting: false,
  error: null,
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : undefined;
}

function normalizeColorLabel(value: string | null | undefined) {
  const formatted = normalizeLabel(value);
  if (!formatted) {
    return "Unknown color";
  }
  return formatted.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AwardFormDialog({
  open,
  onClose,
  onSuccess,
  ceremonies,
  categories,
  teams,
  participants,
  initialCeremonyId = null,
  initialType = null,
  initialTeamId = null,
  initialParticipantId = null,
}: AwardFormDialogProps) {
  const [state, setState] = useState<AwardFormState>({
    ...DEFAULT_FORM_STATE,
    ceremonyId: initialCeremonyId,
    type: initialType,
    teamId: initialTeamId,
    participantId: initialParticipantId,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setState({
      ...DEFAULT_FORM_STATE,
      ceremonyId: initialCeremonyId,
      type: initialType,
      teamId: initialTeamId,
      participantId: initialParticipantId,
    });
  }, [open, initialCeremonyId, initialType, initialTeamId, initialParticipantId]);

  const categoryOptions = useMemo(() => {
    return categories.map((category) => ({
      id: category.id,
      label: normalizeLabel(category.name) ?? `Category ${category.id}`,
      colorLabel: normalizeColorLabel(category.color),
      allowedTypes: category.type ?? [],
    }));
  }, [categories]);

  const selectedCategory = categoryOptions.find(
    (category) => category.id === state.categoryId,
  );

  const allowedTypes: AwardType[] =
    selectedCategory?.allowedTypes?.filter((value): value is AwardType =>
      ["individual", "team", "overall"].includes(value),
    ) ?? ["individual", "team", "overall"];

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    if (
      state.type === null ||
      !selectedCategory.allowedTypes?.includes(state.type)
    ) {
      const nextType = (selectedCategory.allowedTypes?.[0] ??
        null) as AwardType | null;
      setState((prev) => ({
        ...prev,
        type: nextType,
      }));
    }
  }, [selectedCategory, state.type]);

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        label: team.name ?? `Team ${team.id}`,
      })),
    [teams],
  );

  const participantOptions = useMemo(() => {
    if (!state.teamId) {
      return participants;
    }

    return participants.filter(
      (participant) => participant.team?.id === state.teamId,
    );
  }, [participants, state.teamId]);

  const isParticipantAward = state.type === "individual";
  const isTeamAward = state.type === "team" || state.type === "overall";

  useEffect(() => {
    if (!isParticipantAward || state.participantId === null) {
      return;
    }

    const participant = participants.find(
      (item) => item.id === state.participantId,
    );

    if (participant?.team?.id && participant.team.id !== state.teamId) {
      setState((prev) => ({
        ...prev,
        teamId: participant.team?.id ?? prev.teamId,
      }));
    }
  }, [isParticipantAward, participants, state.participantId, state.teamId]);

  const canSubmit =
    !state.submitting &&
    state.ceremonyId !== null &&
    state.categoryId !== null &&
    state.type !== null &&
    ((isParticipantAward && state.participantId !== null) ||
      (isTeamAward && state.teamId !== null));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const payload: Record<string, unknown> = {
        category: state.categoryId,
        ceremony: state.ceremonyId,
        type: state.type,
        participant_nominee: isParticipantAward ? state.participantId : null,
        team_nominee: isTeamAward ? state.teamId : null,
        status: "pending",
      };

      const trimmedNotes = state.notes.trim();
      if (trimmedNotes.length > 0) {
        payload.notes = trimmedNotes;
      }

      const response = await fetch("/api/awards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create award");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      setState((prev) => ({
        ...prev,
        error: "Unable to save award right now. Please try again.",
      }));
    } finally {
      setState((prev) => ({ ...prev, submitting: false }));
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-lg ring-1 ring-white/10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New award nomination</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            disabled={state.submitting}
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Ceremony
            </label>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              value={state.ceremonyId ?? ""}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  ceremonyId:
                    event.target.value === ""
                      ? null
                      : Number.parseInt(event.target.value, 10),
                }))
              }
              disabled={state.submitting}
            >
              <option value="">Select ceremony</option>
              {ceremonies.map((ceremony) => (
                <option key={ceremony.id} value={ceremony.id}>
                  {ceremony.name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Award category
            </label>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              value={state.categoryId ?? ""}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  categoryId:
                    event.target.value === ""
                      ? null
                      : Number.parseInt(event.target.value, 10),
                }))
              }
              disabled={state.submitting}
            >
              <option value="">Select category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label} · {category.colorLabel}
              </option>
            ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Award type
            </label>
            <div className="flex flex-wrap gap-2">
              {allowedTypes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      type: option,
                    }))
                  }
                  className={classNames(
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    state.type === option
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-white hover:bg-white/20",
                  )}
                  disabled={state.submitting}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {isTeamAward || isParticipantAward ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                {isTeamAward ? "Team" : "Filter by team (optional)"}
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                value={state.teamId ?? ""}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    teamId:
                      event.target.value === ""
                        ? null
                        : Number.parseInt(event.target.value, 10),
                  }))
                }
                disabled={state.submitting}
              >
                <option value="">
                  {isTeamAward ? "Select team" : "All teams"}
                </option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isParticipantAward ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Participant
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                value={state.participantId ?? ""}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    participantId:
                      event.target.value === ""
                        ? null
                        : Number.parseInt(event.target.value, 10),
                  }))
                }
                disabled={state.submitting}
              >
                <option value="">Select participant</option>
                {participantOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {[
                      participant.first_name,
                      participant.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || `Participant ${participant.id}`}
                    {participant.team?.name
                      ? ` · ${participant.team?.name}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Notes</label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              rows={3}
              placeholder="Optional notes: Details and reasons why this award is being given."
              value={state.notes}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              disabled={state.submitting}
            />
          </div>

          {state.error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
              {state.error}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit}
          >
            {state.submitting ? "Saving…" : "Save award"}
          </button>
        </form>
      </div>
    </div>
  );
}

