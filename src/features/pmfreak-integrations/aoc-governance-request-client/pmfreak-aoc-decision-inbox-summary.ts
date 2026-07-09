import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInboxSummary = {
  total: number;
  byDecision: Record<string, number>;
  byDecisionStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;

  allowedCount: number;
  blockedCount: number;
  heldCount: number;

  needsEvidenceCount: number;
  needsApprovalCount: number;
  needsBillingReviewCount: number;
  needsContractReviewCount: number;
  needsSecurityReviewCount: number;

  errorCount: number;
  warningCount: number;

  displayOnly: true;
};

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

const NEEDS_APPROVAL_STATUSES = new Set(["needs_pm_approval", "needs_customer_validation", "needs_executive_approval"]);

// Pure, deterministic counting. Never mutates `items`.
export function summarizePMFreakAocDecisionInboxItems(items: PMFreakAocDecisionInboxItem[]): PMFreakAocDecisionInboxSummary {
  const byDecision: Record<string, number> = {};
  const byDecisionStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  let allowedCount = 0;
  let blockedCount = 0;
  let heldCount = 0;
  let needsEvidenceCount = 0;
  let needsApprovalCount = 0;
  let needsBillingReviewCount = 0;
  let needsContractReviewCount = 0;
  let needsSecurityReviewCount = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (const item of items) {
    increment(byDecision, item.decision);
    increment(byDecisionStatus, item.decisionStatus);
    increment(bySeverity, item.decisionSeverity);
    increment(byCategory, item.category);
    increment(bySource, item.source);

    if (item.decisionStatus === "allowed") allowedCount += 1;
    if (item.decisionStatus === "blocked") blockedCount += 1;
    if (item.decisionStatus === "held") heldCount += 1;
    if (item.decisionStatus === "needs_evidence") needsEvidenceCount += 1;
    if (NEEDS_APPROVAL_STATUSES.has(item.decisionStatus)) needsApprovalCount += 1;
    if (item.decisionStatus === "needs_billing_review") needsBillingReviewCount += 1;
    if (item.decisionStatus === "needs_contract_review") needsContractReviewCount += 1;
    if (item.decisionStatus === "needs_security_review") needsSecurityReviewCount += 1;

    if (item.errors.length > 0) errorCount += 1;
    if (item.warnings.length > 0) warningCount += 1;
  }

  return {
    total: items.length,
    byDecision,
    byDecisionStatus,
    bySeverity,
    byCategory,
    bySource,
    allowedCount,
    blockedCount,
    heldCount,
    needsEvidenceCount,
    needsApprovalCount,
    needsBillingReviewCount,
    needsContractReviewCount,
    needsSecurityReviewCount,
    errorCount,
    warningCount,
    displayOnly: true,
  };
}
