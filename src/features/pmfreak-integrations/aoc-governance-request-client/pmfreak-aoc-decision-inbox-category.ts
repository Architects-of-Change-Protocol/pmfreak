import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocDecisionInboxCategory } from "./pmfreak-aoc-decision-inbox-types";

const DECISION_TO_CATEGORY: Partial<Record<PMFreakAocGovernanceDecision, PMFreakAocDecisionInboxCategory>> = {
  require_billing_review: "billing",
  require_evidence: "evidence",
  require_pm_approval: "approval",
  require_customer_validation: "customer_validation",
  require_contract_review: "contract",
  require_security_review: "security",
};

const KNOWN_ACTION_CATEGORY_TO_INBOX_CATEGORY: Record<string, PMFreakAocDecisionInboxCategory> = {
  billing: "billing",
  evidence: "evidence",
  communication: "communication",
  risk: "risk",
  change_control: "contract",
  project_governance: "project_governance",
  schedule: "project_governance",
};

export type PMFreakAocDecisionInboxCategoryInput = {
  decision: PMFreakAocGovernanceDecision;
  reasonCodes?: string[];
  actionCategory?: string;
  missingEvidenceIds?: string[];
  missingApprovalIds?: string[];
};

// Priority order: explicit decision → category mapping first, then the
// deny+risk / hold+communication special cases, then a safe/known
// actionCategory fallback, then "project_governance", then "unknown".
export function mapPMFreakAocDecisionToInboxCategory(input: PMFreakAocDecisionInboxCategoryInput): PMFreakAocDecisionInboxCategory {
  const explicit = DECISION_TO_CATEGORY[input.decision];
  if (explicit) {
    return explicit;
  }

  if (input.decision === "deny" && input.actionCategory === "risk") {
    return "risk";
  }

  if (input.decision === "hold" && input.actionCategory === "communication") {
    return "communication";
  }

  if (input.actionCategory && input.actionCategory in KNOWN_ACTION_CATEGORY_TO_INBOX_CATEGORY) {
    return KNOWN_ACTION_CATEGORY_TO_INBOX_CATEGORY[input.actionCategory];
  }

  if (input.decision === "allow" || input.decision === "deny" || input.decision === "hold") {
    return "project_governance";
  }

  return "unknown";
}
