import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocGovernedActionGateFlags = {
  canProceed: boolean;
  blocked: boolean;
  requiresEvidence: boolean;
  requiresApproval: boolean;
  requiresReview: boolean;
};

const BASE_FLAGS: PMFreakAocGovernedActionGateFlags = {
  canProceed: false,
  blocked: false,
  requiresEvidence: false,
  requiresApproval: false,
  requiresReview: false,
};

// `canProceed = true` means only that the proposed action passed the
// governance gate for the provided request context — it never means the
// action was executed.
export function createPMFreakAocGateFlagsFromVerdict(verdict: PMFreakAocGovernedActionGateVerdict): PMFreakAocGovernedActionGateFlags {
  switch (verdict) {
    case "passed":
      return { ...BASE_FLAGS, canProceed: true };
    case "blocked":
      return { ...BASE_FLAGS, blocked: true };
    case "held":
      return { ...BASE_FLAGS };
    case "needs_evidence":
      return { ...BASE_FLAGS, requiresEvidence: true };
    case "needs_approval":
      return { ...BASE_FLAGS, requiresApproval: true };
    case "needs_review":
      return { ...BASE_FLAGS, requiresReview: true };
    case "error":
      return { ...BASE_FLAGS, blocked: true };
    default:
      return { ...BASE_FLAGS, blocked: true };
  }
}
