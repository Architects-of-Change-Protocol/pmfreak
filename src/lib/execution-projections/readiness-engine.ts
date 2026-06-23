import type { ProjectionReadinessResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Execution Readiness Engine
//
// Calculates readiness score (0–100) based on five governance factors.
// Each factor is binary and weighted equally (20 points each).
// ─────────────────────────────────────────────────────────────────────────────

type ReadinessInput = {
  authorityReady:           boolean;
  dependenciesReady:        boolean;
  commitmentAccepted:       boolean;
  recommendationValidated:  boolean;
  governanceHealth:         boolean;
};

const FACTOR_WEIGHT = 20;

export function calculateExecutionReadiness(input: ReadinessInput): ProjectionReadinessResult {
  let score = 0;
  if (input.authorityReady)          score += FACTOR_WEIGHT;
  if (input.dependenciesReady)       score += FACTOR_WEIGHT;
  if (input.commitmentAccepted)      score += FACTOR_WEIGHT;
  if (input.recommendationValidated) score += FACTOR_WEIGHT;
  if (input.governanceHealth)        score += FACTOR_WEIGHT;
  return {
    score,
    authorityReady:          input.authorityReady,
    dependenciesReady:       input.dependenciesReady,
    commitmentAccepted:      input.commitmentAccepted,
    recommendationValidated: input.recommendationValidated,
    governanceHealth:        input.governanceHealth,
  };
}
