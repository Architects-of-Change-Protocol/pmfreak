import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";

const NEXT_STEPS: Record<PMFreakAocGovernanceDecision, string> = {
  allow: "AOC returned an allow decision for this request context. This display does not execute the action.",
  deny: "Do not proceed under the current request context. Review the decision reasons before attempting a new request.",
  hold: "Hold this action until the required review or context update is available.",
  require_evidence: "Attach or link the missing evidence references before attempting execution.",
  require_pm_approval: "Collect PM approval before attempting execution.",
  require_customer_validation: "Collect customer validation evidence before attempting execution.",
  require_billing_review: "Complete billing review before attempting this billing-sensitive action.",
  require_contract_review: "Complete contract review before attempting execution.",
  require_security_review: "Complete security review before attempting execution.",
  require_executive_approval: "Collect executive approval before attempting execution.",
};

export type PMFreakAocDecisionInboxSafeNextStepInput = {
  decision: PMFreakAocGovernanceDecision;
  requiredEvidenceIds?: string[];
  requiredApprovalIds?: string[];
  missingEvidenceIds?: string[];
  missingApprovalIds?: string[];
};

// Fixed, deterministic copy per decision. Deliberately does not reference
// requiredEvidenceIds/requiredApprovalIds/missingEvidenceIds/
// missingApprovalIds in the text (those are shown as their own inbox item
// fields) — this keeps the safe next-step copy stable and immune to
// claim-safety regressions from caller-supplied identifiers.
export function createPMFreakAocDecisionInboxSafeNextStep(input: PMFreakAocDecisionInboxSafeNextStepInput): string {
  return NEXT_STEPS[input.decision] ?? "Review this AOC governance decision before attempting the action again.";
}
