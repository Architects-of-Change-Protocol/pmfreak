import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import type { PMFreakAocEvidenceRequirementType } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import type { PMFreakAocEvidenceRequirementStatus } from "./pmfreak-aoc-evidence-requirement-handoff-status";

export type PMFreakAocEvidenceRequirementPriority = "low" | "medium" | "high" | "critical";

export type PMFreakAocEvidenceRequirementPriorityInput = {
  requirementType: PMFreakAocEvidenceRequirementType;
  status: PMFreakAocEvidenceRequirementStatus;
  verdict?: PMFreakAocGovernedActionGateVerdict;
};

const CRITICAL_MISSING_TYPES: PMFreakAocEvidenceRequirementType[] = ["customer_acceptance", "billing_review"];
const HIGH_MISSING_TYPES: PMFreakAocEvidenceRequirementType[] = ["security_review", "contract_review", "pm_approval", "executive_approval"];

// Pure, deterministic priority mapping. Never reads a clock, never
// generates a random value, and never depends on anything but its own
// input.
export function mapPMFreakAocEvidenceRequirementPriority(input: PMFreakAocEvidenceRequirementPriorityInput): PMFreakAocEvidenceRequirementPriority {
  const { requirementType, status } = input;

  if (status === "missing") {
    if (CRITICAL_MISSING_TYPES.includes(requirementType)) {
      return "critical";
    }
    if (HIGH_MISSING_TYPES.includes(requirementType)) {
      return "high";
    }
    // Covers "unknown" and any other missing type not explicitly listed
    // above — a safe fallback rather than silently under-prioritizing.
    return "medium";
  }

  if (status === "required") {
    return "medium";
  }

  if (status === "available_reference" || status === "not_applicable") {
    return "low";
  }

  // "review_required" and any future status: safe medium fallback.
  return "medium";
}
