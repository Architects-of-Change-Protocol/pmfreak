import type { ConstitutionStatus } from "./types";

export type ConstitutionTransitionError = {
  code: "invalid_constitution_transition";
  message: string;
  currentStatus: ConstitutionStatus;
  targetStatus: ConstitutionStatus;
  allowedTargets: ConstitutionStatus[];
};

export type ConstitutionTransitionResult =
  | { ok: true; data: { currentStatus: ConstitutionStatus; targetStatus: ConstitutionStatus } }
  | { ok: false; error: ConstitutionTransitionError; failureClass: "validation_failed" };

export const allowedTransitions: Readonly<Record<ConstitutionStatus, readonly ConstitutionStatus[]>> = {
  draft:     ["proposed", "archived"],
  proposed:  ["draft", "approved", "archived"],
  approved:  ["active", "draft", "archived"],
  active:    ["suspended", "closed"],
  suspended: ["active", "closed"],
  closed:    ["archived"],
  archived:  [],
};

export const TERMINAL_STATES: ReadonlySet<ConstitutionStatus> = new Set(["archived"]);

export function validateConstitutionTransition(
  currentStatus: ConstitutionStatus,
  targetStatus: ConstitutionStatus,
): ConstitutionTransitionResult {
  if (currentStatus === targetStatus) {
    return {
      ok: false,
      failureClass: "validation_failed",
      error: {
        code: "invalid_constitution_transition",
        message: `Constitution is already in status '${currentStatus}'; transition to the same status is not allowed.`,
        currentStatus,
        targetStatus,
        allowedTargets: [...allowedTransitions[currentStatus]],
      },
    };
  }

  const allowedTargets = [...allowedTransitions[currentStatus]];

  if (allowedTargets.includes(targetStatus)) {
    return { ok: true, data: { currentStatus, targetStatus } };
  }

  return {
    ok: false,
    failureClass: "validation_failed",
    error: {
      code: "invalid_constitution_transition",
      message: `Constitution transition from '${currentStatus}' to '${targetStatus}' is not allowed.`,
      currentStatus,
      targetStatus,
      allowedTargets,
    },
  };
}

export function transitionValidationFailure<T>(error: ConstitutionTransitionError): import("./types").ConstitutionResult<T> {
  return { ok: false, error: error.message, failureClass: "validation_failed" };
}
