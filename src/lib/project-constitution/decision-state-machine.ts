import type { ConstitutionalDecisionStatus } from "./decision-types";

// ─── Allowed transitions ──────────────────────────────────────────────────────

export const DECISION_ALLOWED_TRANSITIONS: Record<
  ConstitutionalDecisionStatus,
  ConstitutionalDecisionStatus[]
> = {
  draft:     ["proposed", "cancelled"],
  proposed:  ["approved", "rejected", "cancelled"],
  approved:  ["executed", "cancelled"],
  rejected:  [],
  executed:  [],
  cancelled: [],
};

export const DECISION_TERMINAL_STATES = new Set<ConstitutionalDecisionStatus>([
  "rejected",
  "executed",
  "cancelled",
]);

// ─── Validate transition ──────────────────────────────────────────────────────

export type DecisionTransitionError = {
  code: "invalid_decision_transition";
  from: ConstitutionalDecisionStatus;
  to: ConstitutionalDecisionStatus;
  message: string;
};

export type DecisionTransitionResult =
  | { ok: true }
  | { ok: false; error: DecisionTransitionError };

export function validateDecisionTransition(
  from: ConstitutionalDecisionStatus | string,
  to: ConstitutionalDecisionStatus | string,
): DecisionTransitionResult {
  const allowed = DECISION_ALLOWED_TRANSITIONS[from as ConstitutionalDecisionStatus];
  if (!allowed) {
    return {
      ok: false,
      error: {
        code: "invalid_decision_transition",
        from: from as ConstitutionalDecisionStatus,
        to: to as ConstitutionalDecisionStatus,
        message: `Unknown status '${from}'.`,
      },
    };
  }
  if (allowed.includes(to as ConstitutionalDecisionStatus)) return { ok: true };
  return {
    ok: false,
    error: {
      code: "invalid_decision_transition",
      from: from as ConstitutionalDecisionStatus,
      to: to as ConstitutionalDecisionStatus,
      message: `Cannot transition constitutional decision from '${from}' to '${to}'.`,
    },
  };
}

export function decisionTransitionValidationFailure<T>(
  error: DecisionTransitionError,
): import("./decision-types").DecisionResult<T> {
  return {
    ok: false,
    error: error.message,
    failureClass: "governance_violation",
  };
}
