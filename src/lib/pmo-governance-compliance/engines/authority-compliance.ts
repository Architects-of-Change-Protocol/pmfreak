import type { AuthorityComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA    = 75;
const EXPIRED_PENALTY_PER     = 5;
const EXPIRED_PENALTY_MAX     = 30;
const REVOKED_PENALTY_PER     = 3;
const REVOKED_PENALTY_MAX     = 20;
const INVALID_DELEGATION_PER  = 8;
const INVALID_DELEGATION_MAX  = 30;
const UNAUTHORIZED_ACTION_PER = 10;
const UNAUTHORIZED_ACTION_MAX = 40;

export function calculateAuthorityCompliance(input: AuthorityComplianceInput): number {
  const { totalAuthorities, expiredAuthorities, revokedAuthorities, invalidDelegations, unauthorizedActionCount } = input;

  if (totalAuthorities === 0) return DEFAULT_WHEN_NO_DATA;

  const expiredPenalty      = Math.min(expiredAuthorities   * EXPIRED_PENALTY_PER,     EXPIRED_PENALTY_MAX);
  const revokedPenalty      = Math.min(revokedAuthorities   * REVOKED_PENALTY_PER,     REVOKED_PENALTY_MAX);
  const delegationPenalty   = Math.min(invalidDelegations   * INVALID_DELEGATION_PER,  INVALID_DELEGATION_MAX);
  const unauthorizedPenalty = Math.min(unauthorizedActionCount * UNAUTHORIZED_ACTION_PER, UNAUTHORIZED_ACTION_MAX);

  const base = 100 - expiredPenalty - revokedPenalty - delegationPenalty - unauthorizedPenalty;
  return Math.max(0, Math.min(100, Math.round(base)));
}
