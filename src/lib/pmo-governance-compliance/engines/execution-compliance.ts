import type { ExecutionComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA  = 75;
const COMPLETION_WEIGHT     = 0.35;
const REALITY_WEIGHT        = 0.35;
const DRIFT_PENALTY_PER     = 5;
const DRIFT_PENALTY_MAX     = 30;
const INTEGRITY_PENALTY_PER = 10;
const INTEGRITY_PENALTY_MAX = 40;

export function calculateExecutionCompliance(input: ExecutionComplianceInput): number {
  const { totalCommitments, completedCommitments, driftCount, validatedRealities, totalRealities, integrityViolations } = input;

  const hasCommitments = totalCommitments > 0;
  const hasRealities   = totalRealities   > 0;

  if (!hasCommitments && !hasRealities) return DEFAULT_WHEN_NO_DATA;

  const completionRate  = hasCommitments ? completedCommitments / totalCommitments : 0.75;
  const realityRate     = hasRealities   ? validatedRealities   / totalRealities   : 0.75;

  const driftPenalty     = Math.min(driftCount          * DRIFT_PENALTY_PER,     DRIFT_PENALTY_MAX);
  const integrityPenalty = Math.min(integrityViolations * INTEGRITY_PENALTY_PER, INTEGRITY_PENALTY_MAX);

  const base =
    completionRate * COMPLETION_WEIGHT * 100 +
    realityRate    * REALITY_WEIGHT    * 100 +
    (1 - COMPLETION_WEIGHT - REALITY_WEIGHT) * 100;

  return Math.max(0, Math.min(100, Math.round(base - driftPenalty - integrityPenalty)));
}
