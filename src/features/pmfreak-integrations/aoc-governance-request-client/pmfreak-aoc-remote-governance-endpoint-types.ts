// Local compatibility DTOs for the AOC PMFreak Remote Governance Endpoint
// v1 (`aoc.integration.pmfreak.remote_governance_endpoint.v1`). These types
// intentionally do not import anything from the AOC Enterprise repo — they
// are PMFreak's own understanding of the wire contract.

export type PMFreakAocRemoteGovernanceDecision =
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

export type PMFreakAocRemoteGovernanceDecisionSeverity = "success" | "info" | "warning" | "danger";

export type PMFreakAocRemoteGovernanceResponseTraceStep = {
  stepId: string;
  label: string;
  status: "passed" | "warning" | "blocked" | "not_applicable";
  summary: string;
};

export type PMFreakAocRemoteAocGovernanceResponse = {
  responseId: string;
  requestId: string;
  clientId: string;

  providerId: "aoc";
  evaluatedFor: "pmfreak";

  decision: PMFreakAocRemoteGovernanceDecision;

  decisionLabel: string;
  decisionSeverity: PMFreakAocRemoteGovernanceDecisionSeverity;

  reasonCodes: string[];
  safeSummary: string;

  requiredEvidenceIds: string[];
  requiredApprovalIds: string[];

  missingEvidenceIds: string[];
  missingApprovalIds: string[];

  trace: PMFreakAocRemoteGovernanceResponseTraceStep[];

  policyPackIds: string[];
  jurisdictionPackIds: string[];

  safeLabels: string[];
  disclaimers: string[];
  warnings: string[];
  errors: string[];
};

export type PMFreakAocRemoteEndpointSuccessBody = {
  ok: true;
  endpointId: string;
  response: PMFreakAocRemoteAocGovernanceResponse;
  safeLabels: string[];
  warnings: string[];
};

export type PMFreakAocRemoteEndpointErrorBody = {
  ok: false;
  endpointId: string;
  error: {
    code: string;
    message: string;
    safe: true;
    details?: Record<string, unknown>;
  };
  safeLabels: string[];
  warnings: string[];
};

export type PMFreakAocRemoteEndpointBody = PMFreakAocRemoteEndpointSuccessBody | PMFreakAocRemoteEndpointErrorBody;
