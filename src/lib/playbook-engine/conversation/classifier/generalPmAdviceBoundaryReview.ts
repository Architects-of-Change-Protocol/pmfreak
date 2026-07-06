/**
 * Sprint 17R — General PM Advice Boundary & Design Review.
 *
 * This is NOT another vocabulary-calibration sprint. Sprints 12R-16R closed vocabulary gaps for
 * project_status, playbook_analysis, closure_billing, governance_audit, risk_issue_dependency,
 * task_action, and communication_draft, pushing global compatibilityRate from 28.4% to 72.5%.
 * `general_pm_advice` (40%), `decision_support` (0%), and `ambiguous_or_unknown` (0%) were
 * explicitly left uncalibrated because they overlap by *design*, not by missing vocabulary — the
 * golden corpus's own `gpa-02`/`gpa-05`/`gpa-06`/`gpa-08`/`gpa-09`/`gpa-10` mismatches and the
 * `ga-09` (`governance_audit`/`decision_support`) mismatch are architecture-boundary questions, not
 * pattern-list gaps.
 *
 * This module is a pure, read-only boundary reviewer: given a corpus of boundary cases (see
 * `tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts`), it runs the existing
 * Sprint 10R shadow comparison (`intentCompatibilityAdapter.ts`) for each case and scores the
 * result against an explicit routing policy (see
 * `docs/conversational-brain-general-pm-advice-boundary.md`) for where `general_pm_advice` should
 * and should not win.
 *
 * Like every module in this package tree, this does not call the router, composer, or any handler;
 * does not touch `POST /api/command-center/chat`; does not read/write a database, call Supabase,
 * send email, or create a task; and does not activate the enriched classifier anywhere — there is
 * still no feature flag wired to anything.
 */

import type { ConversationIntent as ProductionConversationIntent } from "../types";
import type {
  ConversationIntentFamily as EnrichedConversationIntentFamily,
  ConversationIntentType as EnrichedConversationIntentType,
} from "@/lib/conversational-brain";

import {
  runIntentClassifierShadowComparison,
  type IntentMappingWarning,
  type ShadowComparisonOptions,
} from "./intentCompatibilityAdapter";

// ─── Corpus-facing types ──────────────────────────────────────────────────────────

export type GeneralPmAdviceBoundaryCategory =
  | "safe_general_pm_advice"
  | "playbook_analysis_preferred"
  | "decision_support_candidate"
  | "ambiguous_clarification_candidate"
  | "project_status_preferred"
  | "communication_draft_preferred"
  | "task_action_preferred"
  | "closure_billing_preferred"
  | "risk_issue_dependency_preferred"
  | "governance_audit_preferred";

export type GeneralPmAdviceBoundaryPolicyTargetKind =
  | "production_intent"
  | "architecture_candidate"
  | "clarification_candidate";

/**
 * For `policyTargetKind: "production_intent"` this is a real `ConversationIntent` value. For
 * `"architecture_candidate"` it is always the literal `"decision_support"` (documented gap, no
 * production intent exists for it yet). For `"clarification_candidate"` it is always the literal
 * `"needs_clarification"` (distinct from production's own `"clarification"` intent value, which
 * already exists but is not backed by a real clarification loop — see the policy doc).
 */
export type GeneralPmAdviceBoundaryPolicyTarget = ProductionConversationIntent | "decision_support" | "needs_clarification";

export type GeneralPmAdviceBoundaryRiskLevel = "low" | "medium" | "high";

export type GeneralPmAdviceBoundaryCase = {
  /** Unique identifier within the corpus, e.g. "gpa-b-01". */
  id: string;
  /** Natural-language PM phrase, in Spanish, as a real PMFreak user would type it. */
  input: string;
  boundaryCategory: GeneralPmAdviceBoundaryCategory;
  policyTargetKind: GeneralPmAdviceBoundaryPolicyTargetKind;
  policyTarget: GeneralPmAdviceBoundaryPolicyTarget;
  /** Why the policy says this case belongs where it does — required, never inferred at runtime. */
  rationale: string;
  riskLevel: GeneralPmAdviceBoundaryRiskLevel;
  /** Whether the current production intent model has a real, reachable intent for this case at all
   * (true) or whether it requires future architecture (decision_support handler, a clarification
   * loop) before it can be handled correctly (false). Recorded explicitly at authoring time — not
   * derived from live classifier output — so a corpus reviewer can see the claim directly. */
  shouldCurrentSystemHandle: boolean;
  notes?: string;
};

