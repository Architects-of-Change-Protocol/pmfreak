import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import type { PMFreakAocEvidenceRequirementItem } from "./pmfreak-aoc-evidence-requirement-handoff-item";

export type PMFreakAocEvidenceRequirementHandoffSafeNextStepInput = {
  requirementItems: PMFreakAocEvidenceRequirementItem[];
  verdict?: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;
};

const CUSTOMER_ACCEPTANCE_STEP = "Collect or link customer acceptance evidence before attempting this action again.";
const BILLING_REVIEW_STEP = "Prepare the evidence package for billing review. This handoff does not approve billing or create an invoice.";
const CONTRACT_REVIEW_STEP = "Prepare the required contract review references before attempting this action again.";
const SECURITY_REVIEW_STEP = "Prepare the required security review references before attempting this action again.";
const APPROVAL_STEP = "Collect the required approval references before attempting this action again.";
const FALLBACK_STEP = "Review the evidence requirements before attempting this action again.";

// Deterministic, fixed-copy sentence selection. Scans `requirementItems`
// for the highest-priority missing type present and returns the exact
// safe sentence for it. Never references caller-supplied identifiers, so
// it can never accidentally surface an unsafe or secret value.
export function createPMFreakAocEvidenceRequirementHandoffSafeNextStep(input: PMFreakAocEvidenceRequirementHandoffSafeNextStepInput): string {
  const missingTypes = new Set(input.requirementItems.filter((item) => item.status === "missing").map((item) => item.requirementType));
  const hasRequirementType = (type: string) => input.requirementItems.some((item) => item.requirementType === type);

  if (missingTypes.has("customer_acceptance")) {
    return CUSTOMER_ACCEPTANCE_STEP;
  }
  if (missingTypes.has("billing_review")) {
    return BILLING_REVIEW_STEP;
  }
  if (missingTypes.has("contract_review")) {
    return CONTRACT_REVIEW_STEP;
  }
  if (missingTypes.has("security_review")) {
    return SECURITY_REVIEW_STEP;
  }
  if (missingTypes.has("pm_approval") || missingTypes.has("executive_approval") || hasRequirementType("pm_approval") || hasRequirementType("executive_approval")) {
    return APPROVAL_STEP;
  }

  return FALLBACK_STEP;
}
