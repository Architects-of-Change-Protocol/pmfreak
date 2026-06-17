import type { DecisionStatus, Result } from "./types";

export type DecisionTransitionError = {
  code: "invalid_decision_transition";
  message: string;
  currentStatus: DecisionStatus;
  targetStatus: DecisionStatus;
  allowedTargets: DecisionStatus[];
};

export type DecisionTransitionResult =
  | { ok: true; data: { currentStatus: DecisionStatus; targetStatus: DecisionStatus } }
  | { ok: false; error: DecisionTransitionError; failureClass: "validation_failed" };

export const allowedTransitions: Readonly<Record<DecisionStatus, readonly DecisionStatus[]>> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected", "expired"],
  approved: ["implemented", "expired"],
  rejected: ["expired"],
  implemented: ["expired"],
  expired: [],
};

export function validateDecisionTransition(
  currentStatus: DecisionStatus,
  targetStatus: DecisionStatus,
): DecisionTransitionResult {
  const allowedTargets = [...allowedTransitions[currentStatus]];

  if (allowedTargets.includes(targetStatus)) {
    return { ok: true, data: { currentStatus, targetStatus } };
  }

  return {
    ok: false,
    failureClass: "validation_failed",
    error: {
      code: "invalid_decision_transition",
      message: `Decision transition from ${currentStatus} to ${targetStatus} is not allowed.`,
      currentStatus,
      targetStatus,
      allowedTargets,
    },
  };
}

export function transitionValidationFailure<T>(error: DecisionTransitionError): Result<T> {
  return { ok: false, error: error.message, failureClass: "validation_failed" };
}
