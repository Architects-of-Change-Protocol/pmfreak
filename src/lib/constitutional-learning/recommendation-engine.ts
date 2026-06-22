// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Recommendation Engine
// Generates actionable recommendations from Learning Patterns.
// Sovereignty Rule 5: Every recommendation must be justifiable via pattern traceability.
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningPatternType } from "./types";

export type GeneratedRecommendation = {
  recommendation: string;
  confidence: number;
};

const RECOMMENDATION_MAP: Partial<Record<string, GeneratedRecommendation>> = {
  // Risk patterns
  "risk_pattern::third_party_dependency": {
    recommendation:
      "Introduce a vendor readiness assessment before schedule approval. Validate delivery capability and contractual obligations early.",
    confidence: 0.82,
  },
  "risk_pattern::approval_delay": {
    recommendation:
      "Introduce early ratification checkpoints. Identify approval authorities before project kickoff and pre-schedule sign-off windows.",
    confidence: 0.79,
  },
  "risk_pattern::resource_shortage": {
    recommendation:
      "Perform capacity planning at project initiation. Identify resource constraints and establish escalation paths for staffing gaps.",
    confidence: 0.76,
  },
  "risk_pattern::technical_complexity": {
    recommendation:
      "Require technical feasibility review before commitment. Decompose complex deliverables and validate assumptions with subject matter experts.",
    confidence: 0.74,
  },
  "risk_pattern::regulatory_compliance": {
    recommendation:
      "Engage compliance review at project inception. Map regulatory requirements to deliverables and assign accountability early.",
    confidence: 0.78,
  },
  "risk_pattern::budget_overrun": {
    recommendation:
      "Establish budget checkpoints at milestone gates. Define contingency thresholds and escalation triggers before project start.",
    confidence: 0.75,
  },
  "risk_pattern::scope_creep": {
    recommendation:
      "Define and freeze scope at project initiation. Implement formal change control and require authority approval for scope additions.",
    confidence: 0.77,
  },
  // Decision patterns
  "decision_pattern::vendor_replacement": {
    recommendation:
      "Introduce vendor transition planning before replacement decisions. Document handover criteria and continuity requirements.",
    confidence: 0.80,
  },
  "decision_pattern::schedule_change": {
    recommendation:
      "Require impact assessment before approving schedule changes. Quantify downstream effects on dependencies and milestones.",
    confidence: 0.73,
  },
  "decision_pattern::approval_required": {
    recommendation:
      "Map approval authority to decision categories in advance. Prevent decision bottlenecks by pre-delegating routine approvals.",
    confidence: 0.75,
  },
  "decision_pattern::budget_adjustment": {
    recommendation:
      "Define budget adjustment thresholds and approval chains at project start. Require justification documentation for all adjustments.",
    confidence: 0.72,
  },
  "decision_pattern::resource_reallocation": {
    recommendation:
      "Document resource reallocation impact before executing. Validate that receiving and source streams both remain viable.",
    confidence: 0.70,
  },
  // Governance patterns
  "governance_pattern::authority_gap": {
    recommendation:
      "Conduct authority mapping before project initiation. Identify all decision categories and assign responsible authorities.",
    confidence: 0.81,
  },
  "governance_pattern::late_escalation": {
    recommendation:
      "Define escalation triggers and timeboxes at project start. Require proactive escalation before blockers become critical path issues.",
    confidence: 0.78,
  },
  "governance_pattern::approval_bottleneck": {
    recommendation:
      "Identify approval bottleneck risk by mapping approver availability against project timeline before commitment.",
    confidence: 0.76,
  },
  "governance_pattern::decision_reversal": {
    recommendation:
      "Require ratification before implementing major decisions. Document reversal conditions and authority thresholds upfront.",
    confidence: 0.74,
  },
  // Outcome patterns
  "outcome_pattern::delivery_delay": {
    recommendation:
      "Establish delivery risk indicators and monitor them weekly. Define delay thresholds that trigger automatic escalation.",
    confidence: 0.77,
  },
  "outcome_pattern::cost_overrun": {
    recommendation:
      "Implement financial tracking with leading indicators. Define spend velocity thresholds that trigger review before overrun occurs.",
    confidence: 0.75,
  },
  "outcome_pattern::cancelled": {
    recommendation:
      "Define viability criteria at project initiation. Conduct periodic go/no-go reviews at milestone gates to enable early cancellation.",
    confidence: 0.72,
  },
};

const FALLBACK_RECOMMENDATIONS: Record<LearningPatternType, string> = {
  decision_pattern:
    "Document decision criteria and authority requirements before this pattern recurs. Establish a standard decision framework for this category.",
  risk_pattern:
    "Develop a risk mitigation playbook for this pattern. Define standard mitigation steps and assign ownership before the risk materializes.",
  governance_pattern:
    "Strengthen governance controls for this pattern. Define accountability, escalation paths, and review cadences proactively.",
  authority_pattern:
    "Clarify authority boundaries for this pattern. Establish delegation rules and conflict resolution procedures in advance.",
  amendment_pattern:
    "Create a standard amendment protocol for this pattern. Define approval chains, documentation requirements, and ratification steps.",
  delivery_pattern:
    "Establish delivery checkpoints and success criteria for this pattern. Define acceptance criteria and validation procedures.",
  outcome_pattern:
    "Define success and failure criteria for this pattern before project commitment. Build monitoring into project governance.",
};

export function generateRecommendation(
  patternType: LearningPatternType,
  patternKey: string,
  confidenceScore: number,
): GeneratedRecommendation {
  const lookup = RECOMMENDATION_MAP[`${patternType}::${patternKey}`];
  if (lookup) {
    // Blend stored confidence with the pattern's actual confidence
    const blended = Math.round(((lookup.confidence + confidenceScore) / 2) * 1000) / 1000;
    return { recommendation: lookup.recommendation, confidence: blended };
  }

  const fallback = FALLBACK_RECOMMENDATIONS[patternType];
  return {
    recommendation: fallback,
    confidence: Math.round(Math.min(0.6, confidenceScore * 0.8) * 1000) / 1000,
  };
}
