import type { ConstitutionComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA = 75;
const LIFECYCLE_WEIGHT     = 0.30;
const AMENDMENT_WEIGHT     = 0.20;
const COMPLETENESS_WEIGHT  = 0.50;

export function calculateConstitutionCompliance(input: ConstitutionComplianceInput): number {
  const { constitutionCount, constitutionsWithValidLifecycle, constitutionsWithAmendments, completeConstitutionCount } = input;

  if (constitutionCount === 0) return DEFAULT_WHEN_NO_DATA;

  const lifecycleRate   = constitutionsWithValidLifecycle / constitutionCount;
  const amendmentRate   = constitutionsWithAmendments    / constitutionCount;
  const completenessRate = completeConstitutionCount     / constitutionCount;

  const score =
    lifecycleRate   * LIFECYCLE_WEIGHT   * 100 +
    amendmentRate   * AMENDMENT_WEIGHT   * 100 +
    completenessRate * COMPLETENESS_WEIGHT * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}
