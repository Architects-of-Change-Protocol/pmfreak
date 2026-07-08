/**
 * Sprint 34R — Decision Support Response Draft Quality Evaluation.
 *
 * A pure, offline, deterministic **response draft quality evaluation** — not a user-visible dry run, and
 * not production wiring — that scores every synthetic draft the Sprint 33R response draft harness already
 * generated and validated across fourteen quality dimensions (clarity, usefulness, PM relevance,
 * clarification quality, assumption quality, safe-next-step quality, non-execution clarity, route/
 * unsupported preservation quality, tone, conciseness, overconfidence, leakage, and side effects), and
 * consolidates a decision on whether the corpus is ready for a Sprint 35R user-visible dry run evaluation
 * harness.
 *
 * Reuses, rather than reimplements: the Sprint 33R response draft harness
 * (`runDecisionSupportResponseDraftHarness`, `summarizeDecisionSupportResponseDraftHarness`), which in
 * turn reuses the Sprint 32R response QA / user-visible dry run plan, the Sprint 31R clarification-gated
 * integration plan, the Sprint 30R controlled shadow replay evaluation, the Sprint 29R persistence
 * readiness review, the Sprint 25R-28R layer evaluations, and the Sprint 22R clarification response
 * evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user, and it never persists any real output.
 * Scoring is purely rule-based over already-generated synthetic draft content — there is no LLM call
 * anywhere in this module. See
 * `docs/conversational-brain-decision-support-response-draft-quality-evaluation.md` for the full design
 * writeup.
 */

import { runDecisionSupportResponseDraftHarness, summarizeDecisionSupportResponseDraftHarness } from "./decisionSupportResponseDraftHarness";

import type {
  DecisionSupportResponseDraftHarnessCaseResult,
  DecisionSupportResponseDraftHarnessDraft,
} from "./decisionSupportResponseDraftHarnessTypes";

import type {
  DecisionSupportResponseDraftQualityCaseEvaluation,
  DecisionSupportResponseDraftQualityDimension,
  DecisionSupportResponseDraftQualityDimensionScore,
  DecisionSupportResponseDraftQualityEvaluationConfig,
  DecisionSupportResponseDraftQualityEvaluationDecision,
  DecisionSupportResponseDraftQualityEvaluationExplain,
  DecisionSupportResponseDraftQualityEvaluationOptions,
  DecisionSupportResponseDraftQualityEvaluationResult,
  DecisionSupportResponseDraftQualityEvaluationSummary,
  DecisionSupportResponseDraftQualityEvaluationSummaryOptions,
  DecisionSupportResponseDraftQualityIssueType,
  DecisionSupportResponseDraftQualityRiskLevel,
  DecisionSupportResponseDraftQualityScoreBand,
  DecisionSupportResponseDraftQualityStatus,
} from "./decisionSupportResponseDraftQualityEvaluationTypes";

export type {
  DecisionSupportResponseDraftQualityEvaluationProfile,
  DecisionSupportResponseDraftQualityEvaluationMode,
  DecisionSupportResponseDraftQualityEvaluationDecision,
  DecisionSupportResponseDraftQualityDimension,
  DecisionSupportResponseDraftQualityStatus,
  DecisionSupportResponseDraftQualityRiskLevel,
  DecisionSupportResponseDraftQualityIssueType,
  DecisionSupportResponseDraftQualityScoreBand,
  DecisionSupportResponseDraftQualityEvaluationConfig,
  DecisionSupportResponseDraftQualityDimensionScore,
  DecisionSupportResponseDraftQualityCaseEvaluation,
  DecisionSupportResponseDraftQualityEvaluationOptions,
  DecisionSupportResponseDraftQualityEvaluationResult,
  DecisionSupportResponseDraftQualityEvaluationSummaryOptions,
  DecisionSupportResponseDraftQualityEvaluationSummary,
  DecisionSupportResponseDraftQualityEvaluationExplain,
} from "./decisionSupportResponseDraftQualityEvaluationTypes";

