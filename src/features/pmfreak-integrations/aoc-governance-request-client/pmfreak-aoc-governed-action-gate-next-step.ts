import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

const NEXT_STEPS: Record<PMFreakAocGovernedActionGateVerdict, string> = {
  passed: "This proposed action passed the AOC governance gate for this request context. This gate result does not execute the action.",
  blocked: "Do not proceed under the current request context. Review the AOC decision reasons before attempting a new request.",
  held: "Hold this action until the required review or context update is available.",
  needs_evidence: "Attach or link the missing evidence references before attempting this action.",
  needs_approval: "Collect the required approval references before attempting this action.",
  needs_review: "Complete the required review before attempting this action.",
  error: "The gate could not safely evaluate this action. Review the gate errors before attempting a new request.",
};

export type PMFreakAocGateSafeNextStepInput = {
  verdict: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;
  requiredEvidenceIds?: string[];
  requiredApprovalIds?: string[];
  missingEvidenceIds?: string[];
  missingApprovalIds?: string[];
};

// Fixed, deterministic copy per verdict. Deliberately does not reference
// decision/requiredEvidenceIds/requiredApprovalIds/missingEvidenceIds/
// missingApprovalIds in the text (those are shown as their own gate
// result fields) — this keeps the safe next-step copy stable and immune
// to claim-safety regressions from caller-supplied identifiers.
export function createPMFreakAocGateSafeNextStep(input: PMFreakAocGateSafeNextStepInput): string {
  return NEXT_STEPS[input.verdict] ?? NEXT_STEPS.error;
}