// ─── Result-facing types ──────────────────────────────────────────────────────────

export type GeneralPmAdviceBoundaryConflictType =
  | "none"
  | "general_pm_vs_playbook"
  | "general_pm_vs_decision_support"
  | "general_pm_vs_clarification"
  | "general_pm_vs_project_status"
  | "general_pm_vs_communication"
  | "general_pm_vs_task_action"
  | "general_pm_vs_closure_billing"
  | "general_pm_vs_risk_issue_dependency"
  | "general_pm_vs_governance_audit"
  | "classifier_disagreement"
  | "mapping_gap"
  | "architecture_gap";

export type GeneralPmAdviceBoundaryCaseResult = {
  id: string;
  input: string;
  boundaryCategory: GeneralPmAdviceBoundaryCategory;
  policyTarget: GeneralPmAdviceBoundaryPolicyTarget;
  policyTargetKind: GeneralPmAdviceBoundaryPolicyTargetKind;
  productionIntent: ProductionConversationIntent;
  enrichedFamily: EnrichedConversationIntentFamily;
  enrichedType: EnrichedConversationIntentType;
  mappedIntent: ProductionConversationIntent;
  /** Whether the live production intent matches this case's policyTarget (production_intent kind),
   * or whether the best available live signal matches the documented architecture-gap/clarification
   * fallback (the other two kinds — see `computeIsPolicyAligned` below for the exact rule per kind). */
  isPolicyAligned: boolean;
  /** True whenever this case's policy target is `decision_support` — i.e. no production intent can
   * ever represent it correctly yet, independent of whether this specific case is aligned. */
  isArchitectureGap: boolean;
  /** True whenever this case's policy target is `needs_clarification` — i.e. resolving it correctly
   * requires a clarification loop production does not have yet, independent of alignment. */
  isClarificationGap: boolean;
  /** Whether today's system (no architecture changes) behaves acceptably for this case: an exact
   * policy match when `shouldCurrentSystemHandle` is true, or a safe non-committal fallback (not a
   * confident wrong operational intent) when it is false. */
  isCurrentSystemAcceptable: boolean;
  conflictType: GeneralPmAdviceBoundaryConflictType;
  notes: string[];
};

type FamilyBucket =
  | "general_pm_advice"
  | "playbook_analysis"
  | "project_status"
  | "task_action"
  | "communication_draft"
  | "closure_billing"
  | "risk_issue_dependency"
  | "governance_audit"
  | "decision_support"
  | "needs_clarification"
  | "other";

function mapProductionIntentToFamilyBucket(intent: ProductionConversationIntent): FamilyBucket {
  switch (intent) {
    case "general_pm_advice":
      return "general_pm_advice";
    case "project_status_question":
      return "project_status";
    case "recommendation_request":
      return "playbook_analysis";
    case "risk_analysis":
      return "risk_issue_dependency";
    case "communication_draft":
      return "communication_draft";
    case "closure_question":
    case "billing_question":
      return "closure_billing";
    case "governance_question":
    case "audit_question":
      return "governance_audit";
    case "task_or_action_request":
      return "task_action";
    case "clarification":
      return "needs_clarification";
    case "unsupported":
    case "unknown":
      return "other";
    default: {
      const exhaustiveCheck: never = intent;
      throw new Error(`generalPmAdviceBoundaryReview: unmapped production intent '${String(exhaustiveCheck)}'.`);
    }
  }
}

function mapEnrichedFamilyToFamilyBucket(family: EnrichedConversationIntentFamily): FamilyBucket {
  if (family === "unknown") return "other";
  return family;
}

function policyFamilyBucketFor(kind: GeneralPmAdviceBoundaryPolicyTargetKind, target: GeneralPmAdviceBoundaryPolicyTarget): FamilyBucket {
  if (kind === "architecture_candidate") return "decision_support";
  if (kind === "clarification_candidate") return "needs_clarification";
  return mapProductionIntentToFamilyBucket(target as ProductionConversationIntent);
}

