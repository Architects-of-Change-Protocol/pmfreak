// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Intervention Engine
//
// Simulates the expected effect of a governance action without executing it.
// Provides advisory estimates to support human decision-making.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceActionType, InterventionSimulation } from "./types";

type InterventionProfile = {
  expectedEffect: string;
  baseConfidence: number;
  estimatedResolutionDays: number;
};

const INTERVENTION_PROFILES: Record<GovernanceActionType, InterventionProfile> = {
  create_escalation: {
    expectedEffect:          "reduce_escalation_gap",
    baseConfidence:          0.82,
    estimatedResolutionDays: 2,
  },
  request_ratification: {
    expectedEffect:          "reduce_approval_delay",
    baseConfidence:          0.78,
    estimatedResolutionDays: 3,
  },
  request_approval: {
    expectedEffect:          "reduce_approval_delay",
    baseConfidence:          0.80,
    estimatedResolutionDays: 2,
  },
  create_delegation: {
    expectedEffect:          "close_authority_gap",
    baseConfidence:          0.85,
    estimatedResolutionDays: 1,
  },
  assign_authority: {
    expectedEffect:          "close_authority_gap",
    baseConfidence:          0.83,
    estimatedResolutionDays: 1,
  },
  review_amendment: {
    expectedEffect:          "reduce_amendment_backlog",
    baseConfidence:          0.74,
    estimatedResolutionDays: 7,
  },
  review_decision: {
    expectedEffect:          "reduce_decision_bottleneck",
    baseConfidence:          0.76,
    estimatedResolutionDays: 5,
  },
  review_risk: {
    expectedEffect:          "reduce_risk_accumulation",
    baseConfidence:          0.72,
    estimatedResolutionDays: 7,
  },
  initiate_governance_review: {
    expectedEffect:          "resolve_governance_violation",
    baseConfidence:          0.88,
    estimatedResolutionDays: 14,
  },
  close_signal: {
    expectedEffect:          "archive_resolved_signal",
    baseConfidence:          0.95,
    estimatedResolutionDays: 0,
  },
  reassess_recommendation: {
    expectedEffect:          "re_evaluate_ignored_recommendation",
    baseConfidence:          0.70,
    estimatedResolutionDays: 5,
  },
  other: {
    expectedEffect:          "address_governance_concern",
    baseConfidence:          0.60,
    estimatedResolutionDays: 7,
  },
};

export function simulateGovernanceIntervention(
  actionType: GovernanceActionType,
  actionConfidence: number
): InterventionSimulation {
  const profile = INTERVENTION_PROFILES[actionType];
  // Blend profile base confidence with the action's own confidence
  const confidence = Math.round(
    (profile.baseConfidence * 0.6 + actionConfidence * 0.4) * 1000
  ) / 1000;

  return {
    actionType,
    expectedEffect:          profile.expectedEffect,
    confidence,
    estimatedResolutionDays: profile.estimatedResolutionDays,
  };
}
