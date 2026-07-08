/**
 * Sprint 33R — Decision Support Response Draft Harness.
 *
 * A pure, offline, deterministic **response draft harness** — not a user-visible dry run, and not
 * production wiring — that generates a synthetic draft of a `decision_support` response for every case
 * the Sprint 32R response QA plan already assessed as safe for this harness, validates each draft
 * against its own contract, and consolidates a decision on whether the corpus is ready for a Sprint 34R
 * response draft quality evaluation.
 *
 * Reuses, rather than reimplements: the Sprint 32R response QA / user-visible dry run plan
 * (`buildDecisionSupportResponseQaDryRunPlan`, `summarizeDecisionSupportResponseQaDryRunPlan`), which in
 * turn reuses the Sprint 31R clarification-gated integration plan, the Sprint 30R controlled shadow
 * replay evaluation, the Sprint 29R persistence readiness review, the Sprint 25R-28R layer evaluations,
 * and the Sprint 22R clarification response evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user, and it never persists any real output.
 * Every draft this module produces is a synthetic, harness-only draft: `generatedForHarnessOnly: true`,
 * `userVisibleNow: false`, `persistedNow: false`, `executableNow: false`,
 * `externalSideEffectsAllowed: false` always. See
 * `docs/conversational-brain-decision-support-response-draft-harness.md` for the full design writeup.
 */

import { buildDecisionSupportResponseQaDryRunPlan, summarizeDecisionSupportResponseQaDryRunPlan } from "./decisionSupportResponseQaDryRunPlan";

import type {
  DecisionSupportResponseDraftHarnessCaseResult,
  DecisionSupportResponseDraftHarnessConfig,
  DecisionSupportResponseDraftHarnessDecision,
  DecisionSupportResponseDraftHarnessDraft,
  DecisionSupportResponseDraftHarnessDraftKind,
  DecisionSupportResponseDraftHarnessExplain,
  DecisionSupportResponseDraftHarnessOptions,
  DecisionSupportResponseDraftHarnessQaStatus,
  DecisionSupportResponseDraftHarnessResult,
  DecisionSupportResponseDraftHarnessRiskLevel,
  DecisionSupportResponseDraftHarnessSummary,
  DecisionSupportResponseDraftHarnessSummaryOptions,
  DecisionSupportResponseDraftHarnessValidationResult,
  DecisionSupportResponseDraftHarnessViolationType,
  DecisionSupportResponseQaDryRunCaseAssessment,
} from "./decisionSupportResponseDraftHarnessTypes";

export type {
  DecisionSupportResponseDraftHarnessProfile,
  DecisionSupportResponseDraftHarnessMode,
  DecisionSupportResponseDraftHarnessDecision,
  DecisionSupportResponseDraftHarnessDraftKind,
  DecisionSupportResponseDraftHarnessDraftStatus,
  DecisionSupportResponseDraftHarnessQaStatus,
  DecisionSupportResponseDraftHarnessRiskLevel,
  DecisionSupportResponseDraftHarnessViolationType,
  DecisionSupportResponseDraftHarnessConfig,
  DecisionSupportResponseDraftHarnessDraftSections,
  DecisionSupportResponseDraftHarnessDraftContract,
  DecisionSupportResponseDraftHarnessDraftSafety,
  DecisionSupportResponseDraftHarnessDraft,
  DecisionSupportResponseDraftHarnessValidationResult,
  DecisionSupportResponseDraftHarnessCaseResult,
  DecisionSupportResponseDraftHarnessOptions,
  DecisionSupportResponseDraftHarnessResult,
  DecisionSupportResponseDraftHarnessSummaryOptions,
  DecisionSupportResponseDraftHarnessSummary,
  DecisionSupportResponseDraftHarnessExplain,
} from "./decisionSupportResponseDraftHarnessTypes";

