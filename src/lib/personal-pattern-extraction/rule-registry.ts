import type { PersonalPatternExtractionRule } from "./types";
import { PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES } from "./types";

export type { PersonalPatternExtractionRule };

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic personal pattern extraction rules.
//
// Each rule specifies exactly what structured data to count and what threshold
// must be exceeded to generate a candidate. No text inference, no embeddings,
// no AI. An auditor can reconstruct every candidate purely from these rules
// and the raw evidence records in the referenced tables.
//
// Rules are scoped to workspace_id + pm_user_id — no cross-PM access.
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONAL_RULE_REPEATED_ESCALATION = "personal_repeated_escalation" as const;
export const PERSONAL_RULE_REPEATED_STAKEHOLDER = "personal_repeated_stakeholder" as const;
export const PERSONAL_RULE_REPEATED_RISK_RESPONSE = "personal_repeated_risk_response" as const;
export const PERSONAL_RULE_REPEATED_DECISION = "personal_repeated_decision" as const;

export const ALL_PERSONAL_RULE_IDS = [
  PERSONAL_RULE_REPEATED_ESCALATION,
  PERSONAL_RULE_REPEATED_STAKEHOLDER,
  PERSONAL_RULE_REPEATED_RISK_RESPONSE,
  PERSONAL_RULE_REPEATED_DECISION,
] as const;

export type PersonalRuleId = (typeof ALL_PERSONAL_RULE_IDS)[number];

export const PERSONAL_RULE_REGISTRY: Record<PersonalRuleId, PersonalPatternExtractionRule> = {
  [PERSONAL_RULE_REPEATED_ESCALATION]: {
    id: PERSONAL_RULE_REPEATED_ESCALATION,
    name: "Repeated Escalation Pattern",
    description: `When the same escalation behavior appears at least ${PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES} times in the PM's personal memory records (memory_type = 'escalation'), generate a candidate. Counts are computed from personal_pm_memory where pm_user_id matches and memory_type = 'escalation'.`,
    candidateCategory: "escalation_pattern",
    minimumOccurrences: PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [PERSONAL_RULE_REPEATED_STAKEHOLDER]: {
    id: PERSONAL_RULE_REPEATED_STAKEHOLDER,
    name: "Repeated Stakeholder Management Pattern",
    description: `When the same stakeholder management behavior appears at least ${PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES} times in the PM's personal memory records (memory_type = 'stakeholder'), generate a candidate. Counts are computed from personal_pm_memory where pm_user_id matches and memory_type = 'stakeholder'.`,
    candidateCategory: "stakeholder_management_pattern",
    minimumOccurrences: PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [PERSONAL_RULE_REPEATED_RISK_RESPONSE]: {
    id: PERSONAL_RULE_REPEATED_RISK_RESPONSE,
    name: "Repeated Risk Response Pattern",
    description: `When the same risk response behavior appears at least ${PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES} times across the PM's personal effectiveness records (outcome_classification = 'success' or 'partial_success'), generate a candidate. Counts are computed from personal_pm_effectiveness where pm_user_id matches.`,
    candidateCategory: "risk_response_pattern",
    minimumOccurrences: PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [PERSONAL_RULE_REPEATED_DECISION]: {
    id: PERSONAL_RULE_REPEATED_DECISION,
    name: "Repeated Decision Pattern",
    description: `When the same decision behavior appears at least ${PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES} times across decisions linked to the PM in personal_pm_memory (memory_type = 'decision'), generate a candidate. Counts are computed from personal_pm_memory where pm_user_id matches and memory_type = 'decision'.`,
    candidateCategory: "decision_pattern",
    minimumOccurrences: PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
};

export function getPersonalRuleById(ruleId: string): PersonalPatternExtractionRule | null {
  return PERSONAL_RULE_REGISTRY[ruleId as PersonalRuleId] ?? null;
}

export function getAllPersonalRules(): PersonalPatternExtractionRule[] {
  return ALL_PERSONAL_RULE_IDS.map((id) => PERSONAL_RULE_REGISTRY[id]);
}
