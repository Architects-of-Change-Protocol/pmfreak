import type { GovernanceScoreInput } from "../types";

const VIOLATION_PENALTY_PER = 3;
const VIOLATION_PENALTY_MAX = 30;
const ESCALATION_PENALTY_PER = 5;
const ESCALATION_PENALTY_MAX = 20;
const DEFAULT_WHEN_NO_DATA = 75;

export function calculatePMGovernanceScore(input: GovernanceScoreInput): number {
  const { governanceHealthScores, openViolationCount, pendingEscalationCount } = input;

  if (governanceHealthScores.length === 0) return DEFAULT_WHEN_NO_DATA;

  const avgHealth =
    governanceHealthScores.reduce((sum, s) => sum + s, 0) / governanceHealthScores.length;

  const violationPenalty = Math.min(openViolationCount * VIOLATION_PENALTY_PER, VIOLATION_PENALTY_MAX);
  const escalationPenalty = Math.min(pendingEscalationCount * ESCALATION_PENALTY_PER, ESCALATION_PENALTY_MAX);

  return Math.max(0, Math.min(100, Math.round(avgHealth - violationPenalty - escalationPenalty)));
}
