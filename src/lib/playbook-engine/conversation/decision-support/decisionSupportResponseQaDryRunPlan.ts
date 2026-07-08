/**
 * Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan.
 *
 * A pure, offline, deterministic **response QA plan** — not a user-visible dry run itself — that
 * answers: how should a safe `decision_support` response look if it were eventually shown to a user;
 * what response format is acceptable vs risky; what content must be blocked, kept as a clarification
 * request, or kept as advisory/non-executing guidance; what content must never execute an action,
 * create a task/email/draft, or persist; what checks a response must pass before it could ever become
 * visible in a dry run; and what QA gates must exist before any productive integration.
 *
 * Reuses, rather than reimplements: the Sprint 31R clarification-gated integration plan
 * (`buildDecisionSupportClarificationGatedIntegrationPlan`, `summarizeDecisionSupportClarificationGatedIntegrationPlan`),
 * which in turn reuses the Sprint 30R controlled shadow replay evaluation, the Sprint 29R persistence
 * readiness review, the Sprint 25R-28R layer evaluations, and the Sprint 22R clarification response
 * evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user, and it never persists any real output.
 * Every "response" this module produces is a synthetic, QA-only draft: `userVisibleNow: false` and
 * `persistedNow: false` always. See
 * `docs/conversational-brain-decision-support-response-qa-dry-run-plan.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";

import {
  buildDecisionSupportClarificationGatedIntegrationPlan,
  summarizeDecisionSupportClarificationGatedIntegrationPlan,
} from "./decisionSupportClarificationGatedIntegrationPlan";

import type {
  DecisionSupportClarificationGatedIntegrationCaseAssessment,
  DecisionSupportResponseQaDryRunCaseAssessment,
  DecisionSupportResponseQaDryRunGateResult,
  DecisionSupportResponseQaDryRunGateType,
  DecisionSupportResponseQaDryRunPlanConfig,
  DecisionSupportResponseQaDryRunPlanDecision,
  DecisionSupportResponseQaDryRunPlanExplain,
  DecisionSupportResponseQaDryRunPlanOptions,
  DecisionSupportResponseQaDryRunPlanResult,
  DecisionSupportResponseQaDryRunPlanSummary,
  DecisionSupportResponseQaDryRunPlanSummaryOptions,
  DecisionSupportResponseQaDryRunQaStatus,
  DecisionSupportResponseQaDryRunResponseContract,
  DecisionSupportResponseQaDryRunResponseKind,
  DecisionSupportResponseQaDryRunRiskLevel,
  DecisionSupportResponseQaDryRunSyntheticResponseDraft,
  DecisionSupportResponseQaDryRunViolationType,
} from "./decisionSupportResponseQaDryRunPlanTypes";

export type {
  DecisionSupportResponseQaDryRunPlanProfile,
  DecisionSupportResponseQaDryRunPlanMode,
  DecisionSupportResponseQaDryRunPlanDecision,
  DecisionSupportResponseQaDryRunResponseKind,
  DecisionSupportResponseQaDryRunQaStatus,
  DecisionSupportResponseQaDryRunRiskLevel,
  DecisionSupportResponseQaDryRunViolationType,
  DecisionSupportResponseQaDryRunGateType,
  DecisionSupportResponseQaDryRunPlanConfig,
  DecisionSupportResponseQaDryRunResponseContract,
  DecisionSupportResponseQaDryRunResponseSections,
  DecisionSupportResponseQaDryRunSyntheticResponseDraft,
  DecisionSupportResponseQaDryRunGateResult,
  DecisionSupportResponseQaDryRunCaseAssessment,
  DecisionSupportResponseQaDryRunPlanOptions,
  DecisionSupportResponseQaDryRunPlanResult,
  DecisionSupportResponseQaDryRunPlanSummaryOptions,
  DecisionSupportResponseQaDryRunPlanSummary,
  DecisionSupportResponseQaDryRunPlanExplain,
} from "./decisionSupportResponseQaDryRunPlanTypes";

export const DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_VERSION = "32R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 33R — Decision Support Response Draft Harness";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_response_qa_user_visible_dry_run_plan"` default config. The thirteen
 * `allow*` real-side-effect fields are always `false`, forced regardless of any override a caller
 * passes — mirroring how the Sprint 31R integration plan's own config never actually loosens its nine
 * `allow*` real-side-effect flags from an override. The eight `require*` fields are always `true`.
 */
