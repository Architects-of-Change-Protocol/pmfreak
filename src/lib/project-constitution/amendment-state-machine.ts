import type { AmendmentResult, AmendmentStatus } from "./amendment-types";

export const amendmentAllowedTransitions: Readonly<Record<AmendmentStatus, readonly AmendmentStatus[]>> = {
  draft:     ["proposed", "withdrawn"],
  proposed:  ["approved", "rejected", "withdrawn"],
  approved:  ["applied"],
  rejected:  [],
  withdrawn: [],
  applied:   [],
};

export const AMENDMENT_TERMINAL_STATES: ReadonlySet<AmendmentStatus> = new Set([
  "rejected",
  "withdrawn",
  "applied",
]);

type AmendmentTransitionError = {
  code: "invalid_amendment_transition";
  message: string;
  currentStatus: AmendmentStatus;
  targetStatus: AmendmentStatus;
  allowedTargets: AmendmentStatus[];
};

type AmendmentTransitionResult =
  | { ok: true; data: { currentStatus: AmendmentStatus; targetStatus: AmendmentStatus } }
  | { ok: false; failureClass: "validation_failed"; error: AmendmentTransitionError };

export function validateAmendmentTransition(
  currentStatus: AmendmentStatus,
  targetStatus: AmendmentStatus,
): AmendmentTransitionResult {
  if (currentStatus === targetStatus) {
    return {
      ok: false,
      failureClass: "validation_failed",
      error: {
        code: "invalid_amendment_transition",
        message: `Amendment is already in status '${currentStatus}'; transition to the same status is not allowed.`,
        currentStatus,
        targetStatus,
        allowedTargets: [...amendmentAllowedTransitions[currentStatus]],
      },
    };
  }

  const allowed = [...amendmentAllowedTransitions[currentStatus]];
  if (allowed.includes(targetStatus)) {
    return { ok: true, data: { currentStatus, targetStatus } };
  }

  return {
    ok: false,
    failureClass: "validation_failed",
    error: {
      code: "invalid_amendment_transition",
      message: `Amendment transition from '${currentStatus}' to '${targetStatus}' is not allowed.`,
      currentStatus,
      targetStatus,
      allowedTargets: allowed,
    },
  };
}

export function amendmentTransitionValidationFailure<T>(error: AmendmentTransitionError): AmendmentResult<T> {
  return {
    ok: false,
    error: error.message,
    failureClass: "validation_failed",
  };
}
