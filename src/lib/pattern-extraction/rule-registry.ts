import type { PatternCandidateRule } from "./types";
import { EXTRACTION_MINIMUM_OCCURRENCES } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic extraction rules.
//
// Each rule specifies exactly what structured data to count and what threshold
// must be exceeded to generate a candidate. No text inference, no embeddings,
// no AI. An auditor can reconstruct every candidate purely from these rules
// and the raw data in the referenced tables.
// ─────────────────────────────────────────────────────────────────────────────

export const RULE_REPEATED_DECISION_OUTCOME = "repeated_decision_outcome" as const;
export const RULE_REPEATED_RISK_ESCALATION = "repeated_risk_escalation" as const;
export const RULE_REPEATED_DEPENDENCY_DELAY = "repeated_dependency_delay" as const;
export const RULE_REPEATED_DECISION_REJECTION = "repeated_decision_rejection" as const;

export const ALL_RULE_IDS = [
  RULE_REPEATED_DECISION_OUTCOME,
  RULE_REPEATED_RISK_ESCALATION,
  RULE_REPEATED_DEPENDENCY_DELAY,
  RULE_REPEATED_DECISION_REJECTION,
] as const;
export type RuleId = (typeof ALL_RULE_IDS)[number];

export const RULE_REGISTRY: Record<RuleId, PatternCandidateRule> = {
  [RULE_REPEATED_DECISION_OUTCOME]: {
    id: RULE_REPEATED_DECISION_OUTCOME,
    name: "Repeated Decision Outcome",
    description: `When the same decision_type produces the same outcome_status at least ${EXTRACTION_MINIMUM_OCCURRENCES} times within a workspace, generate a candidate. Counts are computed from project_decisions joined to decision_outcomes.`,
    patternCategory: "decision_pattern",
    minimumOccurrences: EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [RULE_REPEATED_RISK_ESCALATION]: {
    id: RULE_REPEATED_RISK_ESCALATION,
    name: "Repeated Risk Escalation",
    description: `When the same raid_item category appears with status 'open' or 'monitoring' at least ${EXTRACTION_MINIMUM_OCCURRENCES} times in a workspace, generate a candidate. Counts are computed from raid_items where category = 'risk'.`,
    patternCategory: "risk_pattern",
    minimumOccurrences: EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [RULE_REPEATED_DEPENDENCY_DELAY]: {
    id: RULE_REPEATED_DEPENDENCY_DELAY,
    name: "Repeated Dependency Delay",
    description: `When dependency raid_items accumulate at least ${EXTRACTION_MINIMUM_OCCURRENCES} open occurrences in a workspace, generate a candidate. Counts are computed from raid_items where category = 'dependency' and status in ('open','monitoring').`,
    patternCategory: "dependency_pattern",
    minimumOccurrences: EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
  [RULE_REPEATED_DECISION_REJECTION]: {
    id: RULE_REPEATED_DECISION_REJECTION,
    name: "Repeated Decision Rejection",
    description: `When the same decision_type is rejected at least ${EXTRACTION_MINIMUM_OCCURRENCES} times in a workspace, generate a candidate. Counts are computed from project_decisions where decision_status = 'rejected'.`,
    patternCategory: "governance_pattern",
    minimumOccurrences: EXTRACTION_MINIMUM_OCCURRENCES,
    confidenceWhenMet: "medium",
  },
};

export function getRuleById(ruleId: string): PatternCandidateRule | null {
  return RULE_REGISTRY[ruleId as RuleId] ?? null;
}

export function getAllRules(): PatternCandidateRule[] {
  return ALL_RULE_IDS.map((id) => RULE_REGISTRY[id]);
}
