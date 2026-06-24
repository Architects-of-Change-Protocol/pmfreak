import type { RatificationComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA = 75;
const PENDING_PENALTY_PER  = 4;
const PENDING_PENALTY_MAX  = 30;
const EXPIRED_PENALTY_PER  = 8;
const EXPIRED_PENALTY_MAX  = 35;
const MISSING_PENALTY_PER  = 10;
const MISSING_PENALTY_MAX  = 40;

export function calculateRatificationCompliance(input: RatificationComplianceInput): number {
  const { totalRatifications, pendingRatifications, expiredRatifications, missingRatificationCount } = input;

  if (totalRatifications === 0 && missingRatificationCount === 0) return DEFAULT_WHEN_NO_DATA;

  const pendingPenalty  = Math.min(pendingRatifications   * PENDING_PENALTY_PER,  PENDING_PENALTY_MAX);
  const expiredPenalty  = Math.min(expiredRatifications   * EXPIRED_PENALTY_PER,  EXPIRED_PENALTY_MAX);
  const missingPenalty  = Math.min(missingRatificationCount * MISSING_PENALTY_PER, MISSING_PENALTY_MAX);

  const base = 100 - pendingPenalty - expiredPenalty - missingPenalty;
  return Math.max(0, Math.min(100, Math.round(base)));
}