export const DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_VERSION = "33R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 34R — Decision Support Response Draft Quality Evaluation";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 33R — Decision Support Response Draft Harness";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_response_draft_harness"` default config. The thirteen `allow*`
 * real-side-effect fields are always `false`, forced regardless of any override a caller passes —
 * mirroring how the Sprint 32R response QA plan's own config never actually loosens its thirteen
 * `allow*` real-side-effect flags from an override. The nine `require*` fields are always `true`.
 */
export function createDecisionSupportResponseDraftHarnessConfig(
  overrides: Partial<DecisionSupportResponseDraftHarnessConfig> = {},
): DecisionSupportResponseDraftHarnessConfig {
  const config: DecisionSupportResponseDraftHarnessConfig = {
    profile: "strict_response_draft_harness",
    mode: overrides.mode ?? "harness_only",
    // These thirteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the response draft harness's own strict, non-negotiable invariant.
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
    requireQaPlanPass: true,
    requireContractMatch: true,
    requireClarificationFirstForDecisionSupport: true,
    requireRoutePreservationForExistingRoutes: true,
    requireUnsupportedPreservation: true,
    requireNonExecutionNotice: true,
    requireSafeNextStep: true,
    requireNoLeaks: true,
    requireNoSideEffects: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ───────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Build a response draft quality evaluation (Sprint 34R).",
  "Evaluate draft tone and structure evaluation for every draft kind.",
  "Run a clarification-first response evaluation for every clarification_first_draft.",
  "Run a non-execution safety review for every draft.",
  "Run a route preservation response evaluation for every route_preservation_draft.",
  "Run an unsupported boundary response evaluation for every unsupported_boundary_draft.",
  "Run a no-leak validation across every draft.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Show draft to user.",
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
  "Execute actions for real.",
  "Create tasks for real.",
  "Create emails for real.",
  "Create drafts for real.",
  "Call external services for real.",
  "Persist output real.",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportResponseDraftHarnessAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportResponseDraftHarnessProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Draft kind mapping ─────────────────────────────────────────────────────────────────

function draftKindForResponseKind(responseKind: string): DecisionSupportResponseDraftHarnessDraftKind {
  switch (responseKind) {
    case "clarification_question":
      return "clarification_first_draft";
    case "route_preservation_notice":
      return "route_preservation_draft";
    case "unsupported_boundary_notice":
      return "unsupported_boundary_draft";
    case "shadow_only_internal":
      return "shadow_only_internal_draft";
    case "unsafe_response_blocked":
    case "decision_support_advisory":
    default:
      return "blocked_unsafe_draft";
  }
}

// ─── Draft creation ─────────────────────────────────────────────────────────────────────

const ACKNOWLEDGEMENT_TEXT = "Gracias por tu mensaje — quiero asegurarme de responderte de forma segura y útil.";
const CLARIFICATION_QUESTION_TEXT = "Antes de continuar, ¿podrías confirmar el contexto y las opciones concretas que estás evaluando?";
const CLARIFICATION_ASSUMPTIONS: string[] = [
  "Se asume que todavía no se tomó una decisión final sobre este tema.",
  "Se asume que el usuario puede aportar contexto adicional si se le pregunta.",
];
const CLARIFICATION_NEXT_STEP = "El siguiente paso seguro es responder la pregunta de aclaración antes de ofrecer cualquier guía adicional.";

const ROUTE_PRESERVATION_NOTICE_TEXT = "Este tipo de mensaje se sigue resolviendo con la ruta de producción existente, sin pasar por decision_support.";
const ROUTE_PRESERVATION_NEXT_STEP = "El siguiente paso seguro es dejar que la ruta de producción existente continúe manejando este mensaje.";

const UNSUPPORTED_BOUNDARY_NOTICE_TEXT = "Este tipo de mensaje permanece fuera del alcance soportado; se mantiene el comportamiento seguro existente.";
const UNSUPPORTED_NEXT_STEP = "El siguiente paso seguro es mantener el fallback seguro existente para este mensaje.";

const SHADOW_ONLY_NOTICE_TEXT = "Este borrador permanece interno y no debe mostrarse a ningún usuario todavía.";
const BLOCKED_NOTICE_TEXT = "Este borrador no pasó las validaciones de seguridad y se bloquea como fallback seguro genérico.";

const NON_EXECUTION_NOTICE = "Este borrador no ejecuta ninguna acción, no crea tareas, no envía emails ni drafts, y no persiste ningún dato real.";

function emptySafety() {
  return {
    rawInputIncluded: false as const,
    fullCandidateIncluded: false as const,
    piiIncluded: false as const,
    projectNameIncluded: false as const,
    taskPayloadIncluded: false as const,
    emailDraftPayloadIncluded: false as const,
    dbPayloadIncluded: false as const,
    supabasePayloadIncluded: false as const,
    externalCallPayloadIncluded: false as const,
  };
}

export type DecisionSupportResponseDraftFromQaCaseInput =
  | DecisionSupportResponseQaDryRunCaseAssessment
  | { caseId: string; routeKind: string; responseKind: string };

export type DecisionSupportResponseDraftFromQaCaseOptions = Record<string, never>;

/**
 * Builds a synthetic, harness-only draft from a Sprint 32R response QA case assessment (or a bare
 * `{ caseId, routeKind, responseKind }`). Every draft is `generatedForHarnessOnly: true`,
 * `userVisibleNow: false`, `persistedNow: false`, `executableNow: false`,
 * `externalSideEffectsAllowed: false`, and never contains raw input, a full candidate object, a raw
 * project name, an email, a phone number, a task/email/draft/DB/Supabase/external-call payload.
 */
export function createDecisionSupportResponseDraftFromQaCase(
  qaCaseAssessment: DecisionSupportResponseDraftFromQaCaseInput,
  _options: DecisionSupportResponseDraftFromQaCaseOptions = {},
): DecisionSupportResponseDraftHarnessDraft {
  const caseId = qaCaseAssessment.caseId;
  const sourceRouteKind = qaCaseAssessment.routeKind;
  const sourceResponseKind = qaCaseAssessment.responseKind;
  const draftKind = draftKindForResponseKind(sourceResponseKind);
  const draftId = `draft-${caseId}`;

  let sections: DecisionSupportResponseDraftHarnessDraft["sections"];
  switch (draftKind) {
    case "clarification_first_draft":
      sections = {
        acknowledgement: ACKNOWLEDGEMENT_TEXT,
        clarificationQuestion: CLARIFICATION_QUESTION_TEXT,
        assumptions: [...CLARIFICATION_ASSUMPTIONS],
        recommendedNextStep: CLARIFICATION_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      break;
    case "route_preservation_draft":
      sections = {
        acknowledgement: ACKNOWLEDGEMENT_TEXT,
        routePreservationNotice: ROUTE_PRESERVATION_NOTICE_TEXT,
        recommendedNextStep: ROUTE_PRESERVATION_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      break;
    case "unsupported_boundary_draft":
      sections = {
        acknowledgement: ACKNOWLEDGEMENT_TEXT,
        unsupportedBoundaryNotice: UNSUPPORTED_BOUNDARY_NOTICE_TEXT,
        recommendedNextStep: UNSUPPORTED_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      break;
    case "shadow_only_internal_draft":
      sections = {
        shadowOnlyNotice: SHADOW_ONLY_NOTICE_TEXT,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      break;
    case "blocked_unsafe_draft":
    default:
      sections = {
        blockedNotice: BLOCKED_NOTICE_TEXT,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      break;
  }

  return {
    draftId,
    sourceCaseId: caseId,
    draftKind,
    sourceResponseKind,
    sourceRouteKind,
    generatedForHarnessOnly: true,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    status: "generated",
    sections,
    contract: {
      requiresClarificationFirst: draftKind === "clarification_first_draft",
      requiresRoutePreservation: draftKind === "route_preservation_draft",
      requiresUnsupportedPreservation: draftKind === "unsupported_boundary_draft",
      blocksDirectDecision: true,
      blocksExecution: true,
      blocksPersistence: true,
      blocksExternalCalls: true,
    },
    safety: emptySafety(),
    warnings: [],
  } satisfies DecisionSupportResponseDraftHarnessDraft;
}

// ─── Draft validation ───────────────────────────────────────────────────────────────────

type CheckResult = { passed: boolean; violations: DecisionSupportResponseDraftHarnessViolationType[] };

function checkContractMatched(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  const expectedKind = draftKindForResponseKind(draft.sourceResponseKind);
  if (draft.draftKind !== expectedKind) violations.push("direct_decision_without_clarification");
  if (draft.contract.blocksDirectDecision !== true) violations.push("direct_decision_without_clarification");
  if (draft.contract.blocksExecution !== true) violations.push("action_execution");
  if (draft.contract.blocksPersistence !== true) violations.push("real_persistence");
  if (draft.contract.blocksExternalCalls !== true) violations.push("external_call");
  return { passed: violations.length === 0, violations };
}

function checkClarificationFirst(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  if (draft.draftKind !== "clarification_first_draft") return { passed: true, violations: [] };
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (!draft.sections.clarificationQuestion) violations.push("missing_clarifying_question");
  if (draft.sections.advisoryFrame) violations.push("direct_decision_without_clarification");
  if (!draft.sections.assumptions || draft.sections.assumptions.length === 0) violations.push("missing_assumptions");
  return { passed: violations.length === 0, violations };
}

function checkRoutePreservation(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  if (draft.draftKind !== "route_preservation_draft") return { passed: true, violations: [] };
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (!draft.sections.routePreservationNotice) violations.push("direct_decision_without_clarification");
  if (draft.sections.clarificationQuestion || draft.sections.advisoryFrame) violations.push("direct_decision_without_clarification");
  return { passed: violations.length === 0, violations };
}

function checkUnsupportedPreservation(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  if (draft.draftKind !== "unsupported_boundary_draft") return { passed: true, violations: [] };
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (!draft.sections.unsupportedBoundaryNotice) violations.push("direct_decision_without_clarification");
  if (draft.sections.clarificationQuestion || draft.sections.advisoryFrame) violations.push("direct_decision_without_clarification");
  return { passed: violations.length === 0, violations };
}

function checkNonExecutionNotice(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (!draft.sections.nonExecutionNotice) violations.push("missing_non_execution_notice");
  return { passed: violations.length === 0, violations };
}

function checkSafeNextStep(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  switch (draft.draftKind) {
    case "clarification_first_draft":
    case "route_preservation_draft":
    case "unsupported_boundary_draft":
      if (!draft.sections.recommendedNextStep) violations.push("missing_safe_next_step");
      break;
    case "shadow_only_internal_draft":
      if (!draft.sections.shadowOnlyNotice || !draft.sections.nonExecutionNotice) violations.push("missing_safe_next_step");
      break;
    case "blocked_unsafe_draft":
    default:
      if (!draft.sections.blockedNotice || !draft.sections.nonExecutionNotice) violations.push("missing_safe_next_step");
      break;
  }
  return { passed: violations.length === 0, violations };
}

function checkNoLeaks(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (draft.safety.rawInputIncluded) violations.push("raw_input_leak");
  if (draft.safety.fullCandidateIncluded) violations.push("full_candidate_leak");
  if (draft.safety.piiIncluded) violations.push("pii_leak");
  if (draft.safety.projectNameIncluded) violations.push("project_name_leak");
  return { passed: violations.length === 0, violations };
}

function checkNoSideEffects(draft: DecisionSupportResponseDraftHarnessDraft): CheckResult {
  const violations: DecisionSupportResponseDraftHarnessViolationType[] = [];
  if (draft.userVisibleNow) violations.push("user_visible_output");
  if (draft.persistedNow) violations.push("real_persistence");
  if (draft.executableNow) violations.push("action_execution");
  if (draft.externalSideEffectsAllowed) violations.push("external_call");
  if (draft.safety.taskPayloadIncluded) violations.push("task_creation");
  if (draft.safety.emailDraftPayloadIncluded) violations.push("email_or_draft_creation");
  if (draft.safety.dbPayloadIncluded) violations.push("db_write");
  if (draft.safety.supabasePayloadIncluded) violations.push("supabase_write");
  if (draft.safety.externalCallPayloadIncluded) violations.push("external_call");
  return { passed: violations.length === 0, violations };
}

const SIDE_EFFECT_OR_LEAK_VIOLATIONS = new Set<DecisionSupportResponseDraftHarnessViolationType>([
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "user_visible_output",
  "real_persistence",
  "action_execution",
  "task_creation",
  "email_or_draft_creation",
  "db_write",
  "supabase_write",
  "external_call",
  "router_wiring",
  "composer_wiring",
  "endpoint_wiring",
  "feature_flag_activation",
  "production_wiring",
]);

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type DecisionSupportResponseDraftValidationOptions = Record<string, never>;

/**
 * Validates a single synthetic response draft against every Sprint 33R QA check: contract match,
 * clarification-first shape (when applicable), route preservation (when applicable), unsupported
 * boundary preservation (when applicable), non-execution notice, safe next step, no-leak guarantee, and
 * no-side-effects guarantee. Every `*Attempted` field is always the literal `false` — this harness never
 * attempts a real side effect, so there is nothing to detect beyond the draft's own declared fields.
 */
export function validateDecisionSupportResponseDraft(
  draft: DecisionSupportResponseDraftHarnessDraft,
  _options: DecisionSupportResponseDraftValidationOptions = {},
): DecisionSupportResponseDraftHarnessValidationResult {
  const contractMatch = checkContractMatched(draft);
  const clarificationFirst = checkClarificationFirst(draft);
  const routePreservation = checkRoutePreservation(draft);
  const unsupportedPreservation = checkUnsupportedPreservation(draft);
  const nonExecutionNotice = checkNonExecutionNotice(draft);
  const safeNextStep = checkSafeNextStep(draft);
  const noLeaks = checkNoLeaks(draft);
  const noSideEffects = checkNoSideEffects(draft);

  const allChecks = [contractMatch, clarificationFirst, routePreservation, unsupportedPreservation, nonExecutionNotice, safeNextStep, noLeaks, noSideEffects];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));

  const hasBlockingViolation = violations.some((v) => SIDE_EFFECT_OR_LEAK_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportResponseDraftHarnessQaStatus;
  let riskLevel: DecisionSupportResponseDraftHarnessRiskLevel;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
  } else if (hasBlockingViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
  } else {
    qaStatus = "fail";
    riskLevel = "high";
  }

  const valid = violations.length === 0;
  const recommendation =
    violations.length === 0
      ? "No action needed — this draft passes every Sprint 33R QA check."
      : `Fix the following before this draft can be accepted: ${violations.join(", ")}.`;

  return {
    draftId: draft.draftId,
    valid,
    qaStatus,
    riskLevel,
    violations,
    contractMatched: contractMatch.passed,
    clarificationFirstPassed: clarificationFirst.passed,
    routePreservationPassed: routePreservation.passed,
    unsupportedPreservationPassed: unsupportedPreservation.passed,
    nonExecutionNoticePassed: nonExecutionNotice.passed,
    safeNextStepPassed: safeNextStep.passed,
    noLeaksPassed: noLeaks.passed,
    noSideEffectsPassed: noSideEffects.passed,
    userVisibleOutputAttempted: false,
    productionWiringAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    recommendation,
  } satisfies DecisionSupportResponseDraftHarnessValidationResult;
}

// ─── Harness run ────────────────────────────────────────────────────────────────────────

function statusForValidation(
  draftKind: DecisionSupportResponseDraftHarnessDraftKind,
  validation: DecisionSupportResponseDraftHarnessValidationResult,
): "validated" | "rejected" | "blocked" {
  if (draftKind === "blocked_unsafe_draft") return validation.valid ? "validated" : "blocked";
  if (validation.valid) return "validated";
  return validation.qaStatus === "blocked" ? "blocked" : "rejected";
}

function buildCaseResult(assessment: DecisionSupportResponseQaDryRunCaseAssessment): DecisionSupportResponseDraftHarnessCaseResult {
  const draft = createDecisionSupportResponseDraftFromQaCase(assessment);
  const validation = validateDecisionSupportResponseDraft(draft);
  const status = statusForValidation(draft.draftKind, validation);
  const finalDraft: DecisionSupportResponseDraftHarnessDraft = { ...draft, status };

  const warnings: string[] = [];
  if (!validation.valid) {
    warnings.push(`Case ${assessment.caseId}: draft ${draft.draftKind} is ${validation.qaStatus} — ${validation.recommendation}`);
  }

  return {
    caseId: assessment.caseId,
    sourceRouteKind: assessment.routeKind,
    sourceResponseKind: assessment.responseKind,
    draft: finalDraft,
    validation,
    draftGenerated: true,
    draftAccepted: validation.valid,
    draftRejected: !validation.valid && status === "rejected",
    draftBlocked: status === "blocked",
    safeForQualityEvaluation: validation.valid,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings,
  } satisfies DecisionSupportResponseDraftHarnessCaseResult;
}

/**
 * Runs the full Sprint 33R response draft harness: reuses (or builds) the Sprint 32R response QA plan
 * against the same corpus (default: the Sprint 31R integration plan's own small self-contained
 * synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R corpus), generates a
 * synthetic draft for every case, validates each draft, and consolidates the Sprint 33R allowed/
 * prohibited actions. Never shows anything to a user, never persists anything real, and never touches
 * the router, composer, or endpoint.
 */
export function runDecisionSupportResponseDraftHarness(options: DecisionSupportResponseDraftHarnessOptions = {}): DecisionSupportResponseDraftHarnessResult {
  const config = createDecisionSupportResponseDraftHarnessConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const qaPlan = options.qaPlan ?? buildDecisionSupportResponseQaDryRunPlan({ cases: options.cases, now });
  const qaSummary = summarizeDecisionSupportResponseQaDryRunPlan(qaPlan);

  const caseResults = qaPlan.assessments.map((assessment) => buildCaseResult(assessment));

  const allowedNextActions = listDecisionSupportResponseDraftHarnessAllowedNextActions();
  const prohibitedActions = listDecisionSupportResponseDraftHarnessProhibitedActions();

  const warnings: string[] = [];
  if (qaSummary.decision !== "ready_for_response_draft_harness") {
    warnings.push(`Sprint 32R response QA plan decision is "${qaSummary.decision}", not "ready_for_response_draft_harness" — this harness cannot recommend Sprint 34R until that is resolved.`);
  }
  if (qaSummary.safeForResponseDraftHarnessCount !== qaSummary.totalCases) {
    warnings.push("Not every Sprint 32R case is safeForResponseDraftHarness — this harness cannot recommend Sprint 34R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    qaPlan,
    qaSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportResponseDraftHarnessResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function computeDecision(fields: {
  totalCases: number;
  draftGeneratedCount: number;
  draftAcceptedCount: number;
  draftRejectedCount: number;
  draftBlockedCount: number;
  qaPassCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  safeForQualityEvaluationCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  contractMatchedCount: number;
  nonExecutionNoticePassedCount: number;
  safeNextStepPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  violationCount: number;
  criticalViolationCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  rawInputIncludedCount: number;
  fullCandidateIncludedCount: number;
  piiIncludedCount: number;
  projectNameIncludedCount: number;
  taskPayloadIncludedCount: number;
  emailDraftPayloadIncludedCount: number;
  dbPayloadIncludedCount: number;
  supabasePayloadIncludedCount: number;
  externalCallPayloadIncludedCount: number;
  sprint32QaDecision: string | undefined;
}): DecisionSupportResponseDraftHarnessDecision {
  const anySideEffectAttempted =
    fields.userVisibleOutputAttemptedCount > 0 ||
    fields.productionWiringAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0;
  if (anySideEffectAttempted) return "blocked_by_side_effect_risk";

  const anyLeakOrPayload =
    fields.rawInputIncludedCount > 0 ||
    fields.fullCandidateIncludedCount > 0 ||
    fields.piiIncludedCount > 0 ||
    fields.projectNameIncludedCount > 0 ||
    fields.taskPayloadIncludedCount > 0 ||
    fields.emailDraftPayloadIncludedCount > 0 ||
    fields.dbPayloadIncludedCount > 0 ||
    fields.supabasePayloadIncludedCount > 0 ||
    fields.externalCallPayloadIncludedCount > 0;
  if (anyLeakOrPayload) return "blocked_by_leakage";

  if (fields.draftBlockedCount > 0 || fields.qaBlockedCount > 0 || fields.criticalViolationCount > 0) return "blocked_by_unsafe_draft";

  if (fields.contractMatchedCount !== fields.totalCases || fields.qaFailCount > 0 || fields.draftRejectedCount > 0) {
    return "blocked_by_contract_gap";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.draftGeneratedCount === fields.totalCases &&
    fields.draftAcceptedCount === fields.totalCases &&
    fields.draftRejectedCount === 0 &&
    fields.draftBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.safeForQualityEvaluationCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.contractMatchedCount === fields.totalCases &&
    fields.nonExecutionNoticePassedCount === fields.totalCases &&
    fields.safeNextStepPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    !anySideEffectAttempted &&
    !anyLeakOrPayload &&
    fields.sprint32QaDecision === "ready_for_response_draft_harness";

  return allClean ? "ready_for_response_draft_quality_evaluation" : "continue_harness_only";
}

function recommendedNextSprintFor(decision: DecisionSupportResponseDraftHarnessDecision): string {
  switch (decision) {
    case "ready_for_response_draft_quality_evaluation":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_contract_gap":
      return "Sprint 33R — Decision Support Response Draft Harness (Contract Gap Hardening)";
    case "blocked_by_unsafe_draft":
      return "Sprint 33R — Decision Support Response Draft Harness (Unsafe Draft Hardening)";
    case "blocked_by_leakage":
      return "Sprint 33R — Decision Support Response Draft Harness (Leakage Hardening)";
    case "blocked_by_side_effect_risk":
      return "Sprint 33R — Decision Support Response Draft Harness (Side Effect Risk Hardening)";
    case "continue_harness_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportResponseDraftHarness()` result — or a bare
 * `DecisionSupportResponseDraftHarnessCaseResult[]` plus `options.sprint32QaDecision` — into a
 * review-ready report: per-draft-kind counts, QA status counts, safety counts (every
 * production-side-effect count expected zero), leak/payload counts (all expected zero), a decision, and
 * a recommended next sprint. Pure — takes already-computed case results rather than re-running anything.
 */
