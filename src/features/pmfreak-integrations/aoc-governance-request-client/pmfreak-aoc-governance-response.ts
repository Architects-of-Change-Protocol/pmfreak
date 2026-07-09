export type PMFreakAocGovernanceDecision =
  | "allow"
  | "deny"
  | "hold"
  | "require_evidence"
  | "require_pm_approval"
  | "require_customer_validation"
  | "require_billing_review"
  | "require_contract_review"
  | "require_security_review"
  | "require_executive_approval";

export type PMFreakAocGovernanceDecisionSeverity = "success" | "info" | "warning" | "danger";

export type PMFreakAocGovernanceResponseTraceStep = {
  stepId: string;
  label: string;
  status: "passed" | "warning" | "blocked" | "not_applicable";
  summary: string;
};

export type PMFreakAocGovernanceResponse = {
  responseId: string;
  requestId: string;
  clientId: string;

  providerId: "pmfreak";
  evaluatedBy: "aoc" | "local_mock_aoc" | "unsupported_remote";

  decision: PMFreakAocGovernanceDecision;
  decisionLabel: string;
  decisionSeverity: PMFreakAocGovernanceDecisionSeverity;

  reasonCodes: string[];
  safeSummary: string;

  requiredEvidenceIds: string[];
  requiredApprovalIds: string[];

  missingEvidenceIds: string[];
  missingApprovalIds: string[];

  trace: PMFreakAocGovernanceResponseTraceStep[];

  policyPackIds: string[];
  jurisdictionPackIds: string[];

  safeLabels: string[];
  disclaimers: string[];
  warnings: string[];
  errors: string[];
};
