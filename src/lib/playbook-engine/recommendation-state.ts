import type { PlaybookEngineResult } from "./types";
import type { PlaybookRecommendation, PlaybookRecommendationStatus } from "./recommendation-engine";

/**
 * Allowed status transitions for a `PlaybookRecommendation`. Mirrors the pattern in
 * `decision-governance/state-machine.ts`: a static graph validated before every transition,
 * so no caller can move a recommendation into a status its current state doesn't permit.
 *
 * `dismissed` and `executed` are terminal (no outgoing edges) — dismissed can never later become
 * executed, and executed can never move again. `accepted` can reach `executed` directly for
 * recommendations that don't require approval; recommendations that do must pass through
 * `requires_approval` → `approved` first (enforced by `markRecommendationExecuted` below, since
 * the graph alone can't express the approvalRequired-dependent precondition).
 */
export const PLAYBOOK_RECOMMENDATION_TRANSITIONS: Readonly<
  Record<PlaybookRecommendationStatus, readonly PlaybookRecommendationStatus[]>
> = {
  new: ["viewed", "dismissed"],
  viewed: ["accepted", "dismissed"],
  accepted: ["requires_approval", "converted_to_task", "converted_to_draft", "executed", "dismissed"],
  requires_approval: ["approved", "dismissed"],
  approved: ["executed", "dismissed"],
  converted_to_task: [],
  converted_to_draft: [],
  dismissed: [],
  executed: [],
};

function transitionPlaybookRecommendation(
  recommendation: PlaybookRecommendation,
  targetStatus: PlaybookRecommendationStatus,
): PlaybookEngineResult<PlaybookRecommendation> {
  const allowedTargets = PLAYBOOK_RECOMMENDATION_TRANSITIONS[recommendation.status];

  if (!allowedTargets.includes(targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition recommendation from '${recommendation.status}' to '${targetStatus}'. Allowed: ${
        allowedTargets.length > 0 ? allowedTargets.join(", ") : "(none — terminal state)"
      }.`,
      failureClass: "validation_failed",
    };
  }

  return {
    ok: true,
    data: { ...recommendation, status: targetStatus, updatedAt: new Date().toISOString() },
  };
}

/** A human (or the UI on their behalf) has seen the recommendation. */
export function markRecommendationViewed(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  return transitionPlaybookRecommendation(recommendation, "viewed");
}

/** A human has accepted the recommendation as valid and worth acting on. */
export function acceptRecommendation(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  return transitionPlaybookRecommendation(recommendation, "accepted");
}

/** A human has dismissed the recommendation. Terminal — it can never later become executed. */
export function dismissRecommendation(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  return transitionPlaybookRecommendation(recommendation, "dismissed");
}

export function markRecommendationConvertedToTask(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  return transitionPlaybookRecommendation(recommendation, "converted_to_task");
}

export function markRecommendationConvertedToDraft(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  return transitionPlaybookRecommendation(recommendation, "converted_to_draft");
}

/**
 * Routes an accepted recommendation into the approval gate. Only valid when the recommendation
 * actually carries an approval-sensitive suggested action — a recommendation that never
 * required approval has nothing to route here.
 */
export function markRecommendationRequiresApproval(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  if (!recommendation.approvalRequired) {
    return {
      ok: false,
      error: "This recommendation has no approval-sensitive suggested actions; it does not require approval.",
      failureClass: "governance_violation",
    };
  }
  return transitionPlaybookRecommendation(recommendation, "requires_approval");
}

/**
 * Records that a human approved the recommendation. Never valid for a recommendation whose
 * approvalRequired is false — approval is meaningless (and forbidden) when nothing sensitive was
 * proposed. This never executes anything; it only records that a human has cleared the gate.
 */
export function approveRecommendation(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  if (!recommendation.approvalRequired) {
    return {
      ok: false,
      error: "Cannot approve a recommendation that does not require approval.",
      failureClass: "governance_violation",
    };
  }
  return transitionPlaybookRecommendation(recommendation, "approved");
}

/**
 * Records that the recommendation's action was executed elsewhere. This function never
 * executes anything itself — it is pure bookkeeping, called only after a real (out-of-scope for
 * this sprint) execution has already happened. Sensitive recommendations (approvalRequired) may
 * only reach this from `approved`; non-sensitive ones may only reach it from `accepted`. This is
 * the guarantee that approval-sensitive actions are never auto-executed.
 */
export function markRecommendationExecuted(
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  if (recommendation.approvalRequired && recommendation.status !== "approved") {
    return {
      ok: false,
      error: "Approval-sensitive recommendations must be 'approved' before they can be marked executed.",
      failureClass: "governance_violation",
    };
  }
  if (!recommendation.approvalRequired && recommendation.status !== "accepted") {
    return {
      ok: false,
      error: "Recommendations without approval-sensitive actions must be 'accepted' before they can be marked executed.",
      failureClass: "governance_violation",
    };
  }
  return transitionPlaybookRecommendation(recommendation, "executed");
}