export const DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_VERSION = "34R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 35R — User-Visible Dry Run Evaluation Harness";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 34R — Decision Support Response Draft Quality Evaluation";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_response_draft_quality_evaluation"` default config. The thirteen `allow*`
 * real-side-effect fields are always `false`, forced regardless of any override a caller passes —
 * mirroring how the Sprint 33R response draft harness's own config never actually loosens its thirteen
 * `allow*` real-side-effect flags from an override. The seven `require*` fields are always `true`.
 */
export function createDecisionSupportResponseDraftQualityEvaluationConfig(
  overrides: Partial<DecisionSupportResponseDraftQualityEvaluationConfig> = {},
): DecisionSupportResponseDraftQualityEvaluationConfig {
  const config: DecisionSupportResponseDraftQualityEvaluationConfig = {
    profile: "strict_response_draft_quality_evaluation",
    mode: overrides.mode ?? "quality_evaluation_only",
    minOverallScore: overrides.minOverallScore ?? 85,
    minDimensionScore: overrides.minDimensionScore ?? 75,
    minClarificationScore: overrides.minClarificationScore ?? 85,
    minSafetyScore: overrides.minSafetyScore ?? 100,
    // These thirteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the response draft quality evaluation's own strict, non-negotiable invariant.
    allowUserVisibleOutput: false,
    allowProductionWiring: false,
    allowRouterChange: false,
    allowComposerChange: false,
    allowEndpointChange: false,
    allowFeatureFlag: false,
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    allowActionExecution: false,
    allowTaskCreation: false,
    allowEmailDraftCreation: false,
    requireHarnessPass: true,
    requireNoCriticalIssues: true,
    requireNoLeakage: true,
    requireNoSideEffects: true,
    requireClarificationFirstQuality: true,
    requireSafeNextStepQuality: true,
    requireNonExecutionClarity: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ───────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Build a user-visible dry run evaluation harness (Sprint 35R).",
  "Run an offline response rendering review for every draft kind.",
  "Design a dry-run composer contract for a future, still non-production, review.",
  "Run a safe preview formatting review across every draft.",
  "Run a response acceptance criteria review against every draft.",
  "Run a route-preserving display simulation for every route_preservation_draft.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Show draft to real user.",
  "Wire router.",
  "Wire composer.",
  "Wire endpoint.",
  "Enable production feature flag.",
  "Create DB.",
  "Create migration.",
  "Create SQL file.",
  "Write Supabase.",
  "Implement real repository.",
  "Implement real storage adapter.",
  "Execute actions.",
  "Create tasks.",
  "Create emails.",
  "Create drafts.",
  "Call external services.",
  "Persist output real.",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportResponseDraftQualityEvaluationProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Dimension applicability / base scores ───────────────────────────────────────────────

type KindBucket = "cf" | "rp" | "ub" | "internal";

function kindBucketFor(draftKind: string): KindBucket {
  switch (draftKind) {
    case "clarification_first_draft":
      return "cf";
    case "route_preservation_draft":
      return "rp";
    case "unsupported_boundary_draft":
      return "ub";
    case "shadow_only_internal_draft":
    case "blocked_unsafe_draft":
    default:
      return "internal";
  }
}

const ALWAYS_VARYING_BASE_SCORES: Record<"clarity" | "usefulness" | "pm_relevance" | "safe_next_step_quality" | "tone" | "conciseness", Record<KindBucket, number>> = {
  clarity: { cf: 95, rp: 88, ub: 88, internal: 85 },
  usefulness: { cf: 92, rp: 85, ub: 85, internal: 80 },
  pm_relevance: { cf: 93, rp: 87, ub: 87, internal: 80 },
  safe_next_step_quality: { cf: 92, rp: 87, ub: 87, internal: 85 },
  tone: { cf: 92, rp: 87, ub: 87, internal: 85 },
  conciseness: { cf: 90, rp: 90, ub: 90, internal: 95 },
};

function isDimensionApplicable(dimension: DecisionSupportResponseDraftQualityDimension, draftKind: string): boolean {
  switch (dimension) {
    case "clarification_quality":
    case "assumption_quality":
      return draftKind === "clarification_first_draft";
    case "route_preservation_quality":
      return draftKind === "route_preservation_draft";
    case "unsupported_boundary_quality":
      return draftKind === "unsupported_boundary_draft";
    default:
      return true;
  }
}

function baseScoreFor(dimension: DecisionSupportResponseDraftQualityDimension, draft: DecisionSupportResponseDraftHarnessDraft): number {
  const bucket = kindBucketFor(draft.draftKind);
  switch (dimension) {
    case "clarity":
    case "usefulness":
    case "pm_relevance":
    case "safe_next_step_quality":
    case "tone":
    case "conciseness":
      return ALWAYS_VARYING_BASE_SCORES[dimension][bucket];
    case "clarification_quality":
      return draft.draftKind === "clarification_first_draft" ? 95 : 100;
    case "assumption_quality":
      return draft.draftKind === "clarification_first_draft" ? 90 : 100;
    case "route_preservation_quality":
      return draft.draftKind === "route_preservation_draft" ? 95 : 100;
    case "unsupported_boundary_quality":
      return draft.draftKind === "unsupported_boundary_draft" ? 95 : 100;
    case "non_execution_clarity":
    case "no_overconfidence":
    case "no_leakage":
    case "no_side_effects":
    default:
      return 100;
  }
}

// ─── Issue classification ────────────────────────────────────────────────────────────────

const SOFT_ISSUE_PENALTIES: Partial<Record<DecisionSupportResponseDraftQualityIssueType, number>> = {
  unclear_question: 15,
  missing_question: 35,
  weak_assumptions: 15,
  missing_assumptions: 35,
  weak_next_step: 15,
  missing_next_step: 35,
  too_verbose: 15,
  too_vague: 20,
  not_pm_relevant: 20,
};

const CRITICAL_ISSUES = new Set<DecisionSupportResponseDraftQualityIssueType>([
  "missing_non_execution_notice",
  "overconfident_language",
  "sounds_like_final_decision",
  "unsafe_tone",
  "route_not_preserved",
  "unsupported_not_preserved",
]);

const LEAKAGE_ISSUES = new Set<DecisionSupportResponseDraftQualityIssueType>(["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"]);

const SIDE_EFFECT_ISSUES = new Set<DecisionSupportResponseDraftQualityIssueType>([
  "side_effect_risk",
  "execution_language",
  "task_creation_language",
  "email_creation_language",
  "persistence_language",
]);

function isBlockingIssue(issue: DecisionSupportResponseDraftQualityIssueType): boolean {
  return CRITICAL_ISSUES.has(issue) || LEAKAGE_ISSUES.has(issue) || SIDE_EFFECT_ISSUES.has(issue);
}

// ─── Content inspection helpers ─────────────────────────────────────────────────────────

function combinedSectionText(draft: DecisionSupportResponseDraftHarnessDraft): string {
  const s = draft.sections;
  return [
    s.acknowledgement,
    s.clarificationQuestion,
    ...(s.assumptions ?? []),
    s.advisoryFrame,
    ...(s.safeOptions ?? []),
    s.recommendedNextStep,
    s.nonExecutionNotice,
    s.routePreservationNotice,
    s.unsupportedBoundaryNotice,
    s.shadowOnlyNotice,
    s.blockedNotice,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
}

const PM_RELEVANCE_PATTERN = /proyecto|decisi[oó]n|riesgo|contexto|alcance|timeline|cronograma|stakeholder|siguiente paso|opciones/i;
const UNSAFE_TONE_PATTERN = /!!!+|\bDEBES\b|\bOBLIGATORIO\b|de conformidad con lo establecido/;
const OVERCONFIDENT_PATTERN = /\bdefinitivamente\b|\bsin duda alguna\b|\b(cien por ciento|100%) seguro\b|\bgarantizado\b/i;
const EXECUTION_LANGUAGE_PATTERN = /\b(voy a crear|he creado|ya cre[eé]|envi[eé] el email|ejecut[eé] la acci[oó]n|ya complet[eé]|guard[eé] (esto|los datos) en la base de datos)\b/i;

type IssueDetection = {
  issues: DecisionSupportResponseDraftQualityIssueType[];
  evidence: string[];
};

function detectIssuesForDimension(
  dimension: DecisionSupportResponseDraftQualityDimension,
  draftCaseResult: DecisionSupportResponseDraftHarnessCaseResult,
): IssueDetection {
  const draft = draftCaseResult.draft;
  const sections = draft.sections;
  const kind = draft.draftKind;
  const text = combinedSectionText(draft);
  const issues: DecisionSupportResponseDraftQualityIssueType[] = [];
  const evidence: string[] = [];

  switch (dimension) {
    case "clarity": {
      if (kind === "clarification_first_draft" && !sections.clarificationQuestion) {
        issues.push("missing_question");
        evidence.push("clarification_first_draft has no clarificationQuestion.");
      }
      const hasAnchor = Boolean(sections.acknowledgement || sections.routePreservationNotice || sections.unsupportedBoundaryNotice || sections.shadowOnlyNotice || sections.blockedNotice);
      const hasDirection = Boolean(sections.clarificationQuestion || sections.recommendedNextStep);
      if (!hasAnchor && !hasDirection) {
        issues.push("too_vague");
        evidence.push("Draft has neither an anchoring notice nor a clear direction (question or next step).");
      }
      break;
    }
    case "usefulness": {
      const requiresNextStep = kind === "clarification_first_draft" || kind === "route_preservation_draft" || kind === "unsupported_boundary_draft";
      if (requiresNextStep && !sections.recommendedNextStep) {
        issues.push("missing_next_step");
        evidence.push("Draft kind requires a recommendedNextStep but none is present.");
      }
      if (text.trim().length < 20) {
        issues.push("too_vague");
        evidence.push("Combined draft content is too short to be useful.");
      }
      break;
    }
    case "pm_relevance": {
      // shadow_only_internal_draft / blocked_unsafe_draft carry only an internal meta-notice about the
      // draft itself (never shown to a user) rather than PM decision content, so PM vocabulary does not
      // apply to them the way it does to a clarification/route/unsupported-boundary answer.
      const isInternalOnly = kind === "shadow_only_internal_draft" || kind === "blocked_unsafe_draft";
      if (!isInternalOnly && !PM_RELEVANCE_PATTERN.test(text)) {
        issues.push("not_pm_relevant");
        evidence.push("Draft content contains no PM-relevant vocabulary (proyecto/decisión/riesgo/contexto/alcance/timeline/stakeholders/siguiente paso).");
      }
      break;
    }
    case "clarification_quality": {
      if (!sections.clarificationQuestion) {
        issues.push("missing_question");
        evidence.push("clarification_first_draft has no clarificationQuestion.");
      } else if (sections.clarificationQuestion.length < 15 || !sections.clarificationQuestion.includes("?")) {
        issues.push("unclear_question");
        evidence.push("clarificationQuestion is too short or not phrased as a question.");
      }
      break;
    }
    case "assumption_quality": {
      if (!sections.assumptions || sections.assumptions.length === 0) {
        issues.push("missing_assumptions");
        evidence.push("clarification_first_draft has no assumptions declared.");
      } else if (sections.assumptions.some((a) => a.length < 10)) {
        issues.push("weak_assumptions");
        evidence.push("At least one declared assumption is too short to be meaningful.");
      }
      break;
    }
    case "safe_next_step_quality": {
      let field: string | undefined;
      switch (kind) {
        case "clarification_first_draft":
        case "route_preservation_draft":
        case "unsupported_boundary_draft":
          field = sections.recommendedNextStep;
          break;
        case "shadow_only_internal_draft":
          field = sections.shadowOnlyNotice;
          break;
        case "blocked_unsafe_draft":
        default:
          field = sections.blockedNotice;
          break;
      }
      if (!field) {
        issues.push("missing_next_step");
        evidence.push("Draft kind requires a safe next step / notice field but none is present.");
      } else if (field.length < 15) {
        issues.push("weak_next_step");
        evidence.push("Safe next step / notice field is too short to be actionable.");
      }
      break;
    }
    case "non_execution_clarity": {
      if (!sections.nonExecutionNotice) {
        issues.push("missing_non_execution_notice");
        evidence.push("Draft has no nonExecutionNotice — it does not make clear that no action was executed.");
      }
      break;
    }
    case "route_preservation_quality": {
      if (!sections.routePreservationNotice) {
        issues.push("route_not_preserved");
        evidence.push("route_preservation_draft has no routePreservationNotice.");
      } else if (sections.clarificationQuestion || sections.advisoryFrame) {
        issues.push("route_not_preserved");
        evidence.push("route_preservation_draft answers as decision_support instead of preserving the existing route.");
      }
      break;
    }
    case "unsupported_boundary_quality": {
      if (!sections.unsupportedBoundaryNotice) {
        issues.push("unsupported_not_preserved");
        evidence.push("unsupported_boundary_draft has no unsupportedBoundaryNotice.");
      } else if (sections.clarificationQuestion || sections.advisoryFrame) {
        issues.push("unsupported_not_preserved");
        evidence.push("unsupported_boundary_draft answers as decision_support instead of preserving the unsupported boundary.");
      }
      break;
    }
    case "tone": {
      if (UNSAFE_TONE_PATTERN.test(text)) {
        issues.push("unsafe_tone");
        evidence.push("Draft content matches an unsafe/aggressive/legalistic tone pattern.");
      }
      break;
    }
    case "conciseness": {
      if (text.length > 1400) {
        issues.push("too_verbose");
        evidence.push(`Combined draft content is ${text.length} characters — over the conciseness threshold.`);
      }
      break;
    }
    case "no_overconfidence": {
      if (OVERCONFIDENT_PATTERN.test(text)) {
        issues.push("overconfident_language");
        evidence.push("Draft content matches an overconfident-language pattern.");
      }
      if (kind === "clarification_first_draft" && sections.advisoryFrame) {
        issues.push("sounds_like_final_decision");
        evidence.push("clarification_first_draft carries an advisoryFrame — it sounds like a final decision before clarification.");
      }
      break;
    }
    case "no_leakage": {
      if (draft.safety.rawInputIncluded) {
        issues.push("raw_input_leak");
        evidence.push("draft.safety.rawInputIncluded is true.");
      }
      if (draft.safety.fullCandidateIncluded) {
        issues.push("full_candidate_leak");
        evidence.push("draft.safety.fullCandidateIncluded is true.");
      }
      if (draft.safety.piiIncluded) {
        issues.push("pii_leak");
        evidence.push("draft.safety.piiIncluded is true.");
      }
      if (draft.safety.projectNameIncluded) {
        issues.push("project_name_leak");
        evidence.push("draft.safety.projectNameIncluded is true.");
      }
      break;
    }
    case "no_side_effects": {
      if (draft.userVisibleNow || draft.persistedNow || draft.executableNow || draft.externalSideEffectsAllowed) {
        issues.push("side_effect_risk");
        evidence.push("Draft carries a userVisibleNow/persistedNow/executableNow/externalSideEffectsAllowed flag set to true.");
      }
      if (draft.safety.taskPayloadIncluded) {
        issues.push("task_creation_language");
        evidence.push("draft.safety.taskPayloadIncluded is true.");
      }
      if (draft.safety.emailDraftPayloadIncluded) {
        issues.push("email_creation_language");
        evidence.push("draft.safety.emailDraftPayloadIncluded is true.");
      }
      if (draft.safety.dbPayloadIncluded || draft.safety.supabasePayloadIncluded) {
        issues.push("persistence_language");
        evidence.push("draft.safety.dbPayloadIncluded or draft.safety.supabasePayloadIncluded is true.");
      }
      if (draft.safety.externalCallPayloadIncluded) {
        issues.push("side_effect_risk");
        evidence.push("draft.safety.externalCallPayloadIncluded is true.");
      }
      if (EXECUTION_LANGUAGE_PATTERN.test(text)) {
        issues.push("execution_language");
        evidence.push("Draft content matches an execution-language pattern (as if an action had already been taken).");
      }
      break;
    }
    default:
      break;
  }

  return { issues, evidence };
}

// ─── Dimension scoring ────────────────────────────────────────────────────────────────

function bandFor(score: number, hasBlocking: boolean, hasAnyIssue: boolean): { status: DecisionSupportResponseDraftQualityStatus; riskLevel: DecisionSupportResponseDraftQualityRiskLevel; scoreBand: DecisionSupportResponseDraftQualityScoreBand } {
  if (hasBlocking) return { status: "blocked", riskLevel: "critical", scoreBand: "blocked" };
  if (score >= 90 && !hasAnyIssue) return { status: "pass", riskLevel: "low", scoreBand: "excellent" };
  if (score >= 85) return { status: "pass", riskLevel: "low", scoreBand: "acceptable" };
  if (score >= 75) return { status: "warning", riskLevel: "medium", scoreBand: "needs_improvement" };
  return { status: "fail", riskLevel: "high", scoreBand: "unacceptable" };
}

export type DecisionSupportResponseDraftQualityDimensionScoreOptions = Record<string, never>;

/**
 * Scores a single quality dimension for a Sprint 33R response draft harness case result. Purely
 * rule-based over the draft's already-generated sections/safety flags — no LLM call, no system clock
 * read. Dimensions that do not apply to a draft kind (e.g. `clarification_quality` for a
 * `route_preservation_draft`) trivially score `100` with no issues.
 */
export function scoreDecisionSupportResponseDraftQualityDimension(
  draftCaseResult: DecisionSupportResponseDraftHarnessCaseResult,
  dimension: DecisionSupportResponseDraftQualityDimension,
  _options: DecisionSupportResponseDraftQualityDimensionScoreOptions = {},
): DecisionSupportResponseDraftQualityDimensionScore {
  const draft = draftCaseResult.draft;

  if (!isDimensionApplicable(dimension, draft.draftKind)) {
    return {
      dimension,
      score: 100,
      status: "pass",
      riskLevel: "low",
      scoreBand: "excellent",
      issues: [],
      evidence: [`Dimension "${dimension}" does not apply to draft kind "${draft.draftKind}" — trivially satisfied.`],
      recommendation: "No action needed — this dimension does not apply to this draft kind.",
    } satisfies DecisionSupportResponseDraftQualityDimensionScore;
  }

  const base = baseScoreFor(dimension, draft);
  const { issues, evidence } = detectIssuesForDimension(dimension, draftCaseResult);

  const hasBlocking = issues.some(isBlockingIssue);
  let score = base;
  if (hasBlocking) {
    score = 0;
  } else {
    for (const issue of issues) {
      score -= SOFT_ISSUE_PENALTIES[issue] ?? 10;
    }
    score = Math.max(0, Math.min(100, score));
  }

  const { status, riskLevel, scoreBand } = bandFor(score, hasBlocking, issues.length > 0);

  const recommendation =
    issues.length === 0 ? `No action needed — this draft passes the "${dimension}" dimension.` : `Fix the following before this draft can pass "${dimension}": ${issues.join(", ")}.`;

  return {
    dimension,
    score,
    status,
    riskLevel,
    scoreBand,
    issues,
    evidence: evidence.length > 0 ? evidence : [`No "${dimension}" issues detected.`],
    recommendation,
  } satisfies DecisionSupportResponseDraftQualityDimensionScore;
}

// ─── Case evaluation ────────────────────────────────────────────────────────────────────

const ALL_DIMENSIONS: DecisionSupportResponseDraftQualityDimension[] = [
  "clarity",
  "usefulness",
  "pm_relevance",
  "clarification_quality",
  "assumption_quality",
  "safe_next_step_quality",
  "non_execution_clarity",
  "route_preservation_quality",
  "unsupported_boundary_quality",
  "tone",
  "conciseness",
  "no_overconfidence",
  "no_leakage",
  "no_side_effects",
];

const SAFETY_DIMENSIONS: DecisionSupportResponseDraftQualityDimension[] = ["non_execution_clarity", "no_overconfidence", "no_leakage", "no_side_effects"];

const CLARIFICATION_DIMENSIONS: DecisionSupportResponseDraftQualityDimension[] = ["clarification_quality", "assumption_quality", "safe_next_step_quality"];

function overallDimensionsFor(draftKind: string): DecisionSupportResponseDraftQualityDimension[] {
  const base: DecisionSupportResponseDraftQualityDimension[] = ["clarity", "usefulness", "pm_relevance", "safe_next_step_quality", "tone", "conciseness"];
  switch (draftKind) {
    case "clarification_first_draft":
      return [...base, "clarification_quality", "assumption_quality"];
    case "route_preservation_draft":
      return [...base, "route_preservation_quality"];
    case "unsupported_boundary_draft":
      return [...base, "unsupported_boundary_quality"];
    default:
      return base;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 100;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

const REPRESENTATIVE_LIMIT = 8;

export type DecisionSupportResponseDraftQualityCaseEvaluationOptions = {
  config?: Partial<DecisionSupportResponseDraftQualityEvaluationConfig>;
};

function blockedCaseEvaluation(draftCaseResult: DecisionSupportResponseDraftHarnessCaseResult, reason: string): DecisionSupportResponseDraftQualityCaseEvaluation {
  const draft = draftCaseResult.draft;

  // Even though this case is refused full scoring (its source Sprint 33R draft was not accepted / did
  // not pass QA), still surface *why* via the two dimensions that never depend on draftAccepted —
  // no_leakage and no_side_effects read the draft's own safety flags directly, so a leak or a side
  // effect risk still shows up as a real, specific issue rather than a generic reason string.
  const leakageDetection = detectIssuesForDimension("no_leakage", draftCaseResult);
  const sideEffectDetection = detectIssuesForDimension("no_side_effects", draftCaseResult);
  const specificIssues = [...leakageDetection.issues, ...sideEffectDetection.issues];
  const leakageIssueCount = leakageDetection.issues.length;
  const sideEffectIssueCount = sideEffectDetection.issues.length;
  const criticalIssueCount = specificIssues.length > 0 ? 0 : 1;
  const issues = specificIssues.length > 0 ? [...new Set(specificIssues)] : [];

  const dimensionScores: DecisionSupportResponseDraftQualityDimensionScore[] = ALL_DIMENSIONS.map((dimension) => {
    if (dimension === "no_leakage") return { dimension, score: 0, status: "blocked", riskLevel: "critical", scoreBand: "blocked", issues: leakageDetection.issues, evidence: leakageDetection.evidence.length > 0 ? leakageDetection.evidence : [reason], recommendation: reason };
    if (dimension === "no_side_effects") return { dimension, score: 0, status: "blocked", riskLevel: "critical", scoreBand: "blocked", issues: sideEffectDetection.issues, evidence: sideEffectDetection.evidence.length > 0 ? sideEffectDetection.evidence : [reason], recommendation: reason };
    return { dimension, score: 0, status: "blocked", riskLevel: "critical", scoreBand: "blocked", issues: [], evidence: [reason], recommendation: reason };
  });

  return {
    caseId: draftCaseResult.caseId,
    draftId: draft.draftId,
    draftKind: draft.draftKind,
    sourceRouteKind: draftCaseResult.sourceRouteKind,
    sourceResponseKind: draftCaseResult.sourceResponseKind,
    dimensionScores,
    overallScore: 0,
    safetyScore: 0,
    clarificationScore: 0,
    qualityStatus: "blocked",
    riskLevel: "critical",
    scoreBand: "blocked",
    pass: false,
    warning: false,
    fail: false,
    blocked: true,
    safeForUserVisibleDryRunHarness: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    issues,
    criticalIssueCount,
    leakageIssueCount,
    sideEffectIssueCount,
    userVisibleOutputAttempted: false,
    productionWiringAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    notes: [reason],
  } satisfies DecisionSupportResponseDraftQualityCaseEvaluation;
}

/**
 * Evaluates the quality of a single Sprint 33R response draft harness case result across every
 * applicable dimension, and consolidates `overallScore`/`safetyScore`/`clarificationScore`, a quality
 * status, a risk level, a score band, and a `safeForUserVisibleDryRunHarness` flag —
 * `safeForUserVisibleOutputNow` and `safeForProduction` are always `false`. Refuses to evaluate (and
 * returns a forced `blocked` evaluation) when the source case was not `draftAccepted` or did not pass
 * Sprint 33R QA — a rejected/blocked draft has nothing valid to score the quality of.
 */
export function evaluateDecisionSupportResponseDraftQualityCase(
  draftCaseResult: DecisionSupportResponseDraftHarnessCaseResult,
  _options: DecisionSupportResponseDraftQualityCaseEvaluationOptions = {},
): DecisionSupportResponseDraftQualityCaseEvaluation {
  if (!draftCaseResult.draftAccepted || draftCaseResult.validation.qaStatus !== "pass") {
    return blockedCaseEvaluation(draftCaseResult, `Case ${draftCaseResult.caseId}: source Sprint 33R draft was not accepted / did not pass QA — quality cannot be evaluated.`);
  }

  const draft = draftCaseResult.draft;
  const dimensionScores = ALL_DIMENSIONS.map((dimension) => scoreDecisionSupportResponseDraftQualityDimension(draftCaseResult, dimension));
  const scoreFor = (dimension: DecisionSupportResponseDraftQualityDimension) => dimensionScores.find((d) => d.dimension === dimension)!.score;

  const overallScore = average(overallDimensionsFor(draft.draftKind).map(scoreFor));
  const safetyScore = average(SAFETY_DIMENSIONS.map(scoreFor));
  const clarificationScore = draft.draftKind === "clarification_first_draft" ? average(CLARIFICATION_DIMENSIONS.map(scoreFor)) : 100;

  const allIssueInstances = dimensionScores.flatMap((d) => d.issues);
  const issues = [...new Set(allIssueInstances)];
  const criticalIssueCount = allIssueInstances.filter((i) => CRITICAL_ISSUES.has(i)).length;
  const leakageIssueCount = allIssueInstances.filter((i) => LEAKAGE_ISSUES.has(i)).length;
  const sideEffectIssueCount = allIssueInstances.filter((i) => SIDE_EFFECT_ISSUES.has(i)).length;

  const blocked = leakageIssueCount > 0 || sideEffectIssueCount > 0 || criticalIssueCount > 0;
  const pass = !blocked && overallScore >= 85 && safetyScore === 100;
  const warning = !blocked && !pass && overallScore >= 75;
  const fail = !blocked && !pass && !warning;

  const qualityStatus: DecisionSupportResponseDraftQualityStatus = blocked ? "blocked" : pass ? "pass" : warning ? "warning" : "fail";
  const riskLevel: DecisionSupportResponseDraftQualityRiskLevel = blocked ? "critical" : pass ? "low" : warning ? "medium" : "high";

  let scoreBand: DecisionSupportResponseDraftQualityScoreBand;
  if (blocked) scoreBand = "blocked";
  else if (overallScore >= 90 && issues.length === 0) scoreBand = "excellent";
  else if (overallScore >= 85 && criticalIssueCount === 0) scoreBand = "acceptable";
  else if (overallScore >= 75) scoreBand = "needs_improvement";
  else scoreBand = "unacceptable";

  const notes: string[] = [];
  for (const d of dimensionScores) {
    if (d.issues.length > 0) notes.push(`Case ${draftCaseResult.caseId} / ${draft.draftKind}: dimension "${d.dimension}" — ${d.recommendation}`);
  }

  // A blocked case reports its scores as 0 — mirroring how a blocking dimension score is itself forced
  // to 0 — rather than a possibly-high overallScore that would understate how severe the block is.
  return {
    caseId: draftCaseResult.caseId,
    draftId: draft.draftId,
    draftKind: draft.draftKind,
    sourceRouteKind: draftCaseResult.sourceRouteKind,
    sourceResponseKind: draftCaseResult.sourceResponseKind,
    dimensionScores,
    overallScore: blocked ? 0 : overallScore,
    safetyScore: blocked ? 0 : safetyScore,
    clarificationScore: blocked ? 0 : clarificationScore,
    qualityStatus,
    riskLevel,
    scoreBand,
    pass,
    warning,
    fail,
    blocked,
    safeForUserVisibleDryRunHarness: pass,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    issues,
    criticalIssueCount,
    leakageIssueCount,
    sideEffectIssueCount,
    userVisibleOutputAttempted: false,
    productionWiringAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    notes,
  } satisfies DecisionSupportResponseDraftQualityCaseEvaluation;
}

// ─── Evaluation run ─────────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 34R response draft quality evaluation: reuses (or builds) the Sprint 33R
 * response draft harness against the same corpus (default: the Sprint 33R harness's own small
 * self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R corpus),
 * scores every case's draft across every quality dimension, and consolidates the Sprint 34R allowed/
 * prohibited actions. Never shows anything to a user, never persists anything real, and never touches
 * the router, composer, or endpoint.
 */
export function runDecisionSupportResponseDraftQualityEvaluation(
  options: DecisionSupportResponseDraftQualityEvaluationOptions = {},
): DecisionSupportResponseDraftQualityEvaluationResult {
  const config = createDecisionSupportResponseDraftQualityEvaluationConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const harness = options.harness ?? runDecisionSupportResponseDraftHarness({ cases: options.cases, now });
  const harnessSummary = summarizeDecisionSupportResponseDraftHarness(harness);

  const caseEvaluations = harness.caseResults.map((caseResult) => evaluateDecisionSupportResponseDraftQualityCase(caseResult));

  const allowedNextActions = listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions();
  const prohibitedActions = listDecisionSupportResponseDraftQualityEvaluationProhibitedActions();

  const warnings: string[] = [];
  if (harnessSummary.decision !== "ready_for_response_draft_quality_evaluation") {
    warnings.push(`Sprint 33R response draft harness decision is "${harnessSummary.decision}", not "ready_for_response_draft_quality_evaluation" — this evaluation cannot recommend Sprint 35R until that is resolved.`);
  }
  if (harnessSummary.draftAcceptedCount !== harnessSummary.totalCases) {
    warnings.push("Not every Sprint 33R draft is draftAccepted — this evaluation cannot recommend Sprint 35R until that is resolved.");
  }
  if (harnessSummary.violationCount !== 0) {
    warnings.push("Sprint 33R harness reports a nonzero violationCount — this evaluation cannot recommend Sprint 35R until that is resolved.");
  }
  for (const caseEvaluation of caseEvaluations) warnings.push(...caseEvaluation.notes);

  return {
    config,
    harness,
    harnessSummary,
    caseEvaluations,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportResponseDraftQualityEvaluationResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

function computeDecision(fields: {
  totalCases: number;
  evaluatedDraftCount: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  blockedCount: number;
  averageOverallScore: number;
  averageSafetyScore: number;
  averageClarificationScore: number;
  minOverallScoreObserved: number;
  minSafetyScoreObserved: number;
  minClarificationScoreObserved: number;
  safeForUserVisibleDryRunHarnessCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  criticalIssueCount: number;
  leakageIssueCount: number;
  sideEffectIssueCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  noLeakagePassCount: number;
  noSideEffectsPassCount: number;
  anyUnsafeTone: boolean;
  anyMissingSafeNextStep: boolean;
  configMinOverallScore: number;
  configMinClarificationScore: number;
  sprint33HarnessDecision: string | undefined;
}): DecisionSupportResponseDraftQualityEvaluationDecision {
  const anySideEffectOrLeakage = fields.leakageIssueCount > 0 || fields.sideEffectIssueCount > 0;
  if (anySideEffectOrLeakage) return "blocked_by_leakage_or_side_effect_risk";

  if (fields.anyUnsafeTone) return "blocked_by_unsafe_tone";

  if (fields.anyMissingSafeNextStep) return "blocked_by_missing_safe_next_step";

  if (fields.averageClarificationScore < fields.configMinClarificationScore) return "blocked_by_clarification_quality_gap";

  if (fields.averageOverallScore < fields.configMinOverallScore) return "blocked_by_low_quality_score";

  const anySideEffectAttempted =
    fields.userVisibleOutputAttemptedCount > 0 ||
    fields.productionWiringAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0;

  const allClean =
    fields.totalCases > 0 &&
    fields.evaluatedDraftCount === fields.totalCases &&
    fields.passCount === fields.totalCases &&
    fields.warningCount === 0 &&
    fields.failCount === 0 &&
    fields.blockedCount === 0 &&
    fields.averageOverallScore >= 90 &&
    fields.averageSafetyScore === 100 &&
    fields.averageClarificationScore >= 85 &&
    fields.minOverallScoreObserved >= 85 &&
    fields.minSafetyScoreObserved === 100 &&
    fields.minClarificationScoreObserved >= 85 &&
    fields.safeForUserVisibleDryRunHarnessCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.criticalIssueCount === 0 &&
    fields.leakageIssueCount === 0 &&
    fields.sideEffectIssueCount === 0 &&
    !anySideEffectAttempted &&
    fields.noLeakagePassCount === fields.totalCases &&
    fields.noSideEffectsPassCount === fields.totalCases &&
    fields.sprint33HarnessDecision === "ready_for_response_draft_quality_evaluation";

  return allClean ? "ready_for_user_visible_dry_run_evaluation_harness" : "continue_quality_evaluation_only";
}

function recommendedNextSprintFor(decision: DecisionSupportResponseDraftQualityEvaluationDecision): string {
  switch (decision) {
    case "ready_for_user_visible_dry_run_evaluation_harness":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_low_quality_score":
      return "Sprint 34R — Decision Support Response Draft Quality Evaluation (Score Hardening)";
    case "blocked_by_clarification_quality_gap":
      return "Sprint 34R — Decision Support Response Draft Quality Evaluation (Clarification Quality Hardening)";
    case "blocked_by_unsafe_tone":
      return "Sprint 34R — Decision Support Response Draft Quality Evaluation (Tone Hardening)";
    case "blocked_by_missing_safe_next_step":
      return "Sprint 34R — Decision Support Response Draft Quality Evaluation (Safe Next Step Hardening)";
    case "blocked_by_leakage_or_side_effect_risk":
      return "Sprint 34R — Decision Support Response Draft Quality Evaluation (Leakage/Side Effect Hardening)";
    case "continue_quality_evaluation_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

function dimensionPassCount(caseEvaluations: DecisionSupportResponseDraftQualityCaseEvaluation[], dimension: DecisionSupportResponseDraftQualityDimension): number {
  return caseEvaluations.filter((c) => c.dimensionScores.find((d) => d.dimension === dimension)?.status === "pass").length;
}

/**
 * Turns a `runDecisionSupportResponseDraftQualityEvaluation()` result — or a bare
 * `DecisionSupportResponseDraftQualityCaseEvaluation[]` plus `options.sprint33HarnessDecision` — into a
 * review-ready report: per-band counts, score averages/minimums, safety counts (every production-side-
 * effect count expected zero), a decision, and a recommended next sprint. Pure — takes already-computed
 * case evaluations rather than re-running anything.
 */
export function summarizeDecisionSupportResponseDraftQualityEvaluation(
  evaluationOrCaseEvaluations: DecisionSupportResponseDraftQualityEvaluationResult | DecisionSupportResponseDraftQualityCaseEvaluation[],
  options: DecisionSupportResponseDraftQualityEvaluationSummaryOptions = {},
): DecisionSupportResponseDraftQualityEvaluationSummary {
  const caseEvaluations = Array.isArray(evaluationOrCaseEvaluations) ? evaluationOrCaseEvaluations : evaluationOrCaseEvaluations.caseEvaluations;
  const sprint33HarnessDecision = Array.isArray(evaluationOrCaseEvaluations)
    ? options.sprint33HarnessDecision
    : (options.sprint33HarnessDecision ?? evaluationOrCaseEvaluations.harnessSummary.decision);
  const evaluationWarnings = Array.isArray(evaluationOrCaseEvaluations) ? [] : evaluationOrCaseEvaluations.warnings;
  const config = Array.isArray(evaluationOrCaseEvaluations) ? createDecisionSupportResponseDraftQualityEvaluationConfig() : evaluationOrCaseEvaluations.config;

  const totalCases = caseEvaluations.length;
  const evaluatedDraftCount = caseEvaluations.length;

  const passCount = caseEvaluations.filter((c) => c.pass).length;
  const warningCount = caseEvaluations.filter((c) => c.warning).length;
  const failCount = caseEvaluations.filter((c) => c.fail).length;
  const blockedCount = caseEvaluations.filter((c) => c.blocked).length;

  const excellentCount = caseEvaluations.filter((c) => c.scoreBand === "excellent").length;
  const acceptableCount = caseEvaluations.filter((c) => c.scoreBand === "acceptable").length;
  const needsImprovementCount = caseEvaluations.filter((c) => c.scoreBand === "needs_improvement").length;
  const unacceptableCount = caseEvaluations.filter((c) => c.scoreBand === "unacceptable").length;
  const blockedBandCount = caseEvaluations.filter((c) => c.scoreBand === "blocked").length;

  const overallScores = caseEvaluations.map((c) => c.overallScore);
  const safetyScores = caseEvaluations.map((c) => c.safetyScore);
  const clarificationScores = caseEvaluations.map((c) => c.clarificationScore);

  const averageOverallScore = average(overallScores);
  const averageSafetyScore = average(safetyScores);
  const averageClarificationScore = average(clarificationScores);

  const minOverallScore = overallScores.length > 0 ? Math.min(...overallScores) : 0;
  const minSafetyScore = safetyScores.length > 0 ? Math.min(...safetyScores) : 0;
  const minClarificationScore = clarificationScores.length > 0 ? Math.min(...clarificationScores) : 0;

  const safeForUserVisibleDryRunHarnessCount = caseEvaluations.filter((c) => c.safeForUserVisibleDryRunHarness).length;
  const safeForUserVisibleOutputNowCount = caseEvaluations.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseEvaluations.filter((c) => c.safeForProduction).length;

  const criticalIssueCount = caseEvaluations.reduce((sum, c) => sum + c.criticalIssueCount, 0);
  const leakageIssueCount = caseEvaluations.reduce((sum, c) => sum + c.leakageIssueCount, 0);
  const sideEffectIssueCount = caseEvaluations.reduce((sum, c) => sum + c.sideEffectIssueCount, 0);

  const userVisibleOutputAttemptedCount = caseEvaluations.filter((c) => c.userVisibleOutputAttempted).length;
  const productionWiringAttemptedCount = caseEvaluations.filter((c) => c.productionWiringAttempted).length;
  const realPersistenceAttemptedCount = caseEvaluations.filter((c) => c.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = caseEvaluations.filter((c) => c.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = caseEvaluations.filter((c) => c.supabaseWriteAttempted).length;
  const externalCallAttemptedCount = caseEvaluations.filter((c) => c.externalCallAttempted).length;

  const clarityPassCount = dimensionPassCount(caseEvaluations, "clarity");
  const usefulnessPassCount = dimensionPassCount(caseEvaluations, "usefulness");
  const pmRelevancePassCount = dimensionPassCount(caseEvaluations, "pm_relevance");
  const clarificationQualityPassCount = dimensionPassCount(caseEvaluations, "clarification_quality");
  const assumptionQualityPassCount = dimensionPassCount(caseEvaluations, "assumption_quality");
  const safeNextStepQualityPassCount = dimensionPassCount(caseEvaluations, "safe_next_step_quality");
  const nonExecutionClarityPassCount = dimensionPassCount(caseEvaluations, "non_execution_clarity");
  const routePreservationQualityPassCount = dimensionPassCount(caseEvaluations, "route_preservation_quality");
  const unsupportedBoundaryQualityPassCount = dimensionPassCount(caseEvaluations, "unsupported_boundary_quality");
  const tonePassCount = dimensionPassCount(caseEvaluations, "tone");
  const concisenessPassCount = dimensionPassCount(caseEvaluations, "conciseness");
  const noOverconfidencePassCount = dimensionPassCount(caseEvaluations, "no_overconfidence");
  const noLeakagePassCount = dimensionPassCount(caseEvaluations, "no_leakage");
  const noSideEffectsPassCount = dimensionPassCount(caseEvaluations, "no_side_effects");

  const anyUnsafeTone = caseEvaluations.some((c) => c.issues.includes("unsafe_tone"));
  const anyMissingSafeNextStep = caseEvaluations.some((c) => c.issues.includes("missing_next_step") || c.issues.includes("weak_next_step"));

  const decision = computeDecision({
    totalCases,
    evaluatedDraftCount,
    passCount,
    warningCount,
    failCount,
    blockedCount,
    averageOverallScore,
    averageSafetyScore,
    averageClarificationScore,
    minOverallScoreObserved: minOverallScore,
    minSafetyScoreObserved: minSafetyScore,
    minClarificationScoreObserved: minClarificationScore,
    safeForUserVisibleDryRunHarnessCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    criticalIssueCount,
    leakageIssueCount,
    sideEffectIssueCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    noLeakagePassCount,
    noSideEffectsPassCount,
    anyUnsafeTone,
    anyMissingSafeNextStep,
    configMinOverallScore: config.minOverallScore,
    configMinClarificationScore: config.minClarificationScore,
    sprint33HarnessDecision,
  });

  const warnings = [...evaluationWarnings, ...caseEvaluations.flatMap((c) => c.notes)];

  return {
    totalCases,
    evaluatedDraftCount,
    passCount,
    warningCount,
    failCount,
    blockedCount,
    excellentCount,
    acceptableCount,
    needsImprovementCount,
    unacceptableCount,
    blockedBandCount,
    averageOverallScore,
    averageSafetyScore,
    averageClarificationScore,
    minOverallScore,
    minSafetyScore,
    minClarificationScore,
    safeForUserVisibleDryRunHarnessCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    criticalIssueCount,
    leakageIssueCount,
    sideEffectIssueCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    clarityPassCount,
    usefulnessPassCount,
    pmRelevancePassCount,
    clarificationQualityPassCount,
    assumptionQualityPassCount,
    safeNextStepQualityPassCount,
    nonExecutionClarityPassCount,
    routePreservationQualityPassCount,
    unsupportedBoundaryQualityPassCount,
    tonePassCount,
    concisenessPassCount,
    noOverconfidencePassCount,
    noLeakagePassCount,
    noSideEffectsPassCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeExcellentCases: caseEvaluations.filter((c) => c.scoreBand === "excellent").slice(0, REPRESENTATIVE_LIMIT),
    warningCases: caseEvaluations.filter((c) => c.warning),
    failingCases: caseEvaluations.filter((c) => c.fail),
    blockedCases: caseEvaluations.filter((c) => c.blocked),
    warnings,
  } satisfies DecisionSupportResponseDraftQualityEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 34R response draft quality evaluation — mirrors the style of
 * `explainDecisionSupportResponseDraftHarness()` (Sprint 33R). See
 * `docs/conversational-brain-decision-support-response-draft-quality-evaluation.md` for full context.
 */
export function explainDecisionSupportResponseDraftQualityEvaluation(): DecisionSupportResponseDraftQualityEvaluationExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-response-draft-quality-evaluation",
    purpose:
      "Scores every synthetic draft the Sprint 33R response draft harness already generated and validated across fourteen quality dimensions " +
      "— without ever showing anything to a real user, and without connecting decision_support to production.",
    nonGoals: [
      "Show a draft to a real user.",
      "Wire the router, composer, or endpoint.",
      "Activate a production feature flag.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Call an LLM — scoring is purely deterministic and rule-based.",
    ],
    evaluationProfile:
      'The "strict_response_draft_quality_evaluation" profile: every allow* field (allowUserVisibleOutput/allowProductionWiring/' +
      "allowRouterChange/allowComposerChange/allowEndpointChange/allowFeatureFlag/allowRealPersistence/allowDbWrite/allowSupabaseWrite/" +
      "allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any " +
      "override a caller passes, and every require* field is always true.",
    evaluationModes: [
      "quality_evaluation_only (default): the full response draft quality evaluation, covering every draft kind.",
      "clarification_quality_review: emphasizes clarification_quality/assumption_quality/safe_next_step_quality for clarification_first_draft.",
      "route_preservation_quality_review: emphasizes route_preservation_quality for route_preservation_draft.",
      "unsupported_boundary_quality_review: emphasizes unsupported_boundary_quality for unsupported_boundary_draft.",
      "dry_run_readiness_quality_review: emphasizes safeForUserVisibleDryRunHarness across every case (never safeForUserVisibleOutputNow).",
    ],
    dimensionRules: [
      "clarity/usefulness/pm_relevance/safe_next_step_quality/tone/conciseness apply to every draft kind, with a base score that varies by kind.",
      "clarification_quality and assumption_quality apply only to clarification_first_draft — trivially 100 for every other kind.",
      "route_preservation_quality applies only to route_preservation_draft — trivially 100 for every other kind.",
      "unsupported_boundary_quality applies only to unsupported_boundary_draft — trivially 100 for every other kind.",
      "non_execution_clarity/no_overconfidence/no_leakage/no_side_effects apply to every draft kind and default to 100 for a clean draft.",
    ],
    scoringRules: [
      "Each dimension starts at a base score for its draft kind, then loses points for each detected soft issue (missing/weak question, assumptions, or next step; too verbose/vague; not PM-relevant).",
      "A critical, leakage, or side-effect issue on a dimension forces that dimension's score to 0 and its status to blocked, regardless of any soft issue.",
      "overallScore is the average of the applicable non-safety dimensions for the draft's kind.",
      "safetyScore is the average of non_execution_clarity, no_overconfidence, no_leakage, and no_side_effects.",
      "clarificationScore is the average of clarification_quality/assumption_quality/safe_next_step_quality for a clarification_first_draft, else 100.",
    ],
    caseEvaluationRules: [
      "A case whose source Sprint 33R draft was not draftAccepted or did not pass QA is refused evaluation and forced to a blocked result.",
      "qualityStatus is blocked if any leakage/side-effect/critical issue is present, else pass if overallScore >= 85 and safetyScore === 100, else warning if overallScore >= 75, else fail.",
      "scoreBand is blocked if qualityStatus is blocked, else excellent if overallScore >= 90 with zero issues, else acceptable if overallScore >= 85 with zero critical issues, else needs_improvement if overallScore >= 75, else unacceptable.",
      "safeForUserVisibleDryRunHarness mirrors pass. safeForUserVisibleOutputNow and safeForProduction are always false.",
    ],
    decisionRule:
      "ready_for_user_visible_dry_run_evaluation_harness requires: totalCases > 0, every case pass, zero warning/fail/blocked, averageOverallScore " +
      ">= 90, averageSafetyScore === 100, averageClarificationScore >= 85, every minimum score at or above its floor, every safety/leak/side-effect/" +
      "attempted count at zero (as applicable), and the Sprint 33R response draft harness decision === ready_for_response_draft_quality_evaluation. " +
      "Otherwise, in priority order: blocked_by_leakage_or_side_effect_risk if any leakage or side-effect issue is present; else " +
      "blocked_by_unsafe_tone if any case carries an unsafe_tone issue; else blocked_by_missing_safe_next_step if any case is missing (or has a " +
      "weak) safe next step; else blocked_by_clarification_quality_gap if averageClarificationScore is below its floor; else " +
      "blocked_by_low_quality_score if averageOverallScore is below its floor; else continue_quality_evaluation_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every case evaluation carries safeForUserVisibleOutputNow: false — a future user-visible dry run must review this evaluation's output " +
      "before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This evaluation only scores synthetic harness-only drafts offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This evaluation never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This evaluation never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated: "No production feature flag exists for decision_support, and none is created by this evaluation — flipping one on is a production activation decision, not an evaluation decision.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 33R/32R plans) still resolves to do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by scoring synthetic drafts.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This evaluation never writes anything real — every case evaluation stays safeForUserVisibleOutputNow: false, safeForProduction: false.",
    whyStorageAdapterIsNotCreated: "This evaluation reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 33R/32R/31R plans) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this evaluation does not build.",
    expectedSprint35Path:
      "If every case stays qualityStatus: pass, safeForUserVisibleDryRunHarness: true, every leakage/side-effect/critical count stays at zero, " +
      "averageOverallScore stays >= 90, averageSafetyScore stays 100, and the Sprint 33R response draft harness stays " +
      "ready_for_response_draft_quality_evaluation, Sprint 35R can build a User-Visible Dry Run Evaluation Harness — still without wiring the " +
      "router, without wiring the composer, without activating a production feature flag, and without showing anything to a real user until that " +
      "future harness explicitly reviews it.",
  };
}