function computeIsPolicyAligned(
  kind: GeneralPmAdviceBoundaryPolicyTargetKind,
  target: GeneralPmAdviceBoundaryPolicyTarget,
  productionIntent: ProductionConversationIntent,
  enrichedFamily: EnrichedConversationIntentFamily,
): boolean {
  if (kind === "production_intent") return productionIntent === target;
  if (kind === "architecture_candidate") return enrichedFamily === "decision_support";
  return productionIntent === "clarification" || enrichedFamily === "needs_clarification";
}

function computeIsCurrentSystemAcceptable(
  shouldCurrentSystemHandle: boolean,
  isPolicyAligned: boolean,
  productionFamilyBucket: FamilyBucket,
): boolean {
  if (shouldCurrentSystemHandle) return isPolicyAligned;
  return (
    productionFamilyBucket === "other" ||
    productionFamilyBucket === "general_pm_advice" ||
    productionFamilyBucket === "needs_clarification"
  );
}

const CONFLICT_SUFFIX_BY_FAMILY: Partial<Record<FamilyBucket, GeneralPmAdviceBoundaryConflictType>> = {
  playbook_analysis: "general_pm_vs_playbook",
  decision_support: "general_pm_vs_decision_support",
  needs_clarification: "general_pm_vs_clarification",
  project_status: "general_pm_vs_project_status",
  communication_draft: "general_pm_vs_communication",
  task_action: "general_pm_vs_task_action",
  closure_billing: "general_pm_vs_closure_billing",
  risk_issue_dependency: "general_pm_vs_risk_issue_dependency",
  governance_audit: "general_pm_vs_governance_audit",
};

/**
 * Conflict classification order: (1) an exact policy match is always `"none"`; (2) any mismatch
 * where `general_pm_advice` is on one side (either it swallowed a case that should have gone
 * elsewhere, or it was missed for a case that should have been it) is named after the *other*
 * family, since this sprint's whole purpose is mapping general_pm_advice's boundary; (3) only once
 * general_pm_advice is ruled out on both sides do we fall back to the generic
 * architecture/clarification/disagreement buckets.
 */
function computeConflictType(
  isPolicyAligned: boolean,
  policyFamilyBucket: FamilyBucket,
  productionFamilyBucket: FamilyBucket,
): GeneralPmAdviceBoundaryConflictType {
  if (isPolicyAligned) return "none";

  if (policyFamilyBucket === "general_pm_advice" && productionFamilyBucket !== "general_pm_advice") {
    return CONFLICT_SUFFIX_BY_FAMILY[productionFamilyBucket] ?? "classifier_disagreement";
  }
  if (policyFamilyBucket !== "general_pm_advice" && productionFamilyBucket === "general_pm_advice") {
    return CONFLICT_SUFFIX_BY_FAMILY[policyFamilyBucket] ?? "classifier_disagreement";
  }
  if (policyFamilyBucket === "decision_support") return "architecture_gap";
  if (policyFamilyBucket === "needs_clarification") return "mapping_gap";
  return "classifier_disagreement";
}

export type GeneralPmAdviceBoundaryReviewOptions = ShadowComparisonOptions;

/**
 * Runs the Sprint 10R shadow comparison (production classifier + enriched classifier + adapter
 * mapping) for every case in the boundary corpus and scores each result against the explicit
 * routing policy in `docs/conversational-brain-general-pm-advice-boundary.md`. Pure — never
 * mutates `cases`, never calls the router, composer, any handler, a database, Supabase, or any
 * external service, and never activates the enriched classifier in production.
 */
