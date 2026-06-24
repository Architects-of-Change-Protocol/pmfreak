import type { GovernanceComplianceStatus } from "../types";
import { GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS } from "../types";

export function classifyGovernanceComplianceStatus(score: number): GovernanceComplianceStatus {
  if (score >= GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.compliant) return "compliant";
  if (score >= GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}
