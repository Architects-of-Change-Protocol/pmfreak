import type { ProjectOSHealthScore } from "./types";

// ─── Weight Configuration ─────────────────────────────────────────────────────
//
// Operating health is a weighted average of domain health scores.
// Governance and execution carry the most weight because they directly
// impact project outcomes; memory and recommendations support them.

const GOVERNANCE_WEIGHT    = 0.35;
const EXECUTION_WEIGHT     = 0.35;
const MEMORY_WEIGHT        = 0.15;
const RECOMMENDATION_WEIGHT = 0.15;

// ─── calculateGovernanceOSHealth ──────────────────────────────────────────────

export function calculateGovernanceOSHealth(input: {
  activeSignals: number;
  criticalSignals: number;
  unresolvedViolations: number;
}): number {
  let penalty = 0;
  penalty += input.criticalSignals * 25;
  penalty += (input.activeSignals - input.criticalSignals) * 5;
  penalty += input.unresolvedViolations * 15;
  return Math.max(0, Math.min(100, 100 - penalty));
}

// ─── calculateExecutionOSHealth ───────────────────────────────────────────────

export function calculateExecutionOSHealth(input: {
  activeCommitments: number;
  overdueCommitments: number;
  projectionAccuracy: number;
}): number {
  const overdueRatio = input.activeCommitments > 0
    ? input.overdueCommitments / input.activeCommitments
    : 0;
  const overduePenalty = Math.round(overdueRatio * 40);
  const accuracyBonus  = Math.round((input.projectionAccuracy - 70) / 10);
  return Math.max(0, Math.min(100, 100 - overduePenalty + Math.max(0, accuracyBonus)));
}

// ─── calculateMemoryOSHealth ──────────────────────────────────────────────────

export function calculateMemoryOSHealth(input: {
  artifacts: number;
  memoryRecords: number;
  digests: number;
  learningPatterns: number;
}): number {
  // Memory health increases with richness; no records = 60 (neutral, not punished)
  const totalRecords = input.artifacts + input.memoryRecords + input.digests + input.learningPatterns;
  if (totalRecords === 0) return 60;
  const bonus = Math.min(40, Math.floor(totalRecords / 2));
  return Math.min(100, 60 + bonus);
}

// ─── calculateRecommendationOSHealth ─────────────────────────────────────────

export function calculateRecommendationOSHealth(input: {
  activeRecommendations: number;
  highConfidenceRecommendations: number;
  ignoredRecommendations: number;
}): number {
  const ignoredPenalty = input.ignoredRecommendations * 10;
  const highConfidenceBonus = input.highConfidenceRecommendations > 0
    ? Math.min(10, input.highConfidenceRecommendations * 3)
    : 0;
  return Math.max(0, Math.min(100, 100 - ignoredPenalty + highConfidenceBonus));
}

// ─── calculateProjectOperatingHealth ─────────────────────────────────────────

export function calculateProjectOperatingHealth(input: {
  projectId: string;
  workspaceId: string;
  governanceHealthScore: number;
  executionHealthScore: number;
  memoryHealthScore: number;
  recommendationHealthScore: number;
}): ProjectOSHealthScore {
  const operatingHealthScore = Math.round(
    input.governanceHealthScore    * GOVERNANCE_WEIGHT +
    input.executionHealthScore     * EXECUTION_WEIGHT +
    input.memoryHealthScore        * MEMORY_WEIGHT +
    input.recommendationHealthScore * RECOMMENDATION_WEIGHT
  );

  return {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    operatingHealthScore: Math.max(0, Math.min(100, operatingHealthScore)),
    governanceHealthScore: input.governanceHealthScore,
    executionHealthScore: input.executionHealthScore,
    memoryHealthScore: input.memoryHealthScore,
    recommendationHealthScore: input.recommendationHealthScore,
    calculatedAt: new Date().toISOString(),
    breakdown: {
      governanceWeight: GOVERNANCE_WEIGHT,
      executionWeight: EXECUTION_WEIGHT,
      memoryWeight: MEMORY_WEIGHT,
      recommendationWeight: RECOMMENDATION_WEIGHT,
    },
  };
}
