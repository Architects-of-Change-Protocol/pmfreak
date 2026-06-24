import type { OverallComplianceInput } from "../types";
import { GOVERNANCE_COMPLIANCE_WEIGHTS } from "../types";

export function calculateOverallCompliance(input: OverallComplianceInput): number {
  const w = GOVERNANCE_COMPLIANCE_WEIGHTS;
  const weighted =
    input.constitution  * w.constitution  +
    input.authority     * w.authority     +
    input.ratification  * w.ratification  +
    input.decision      * w.decision      +
    input.execution     * w.execution     +
    input.learning      * w.learning;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}
