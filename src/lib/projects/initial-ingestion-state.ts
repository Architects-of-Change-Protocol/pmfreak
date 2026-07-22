// Initial-ingestion lifecycle for a project's first guided entry into the
// Project Intelligence Inbox.
//
// WHY THIS EXISTS
// ---------------
// The Inbox is the canonical first experience after Command Center activation,
// but nothing durable recorded whether a user had entered it yet. The only
// signal was `brainActivated=1`, a transient query parameter set by just one of
// the two project-creation paths and consumed as a one-shot value — so a
// refresh, or any later return to /command-center, lost it.
//
// This marker records the GUIDED-ENTRY lifecycle, not content. It deliberately
// does NOT ask "does this project have evidence?": absence of evidence proves
// only that the project is empty, never that onboarding is incomplete, and
// using it as a proxy would reopen ingestion forever for a project the user has
// already been through.
//
// STORAGE (Option A — no migration)
// ---------------------------------
// Persisted inside the existing `projects.onboarding_payload` jsonb column
// (added 20260601000000, already in PROJECT_SELECTABLE_COLUMNS, and already
// loaded by the Command Center page) under the `initialIngestion` key. Because
// jsonb carries no CHECK constraint, every read is narrowed through
// readInitialIngestionStatus below and any unrecognized value fails safe to
// "not_started" — the state that shows the guided experience rather than
// skipping it.

export type InitialIngestionStatus = "not_started" | "in_progress" | "completed";

export const INITIAL_INGESTION_KEY = "initialIngestion";

const VALID_STATUSES: readonly InitialIngestionStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

/**
 * Narrows the persisted marker out of an untrusted `onboarding_payload`.
 * Anything missing, malformed, or unrecognized reads as "not_started" so a
 * corrupt value can never silently skip the guided first experience.
 */
export function readInitialIngestionStatus(payload: unknown): InitialIngestionStatus {
  if (!payload || typeof payload !== "object") {
    return "not_started";
  }

  const marker = (payload as Record<string, unknown>)[INITIAL_INGESTION_KEY];
  if (!marker || typeof marker !== "object") {
    return "not_started";
  }

  const status = (marker as Record<string, unknown>).status;
  if (VALID_STATUSES.includes(status as InitialIngestionStatus)) {
    return status as InitialIngestionStatus;
  }

  return "not_started";
}

/**
 * Returns a new payload with the marker set, preserving every other key.
 * `updatedAt` is supplied by the caller so this stays pure and testable.
 */
export function withInitialIngestionStatus(
  payload: unknown,
  status: InitialIngestionStatus,
  updatedAt: string,
): Record<string, unknown> {
  const base =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return { ...base, [INITIAL_INGESTION_KEY]: { status, updatedAt } };
}

export type CommandCenterLandingView = "ingestion" | "dashboard";

/**
 * Which view /command-center opens for an already-activated Command Center.
 *
 * `activationHint` is the `brainActivated=1` hand-off, already validated by the
 * caller against the active project id. It remains part of the supported
 * navigation contract, but it is advisory: it can only force ingestion ON, and
 * is never the sole source of truth. The durable marker decides everything
 * else, which is what makes this survive a refresh.
 */
export function resolveCommandCenterLanding(input: {
  ingestionStatus: InitialIngestionStatus;
  activationHint: boolean;
}): CommandCenterLandingView {
  if (input.activationHint) {
    return "ingestion";
  }

  return input.ingestionStatus === "completed" ? "dashboard" : "ingestion";
}