export function runGeneralPmAdviceBoundaryReview(
  cases: GeneralPmAdviceBoundaryCase[],
  options: GeneralPmAdviceBoundaryReviewOptions = {},
): GeneralPmAdviceBoundaryCaseResult[] {
  return cases.map((boundaryCase) => {
    const shadow = runIntentClassifierShadowComparison(
      { workspaceId: "boundary-review", userId: "boundary-review", message: boundaryCase.input },
      options,
    );

    const productionIntent = shadow.productionIntent;
    const enrichedFamily = shadow.enrichedIntent.intentFamily;
    const enrichedType = shadow.enrichedIntent.intentType;
    const mappedIntent = shadow.mappedIntent;

    const isPolicyAligned = computeIsPolicyAligned(
      boundaryCase.policyTargetKind,
      boundaryCase.policyTarget,
      productionIntent,
      enrichedFamily,
    );

    const policyFamilyBucket = policyFamilyBucketFor(boundaryCase.policyTargetKind, boundaryCase.policyTarget);
    const productionFamilyBucket = mapProductionIntentToFamilyBucket(productionIntent);

    const isArchitectureGap = policyFamilyBucket === "decision_support";
    const isClarificationGap = policyFamilyBucket === "needs_clarification";
    const isCurrentSystemAcceptable = computeIsCurrentSystemAcceptable(
      boundaryCase.shouldCurrentSystemHandle,
      isPolicyAligned,
      productionFamilyBucket,
    );
    const conflictType = computeConflictType(isPolicyAligned, policyFamilyBucket, productionFamilyBucket);

    const notes: string[] = [];
    if (boundaryCase.notes) notes.push(boundaryCase.notes);
    if (!isPolicyAligned) {
      notes.push(
        `Policy expects "${boundaryCase.policyTarget}" (${boundaryCase.policyTargetKind}); live production intent is ` +
          `"${productionIntent}" and enriched family is "${enrichedFamily}/${enrichedType}" (mapped: "${mappedIntent}").`,
      );
    }
    for (const warning of shadow.migrationWarnings as IntentMappingWarning[]) {
      if (warning.severity === "caution") notes.push(`${warning.code}: ${warning.message}`);
    }

    return {
      id: boundaryCase.id,
      input: boundaryCase.input,
      boundaryCategory: boundaryCase.boundaryCategory,
      policyTarget: boundaryCase.policyTarget,
      policyTargetKind: boundaryCase.policyTargetKind,
      productionIntent,
      enrichedFamily,
      enrichedType,
      mappedIntent,
      isPolicyAligned,
      isArchitectureGap,
      isClarificationGap,
      isCurrentSystemAcceptable,
      conflictType,
      notes,
    };
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────

export type GeneralPmAdviceBoundaryCategorySummary = {
  boundaryCategory: GeneralPmAdviceBoundaryCategory;
  totalCases: number;
  policyAlignedCount: number;
  policyAlignedRate: number;
  currentSystemAcceptableCount: number;
  currentSystemAcceptableRate: number;
};

export type GeneralPmAdviceBoundaryNextSprintRecommendation =
  | "Sprint 18R — Decision Support Architecture"
  | "Sprint 18R — Ambiguous / Clarification Strategy"
  | "Sprint 18R — General PM Advice Calibration"
  | "Controlled Shadow Capture Prep"
  | "Decision Support + Clarification Architecture Review";

export type GeneralPmAdviceBoundarySummary = {
  totalCases: number;
  policyAlignedCount: number;
  policyAlignedRate: number;
  currentSystemAcceptableCount: number;
  currentSystemAcceptableRate: number;
  architectureGapCount: number;
  clarificationGapCount: number;
  byBoundaryCategory: Record<GeneralPmAdviceBoundaryCategory, GeneralPmAdviceBoundaryCategorySummary>;
  byConflictType: Record<GeneralPmAdviceBoundaryConflictType, number>;
  decisionSupportCandidates: GeneralPmAdviceBoundaryCaseResult[];
  clarificationCandidates: GeneralPmAdviceBoundaryCaseResult[];
  safeGeneralPmAdviceCases: GeneralPmAdviceBoundaryCaseResult[];
  /** Union of `casesWhereGeneralPmAdviceIsOverused` and `casesWhereGeneralPmAdviceIsMissed` — every
   * case where general_pm_advice sits on the wrong side of the live boundary, in either direction. */
  misroutedGeneralPmAdviceCases: GeneralPmAdviceBoundaryCaseResult[];
  /** Cases whose policy target is NOT general_pm_advice, but production currently resolves them to
   * general_pm_advice anyway (general_pm_advice swallowing another category's territory). */
  casesWhereGeneralPmAdviceIsOverused: GeneralPmAdviceBoundaryCaseResult[];
  /** Cases whose policy target IS general_pm_advice (boundaryCategory `safe_general_pm_advice`), but
   * production currently fails to resolve them to general_pm_advice (a real vocabulary/detection
   * gap, not a boundary/design gap). */
  casesWhereGeneralPmAdviceIsMissed: GeneralPmAdviceBoundaryCaseResult[];
  recommendedNextSprint: GeneralPmAdviceBoundaryNextSprintRecommendation;
  recommendation: string;
};

const BOUNDARY_CATEGORIES: GeneralPmAdviceBoundaryCategory[] = [
  "safe_general_pm_advice",
  "playbook_analysis_preferred",
  "decision_support_candidate",
  "ambiguous_clarification_candidate",
  "project_status_preferred",
  "communication_draft_preferred",
  "task_action_preferred",
  "closure_billing_preferred",
  "risk_issue_dependency_preferred",
  "governance_audit_preferred",
];

const CONFLICT_TYPES: GeneralPmAdviceBoundaryConflictType[] = [
  "none",
  "general_pm_vs_playbook",
  "general_pm_vs_decision_support",
  "general_pm_vs_clarification",
  "general_pm_vs_project_status",
  "general_pm_vs_communication",
  "general_pm_vs_task_action",
  "general_pm_vs_closure_billing",
  "general_pm_vs_risk_issue_dependency",
  "general_pm_vs_governance_audit",
  "classifier_disagreement",
  "mapping_gap",
  "architecture_gap",
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

/** Threshold (as a fraction of the corpus) above which an architecture/clarification gap slice is
 * considered "high" for the `recommendedNextSprint` heuristic below. */
const HIGH_GAP_SHARE = 0.12;
/** Alignment-rate threshold (percentage) below which `safe_general_pm_advice` is considered "low". */
const LOW_ALIGNMENT_RATE = 70;
/** Alignment/acceptability threshold (percentage) for recommending a controlled shadow capture. */
const SHADOW_CAPTURE_READY_RATE = 85;

function recommendNextSprint(input: {
  totalCases: number;
  architectureGapCount: number;
  clarificationGapCount: number;
  safeGeneralPmAdviceAlignmentRate: number;
  policyAlignedRate: number;
  currentSystemAcceptableRate: number;
}): { recommendedNextSprint: GeneralPmAdviceBoundaryNextSprintRecommendation; recommendation: string } {
  const {
    totalCases,
    architectureGapCount,
    clarificationGapCount,
    safeGeneralPmAdviceAlignmentRate,
    policyAlignedRate,
    currentSystemAcceptableRate,
  } = input;

  const architectureGapShare = totalCases > 0 ? architectureGapCount / totalCases : 0;
  const clarificationGapShare = totalCases > 0 ? clarificationGapCount / totalCases : 0;
  const architectureGapHigh = architectureGapShare >= HIGH_GAP_SHARE;
  const clarificationGapHigh = clarificationGapShare >= HIGH_GAP_SHARE;

  if (architectureGapHigh && clarificationGapHigh) {
    return {
      recommendedNextSprint: "Decision Support + Clarification Architecture Review",
      recommendation:
        `Both architecture gaps (${architectureGapCount}/${totalCases} cases, ${round1(architectureGapShare * 100)}%) and ` +
        `clarification gaps (${clarificationGapCount}/${totalCases} cases, ${round1(clarificationGapShare * 100)}%) are ` +
        "large enough that neither can be deferred — scope a combined architecture review covering both a " +
        "decision_support production handler and a clarification-loop strategy before the next vocabulary sprint.",
    };
  }
  if (architectureGapHigh) {
    return {
      recommendedNextSprint: "Sprint 18R — Decision Support Architecture",
      recommendation:
        `decision_support candidates make up ${architectureGapCount}/${totalCases} cases (${round1(architectureGapShare * 100)}%) ` +
        "with no production intent to map to — prioritize designing a decision_support production handler next.",
    };
  }
  if (clarificationGapHigh) {
    return {
      recommendedNextSprint: "Sprint 18R — Ambiguous / Clarification Strategy",
      recommendation:
        `clarification candidates make up ${clarificationGapCount}/${totalCases} cases (${round1(clarificationGapShare * 100)}%) ` +
        "with no real clarification loop backing them — prioritize a clarification strategy before further calibration.",
    };
  }
  if (safeGeneralPmAdviceAlignmentRate < LOW_ALIGNMENT_RATE) {
    return {
      recommendedNextSprint: "Sprint 18R — General PM Advice Calibration",
      recommendation:
        `safe_general_pm_advice alignment is low (${safeGeneralPmAdviceAlignmentRate}%) while architecture gaps stay ` +
        "small — this is a vocabulary problem, not a boundary problem, so it is safe to run a calibration sprint next.",
    };
  }
  if (policyAlignedRate >= SHADOW_CAPTURE_READY_RATE && currentSystemAcceptableRate >= SHADOW_CAPTURE_READY_RATE) {
    return {
      recommendedNextSprint: "Controlled Shadow Capture Prep",
      recommendation:
        `policyAlignedRate (${policyAlignedRate}%) and currentSystemAcceptableRate (${currentSystemAcceptableRate}%) are both ` +
        ">= 85% — the boundary is well-understood and stable enough to prepare a controlled shadow capture.",
    };
  }
  return {
    recommendedNextSprint: "Sprint 18R — General PM Advice Calibration",
    recommendation:
      "No single gap dominates (architecture and clarification gaps are both below the high-share threshold, and " +
      "safe_general_pm_advice alignment is not critically low) — the next-lowest-risk step is a targeted " +
      "general_pm_advice vocabulary calibration sprint, re-running this boundary review afterward.",
  };
}

/**
 * Turns a `runGeneralPmAdviceBoundaryReview()` result array into a review-ready report: global +
 * per-boundary-category alignment rates, conflict-type breakdown, the decision_support/
 * clarification candidate slices, the general_pm_advice over/under-use slices, and a next-sprint
 * recommendation. Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeGeneralPmAdviceBoundaryReview(
  results: GeneralPmAdviceBoundaryCaseResult[],
): GeneralPmAdviceBoundarySummary {
  const totalCases = results.length;

  const byBoundaryCategory = Object.fromEntries(
    BOUNDARY_CATEGORIES.map((boundaryCategory) => [
      boundaryCategory,
      {
        boundaryCategory,
        totalCases: 0,
        policyAlignedCount: 0,
        policyAlignedRate: 0,
        currentSystemAcceptableCount: 0,
        currentSystemAcceptableRate: 0,
      } satisfies GeneralPmAdviceBoundaryCategorySummary,
    ]),
  ) as Record<GeneralPmAdviceBoundaryCategory, GeneralPmAdviceBoundaryCategorySummary>;

  const byConflictType = Object.fromEntries(CONFLICT_TYPES.map((conflictType) => [conflictType, 0])) as Record<
    GeneralPmAdviceBoundaryConflictType,
    number
  >;

  let policyAlignedCount = 0;
  let currentSystemAcceptableCount = 0;
  let architectureGapCount = 0;
  let clarificationGapCount = 0;

  const decisionSupportCandidates: GeneralPmAdviceBoundaryCaseResult[] = [];
  const clarificationCandidates: GeneralPmAdviceBoundaryCaseResult[] = [];
  const safeGeneralPmAdviceCases: GeneralPmAdviceBoundaryCaseResult[] = [];
  const casesWhereGeneralPmAdviceIsOverused: GeneralPmAdviceBoundaryCaseResult[] = [];
  const casesWhereGeneralPmAdviceIsMissed: GeneralPmAdviceBoundaryCaseResult[] = [];

  for (const result of results) {
    const categorySummary = byBoundaryCategory[result.boundaryCategory];
    categorySummary.totalCases += 1;
    if (result.isPolicyAligned) {
      policyAlignedCount += 1;
      categorySummary.policyAlignedCount += 1;
    }
    if (result.isCurrentSystemAcceptable) {
      currentSystemAcceptableCount += 1;
      categorySummary.currentSystemAcceptableCount += 1;
    }
    if (result.isArchitectureGap) architectureGapCount += 1;
    if (result.isClarificationGap) clarificationGapCount += 1;

    byConflictType[result.conflictType] += 1;

    if (result.boundaryCategory === "decision_support_candidate") decisionSupportCandidates.push(result);
    if (result.boundaryCategory === "ambiguous_clarification_candidate") clarificationCandidates.push(result);
    if (result.boundaryCategory === "safe_general_pm_advice") {
      safeGeneralPmAdviceCases.push(result);
      if (!result.isPolicyAligned) casesWhereGeneralPmAdviceIsMissed.push(result);
    } else if (
      result.conflictType === "general_pm_vs_playbook" ||
      result.conflictType === "general_pm_vs_decision_support" ||
      result.conflictType === "general_pm_vs_clarification" ||
      result.conflictType === "general_pm_vs_project_status" ||
      result.conflictType === "general_pm_vs_communication" ||
      result.conflictType === "general_pm_vs_task_action" ||
      result.conflictType === "general_pm_vs_closure_billing" ||
      result.conflictType === "general_pm_vs_risk_issue_dependency" ||
      result.conflictType === "general_pm_vs_governance_audit"
    ) {
      casesWhereGeneralPmAdviceIsOverused.push(result);
    }
  }

  for (const boundaryCategory of BOUNDARY_CATEGORIES) {
    const categorySummary = byBoundaryCategory[boundaryCategory];
    categorySummary.policyAlignedRate = rateOf(categorySummary.policyAlignedCount, categorySummary.totalCases);
    categorySummary.currentSystemAcceptableRate = rateOf(
      categorySummary.currentSystemAcceptableCount,
      categorySummary.totalCases,
    );
  }

  const policyAlignedRate = rateOf(policyAlignedCount, totalCases);
  const currentSystemAcceptableRate = rateOf(currentSystemAcceptableCount, totalCases);
  const safeGeneralPmAdviceAlignmentRate = byBoundaryCategory.safe_general_pm_advice.policyAlignedRate;

  const { recommendedNextSprint, recommendation } = recommendNextSprint({
    totalCases,
    architectureGapCount,
    clarificationGapCount,
    safeGeneralPmAdviceAlignmentRate,
    policyAlignedRate,
    currentSystemAcceptableRate,
  });

  return {
    totalCases,
    policyAlignedCount,
    policyAlignedRate,
    currentSystemAcceptableCount,
    currentSystemAcceptableRate,
    architectureGapCount,
    clarificationGapCount,
    byBoundaryCategory,
    byConflictType,
    decisionSupportCandidates,
    clarificationCandidates,
    safeGeneralPmAdviceCases,
    misroutedGeneralPmAdviceCases: [...casesWhereGeneralPmAdviceIsOverused, ...casesWhereGeneralPmAdviceIsMissed],
    casesWhereGeneralPmAdviceIsOverused,
    casesWhereGeneralPmAdviceIsMissed,
    recommendedNextSprint,
    recommendation,
  };
}

// ─── Policy explanation ────────────────────────────────────────────────────────────

export type GeneralPmAdviceBoundaryPolicyExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  whatIsGeneralPmAdvice: string;
  whatIsNotGeneralPmAdvice: string[];
  precedenceRules: Array<{ category: GeneralPmAdviceBoundaryCategory; beatsGeneralPmAdviceWhen: string }>;
  categoriesThatBeatGeneralPmAdvice: GeneralPmAdviceBoundaryCategory[];
  unresolvedArchitectureGaps: string[];
  unresolvedClarificationGaps: string[];
};

/**
 * Capability explanation for the Sprint 17R boundary review module — mirrors the style of
 * `explainIntentCompatibilityMapping()` (Sprint 10R) and `explainGoldenIntentEvaluation()`
 * (Sprint 11R). See `docs/conversational-brain-general-pm-advice-boundary.md` for full context.
 */
export function explainGeneralPmAdviceBoundaryPolicy(): GeneralPmAdviceBoundaryPolicyExplain {
  return {
    capability: "playbook-engine-conversation-general-pm-advice-boundary-review",
    purpose:
      "Defines an explicit routing policy for general_pm_advice's boundary against the eight other conversation " +
      "intent categories, and measures alignment between that policy, the production classifier, the enriched " +
      "classifier, and the Sprint 10R adapter's mapped intent — without changing production behavior or the " +
      "global golden-corpus compatibilityRate.",
    doesNot: [
      "Does not replace, call, or modify classifier/intentClassifier.rules.ts or intent-patterns.ts.",
      "Does not touch router/brainRouter.ts, composer/responseComposer.ts, or any handlers/*.ts.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or emit audit events.",
      "Does not activate the enriched classifier in production — there is still no feature flag wired to anything.",
      "Does not create a decision_support production handler or a clarification loop — both remain documented gaps.",
    ],
    whatIsGeneralPmAdvice:
      "general_pm_advice is the category for general PM orientation, coaching, and good-practice guidance — used " +
      "when the user asks 'how would you handle X' / 'what should I watch out for' without asking for project " +
      "status, a playbook recommendation, a decision between options, a communication draft, a task/action, a " +
      "risk/issue/dependency read, an audit/evidence trail, or a closure/billing readiness check.",
    whatIsNotGeneralPmAdvice: [
      "Not a substitute for playbook_analysis: 'qué recomienda el playbook' asks for PMFreak's own governed " +
        "recommendation, not general coaching.",
      "Not a substitute for decision_support: 'qué opción debería escoger' asks to resolve a concrete decision " +
        "between named alternatives, not for general advice on how to decide.",
      "Not a substitute for ambiguous/clarification handling: 'ayuda' or 'qué hacemos' is too underspecified to " +
        "safely answer as PM advice — it needs a clarifying question, not a canned coaching answer.",
      "Not a substitute for project_status, task_action, communication_draft, risk_issue_dependency, " +
        "governance_audit, or closure_billing whenever the message contains one of those categories' explicit " +
        "operational signal words (see precedenceRules below).",
    ],
    precedenceRules: [
      {
        category: "project_status_preferred",
        beatsGeneralPmAdviceWhen: "the message asks about status, progress, or health (\"cómo va\", \"estado\", \"avance\", \"atrasados\", \"salud del proyecto\", \"bloqueos\").",
      },
      {
        category: "playbook_analysis_preferred",
        beatsGeneralPmAdviceWhen: "the message asks for the playbook's own recommendation or governed next action (\"qué recomienda el playbook\", \"según el playbook\", \"siguiente mejor acción\").",
      },
      {
        category: "communication_draft_preferred",
        beatsGeneralPmAdviceWhen: "the message asks to draft, answer, or prepare a communication artifact (\"redactame un correo\", \"preparame una minuta\", \"cómo le digo al cliente\").",
      },
      {
        category: "task_action_preferred",
        beatsGeneralPmAdviceWhen: "the message asks to create, assign, convert, mark, or close a task/action (\"creá una tarea\", \"asignale seguimiento\", \"cerrá esta acción\").",
      },
      {
        category: "closure_billing_preferred",
        beatsGeneralPmAdviceWhen: "the message asks about closure/billing/reception readiness (\"qué falta para facturar\", \"estamos listos para cerrar\").",
      },
      {
        category: "risk_issue_dependency_preferred",
        beatsGeneralPmAdviceWhen: "the message asks about explicit risks, issues, dependencies, or blockers (\"qué riesgos hay\", \"qué nos está deteniendo\").",
      },
      {
        category: "governance_audit_preferred",
        beatsGeneralPmAdviceWhen: "the message asks for evidence, rules, justification, or an audit trail (\"por qué recomendaste esto\", \"mostrame el audit trail\").",
      },
      {
        category: "decision_support_candidate",
        beatsGeneralPmAdviceWhen: "the message asks to choose between named options or unblock a specific pending decision (\"qué opción debería escoger\", \"deberíamos hacer A o B\") — documented as an architecture_candidate, not mapped to a production intent yet.",
      },
      {
        category: "ambiguous_clarification_candidate",
        beatsGeneralPmAdviceWhen: "the message is too underspecified to answer safely (\"ayuda\", \"qué hacemos\", \"no sé qué hacer\") — documented as a clarification_candidate needing a real clarification loop, not a canned advice answer.",
      },
    ],
    categoriesThatBeatGeneralPmAdvice: [
      "project_status_preferred",
      "playbook_analysis_preferred",
      "communication_draft_preferred",
      "task_action_preferred",
      "closure_billing_preferred",
      "risk_issue_dependency_preferred",
      "governance_audit_preferred",
      "decision_support_candidate",
      "ambiguous_clarification_candidate",
    ],
    unresolvedArchitectureGaps: [
      "decision_support has no production ConversationIntent, route, or handler — every decision_support_candidate " +
        "case's best-case outcome today is the enriched classifier correctly detecting the family while production " +
        "and the adapter both fall back to 'unsupported'.",
      "The governance_audit/decision_support vocabulary overlap documented since Sprint 11R (golden corpus case " +
        "ga-09) is a symptom of this same gap, not a pattern-list bug.",
    ],
    unresolvedClarificationGaps: [
      "Production's 'clarification' intent and the enriched classifier's 'needs_clarification' family both exist, " +
        "but neither is backed by an actual clarification loop (asking a targeted follow-up question) — both " +
        "currently resolve straight through to general_pm_advisor, which is a documented simplification, not a " +
        "clarification strategy.",
      "Short, ambiguous inputs ('ayuda', 'qué hacemos', 'dale seguimiento') are indistinguishable from genuine " +
        "general_pm_advice requests using vocabulary alone — resolving this requires a product decision on what a " +
        "clarification loop should ask, not another pattern-list calibration.",
    ],
  };
}
