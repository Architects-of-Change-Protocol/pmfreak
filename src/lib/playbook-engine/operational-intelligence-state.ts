import type { PlaybookEngineResult } from "./types";
import type { OperationalDraft, OperationalDraftStatus } from "./operational-intelligence-types";

/**
 * Allowed status transitions for an `OperationalDraft`. Mirrors the pattern in
 * `recommendation-state.ts`/`communication-state.ts`: a static graph validated before every
 * transition. `discarded` and `converted` are terminal — a discarded draft can never later be
 * converted, and a converted draft can never move again. There is deliberately no path that
 * reaches `converted` without passing through `approved` first, and no automated transition
 * exists anywhere in this module: every state change requires an explicit human call. This is
 * the mechanism guaranteeing PMFreak never creates/modifies a real risk, issue, dependency or
 * decision on its own.
 */
export const OPERATIONAL_DRAFT_TRANSITIONS: Readonly<Record<OperationalDraftStatus, readonly OperationalDraftStatus[]>> = {
  draft: ["reviewed", "discarded"],
  reviewed: ["approved", "discarded"],
  approved: ["converted", "discarded"],
  converted: [],
  discarded: [],
};

function transitionOperationalDraft(
  draft: OperationalDraft,
  targetStatus: OperationalDraftStatus,
): PlaybookEngineResult<OperationalDraft> {
  const allowedTargets = OPERATIONAL_DRAFT_TRANSITIONS[draft.status];

  if (!allowedTargets.includes(targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition operational draft from '${draft.status}' to '${targetStatus}'. Allowed: ${
        allowedTargets.length > 0 ? allowedTargets.join(", ") : "(none — terminal state)"
      }.`,
      failureClass: "validation_failed",
    };
  }

  return { ok: true, data: { ...draft, status: targetStatus, updatedAt: new Date().toISOString() } };
}

/** A human has reviewed the draft's classification and content. */
export function markOperationalDraftReviewed(draft: OperationalDraft): PlaybookEngineResult<OperationalDraft> {
  return transitionOperationalDraft(draft, "reviewed");
}

/** A human has approved the draft as ready to be converted. Never creates anything by itself. */
export function approveOperationalDraft(draft: OperationalDraft): PlaybookEngineResult<OperationalDraft> {
  return transitionOperationalDraft(draft, "approved");
}

/**
 * Records that a human has converted this draft into a real risk/issue/dependency/decision
 * elsewhere (out of scope for this sprint). This function never creates or persists that real
 * object itself — it only records that a human decision to convert has already happened. Only
 * reachable from `approved`, so an unreviewed/unapproved draft can never be marked converted.
 */
export function convertOperationalDraft(draft: OperationalDraft): PlaybookEngineResult<OperationalDraft> {
  return transitionOperationalDraft(draft, "converted");
}

/** A human has discarded the draft. Terminal — it can never later be converted. */
export function discardOperationalDraft(draft: OperationalDraft): PlaybookEngineResult<OperationalDraft> {
  return transitionOperationalDraft(draft, "discarded");
}