export function summarizeDecisionSupportResponseDraftHarness(
  harnessOrCaseResults: DecisionSupportResponseDraftHarnessResult | DecisionSupportResponseDraftHarnessCaseResult[],
  options: DecisionSupportResponseDraftHarnessSummaryOptions = {},
): DecisionSupportResponseDraftHarnessSummary {
  const caseResults = Array.isArray(harnessOrCaseResults) ? harnessOrCaseResults : harnessOrCaseResults.caseResults;
  const sprint32QaDecision = Array.isArray(harnessOrCaseResults)
    ? options.sprint32QaDecision
    : (options.sprint32QaDecision ?? harnessOrCaseResults.qaSummary.decision);
  const harnessWarnings = Array.isArray(harnessOrCaseResults) ? [] : harnessOrCaseResults.warnings;

  const totalCases = caseResults.length;

  const draftGeneratedCount = caseResults.filter((c) => c.draftGenerated).length;
  const draftAcceptedCount = caseResults.filter((c) => c.draftAccepted).length;
  const draftRejectedCount = caseResults.filter((c) => c.draftRejected).length;
  const draftBlockedCount = caseResults.filter((c) => c.draftBlocked).length;

  const clarificationFirstCases = caseResults.filter((c) => c.draft.draftKind === "clarification_first_draft");
  const routePreservationCases = caseResults.filter((c) => c.draft.draftKind === "route_preservation_draft");
  const unsupportedBoundaryCases = caseResults.filter((c) => c.draft.draftKind === "unsupported_boundary_draft");
  const shadowOnlyInternalCases = caseResults.filter((c) => c.draft.draftKind === "shadow_only_internal_draft");
  const blockedUnsafeCases = caseResults.filter((c) => c.draft.draftKind === "blocked_unsafe_draft");

  const clarificationFirstDraftCount = clarificationFirstCases.length;
  const routePreservationDraftCount = routePreservationCases.length;
  const unsupportedBoundaryDraftCount = unsupportedBoundaryCases.length;
  const shadowOnlyInternalDraftCount = shadowOnlyInternalCases.length;
  const blockedUnsafeDraftCount = blockedUnsafeCases.length;

  const qaPassCount = caseResults.filter((c) => c.validation.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.validation.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.validation.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.validation.qaStatus === "blocked").length;

  const safeForQualityEvaluationCount = caseResults.filter((c) => c.safeForQualityEvaluation).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const contractMatchedCount = caseResults.filter((c) => c.validation.contractMatched).length;
  const clarificationFirstPassedCount = clarificationFirstCases.filter((c) => c.validation.clarificationFirstPassed).length;
  const routePreservationPassedCount = routePreservationCases.filter((c) => c.validation.routePreservationPassed).length;
  const unsupportedPreservationPassedCount = unsupportedBoundaryCases.filter((c) => c.validation.unsupportedPreservationPassed).length;
  const nonExecutionNoticePassedCount = caseResults.filter((c) => c.validation.nonExecutionNoticePassed).length;
  const safeNextStepPassedCount = caseResults.filter((c) => c.validation.safeNextStepPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.validation.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.validation.noSideEffectsPassed).length;

  const allViolations = caseResults.flatMap((c) => c.validation.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = caseResults.filter((c) => c.validation.riskLevel === "critical").flatMap((c) => c.validation.violations).length;

  const userVisibleOutputAttemptedCount = caseResults.filter((c) => c.validation.userVisibleOutputAttempted).length;
  const productionWiringAttemptedCount = caseResults.filter((c) => c.validation.productionWiringAttempted).length;
  const realPersistenceAttemptedCount = caseResults.filter((c) => c.validation.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = caseResults.filter((c) => c.validation.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = caseResults.filter((c) => c.validation.supabaseWriteAttempted).length;
  const externalCallAttemptedCount = caseResults.filter((c) => c.validation.externalCallAttempted).length;

  const rawInputIncludedCount = caseResults.filter((c) => c.draft.safety.rawInputIncluded).length;
  const fullCandidateIncludedCount = caseResults.filter((c) => c.draft.safety.fullCandidateIncluded).length;
  const piiIncludedCount = caseResults.filter((c) => c.draft.safety.piiIncluded).length;
  const projectNameIncludedCount = caseResults.filter((c) => c.draft.safety.projectNameIncluded).length;
  const taskPayloadIncludedCount = caseResults.filter((c) => c.draft.safety.taskPayloadIncluded).length;
  const emailDraftPayloadIncludedCount = caseResults.filter((c) => c.draft.safety.emailDraftPayloadIncluded).length;
  const dbPayloadIncludedCount = caseResults.filter((c) => c.draft.safety.dbPayloadIncluded).length;
  const supabasePayloadIncludedCount = caseResults.filter((c) => c.draft.safety.supabasePayloadIncluded).length;
  const externalCallPayloadIncludedCount = caseResults.filter((c) => c.draft.safety.externalCallPayloadIncluded).length;

  const decision = computeDecision({
    totalCases,
    draftGeneratedCount,
    draftAcceptedCount,
    draftRejectedCount,
    draftBlockedCount,
    qaPassCount,
    qaFailCount,
    qaBlockedCount,
    safeForQualityEvaluationCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    contractMatchedCount,
    nonExecutionNoticePassedCount,
    safeNextStepPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    violationCount,
    criticalViolationCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputIncludedCount,
    fullCandidateIncludedCount,
    piiIncludedCount,
    projectNameIncludedCount,
    taskPayloadIncludedCount,
    emailDraftPayloadIncludedCount,
    dbPayloadIncludedCount,
    supabasePayloadIncludedCount,
    externalCallPayloadIncludedCount,
    sprint32QaDecision,
  });

  const warnings = [...harnessWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    draftGeneratedCount,
    draftAcceptedCount,
    draftRejectedCount,
    draftBlockedCount,
    clarificationFirstDraftCount,
    routePreservationDraftCount,
    unsupportedBoundaryDraftCount,
    shadowOnlyInternalDraftCount,
    blockedUnsafeDraftCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    safeForQualityEvaluationCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    contractMatchedCount,
    clarificationFirstPassedCount,
    routePreservationPassedCount,
    unsupportedPreservationPassedCount,
    nonExecutionNoticePassedCount,
    safeNextStepPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    violationCount,
    criticalViolationCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputIncludedCount,
    fullCandidateIncludedCount,
    piiIncludedCount,
    projectNameIncludedCount,
    taskPayloadIncludedCount,
    emailDraftPayloadIncludedCount,
    dbPayloadIncludedCount,
    supabasePayloadIncludedCount,
    externalCallPayloadIncludedCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedDrafts: caseResults.filter((c) => c.draftAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedDrafts: caseResults.filter((c) => c.draftRejected),
    blockedDrafts: caseResults.filter((c) => c.draftBlocked),
    warnings,
  } satisfies DecisionSupportResponseDraftHarnessSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 33R response draft harness — mirrors the style of
 * `explainDecisionSupportResponseQaDryRunPlan()` (Sprint 32R). See
 * `docs/conversational-brain-decision-support-response-draft-harness.md` for full context.
 */
export function explainDecisionSupportResponseDraftHarness(): DecisionSupportResponseDraftHarnessExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-response-draft-harness",
    purpose:
      "Generates, validates, and evaluates synthetic drafts of a decision_support response for every case the Sprint 32R response QA plan " +
      "already assessed as safe for this harness — without ever showing anything to a real user, and without connecting decision_support to " +
      "production.",
    nonGoals: [
      "Show a draft to a real user.",
      "Wire the router, composer, or endpoint.",
      "Activate a production feature flag.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
    ],
    harnessProfile:
      'The "strict_response_draft_harness" profile: every allow* field (allowUserVisibleOutput/allowProductionWiring/allowRouterChange/' +
      "allowComposerChange/allowEndpointChange/allowFeatureFlag/allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls/" +
      "allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override a caller passes, " +
      "and every require* field is always true.",
    harnessModes: [
      "harness_only (default): the full response draft harness, covering every draft kind.",
      "synthetic_draft_generation: emphasizes createDecisionSupportResponseDraftFromQaCase() output.",
      "contract_backed_draft_generation: emphasizes each draft's contract fields.",
      "qa_backed_draft_generation: emphasizes validateDecisionSupportResponseDraft() output.",
      "dry_run_readiness_harness: emphasizes safeForQualityEvaluation across every case (never safeForUserVisibleOutputNow).",
    ],
    draftKindRules: [
      "clarification_question (Sprint 32R response kind) -> clarification_first_draft.",
      "route_preservation_notice -> route_preservation_draft.",
      "unsupported_boundary_notice -> unsupported_boundary_draft.",
      "shadow_only_internal -> shadow_only_internal_draft.",
      "unsafe_response_blocked and decision_support_advisory -> blocked_unsafe_draft (the safe fallback for any response kind this harness does not build a positive draft for).",
    ],
    draftCreationRules: [
      "Every draft is generatedForHarnessOnly: true, userVisibleNow: false, persistedNow: false, executableNow: false, externalSideEffectsAllowed: false.",
      "A clarification_first_draft never contains a direct decision or advisory conclusion — only an acknowledgement, a clarifying question, assumptions, a safe next step, and a non-execution notice.",
      "No draft ever contains raw input, a full candidate object, a raw project name, an email, a phone number, executable output, a task-creation instruction, email/draft content, a persisted payload, or DB/Supabase content.",
    ],
    draftValidationRules: [
      "contractMatched checks the draft kind matches its source response kind and every blocks* contract field is true.",
      "clarificationFirstPassed/routePreservationPassed/unsupportedPreservationPassed only apply to their matching draft kind — every other draft kind trivially passes.",
      "nonExecutionNoticePassed, safeNextStepPassed, noLeaksPassed, and noSideEffectsPassed apply to every draft kind.",
      "qaStatus is blocked if any leak/side-effect violation is present, else fail if any other violation is present, else pass.",
    ],
    harnessRunRules: [
      "Reuses (or accepts) the Sprint 32R response QA plan against the same corpus rather than re-deriving it.",
      "Generates exactly one draft per Sprint 32R case assessment, then validates every draft.",
      "Never shows output to a user, never persists output, and never touches the router/composer/endpoint.",
    ],
    decisionRule:
      "ready_for_response_draft_quality_evaluation requires: totalCases > 0, draftGeneratedCount === totalCases, draftAcceptedCount === " +
      "totalCases, every rejected/blocked count at zero, qaPassCount === totalCases, every leak/payload count at zero, every attempted count " +
      "at zero, and the Sprint 32R response QA plan decision === ready_for_response_draft_harness. Otherwise, in priority order: " +
      "blocked_by_side_effect_risk if any attempted count is nonzero; else blocked_by_leakage if any leak/payload count is nonzero; else " +
      "blocked_by_unsafe_draft if any draft is blocked or carries a critical violation; else blocked_by_contract_gap if any draft fails " +
      "contract match or a required gate; else continue_harness_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every draft carries userVisibleNow: false and every case result carries safeForUserVisibleOutputNow: false — a future user-visible " +
      "dry run must review this harness's output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This harness only builds synthetic harness-only drafts offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This harness never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This harness never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated: "No production feature flag exists for decision_support, and none is created by this harness — flipping one on is a production activation decision, not a harness decision.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused via the Sprint 32R plan) still resolves to do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by drafting synthetic responses.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This harness never writes anything real — every draft stays persistedNow: false.",
    whyStorageAdapterIsNotCreated: "This harness reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 32R/31R plans) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this harness does not build.",
    expectedSprint34Path:
      "If every draft stays qaStatus: pass, safeForQualityEvaluation: true, no leak/payload count is nonzero, no attempted count is nonzero, " +
      "and the Sprint 32R response QA plan stays ready_for_response_draft_harness, Sprint 34R can run a Decision Support Response Draft " +
      "Quality Evaluation — still without wiring the router, without wiring the composer, without activating a production feature flag, and " +
      "without showing anything to a real user until a future user-visible dry run explicitly reviews it.",
  };
}
