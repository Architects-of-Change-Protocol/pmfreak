import type { PlaybookEngineResult } from "./types";
import type {
  BillingBlocker,
  ClosureBillingAssessment,
  ClosureBillingAssessmentReviewStatus,
  ClosureBlocker,
  ClosureChecklistItem,
} from "./closure-billing-types";

/**
 * Governed status helpers for closure/billing checklist items, blockers, and the assessment
 * itself. None of these ever reach "closed"/"invoiced" — that lifecycle intentionally does not
 * exist here. `reviewed` on an assessment or blocker only records that a human looked at it; it
 * is never equivalent to `readyForClosure`/`readyForBilling` becoming true, and there is no
 * transition anywhere in this module that a human did not explicitly request.
 */

/** Only a `requires_validation` checklist item can be marked validated — a human confirmed the
 * evidence one way or the other. `complete`/`missing`/`not_applicable` are left to re-evaluation
 * (`buildClosureChecklist`), never mutated by hand here. */
export function markClosureChecklistItemValidated(item: ClosureChecklistItem): PlaybookEngineResult<ClosureChecklistItem> {
  if (item.status !== "requires_validation") {
    return {
      ok: false,
      error: `Cannot mark checklist item '${item.id}' as validated from status '${item.status}'. Only 'requires_validation' items can be validated.`,
      failureClass: "validation_failed",
    };
  }
  return { ok: true, data: { ...item, status: "complete", notes: null } };
}

function markBlockerReviewed<T extends ClosureBlocker | BillingBlocker>(blocker: T): PlaybookEngineResult<T> {
  if (blocker.status !== "open") {
    return {
      ok: false,
      error: `Cannot mark blocker '${blocker.id}' as reviewed from status '${blocker.status}'. Only 'open' blockers can be reviewed.`,
      failureClass: "validation_failed",
    };
  }
  return { ok: true, data: { ...blocker, status: "reviewed" } };
}

/** A human has reviewed this closure blocker. Never resolves it — resolution is only ever
 * reflected by the underlying evidence changing and the checklist being re-evaluated. */
export function markClosureBlockerReviewed(blocker: ClosureBlocker): PlaybookEngineResult<ClosureBlocker> {
  return markBlockerReviewed(blocker);
}

/** A human has reviewed this billing blocker. Never resolves it, never enables billing. */
export function markBillingBlockerReviewed(blocker: BillingBlocker): PlaybookEngineResult<BillingBlocker> {
  return markBlockerReviewed(blocker);
}

export const CLOSURE_BILLING_ASSESSMENT_TRANSITIONS: Readonly<Record<ClosureBillingAssessmentReviewStatus, readonly ClosureBillingAssessmentReviewStatus[]>> = {
  draft: ["reviewed", "discarded"],
  reviewed: ["discarded"],
  discarded: [],
};

/** A human has reviewed the assessment. This is not equivalent to `readyForClosure`/
 * `readyForBilling` becoming true, and it never triggers closure or billing. */
export function markClosureBillingAssessmentReviewed(assessment: ClosureBillingAssessment): PlaybookEngineResult<ClosureBillingAssessment> {
  const allowed = CLOSURE_BILLING_ASSESSMENT_TRANSITIONS[assessment.reviewStatus];
  if (!allowed.includes("reviewed")) {
    return {
      ok: false,
      error: `Cannot transition closure & billing assessment from '${assessment.reviewStatus}' to 'reviewed'.`,
      failureClass: "validation_failed",
    };
  }
  return { ok: true, data: { ...assessment, reviewStatus: "reviewed", updatedAt: new Date().toISOString() } };
}

/** A human has discarded the assessment (e.g. it is stale). Terminal — a discarded assessment
 * must be regenerated from fresh evidence, never revived. */
export function discardClosureBillingAssessment(assessment: ClosureBillingAssessment): PlaybookEngineResult<ClosureBillingAssessment> {
  const allowed = CLOSURE_BILLING_ASSESSMENT_TRANSITIONS[assessment.reviewStatus];
  if (!allowed.includes("discarded")) {
    return {
      ok: false,
      error: `Cannot transition closure & billing assessment from '${assessment.reviewStatus}' to 'discarded'.`,
      failureClass: "validation_failed",
    };
  }
  return { ok: true, data: { ...assessment, reviewStatus: "discarded", updatedAt: new Date().toISOString() } };
}
