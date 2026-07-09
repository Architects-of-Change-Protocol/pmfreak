import { evaluatePMFreakAocRemoteGovernanceTransportClaimSafety } from "./pmfreak-aoc-remote-governance-claim-safety";
import type { PMFreakAocRemoteAocGovernanceResponse } from "./pmfreak-aoc-remote-governance-endpoint-types";

export type PMFreakAocRemoteGovernanceResponseValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const KNOWN_DECISIONS = new Set([
  "allow",
  "deny",
  "hold",
  "require_evidence",
  "require_pm_approval",
  "require_customer_validation",
  "require_billing_review",
  "require_contract_review",
  "require_security_review",
  "require_executive_approval",
]);

const KNOWN_SEVERITIES = new Set(["success", "info", "warning", "danger"]);

// Pure validation: no AOC calls, no mutation, no side effects.
export function validatePMFreakAocRemoteAocGovernanceResponse(
  response: PMFreakAocRemoteAocGovernanceResponse,
): PMFreakAocRemoteGovernanceResponseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!response || typeof response !== "object") {
    return { valid: false, errors: ["response is required"], warnings };
  }

  if (!response.responseId) errors.push("responseId is required");
  if (!response.requestId) errors.push("requestId is required");
  if (!response.clientId) errors.push("clientId is required");
  if (response.providerId !== "aoc") errors.push('providerId must equal "aoc"');
  if (response.evaluatedFor !== "pmfreak") errors.push('evaluatedFor must equal "pmfreak"');
  if (!KNOWN_DECISIONS.has(response.decision)) errors.push(`decision "${String(response.decision)}" is not a known AOC decision`);
  if (!response.decisionLabel) errors.push("decisionLabel is required");
  if (!KNOWN_SEVERITIES.has(response.decisionSeverity)) {
    errors.push(`decisionSeverity "${String(response.decisionSeverity)}" is not a known decision severity`);
  }
  if (!Array.isArray(response.reasonCodes)) errors.push("reasonCodes must be an array");
  if (!response.safeSummary) errors.push("safeSummary is required");
  if (!Array.isArray(response.requiredEvidenceIds)) errors.push("requiredEvidenceIds must be an array");
  if (!Array.isArray(response.requiredApprovalIds)) errors.push("requiredApprovalIds must be an array");
  if (!Array.isArray(response.missingEvidenceIds)) errors.push("missingEvidenceIds must be an array");
  if (!Array.isArray(response.missingApprovalIds)) errors.push("missingApprovalIds must be an array");
  if (!Array.isArray(response.trace)) errors.push("trace must be an array");
  if (!Array.isArray(response.safeLabels)) errors.push("safeLabels must be an array");

  const claimSafety = evaluatePMFreakAocRemoteGovernanceTransportClaimSafety(response);
  if (!claimSafety.safe) {
    errors.push(`response contains unsafe claim phrase(s): ${claimSafety.unsafePhrases.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
