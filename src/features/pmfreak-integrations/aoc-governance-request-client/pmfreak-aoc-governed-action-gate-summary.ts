import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

export type PMFreakAocGovernedActionGateSummary = {
  total: number;
  passedCount: number;
  blockedCount: number;
  heldCount: number;
  needsEvidenceCount: number;
  needsApprovalCount: number;
  needsReviewCount: number;
  errorCount: number;
  canProceedCount: number;
  cannotProceedCount: number;
  byVerdict: Record<string, number>;
  bySeverity: Record<string, number>;
  gateOnly: true;
};

// Pure aggregation over already-computed gate results. Does not mutate
// its input.
export function summarizePMFreakAocGovernedActionGateResults(results: PMFreakAocGovernedActionGateResult[]): PMFreakAocGovernedActionGateSummary {
  const byVerdict: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  let passedCount = 0;
  let blockedCount = 0;
  let heldCount = 0;
  let needsEvidenceCount = 0;
  let needsApprovalCount = 0;
  let needsReviewCount = 0;
  let errorCount = 0;
  let canProceedCount = 0;

  for (const result of results) {
    byVerdict[result.verdict] = (byVerdict[result.verdict] ?? 0) + 1;
    bySeverity[result.severity] = (bySeverity[result.severity] ?? 0) + 1;

    if (result.canProceed) {
      canProceedCount += 1;
    }

    switch (result.verdict) {
      case "passed":
        passedCount += 1;
        break;
      case "blocked":
        blockedCount += 1;
        break;
      case "held":
        heldCount += 1;
        break;
      case "needs_evidence":
        needsEvidenceCount += 1;
        break;
      case "needs_approval":
        needsApprovalCount += 1;
        break;
      case "needs_review":
        needsReviewCount += 1;
        break;
      case "error":
        errorCount += 1;
        break;
    }
  }

  return {
    total: results.length,
    passedCount,
    blockedCount,
    heldCount,
    needsEvidenceCount,
    needsApprovalCount,
    needsReviewCount,
    errorCount,
    canProceedCount,
    cannotProceedCount: results.length - canProceedCount,
    byVerdict,
    bySeverity,
    gateOnly: true,
  };
}