export function createDecisionSupportResponseQaDryRunPlanConfig(
  overrides: Partial<DecisionSupportResponseQaDryRunPlanConfig> = {},
): DecisionSupportResponseQaDryRunPlanConfig {
  const config: DecisionSupportResponseQaDryRunPlanConfig = {
    profile: "strict_response_qa_user_visible_dry_run_plan",
    mode: overrides.mode ?? "plan_only",
    // These thirteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the response QA plan's own strict, non-negotiable invariant.
    allowUserVisibleDryRun: false,
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
    requireClarificationGate: true,
    requireResponseContract: true,
    requireAssumptionDisclosure: true,
    requireNonExecutionGuarantee: true,
    requireNoRawInputLeak: true,
    requireNoFullCandidateLeak: true,
    requireNoPiiLeak: true,
    requireSafeNextStep: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ───────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Build a response draft harness (Sprint 33R).",
  "Evaluate synthetic response drafts against every QA gate.",
  "Validate response contracts for every response kind.",
  "Test the clarification-first answer shape.",
  "Test the route preservation answer shape.",
  "Test the unsupported boundary answer shape.",
  "Test non-execution guarantees for every response kind.",
  "Test no-leak guarantees (raw input, full candidate, PII) for every response kind.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Show decision_support output to a user.",
  "Wire the router to decision_support.",
  "Wire the composer to decision_support.",
  "Wire the endpoint to decision_support.",
  "Enable a production feature flag.",
  "Create a database.",
  "Create a migration.",
  "Create a SQL file.",
  "Write to Supabase.",
  "Implement a real repository.",
  "Implement a real storage adapter.",
  "Execute actions for real.",
  "Create tasks for real.",
  "Create emails for real.",
  "Create drafts for real.",
  "Call external services for real.",
  "Persist output for real.",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportResponseQaDryRunAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportResponseQaDryRunProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Response contracts ─────────────────────────────────────────────────────────────────

const CLARIFICATION_LIKE_REQUIRED_GATES: DecisionSupportResponseQaDryRunGateType[] = [
  "must_be_clarification_first",
  "must_state_assumptions",
  "must_avoid_direct_execution",
  "must_not_create_tasks",
  "must_not_create_emails",
  "must_not_persist",
  "must_not_call_external_services",
  "must_not_leak_raw_input",
  "must_not_leak_full_candidate",
  "must_not_leak_pii",
  "must_be_safe_for_dry_run_only",
];

const ROUTE_PRESERVATION_REQUIRED_GATES: DecisionSupportResponseQaDryRunGateType[] = [
  "must_preserve_existing_route",
  "must_avoid_direct_execution",
  "must_not_create_tasks",
  "must_not_create_emails",
  "must_not_persist",
  "must_not_call_external_services",
  "must_be_safe_for_dry_run_only",
];

const UNSUPPORTED_BOUNDARY_REQUIRED_GATES: DecisionSupportResponseQaDryRunGateType[] = [
  "must_preserve_unsupported",
  "must_avoid_direct_execution",
  "must_not_create_tasks",
  "must_not_create_emails",
  "must_not_persist",
  "must_not_call_external_services",
  "must_be_safe_for_dry_run_only",
];

const SHADOW_ONLY_REQUIRED_GATES: DecisionSupportResponseQaDryRunGateType[] = ["must_remain_shadow_only", "must_be_safe_for_dry_run_only"];

const UNSAFE_BLOCKED_REQUIRED_GATES: DecisionSupportResponseQaDryRunGateType[] = [
  "must_avoid_direct_execution",
  "must_not_create_tasks",
  "must_not_create_emails",
  "must_not_persist",
  "must_not_call_external_services",
  "must_be_safe_for_dry_run_only",
];

const COMMON_PROHIBITED_PATTERNS: DecisionSupportResponseQaDryRunViolationType[] = [
  "unsupported_action_execution",
  "task_creation",
  "email_or_draft_creation",
  "real_persistence",
  "db_write",
  "supabase_write",
  "external_call",
  "router_wiring",
  "composer_wiring",
  "endpoint_wiring",
  "feature_flag_activation",
];

type ResponseContractSeed = {
  allowedInSprint32: boolean;
  futureOnly: boolean;
  prohibitedInSprint32: boolean;
  requiresClarificationGate: boolean;
  requiresAssumptionDisclosure: boolean;
  requiresNonExecutionGuarantee: boolean;
  requiresSafeNextStep: boolean;
  requiredGates: DecisionSupportResponseQaDryRunGateType[];
  prohibitedPatterns: DecisionSupportResponseQaDryRunViolationType[];
  expectedStructure: string[];
  rationale: string[];
};

const RESPONSE_CONTRACT_SEEDS: Record<DecisionSupportResponseQaDryRunResponseKind, ResponseContractSeed> = {
  clarification_question: {
    allowedInSprint32: true,
    futureOnly: false,
    prohibitedInSprint32: false,
    requiresClarificationGate: true,
    requiresAssumptionDisclosure: true,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: true,
    requiredGates: [...CLARIFICATION_LIKE_REQUIRED_GATES],
    prohibitedPatterns: [
      "direct_decision_without_clarification",
      ...COMMON_PROHIBITED_PATTERNS,
      "raw_input_leak",
      "full_candidate_leak",
      "pii_leak",
      "project_name_leak",
      "overconfident_recommendation",
    ],
    expectedStructure: [
      "brief acknowledgement",
      "explicit uncertainty",
      "clarifying question",
      "assumptions if any",
      "non-execution notice",
      "safe next step",
    ],
    rationale: [
      "A clarification_question response is the safe, gate-satisfying shape for any case the Sprint 31R plan routed through the clarification gate.",
      "It must never contain a direct decision, must always disclose its assumptions, and must always carry a non-execution guarantee.",
    ],
  },
  decision_support_advisory: {
    allowedInSprint32: false,
    futureOnly: true,
    prohibitedInSprint32: true,
    requiresClarificationGate: true,
    requiresAssumptionDisclosure: true,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: true,
    requiredGates: [...CLARIFICATION_LIKE_REQUIRED_GATES],
    prohibitedPatterns: [
      "direct_decision_without_clarification",
      ...COMMON_PROHIBITED_PATTERNS,
      "raw_input_leak",
      "full_candidate_leak",
      "pii_leak",
      "project_name_leak",
      "overconfident_recommendation",
    ],
    expectedStructure: [
      "brief acknowledgement",
      "advisory frame (non-executing guidance only)",
      "assumptions",
      "safe options, not a directive",
      "non-execution notice",
      "safe next step",
    ],
    rationale: [
      "decision_support_advisory is future-only and prohibited in Sprint 32R — a user-visible advisory answer may only be considered after a Sprint 32R user-visible dry run has reviewed the response draft harness this sprint recommends building.",
      "Even once allowed, it must still pass through the clarification gate first and must never present a direct decision.",
    ],
  },
  route_preservation_notice: {
    allowedInSprint32: true,
    futureOnly: false,
    prohibitedInSprint32: false,
    requiresClarificationGate: false,
    requiresAssumptionDisclosure: false,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: true,
    requiredGates: [...ROUTE_PRESERVATION_REQUIRED_GATES],
    prohibitedPatterns: [...COMMON_PROHIBITED_PATTERNS],
    expectedStructure: ["route preservation notice", "non-execution notice", "safe next step"],
    rationale: [
      "This case's Sprint 31R route kind is existing_route_preserved — an existing production route already serves it, so no clarification gate applies.",
      "The notice only ever confirms the existing route stays untouched; it never introduces a decision_support answer.",
    ],
  },
  unsupported_boundary_notice: {
    allowedInSprint32: true,
    futureOnly: false,
    prohibitedInSprint32: false,
    requiresClarificationGate: false,
    requiresAssumptionDisclosure: false,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: true,
    requiredGates: [...UNSUPPORTED_BOUNDARY_REQUIRED_GATES],
    prohibitedPatterns: [...COMMON_PROHIBITED_PATTERNS],
    expectedStructure: ["unsupported boundary notice", "non-execution notice", "safe next step"],
    rationale: [
      "This case's Sprint 31R route kind is unsupported_preserved — the Sprint 10R safe fallback already handles it, so decision_support is never a candidate.",
    ],
  },
  shadow_only_internal: {
    allowedInSprint32: true,
    futureOnly: false,
    prohibitedInSprint32: false,
    requiresClarificationGate: false,
    requiresAssumptionDisclosure: false,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: false,
    requiredGates: [...SHADOW_ONLY_REQUIRED_GATES],
    prohibitedPatterns: [...COMMON_PROHIBITED_PATTERNS],
    expectedStructure: ["internal shadow-only marker", "non-execution notice"],
    rationale: [
      "This case's Sprint 31R route kind is shadow_only — a replay not yet proven stable and safe must never be surfaced to a user, not even as a notice.",
    ],
  },
  unsafe_response_blocked: {
    allowedInSprint32: true,
    futureOnly: false,
    prohibitedInSprint32: false,
    requiresClarificationGate: false,
    requiresAssumptionDisclosure: true,
    requiresNonExecutionGuarantee: true,
    requiresSafeNextStep: true,
    requiredGates: [...UNSAFE_BLOCKED_REQUIRED_GATES],
    prohibitedPatterns: [...COMMON_PROHIBITED_PATTERNS, "unsafe_instruction", "overconfident_recommendation"],
    expectedStructure: ["blocked-response fallback notice", "non-execution notice", "safe next step"],
    rationale: [
      "unsafe_response_blocked is the safe fallback for any synthetic draft that fails a required gate — it never shows the unsafe content itself, only a generic blocked notice.",
    ],
  },
};

/**
 * Builds the Sprint 32R response contract for a given response kind. Every contract carries
 * `allowsDirectDecision: false`, `allowsActionExecution: false`, `allowsTaskCreation: false`,
 * `allowsEmailDraftCreation: false`, `allowsRealPersistence: false`, `allowsExternalCalls: false`, and
 * `allowsProductionWiring: false` as literal types — no response kind may ever do any of these things.
 */
export function createDecisionSupportResponseQaDryRunResponseContract(
  responseKind: DecisionSupportResponseQaDryRunResponseKind,
  _options: Record<string, never> = {},
): DecisionSupportResponseQaDryRunResponseContract {
  const seed = RESPONSE_CONTRACT_SEEDS[responseKind];
  return {
    responseKind,
    allowedInSprint32: seed.allowedInSprint32,
    futureOnly: seed.futureOnly,
    prohibitedInSprint32: seed.prohibitedInSprint32,
    requiresClarificationGate: seed.requiresClarificationGate,
    requiresAssumptionDisclosure: seed.requiresAssumptionDisclosure,
    requiresNonExecutionGuarantee: seed.requiresNonExecutionGuarantee,
    requiresSafeNextStep: seed.requiresSafeNextStep,
    allowsDirectDecision: false,
    allowsActionExecution: false,
    allowsTaskCreation: false,
    allowsEmailDraftCreation: false,
    allowsRealPersistence: false,
    allowsExternalCalls: false,
    allowsProductionWiring: false,
    requiredGates: [...seed.requiredGates],
    prohibitedPatterns: [...seed.prohibitedPatterns],
    expectedStructure: [...seed.expectedStructure],
    rationale: [...seed.rationale],
  } satisfies DecisionSupportResponseQaDryRunResponseContract;
}

// ─── Route kind -> response kind ────────────────────────────────────────────────────────

function responseKindForRouteKind(routeKind: string): DecisionSupportResponseQaDryRunResponseKind {
  switch (routeKind) {
    case "clarification_gated_decision_support":
      return "clarification_question";
    case "existing_route_preserved":
      return "route_preservation_notice";
    case "unsupported_preserved":
      return "unsupported_boundary_notice";
    case "shadow_only":
    default:
      return "shadow_only_internal";
  }
}

// ─── Synthetic response draft ──────────────────────────────────────────────────────────

const NON_EXECUTION_NOTICE = "Esta respuesta no ejecuta ninguna acción, no crea tareas, no envía emails ni drafts, y no persiste ningún dato real.";
const CLARIFICATION_QUESTION_TEXT = "Antes de continuar, ¿podrías confirmar el contexto y las opciones concretas que estás evaluando?";
const CLARIFICATION_ASSUMPTIONS: string[] = [
  "Se asume que todavía no se tomó una decisión final sobre este tema.",
  "Se asume que el usuario puede aportar contexto adicional si se le pregunta.",
];
const CLARIFICATION_NEXT_STEP = "El siguiente paso seguro es responder la pregunta de aclaración antes de ofrecer cualquier guía adicional.";
const ROUTE_PRESERVATION_NOTICE_TEXT = "Este tipo de mensaje se sigue resolviendo con la ruta de producción existente, sin pasar por decision_support.";
const ROUTE_PRESERVATION_NEXT_STEP = "El siguiente paso seguro es dejar que la ruta de producción existente continúe manejando este mensaje.";
const UNSUPPORTED_NOTICE_TEXT = "Este tipo de mensaje permanece fuera del alcance soportado; se mantiene el comportamiento seguro existente.";
const UNSUPPORTED_NEXT_STEP = "El siguiente paso seguro es mantener el fallback seguro existente para este mensaje.";

export type DecisionSupportResponseQaDryRunSyntheticDraftInput = { caseId: string; routeKind: string } | string;

function inputToCaseIdAndRouteKind(input: DecisionSupportResponseQaDryRunSyntheticDraftInput): { caseId: string; routeKind: string } {
  if (typeof input === "string") return { caseId: `qa-synthetic-${input}`, routeKind: input };
  return { caseId: input.caseId, routeKind: input.routeKind };
}

/**
 * Builds a QA-only synthetic response draft for a given Sprint 31R case assessment (or a bare route
 * kind string). Never includes raw input, a full candidate object, a raw project name, an email, a
 * phone number, executable output, a task-creation instruction, email/draft content, a persisted
 * payload, or any DB/Supabase content — always `userVisibleNow: false` and `persistedNow: false`.
 */
export function createDecisionSupportResponseQaDryRunSyntheticDraft(
  caseAssessmentOrRouteKind: DecisionSupportResponseQaDryRunSyntheticDraftInput,
  _options: Record<string, never> = {},
): DecisionSupportResponseQaDryRunSyntheticResponseDraft {
  const { caseId, routeKind } = inputToCaseIdAndRouteKind(caseAssessmentOrRouteKind);
  const responseKind = responseKindForRouteKind(routeKind);
  const draftId = `qa-draft-${caseId}`;
  const notes: string[] = [];

  let responseSections: DecisionSupportResponseQaDryRunSyntheticResponseDraft["responseSections"];
  switch (responseKind) {
    case "clarification_question":
      responseSections = {
        clarificationQuestion: CLARIFICATION_QUESTION_TEXT,
        assumptions: [...CLARIFICATION_ASSUMPTIONS],
        recommendedNextStep: CLARIFICATION_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      notes.push("Synthetic clarification_question draft — no advisory/direct-decision content, QA-only.");
      break;
    case "route_preservation_notice":
      responseSections = {
        routePreservationNotice: ROUTE_PRESERVATION_NOTICE_TEXT,
        recommendedNextStep: ROUTE_PRESERVATION_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      notes.push("Synthetic route_preservation_notice draft — QA-only.");
      break;
    case "unsupported_boundary_notice":
      responseSections = {
        unsupportedNotice: UNSUPPORTED_NOTICE_TEXT,
        recommendedNextStep: UNSUPPORTED_NEXT_STEP,
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      notes.push("Synthetic unsupported_boundary_notice draft — QA-only.");
      break;
    case "shadow_only_internal":
    default:
      responseSections = {
        nonExecutionNotice: NON_EXECUTION_NOTICE,
      };
      notes.push("Synthetic shadow_only_internal draft — internal only, never shown to a user, QA-only.");
      break;
  }

  return {
    draftId,
    sourceCaseId: caseId,
    responseKind,
    routeKind,
    generatedForQaOnly: true,
    userVisibleNow: false,
    persistedNow: false,
    responseSections,
    prohibitedContentPresent: false,
    notes,
  } satisfies DecisionSupportResponseQaDryRunSyntheticResponseDraft;
}

// ─── Gate evaluation ────────────────────────────────────────────────────────────────────

function draftText(draft: DecisionSupportResponseQaDryRunSyntheticResponseDraft): string {
  const sectionValues = Object.values(draft.responseSections).flatMap((value) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value;
    return [];
  });
  return [...sectionValues, ...draft.notes].join("\n");
}

const EMAIL_PATTERN = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/;
const TASK_LANGUAGE_PATTERN = /\b(crear tarea|create task|task_id|assignee)\b/i;
const EMAIL_DRAFT_LANGUAGE_PATTERN = /\b(enviar email|send email|draft_id|para:|to:|subject:)\b/i;
const EXTERNAL_CALL_PATTERN = /\b(https?:\/\/|fetch\(|axios\.|supabase\.|process\.env)\b/i;
const RAW_INPUT_PATTERN = /\b(raw[_\s-]?input|input\s+crudo|prompt\s+original)\b/i;
const FULL_CANDIDATE_PATTERN = /\b(full[_\s-]?candidate|candidato\s+completo)\b/i;

function hasPiiLeak(text: string): boolean {
  return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

function hasRawInputLeak(draft: DecisionSupportResponseQaDryRunSyntheticResponseDraft, text: string): boolean {
  return Boolean((draft as Record<string, unknown>).rawInputEcho) || RAW_INPUT_PATTERN.test(text);
}

function hasFullCandidateLeak(draft: DecisionSupportResponseQaDryRunSyntheticResponseDraft, text: string): boolean {
  return Boolean((draft as Record<string, unknown>).fullCandidateEcho) || FULL_CANDIDATE_PATTERN.test(text);
}

function hasTaskCreationLanguage(text: string): boolean {
  return TASK_LANGUAGE_PATTERN.test(text);
}

function hasEmailDraftLanguage(text: string): boolean {
  return EMAIL_DRAFT_LANGUAGE_PATTERN.test(text);
}

function hasExternalCallLanguage(text: string): boolean {
  return EXTERNAL_CALL_PATTERN.test(text);
}

function riskForStatus(status: DecisionSupportResponseQaDryRunQaStatus): DecisionSupportResponseQaDryRunRiskLevel {
  switch (status) {
    case "pass":
      return "low";
    case "warning":
      return "medium";
    case "fail":
      return "high";
    case "blocked":
    default:
      return "critical";
  }
}

function gateResult(
  gateType: DecisionSupportResponseQaDryRunGateType,
  status: DecisionSupportResponseQaDryRunQaStatus,
  violations: DecisionSupportResponseQaDryRunViolationType[],
  evidence: string[],
  recommendation: string,
): DecisionSupportResponseQaDryRunGateResult {
  return {
    gateType,
    status,
    riskLevel: riskForStatus(status),
    passed: status === "pass",
    violations,
    evidence,
    recommendation,
  };
}

export type DecisionSupportResponseQaDryRunGateEvaluationOptions = {
  requiresAssumptionDisclosure?: boolean;
};

/**
 * Evaluates a single synthetic response draft against a single QA gate. Every gate this module ships
 * with is a pure content check over the draft's own `responseSections`/`notes` — it never reads a raw
 * input, a full candidate object, or anything outside the draft itself.
 */
export function evaluateDecisionSupportResponseQaDryRunGate(
  draft: DecisionSupportResponseQaDryRunSyntheticResponseDraft,
  gateType: DecisionSupportResponseQaDryRunGateType,
  options: DecisionSupportResponseQaDryRunGateEvaluationOptions = {},
): DecisionSupportResponseQaDryRunGateResult {
  const text = draftText(draft);

  switch (gateType) {
    case "must_be_clarification_first": {
      if (draft.responseKind === "clarification_question" || draft.responseKind === "decision_support_advisory") {
        if (draft.responseSections.clarificationQuestion) {
          return gateResult(gateType, "pass", [], ["clarificationQuestion is present before any advisory content."], "No action needed.");
        }
        if (draft.responseSections.advisoryFrame) {
          return gateResult(
            gateType,
            "fail",
            ["direct_decision_without_clarification", "missing_clarifying_question"],
            ["advisoryFrame present without a preceding clarificationQuestion."],
            "Add a clarifying question before any advisory content.",
          );
        }
        return gateResult(gateType, "fail", ["missing_clarifying_question"], ["No clarificationQuestion present."], "Add a clarifying question.");
      }
      return gateResult(gateType, "warning", [], ["This gate does not apply to this response kind."], "No action needed — gate not applicable.");
    }

    case "must_state_assumptions": {
      const requires = options.requiresAssumptionDisclosure ?? true;
      if (!requires) {
        return gateResult(gateType, "warning", [], ["Assumption disclosure not required for this response kind."], "No action needed.");
      }
      const assumptions = draft.responseSections.assumptions ?? [];
      if (assumptions.length > 0) {
        return gateResult(gateType, "pass", [], [`${assumptions.length} assumption(s) disclosed.`], "No action needed.");
      }
      return gateResult(gateType, "fail", ["missing_assumptions"], ["No assumptions disclosed."], "Disclose the assumptions this response relies on.");
    }

    case "must_avoid_direct_execution": {
      const violations: DecisionSupportResponseQaDryRunViolationType[] = [];
      if (hasTaskCreationLanguage(text)) violations.push("task_creation");
      if (hasEmailDraftLanguage(text)) violations.push("email_or_draft_creation");
      if (draft.persistedNow) violations.push("real_persistence");
      if (hasExternalCallLanguage(text)) violations.push("external_call");
      if (violations.length > 0) {
        return gateResult(gateType, "blocked", violations, ["Draft contains execution/persistence/external-call language."], "Remove all execution language from this response.");
      }
      return gateResult(gateType, "pass", [], ["No execution, task, email, or persistence language present."], "No action needed.");
    }

    case "must_not_create_tasks": {
      if (hasTaskCreationLanguage(text)) {
        return gateResult(gateType, "blocked", ["task_creation"], ["Draft contains task-creation language."], "Remove all task-creation language.");
      }
      return gateResult(gateType, "pass", [], ["No task payload or task-creation language present."], "No action needed.");
    }

    case "must_not_create_emails": {
      if (hasEmailDraftLanguage(text)) {
        return gateResult(gateType, "blocked", ["email_or_draft_creation"], ["Draft contains email/draft-creation language."], "Remove all email/draft-creation language.");
      }
      return gateResult(gateType, "pass", [], ["No email/draft payload or recipient present."], "No action needed.");
    }

    case "must_not_persist": {
      if (draft.persistedNow) {
        return gateResult(gateType, "blocked", ["real_persistence"], ["persistedNow is true."], "This draft must never be persisted for real.");
      }
      return gateResult(gateType, "pass", [], ["persistedNow is false."], "No action needed.");
    }

    case "must_not_call_external_services": {
      if (hasExternalCallLanguage(text)) {
        return gateResult(gateType, "blocked", ["external_call"], ["Draft references an external call/service."], "Remove all external-call language.");
      }
      return gateResult(gateType, "pass", [], ["No external-call attempt present."], "No action needed.");
    }

    case "must_not_leak_raw_input": {
      if (hasRawInputLeak(draft, text)) {
        return gateResult(gateType, "blocked", ["raw_input_leak"], ["Draft appears to echo raw input."], "Remove the raw input echo from this response.");
      }
      return gateResult(gateType, "pass", [], ["No raw input present in this draft."], "No action needed.");
    }

    case "must_not_leak_full_candidate": {
      if (hasFullCandidateLeak(draft, text)) {
        return gateResult(gateType, "blocked", ["full_candidate_leak"], ["Draft appears to echo the full candidate object."], "Remove the full candidate echo from this response.");
      }
      return gateResult(gateType, "pass", [], ["No full candidate object present in this draft."], "No action needed.");
    }

    case "must_not_leak_pii": {
      if (hasPiiLeak(text)) {
        return gateResult(gateType, "blocked", ["pii_leak"], ["Draft appears to contain an email address or phone number."], "Remove all PII from this response.");
      }
      return gateResult(gateType, "pass", [], ["No email address or phone number present in this draft."], "No action needed.");
    }

    case "must_preserve_existing_route": {
      if (draft.responseKind === "route_preservation_notice" && draft.responseSections.routePreservationNotice) {
        return gateResult(gateType, "pass", [], ["routePreservationNotice is present."], "No action needed.");
      }
      return gateResult(
        gateType,
        "fail",
        ["direct_decision_without_clarification"],
        ["Expected a route_preservation_notice response kind with a routePreservationNotice section."],
        "Preserve the existing route notice for this case.",
      );
    }

    case "must_preserve_unsupported": {
      if (draft.responseKind === "unsupported_boundary_notice" && draft.responseSections.unsupportedNotice) {
        return gateResult(gateType, "pass", [], ["unsupportedNotice is present."], "No action needed.");
      }
      return gateResult(
        gateType,
        "fail",
        ["direct_decision_without_clarification"],
        ["Expected an unsupported_boundary_notice response kind with an unsupportedNotice section."],
        "Preserve the unsupported boundary notice for this case.",
      );
    }

    case "must_remain_shadow_only": {
      if (draft.responseKind === "shadow_only_internal" && !draft.userVisibleNow) {
        return gateResult(gateType, "pass", [], ["Draft is shadow_only_internal and userVisibleNow is false."], "No action needed.");
      }
      return gateResult(
        gateType,
        "fail",
        ["direct_decision_without_clarification"],
        ["Expected a shadow_only_internal response kind that stays internal."],
        "Keep this draft shadow-only and internal.",
      );
    }

    case "must_be_safe_for_dry_run_only":
    default: {
      if (draft.userVisibleNow === false && draft.persistedNow === false) {
        return gateResult(gateType, "pass", [], ["userVisibleNow is false and persistedNow is false."], "No action needed.");
      }
      return gateResult(
        gateType,
        "blocked",
        ["real_persistence"],
        ["Draft is not safe for dry-run-only use."],
        "Every synthetic draft must stay userVisibleNow: false and persistedNow: false.",
      );
    }
  }
}

// ─── Case assessment ────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunCaseAssessmentOptions = Record<string, never>;

function qaStatusFromGateResults(gateResults: DecisionSupportResponseQaDryRunGateResult[]): DecisionSupportResponseQaDryRunQaStatus {
  if (gateResults.some((g) => g.status === "blocked")) return "blocked";
  if (gateResults.some((g) => g.status === "fail")) return "fail";
  if (gateResults.some((g) => g.status === "warning")) return "warning";
  return "pass";
}

/**
 * Assesses a single Sprint 31R integration case assessment (or a bare `{ caseId, routeKind }`) for the
 * Sprint 32R response QA plan: derives its response kind, builds its response contract and a synthetic
 * QA-only draft, evaluates every required gate, and computes `qaStatus`/`riskLevel`/
 * `safeForResponseDraftHarness`. Every real-side-effect field is always the literal `false`.
 */
export function assessDecisionSupportResponseQaDryRunCase(
  integrationCaseAssessment: DecisionSupportClarificationGatedIntegrationCaseAssessment | { caseId: string; routeKind: string },
  _options: DecisionSupportResponseQaDryRunCaseAssessmentOptions = {},
): DecisionSupportResponseQaDryRunCaseAssessment {
  const caseId = integrationCaseAssessment.caseId;
  const routeKind = integrationCaseAssessment.routeKind;
  const responseKind = responseKindForRouteKind(routeKind);
  const responseContract = createDecisionSupportResponseQaDryRunResponseContract(responseKind);
  const syntheticDraft = createDecisionSupportResponseQaDryRunSyntheticDraft({ caseId, routeKind });

  const gateResults = responseContract.requiredGates.map((gateType) =>
    evaluateDecisionSupportResponseQaDryRunGate(syntheticDraft, gateType, {
      requiresAssumptionDisclosure: responseContract.requiresAssumptionDisclosure,
    }),
  );

  const qaStatus = qaStatusFromGateResults(gateResults);
  const riskLevel = riskForStatus(qaStatus);
  const safeForResponseDraftHarness = qaStatus === "pass" || qaStatus === "warning";

  const warnings: string[] = [];
  for (const gate of gateResults) {
    if (gate.status !== "pass") warnings.push(`Case ${caseId}: gate ${gate.gateType} is ${gate.status} — ${gate.recommendation}`);
  }

  return {
    caseId,
    routeKind,
    responseKind,
    responseContract,
    syntheticDraft,
    gateResults,
    qaStatus,
    riskLevel,
    safeForResponseDraftHarness,
    safeForUserVisibleDryRunNow: false,
    safeForProduction: false,
    directDecisionBlocked: true,
    actionExecutionBlocked: true,
    taskCreationBlocked: true,
    emailDraftCreationBlocked: true,
    persistenceBlocked: true,
    externalCallsBlocked: true,
    userVisibleOutputAttempted: false,
    productionWiringAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    warnings,
  } satisfies DecisionSupportResponseQaDryRunCaseAssessment;
}

// ─── Build plan ─────────────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 32R response QA / user-visible dry run plan: reuses the Sprint 31R
 * clarification-gated integration plan against the same corpus (default: the Sprint 31R plan's own
 * small self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R
 * corpus), builds a synthetic QA-only response draft for every case, evaluates every required gate, and
 * consolidates the Sprint 32R allowed/prohibited actions. Never shows anything to a user, never
 * persists anything real, and never touches the router, composer, or endpoint.
 */
export function buildDecisionSupportResponseQaDryRunPlan(options: DecisionSupportResponseQaDryRunPlanOptions = {}): DecisionSupportResponseQaDryRunPlanResult {
  const config = createDecisionSupportResponseQaDryRunPlanConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;
  const cases: DecisionClarificationCase[] | undefined = options.cases;

  // 1. Reuse the Sprint 31R clarification-gated integration plan (which itself reuses Sprint 18R-30R).
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases, now });
  const integrationSummary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);

  // 2-4. Assess every case: derive response kind, build contract + synthetic draft, evaluate gates.
  const assessments = integrationPlan.assessments.map((assessment) => assessDecisionSupportResponseQaDryRunCase(assessment));

  const allowedNextActions = listDecisionSupportResponseQaDryRunAllowedNextActions();
  const prohibitedActions = listDecisionSupportResponseQaDryRunProhibitedActions();

  const warnings: string[] = [];
  if (integrationSummary.decision !== "ready_for_user_visible_dry_run_plan") {
    warnings.push(
      `Sprint 31R clarification-gated integration plan decision is "${integrationSummary.decision}", not "ready_for_user_visible_dry_run_plan" — this response QA plan cannot recommend Sprint 33R until that is resolved.`,
    );
  }
  if (integrationPlan.replaySummary.decision !== "ready_for_clarification_gated_integration_plan") {
    warnings.push(`Sprint 30R controlled replay decision is "${integrationPlan.replaySummary.decision}", not the expected ready decision.`);
  }
  if (integrationPlan.persistenceReadinessSummary.decision !== "do_not_build_real_persistence_yet") {
    warnings.push(`Sprint 29R persistence readiness decision is "${integrationPlan.persistenceReadinessSummary.decision}" — expected do_not_build_real_persistence_yet.`);
  }
  for (const assessment of assessments) warnings.push(...assessment.warnings);

  return {
    config,
    integrationPlan,
    integrationSummary,
    assessments,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportResponseQaDryRunPlanResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function violationsFor(assessment: DecisionSupportResponseQaDryRunCaseAssessment): DecisionSupportResponseQaDryRunViolationType[] {
  return assessment.gateResults.flatMap((g) => g.violations);
}

function computeDecision(fields: {
  totalCases: number;
  qaPassCaseCount: number;
  qaFailCaseCount: number;
  qaBlockedCaseCount: number;
  violationCount: number;
  criticalViolationCount: number;
  safeForResponseDraftHarnessCount: number;
  safeForUserVisibleDryRunNowCount: number;
  safeForProductionCount: number;
  directDecisionBlockedCount: number;
  actionExecutionBlockedCount: number;
  taskCreationBlockedCount: number;
  emailDraftCreationBlockedCount: number;
  persistenceBlockedCount: number;
  externalCallsBlockedCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  rawInputLeakCount: number;
  fullCandidateLeakCount: number;
  piiLeakCount: number;
  projectNameLeakCount: number;
  missingClarificationGateCount: number;
  sprint31IntegrationDecision: string | undefined;
}): DecisionSupportResponseQaDryRunPlanDecision {
  const anyProductionOrWiringAttempted =
    fields.userVisibleOutputAttemptedCount > 0 ||
    fields.productionWiringAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0;
  if (anyProductionOrWiringAttempted) return "blocked_by_production_wiring_risk";

  if (fields.qaBlockedCaseCount > 0 || fields.criticalViolationCount > 0) return "blocked_by_unsafe_response_pattern";

  if (fields.missingClarificationGateCount > 0) return "blocked_by_missing_clarification_gate";

  if (fields.qaFailCaseCount > 0) return "blocked_by_response_contract_gap";

  const allClean =
    fields.totalCases > 0 &&
    fields.qaPassCaseCount === fields.totalCases &&
    fields.qaFailCaseCount === 0 &&
    fields.qaBlockedCaseCount === 0 &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.safeForResponseDraftHarnessCount === fields.totalCases &&
    fields.safeForUserVisibleDryRunNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.directDecisionBlockedCount === fields.totalCases &&
    fields.actionExecutionBlockedCount === fields.totalCases &&
    fields.taskCreationBlockedCount === fields.totalCases &&
    fields.emailDraftCreationBlockedCount === fields.totalCases &&
    fields.persistenceBlockedCount === fields.totalCases &&
    fields.externalCallsBlockedCount === fields.totalCases &&
    fields.userVisibleOutputAttemptedCount === 0 &&
    fields.productionWiringAttemptedCount === 0 &&
    fields.realPersistenceAttemptedCount === 0 &&
    fields.dbWriteAttemptedCount === 0 &&
    fields.supabaseWriteAttemptedCount === 0 &&
    fields.externalCallAttemptedCount === 0 &&
    fields.rawInputLeakCount === 0 &&
    fields.fullCandidateLeakCount === 0 &&
    fields.piiLeakCount === 0 &&
    fields.projectNameLeakCount === 0 &&
    fields.sprint31IntegrationDecision === "ready_for_user_visible_dry_run_plan";

  return allClean ? "ready_for_response_draft_harness" : "continue_plan_only";
}

function recommendedNextSprintFor(decision: DecisionSupportResponseQaDryRunPlanDecision): string {
  switch (decision) {
    case "ready_for_response_draft_harness":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_response_contract_gap":
      return "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan (Response Contract Hardening)";
    case "blocked_by_unsafe_response_pattern":
      return "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan (Unsafe Response Pattern Hardening)";
    case "blocked_by_missing_clarification_gate":
      return "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan (Clarification Gate Hardening)";
    case "blocked_by_production_wiring_risk":
      return "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan (Production Wiring Risk Hardening)";
    case "continue_plan_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `buildDecisionSupportResponseQaDryRunPlan()` result — or a bare
 * `DecisionSupportResponseQaDryRunCaseAssessment[]` plus `options.sprint31IntegrationDecision` — into a
 * review-ready report: per-response-kind counts, QA status counts, safety counts (every
 * production-side-effect count expected zero), leak counts (all expected zero), a decision, and a
 * recommended next sprint. Pure — takes already-computed assessments rather than re-running anything.
 */
export function summarizeDecisionSupportResponseQaDryRunPlan(
  planOrAssessments: DecisionSupportResponseQaDryRunPlanResult | DecisionSupportResponseQaDryRunCaseAssessment[],
  options: DecisionSupportResponseQaDryRunPlanSummaryOptions = {},
): DecisionSupportResponseQaDryRunPlanSummary {
  const assessments = Array.isArray(planOrAssessments) ? planOrAssessments : planOrAssessments.assessments;
  const sprint31IntegrationDecision = Array.isArray(planOrAssessments)
    ? options.sprint31IntegrationDecision
    : (options.sprint31IntegrationDecision ?? planOrAssessments.integrationSummary.decision);
  const planWarnings = Array.isArray(planOrAssessments) ? [] : planOrAssessments.warnings;

  const totalCases = assessments.length;

  const clarificationQuestionCaseCount = assessments.filter((a) => a.responseKind === "clarification_question").length;
  const advisoryCaseCount = assessments.filter((a) => a.responseKind === "decision_support_advisory").length;
  const routePreservationCaseCount = assessments.filter((a) => a.responseKind === "route_preservation_notice").length;
  const unsupportedBoundaryCaseCount = assessments.filter((a) => a.responseKind === "unsupported_boundary_notice").length;
  const shadowOnlyCaseCount = assessments.filter((a) => a.responseKind === "shadow_only_internal").length;
  const unsafeBlockedCaseCount = assessments.filter((a) => a.responseKind === "unsafe_response_blocked").length;

  const qaPassCaseCount = assessments.filter((a) => a.qaStatus === "pass").length;
  const qaWarningCaseCount = assessments.filter((a) => a.qaStatus === "warning").length;
  const qaFailCaseCount = assessments.filter((a) => a.qaStatus === "fail").length;
  const qaBlockedCaseCount = assessments.filter((a) => a.qaStatus === "blocked").length;

  const safeForResponseDraftHarnessCount = assessments.filter((a) => a.safeForResponseDraftHarness).length;
  const safeForUserVisibleDryRunNowCount = assessments.filter((a) => a.safeForUserVisibleDryRunNow).length;
  const safeForProductionCount = assessments.filter((a) => a.safeForProduction).length;

  const directDecisionBlockedCount = assessments.filter((a) => a.directDecisionBlocked).length;
  const actionExecutionBlockedCount = assessments.filter((a) => a.actionExecutionBlocked).length;
  const taskCreationBlockedCount = assessments.filter((a) => a.taskCreationBlocked).length;
  const emailDraftCreationBlockedCount = assessments.filter((a) => a.emailDraftCreationBlocked).length;
  const persistenceBlockedCount = assessments.filter((a) => a.persistenceBlocked).length;
  const externalCallsBlockedCount = assessments.filter((a) => a.externalCallsBlocked).length;

  const userVisibleOutputAttemptedCount = assessments.filter((a) => a.userVisibleOutputAttempted).length;
  const productionWiringAttemptedCount = assessments.filter((a) => a.productionWiringAttempted).length;
  const realPersistenceAttemptedCount = assessments.filter((a) => a.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = assessments.filter((a) => a.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = assessments.filter((a) => a.supabaseWriteAttempted).length;
  const externalCallAttemptedCount = assessments.filter((a) => a.externalCallAttempted).length;

  const allViolations = assessments.flatMap(violationsFor);
  const rawInputLeakCount = allViolations.filter((v) => v === "raw_input_leak").length;
  const fullCandidateLeakCount = allViolations.filter((v) => v === "full_candidate_leak").length;
  const piiLeakCount = allViolations.filter((v) => v === "pii_leak").length;
  const projectNameLeakCount = allViolations.filter((v) => v === "project_name_leak").length;
  const violationCount = allViolations.length;
  const criticalViolationCount = assessments.filter((a) => a.riskLevel === "critical").flatMap(violationsFor).length;

  const missingClarificationGateCount = assessments.filter(
    (a) => a.responseKind === "clarification_question" && a.gateResults.some((g) => g.gateType === "must_be_clarification_first" && g.status !== "pass"),
  ).length;

  const decision = computeDecision({
    totalCases,
    qaPassCaseCount,
    qaFailCaseCount,
    qaBlockedCaseCount,
    violationCount,
    criticalViolationCount,
    safeForResponseDraftHarnessCount,
    safeForUserVisibleDryRunNowCount,
    safeForProductionCount,
    directDecisionBlockedCount,
    actionExecutionBlockedCount,
    taskCreationBlockedCount,
    emailDraftCreationBlockedCount,
    persistenceBlockedCount,
    externalCallsBlockedCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputLeakCount,
    fullCandidateLeakCount,
    piiLeakCount,
    projectNameLeakCount,
    missingClarificationGateCount,
    sprint31IntegrationDecision,
  });

  const warnings = [...planWarnings, ...assessments.flatMap((a) => a.warnings)];

  return {
    totalCases,
    clarificationQuestionCaseCount,
    advisoryCaseCount,
    routePreservationCaseCount,
    unsupportedBoundaryCaseCount,
    shadowOnlyCaseCount,
    unsafeBlockedCaseCount,
    qaPassCaseCount,
    qaWarningCaseCount,
    qaFailCaseCount,
    qaBlockedCaseCount,
    safeForResponseDraftHarnessCount,
    safeForUserVisibleDryRunNowCount,
    safeForProductionCount,
    directDecisionBlockedCount,
    actionExecutionBlockedCount,
    taskCreationBlockedCount,
    emailDraftCreationBlockedCount,
    persistenceBlockedCount,
    externalCallsBlockedCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputLeakCount,
    fullCandidateLeakCount,
    piiLeakCount,
    projectNameLeakCount,
    violationCount,
    criticalViolationCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativePassingCases: assessments.filter((a) => a.qaStatus === "pass").slice(0, REPRESENTATIVE_LIMIT),
    warningCases: assessments.filter((a) => a.qaStatus === "warning"),
    blockedCases: assessments.filter((a) => a.qaStatus === "fail" || a.qaStatus === "blocked"),
    warnings,
  } satisfies DecisionSupportResponseQaDryRunPlanSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 32R response QA / user-visible dry run plan — mirrors the
 * style of `explainDecisionSupportClarificationGatedIntegrationPlan()` (Sprint 31R). See
 * `docs/conversational-brain-decision-support-response-qa-dry-run-plan.md` for full context.
 */
export function explainDecisionSupportResponseQaDryRunPlan(): DecisionSupportResponseQaDryRunPlanExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-response-qa-dry-run-plan",
    purpose:
      "Plans what a safe decision_support response would look like if it were eventually shown to a user — what response format is acceptable vs " +
      "risky, what content must be blocked, kept as a clarification request, or kept as advisory/non-executing guidance, and what QA gates a " +
      "response must pass before it could ever become visible in a dry run — without ever showing a real user any output, and without building " +
      "any real integration.",
    nonGoals: [
      "Show decision_support output to a real user.",
      "Wire the router, composer, or endpoint.",
      "Activate a production feature flag.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
    ],
    planProfile:
      'The "strict_response_qa_user_visible_dry_run_plan" profile: every allow* field (allowUserVisibleDryRun/allowProductionWiring/' +
      "allowRouterChange/allowComposerChange/allowEndpointChange/allowFeatureFlag/allowRealPersistence/allowDbWrite/allowSupabaseWrite/" +
      "allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override " +
      "a caller passes, and every require* field is always true.",
    planModes: [
      "plan_only (default): the full response QA plan, covering every response kind.",
      "response_contract_review: emphasizes createDecisionSupportResponseQaDryRunResponseContract() output.",
      "synthetic_response_qa: emphasizes createDecisionSupportResponseQaDryRunSyntheticDraft() + gate evaluation output.",
      "clarification_gated_response_review: emphasizes clarification_question response kind cases.",
      "user_visible_dry_run_readiness_review: emphasizes safeForResponseDraftHarness across every case (never safeForUserVisibleDryRunNow).",
    ],
    responseKindRules: [
      "clarification_gated_decision_support (Sprint 31R route kind) -> clarification_question response kind.",
      "existing_route_preserved -> route_preservation_notice.",
      "unsupported_preserved -> unsupported_boundary_notice.",
      "shadow_only -> shadow_only_internal.",
      "decision_support_advisory and unsafe_response_blocked are contract-only response kinds this sprint never generates a draft for.",
    ],
    responseContractRules: [
      "Every response contract carries allowsDirectDecision/allowsActionExecution/allowsTaskCreation/allowsEmailDraftCreation/allowsRealPersistence/allowsExternalCalls/allowsProductionWiring: false.",
      "clarification_question is allowed in Sprint 32R; decision_support_advisory is future-only and prohibited in Sprint 32R.",
      "route_preservation_notice/unsupported_boundary_notice/shadow_only_internal/unsafe_response_blocked are all allowed in Sprint 32R as safe, non-decision-support-output shapes.",
    ],
    syntheticDraftRules: [
      "Every synthetic draft is generatedForQaOnly: true, userVisibleNow: false, persistedNow: false.",
      "A clarification_question draft never contains a direct decision or advisory conclusion — only a clarifying question, assumptions, a safe next step, and a non-execution notice.",
      "No draft ever contains raw input, a full candidate object, a raw project name, an email, a phone number, executable output, a task-creation instruction, email/draft content, a persisted payload, or DB/Supabase content.",
    ],
    gateEvaluationRules: [
      "Every gate is a pure content check over the draft's own responseSections/notes.",
      "must_be_clarification_first/must_state_assumptions/must_preserve_existing_route/must_preserve_unsupported/must_remain_shadow_only/must_be_safe_for_dry_run_only check structural shape.",
      "must_avoid_direct_execution/must_not_create_tasks/must_not_create_emails/must_not_persist/must_not_call_external_services/must_not_leak_raw_input/must_not_leak_full_candidate/must_not_leak_pii check for forbidden content.",
    ],
    caseAssessmentRules: [
      "qaStatus is blocked if any required gate is blocked, else fail if any gate failed, else warning if any gate warned, else pass.",
      "safeForResponseDraftHarness is true for pass and warning; false for fail and blocked.",
      "safeForUserVisibleDryRunNow and safeForProduction are always the literal false for every case, regardless of qaStatus.",
    ],
    decisionRule:
      "ready_for_response_draft_harness requires: totalCases > 0, qaPassCaseCount === totalCases, every blocked count at zero, every leak count " +
      "at zero, every production/wiring-attempted count at zero, and the Sprint 31R integration plan decision === ready_for_user_visible_dry_run_plan. " +
      "Otherwise, in priority order: blocked_by_production_wiring_risk if any production/wiring action was attempted; else " +
      "blocked_by_unsafe_response_pattern if any case is blocked or carries a critical violation; else blocked_by_missing_clarification_gate if any " +
      "clarification_question case fails must_be_clarification_first; else blocked_by_response_contract_gap if any case fails a required gate; " +
      "else continue_plan_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every case assessment carries safeForUserVisibleDryRunNow: false and every synthetic draft carries userVisibleNow: false — a real user-visible dry run is Sprint 33R's own harness to build and review, not this plan's job.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This plan only builds synthetic QA-only drafts offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This plan never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This plan never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated: "No production feature flag exists for decision_support, and none is created by this plan — flipping one on is a production activation decision, not a QA-planning decision.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review still resolves to do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by QA-planning a response format.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This plan never writes anything real — every synthetic draft stays persistedNow: false.",
    whyStorageAdapterIsNotCreated: "This plan reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 31R plan) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this plan does not build.",
    expectedSprint33Path:
      "If every case stays qaStatus: pass, safeForResponseDraftHarness: true, no leak count is nonzero, no production/wiring action is attempted, " +
      "and the Sprint 31R integration plan stays ready_for_user_visible_dry_run_plan, Sprint 33R can build a Decision Support Response Draft " +
      "Harness — still without wiring the router, without wiring the composer, without activating a production feature flag, and without " +
      "showing anything to a real user until a future user-visible dry run explicitly reviews it.",
  };
}
