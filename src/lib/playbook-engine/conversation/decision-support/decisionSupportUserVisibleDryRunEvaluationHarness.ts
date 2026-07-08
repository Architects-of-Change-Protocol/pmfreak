/**
 * Sprint 35R — Decision Support User-Visible Dry Run Evaluation Harness.
 *
 * A pure, offline, deterministic **user-visible dry run evaluation harness** — not a user-visible
 * output, and not production wiring — that renders a synthetic, internal-only preview of how every
 * Sprint 34R-evaluated draft *would eventually look* if a future composer ever showed it to a user,
 * validates each preview against a display contract keyed by preview kind, and consolidates a decision on
 * whether the corpus is ready for a Sprint 36R default-off route/composer integration adapter.
 *
 * Reuses, rather than reimplements: the Sprint 34R response draft quality evaluation
 * (`runDecisionSupportResponseDraftQualityEvaluation`, `summarizeDecisionSupportResponseDraftQualityEvaluation`),
 * which in turn reuses the Sprint 33R response draft harness, the Sprint 32R response QA / user-visible
 * dry run plan, the Sprint 31R clarification-gated integration plan, the Sprint 30R controlled shadow
 * replay evaluation, the Sprint 29R persistence readiness review, the Sprint 25R-28R layer evaluations,
 * and the Sprint 22R clarification response evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user, and it never persists any real output.
 * Every preview this module renders is synthetic and internal-only: `generatedForDryRunOnly: true`,
 * `internalPreviewOnly: true`, `userVisibleNow: false`, `persistedNow: false`, `executableNow: false`,
 * `externalSideEffectsAllowed: false`, `productionEligibleNow: false` always. See
 * `docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md` for the full
 * design writeup.
 */

import { runDecisionSupportResponseDraftQualityEvaluation, summarizeDecisionSupportResponseDraftQualityEvaluation } from "./decisionSupportResponseDraftQualityEvaluation";

import type {
  DecisionSupportResponseDraftQualityCaseEvaluation,
  DecisionSupportUserVisibleDryRunDisplayContract,
  DecisionSupportUserVisibleDryRunDisplayContractStatus,
  DecisionSupportUserVisibleDryRunDisplaySection,
  DecisionSupportUserVisibleDryRunDisplaySectionKind,
  DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  DecisionSupportUserVisibleDryRunEvaluationHarnessConfig,
  DecisionSupportUserVisibleDryRunEvaluationHarnessDecision,
  DecisionSupportUserVisibleDryRunEvaluationHarnessExplain,
  DecisionSupportUserVisibleDryRunEvaluationHarnessOptions,
  DecisionSupportUserVisibleDryRunEvaluationHarnessResult,
  DecisionSupportUserVisibleDryRunEvaluationHarnessSummary,
  DecisionSupportUserVisibleDryRunEvaluationHarnessSummaryOptions,
  DecisionSupportUserVisibleDryRunPreview,
  DecisionSupportUserVisibleDryRunPreviewKind,
  DecisionSupportUserVisibleDryRunPreviewQaStatus,
  DecisionSupportUserVisibleDryRunPreviewRiskLevel,
  DecisionSupportUserVisibleDryRunPreviewStatus,
  DecisionSupportUserVisibleDryRunPreviewValidationResult,
  DecisionSupportUserVisibleDryRunViolationType,
} from "./decisionSupportUserVisibleDryRunEvaluationHarnessTypes";

export type {
  DecisionSupportUserVisibleDryRunEvaluationHarnessProfile,
  DecisionSupportUserVisibleDryRunEvaluationHarnessMode,
  DecisionSupportUserVisibleDryRunEvaluationHarnessDecision,
  DecisionSupportUserVisibleDryRunPreviewKind,
  DecisionSupportUserVisibleDryRunPreviewStatus,
  DecisionSupportUserVisibleDryRunPreviewQaStatus,
  DecisionSupportUserVisibleDryRunPreviewRiskLevel,
  DecisionSupportUserVisibleDryRunDisplaySectionKind,
  DecisionSupportUserVisibleDryRunViolationType,
  DecisionSupportUserVisibleDryRunDisplayContractStatus,
  DecisionSupportUserVisibleDryRunEvaluationHarnessConfig,
  DecisionSupportUserVisibleDryRunDisplaySection,
  DecisionSupportUserVisibleDryRunDisplayContract,
  DecisionSupportUserVisibleDryRunPreview,
  DecisionSupportUserVisibleDryRunPreviewValidationResult,
  DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  DecisionSupportUserVisibleDryRunEvaluationHarnessOptions,
  DecisionSupportUserVisibleDryRunEvaluationHarnessResult,
  DecisionSupportUserVisibleDryRunEvaluationHarnessSummaryOptions,
  DecisionSupportUserVisibleDryRunEvaluationHarnessSummary,
  DecisionSupportUserVisibleDryRunEvaluationHarnessExplain,
} from "./decisionSupportUserVisibleDryRunEvaluationHarnessTypes";

export const DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_VERSION = "35R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 36R — Default-Off Route/Composer Integration Adapter";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 35R — User-Visible Dry Run Evaluation Harness";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_user_visible_dry_run_evaluation_harness"` default config. The thirteen
 * `allow*` real-side-effect fields are always `false`, forced regardless of any override a caller
 * passes — mirroring how the Sprint 34R response draft quality evaluation's own config never actually
 * loosens its thirteen `allow*` real-side-effect flags from an override. The seven `require*` fields are
 * always `true`.
 */
export function createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig(
  overrides: Partial<DecisionSupportUserVisibleDryRunEvaluationHarnessConfig> = {},
): DecisionSupportUserVisibleDryRunEvaluationHarnessConfig {
  const config: DecisionSupportUserVisibleDryRunEvaluationHarnessConfig = {
    profile: "strict_user_visible_dry_run_evaluation_harness",
    mode: overrides.mode ?? "dry_run_harness_only",
    minPreviewQualityScore: overrides.minPreviewQualityScore ?? 85,
    minDisplayContractScore: overrides.minDisplayContractScore ?? 85,
    // These thirteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the user-visible dry run evaluation harness's own strict, non-negotiable
    // invariant.
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
    requireQualityEvaluationPass: true,
    requireInternalDryRunNotice: true,
    requireDisplayContractCompatibility: true,
    requireNoVisibilityAttempt: true,
    requireNoLeakage: true,
    requireNoSideEffects: true,
    requireNoProductionEligibility: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ───────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Build a default-off route/composer integration adapter (Sprint 36R).",
  "Design a dry-run adapter contract implementation.",
  "Build a no-op production integration shell.",
  "Write route guard contract tests.",
  "Write composer guard contract tests.",
  "Run a feature flag contract review.",
  "Run an integration rollback contract review.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Show preview to real user.",
  "Wire router directly to live decision_support.",
  "Wire composer directly to live decision_support.",
  "Wire endpoint directly to live decision_support.",
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
export function listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Preview kind mapping ─────────────────────────────────────────────────────────────

function previewKindForDraftKind(draftKind: string): DecisionSupportUserVisibleDryRunPreviewKind {
  switch (draftKind) {
    case "clarification_first_draft":
      return "clarification_first_preview";
    case "route_preservation_draft":
      return "route_preservation_preview";
    case "unsupported_boundary_draft":
      return "unsupported_boundary_preview";
    case "shadow_only_internal_draft":
      return "shadow_only_internal_preview";
    case "blocked_unsafe_draft":
    default:
      return "blocked_unsafe_preview";
  }
}

// ─── Display contract ─────────────────────────────────────────────────────────────────

type DisplayContractTemplate = {
  requiredSections: DecisionSupportUserVisibleDryRunDisplaySectionKind[];
  prohibitedSections: DecisionSupportUserVisibleDryRunDisplaySectionKind[];
  requiresClarificationFirst: boolean;
  requiresRoutePreservation: boolean;
  requiresUnsupportedPreservation: boolean;
  displayContractScore: number;
  rationale: string[];
};

const DISPLAY_CONTRACT_TEMPLATES: Record<DecisionSupportUserVisibleDryRunPreviewKind, DisplayContractTemplate> = {
  clarification_first_preview: {
    requiredSections: ["internal_dry_run_notice", "acknowledgement", "clarifying_question", "assumptions", "recommended_next_step", "non_execution_notice"],
    prohibitedSections: ["unsupported_boundary_notice", "shadow_only_notice", "blocked_notice"],
    requiresClarificationFirst: true,
    requiresRoutePreservation: false,
    requiresUnsupportedPreservation: false,
    displayContractScore: 95,
    rationale: ["A clarification_first_preview must ask before advising — it carries a clarifying question and its declared assumptions, never a final decision."],
  },
  route_preservation_preview: {
    requiredSections: ["internal_dry_run_notice", "acknowledgement", "route_preservation_notice", "recommended_next_step", "non_execution_notice"],
    prohibitedSections: ["clarifying_question", "unsupported_boundary_notice", "shadow_only_notice", "blocked_notice"],
    requiresClarificationFirst: false,
    requiresRoutePreservation: true,
    requiresUnsupportedPreservation: false,
    displayContractScore: 92,
    rationale: ["A route_preservation_preview must preserve the existing production route rather than answering as decision_support."],
  },
  unsupported_boundary_preview: {
    requiredSections: ["internal_dry_run_notice", "acknowledgement", "unsupported_boundary_notice", "recommended_next_step", "non_execution_notice"],
    prohibitedSections: ["clarifying_question", "route_preservation_notice", "shadow_only_notice", "blocked_notice"],
    requiresClarificationFirst: false,
    requiresRoutePreservation: false,
    requiresUnsupportedPreservation: true,
    displayContractScore: 90,
    rationale: ["An unsupported_boundary_preview must preserve the existing safe fallback rather than answering as decision_support."],
  },
  shadow_only_internal_preview: {
    requiredSections: ["internal_dry_run_notice", "shadow_only_notice", "non_execution_notice"],
    prohibitedSections: ["clarifying_question", "route_preservation_notice", "unsupported_boundary_notice", "blocked_notice"],
    requiresClarificationFirst: false,
    requiresRoutePreservation: false,
    requiresUnsupportedPreservation: false,
    displayContractScore: 88,
    rationale: ["A shadow_only_internal_preview must stay internal — it never carries a decision_support answer of any shape."],
  },
  blocked_unsafe_preview: {
    requiredSections: ["internal_dry_run_notice", "blocked_notice", "non_execution_notice"],
    prohibitedSections: ["clarifying_question", "route_preservation_notice", "unsupported_boundary_notice", "shadow_only_notice"],
    requiresClarificationFirst: false,
    requiresRoutePreservation: false,
    requiresUnsupportedPreservation: false,
    displayContractScore: 85,
    rationale: ["A blocked_unsafe_preview must surface only the generic safe fallback — it never carries a decision_support answer of any shape."],
  },
};

export type DecisionSupportUserVisibleDryRunDisplayContractOptions = {
  config?: Partial<DecisionSupportUserVisibleDryRunEvaluationHarnessConfig>;
};

/**
 * Builds the display contract a future composer would need to satisfy for a given Sprint 34R case
 * evaluation's draft kind. Every contract is `requiresInternalDryRunNotice: true`, `blocksDirectDecision:
 * true`, `blocksExecution: true`, `blocksPersistence: true`, `blocksExternalCalls: true`,
 * `blocksProductionEligibility: true`, and starts `displayContractStatus: "compatible"` — this harness
 * never emits an incompatible contract for a known preview kind.
 */
export function createDecisionSupportUserVisibleDryRunDisplayContract(
  qualityCaseEvaluation: DecisionSupportResponseDraftQualityCaseEvaluation,
  _options: DecisionSupportUserVisibleDryRunDisplayContractOptions = {},
): DecisionSupportUserVisibleDryRunDisplayContract {
  const previewKind = previewKindForDraftKind(qualityCaseEvaluation.draftKind);
  const template = DISPLAY_CONTRACT_TEMPLATES[previewKind];

  return {
    contractId: `contract-${previewKind}`,
    previewKind,
    requiredSections: [...template.requiredSections],
    prohibitedSections: [...template.prohibitedSections],
    requiresInternalDryRunNotice: true,
    requiresClarificationFirst: template.requiresClarificationFirst,
    requiresRoutePreservation: template.requiresRoutePreservation,
    requiresUnsupportedPreservation: template.requiresUnsupportedPreservation,
    blocksDirectDecision: true,
    blocksExecution: true,
    blocksPersistence: true,
    blocksExternalCalls: true,
    blocksProductionEligibility: true,
    displayContractStatus: "compatible",
    displayContractScore: template.displayContractScore,
    rationale: [...template.rationale],
  } satisfies DecisionSupportUserVisibleDryRunDisplayContract;
}

// ─── Preview rendering ────────────────────────────────────────────────────────────────

const INTERNAL_DRY_RUN_NOTICE_TEXT = "Esta es una vista previa interna de dry-run — no es una respuesta real y no fue mostrada a ningún usuario.";
const ACKNOWLEDGEMENT_TEXT = "Gracias por tu mensaje — quiero asegurarme de responderte de forma segura y útil.";
const CLARIFYING_QUESTION_TEXT = "Antes de continuar, ¿podrías confirmar el contexto y las opciones concretas que estás evaluando?";
const ASSUMPTIONS_TEXT = "Se asume que todavía no se tomó una decisión final sobre este tema y que puedes aportar contexto adicional si se te pregunta.";
const CLARIFICATION_NEXT_STEP_TEXT = "El siguiente paso seguro es responder la pregunta de aclaración antes de ofrecer cualquier guía adicional.";
const ROUTE_PRESERVATION_NOTICE_TEXT = "Este tipo de mensaje se sigue resolviendo con la ruta de producción existente, sin pasar por decision_support.";
const ROUTE_PRESERVATION_NEXT_STEP_TEXT = "El siguiente paso seguro es dejar que la ruta de producción existente continúe manejando este mensaje.";
const UNSUPPORTED_BOUNDARY_NOTICE_TEXT = "Este tipo de mensaje permanece fuera del alcance soportado; se mantiene el comportamiento seguro existente.";
const UNSUPPORTED_NEXT_STEP_TEXT = "El siguiente paso seguro es mantener el fallback seguro existente para este mensaje.";
const SHADOW_ONLY_NOTICE_TEXT = "Este preview permanece interno y no debe mostrarse a ningún usuario todavía.";
const BLOCKED_NOTICE_TEXT = "Este preview no pasó las validaciones de seguridad y se bloquea como fallback seguro genérico.";
const NON_EXECUTION_NOTICE_TEXT = "Esta vista previa no ejecuta ninguna acción, no crea tareas, no envía emails ni drafts, y no persiste ningún dato real.";

function section(
  kind: DecisionSupportUserVisibleDryRunDisplaySectionKind,
  title: string,
  body: string,
  order: number,
): DecisionSupportUserVisibleDryRunDisplaySection {
  return {
    sectionId: `${kind}-${order}`,
    kind,
    title,
    body,
    order,
    required: true,
    internalOnly: true,
    userVisibleNow: false,
    containsRawInput: false,
    containsFullCandidate: false,
    containsPii: false,
    containsProjectNameRaw: false,
    containsExecutableInstruction: false,
    containsPersistenceInstruction: false,
    warnings: [],
  } satisfies DecisionSupportUserVisibleDryRunDisplaySection;
}

function sectionsForPreviewKind(previewKind: DecisionSupportUserVisibleDryRunPreviewKind): DecisionSupportUserVisibleDryRunDisplaySection[] {
  const dryRunNotice = section("internal_dry_run_notice", "Nota interna de dry-run", INTERNAL_DRY_RUN_NOTICE_TEXT, 0);
  switch (previewKind) {
    case "clarification_first_preview":
      return [
        dryRunNotice,
        section("acknowledgement", "Reconocimiento", ACKNOWLEDGEMENT_TEXT, 1),
        section("clarifying_question", "Pregunta de aclaración", CLARIFYING_QUESTION_TEXT, 2),
        section("assumptions", "Supuestos", ASSUMPTIONS_TEXT, 3),
        section("recommended_next_step", "Siguiente paso recomendado", CLARIFICATION_NEXT_STEP_TEXT, 4),
        section("non_execution_notice", "Aviso de no ejecución", NON_EXECUTION_NOTICE_TEXT, 5),
      ];
    case "route_preservation_preview":
      return [
        dryRunNotice,
        section("acknowledgement", "Reconocimiento", ACKNOWLEDGEMENT_TEXT, 1),
        section("route_preservation_notice", "Aviso de preservación de ruta", ROUTE_PRESERVATION_NOTICE_TEXT, 2),
        section("recommended_next_step", "Siguiente paso recomendado", ROUTE_PRESERVATION_NEXT_STEP_TEXT, 3),
        section("non_execution_notice", "Aviso de no ejecución", NON_EXECUTION_NOTICE_TEXT, 4),
      ];
    case "unsupported_boundary_preview":
      return [
        dryRunNotice,
        section("acknowledgement", "Reconocimiento", ACKNOWLEDGEMENT_TEXT, 1),
        section("unsupported_boundary_notice", "Aviso de límite no soportado", UNSUPPORTED_BOUNDARY_NOTICE_TEXT, 2),
        section("recommended_next_step", "Siguiente paso recomendado", UNSUPPORTED_NEXT_STEP_TEXT, 3),
        section("non_execution_notice", "Aviso de no ejecución", NON_EXECUTION_NOTICE_TEXT, 4),
      ];
    case "shadow_only_internal_preview":
      return [dryRunNotice, section("shadow_only_notice", "Aviso interno de shadow", SHADOW_ONLY_NOTICE_TEXT, 1), section("non_execution_notice", "Aviso de no ejecución", NON_EXECUTION_NOTICE_TEXT, 2)];
    case "blocked_unsafe_preview":
    default:
      return [dryRunNotice, section("blocked_notice", "Aviso de bloqueo", BLOCKED_NOTICE_TEXT, 1), section("non_execution_notice", "Aviso de no ejecución", NON_EXECUTION_NOTICE_TEXT, 2)];
  }
}

export type DecisionSupportUserVisibleDryRunPreviewRenderOptions = {
  config?: Partial<DecisionSupportUserVisibleDryRunEvaluationHarnessConfig>;
};

/**
 * Renders a synthetic, internal-only preview from a Sprint 34R response draft quality case evaluation.
 * Content is generated from fixed, non-LLM templates keyed by preview kind — never from raw input, a
 * full candidate object, PII, or a raw project name. Every preview is `generatedForDryRunOnly: true`,
 * `internalPreviewOnly: true`, `userVisibleNow: false`, `persistedNow: false`, `executableNow: false`,
 * `externalSideEffectsAllowed: false`, `productionEligibleNow: false`.
 */
export function renderDecisionSupportUserVisibleDryRunPreview(
  qualityCaseEvaluation: DecisionSupportResponseDraftQualityCaseEvaluation,
  options: DecisionSupportUserVisibleDryRunPreviewRenderOptions = {},
): DecisionSupportUserVisibleDryRunPreview {
  const previewKind = previewKindForDraftKind(qualityCaseEvaluation.draftKind);
  const displayContract = createDecisionSupportUserVisibleDryRunDisplayContract(qualityCaseEvaluation, options);
  const displaySections = sectionsForPreviewKind(previewKind);

  return {
    previewId: `preview-${qualityCaseEvaluation.draftId}`,
    sourceCaseId: qualityCaseEvaluation.caseId,
    sourceDraftId: qualityCaseEvaluation.draftId,
    previewKind,
    sourceDraftKind: qualityCaseEvaluation.draftKind,
    sourceRouteKind: qualityCaseEvaluation.sourceRouteKind,
    generatedForDryRunOnly: true,
    internalPreviewOnly: true,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    productionEligibleNow: false,
    status: "rendered",
    displaySections,
    displayContract,
    previewQualityScore: qualityCaseEvaluation.overallScore,
    displayContractScore: displayContract.displayContractScore,
    warnings: [],
  } satisfies DecisionSupportUserVisibleDryRunPreview;
}

// ─── Preview validation ───────────────────────────────────────────────────────────────

type CheckResult = { passed: boolean; violations: DecisionSupportUserVisibleDryRunViolationType[] };

function sectionKinds(preview: DecisionSupportUserVisibleDryRunPreview): Set<DecisionSupportUserVisibleDryRunDisplaySectionKind> {
  return new Set(preview.displaySections.map((s) => s.kind));
}

function hasSection(preview: DecisionSupportUserVisibleDryRunPreview, kind: DecisionSupportUserVisibleDryRunDisplaySectionKind): boolean {
  return preview.displaySections.some((s) => s.kind === kind && s.body.trim().length > 0);
}

function checkInternalDryRunNotice(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  if (hasSection(preview, "internal_dry_run_notice") && preview.internalPreviewOnly === true && preview.generatedForDryRunOnly === true) {
    return { passed: true, violations: [] };
  }
  return { passed: false, violations: ["missing_internal_dry_run_notice"] };
}

function missingRequiredSectionViolation(kind: DecisionSupportUserVisibleDryRunDisplaySectionKind): DecisionSupportUserVisibleDryRunViolationType {
  switch (kind) {
    case "clarifying_question":
      return "missing_clarifying_question";
    case "assumptions":
      return "missing_assumptions";
    case "recommended_next_step":
      return "missing_safe_next_step";
    case "non_execution_notice":
      return "missing_non_execution_notice";
    case "internal_dry_run_notice":
      return "missing_internal_dry_run_notice";
    default:
      return "unsafe_display_format";
  }
}

function checkDisplayContract(preview: DecisionSupportUserVisibleDryRunPreview, minDisplayContractScore: number): CheckResult {
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  const present = sectionKinds(preview);
  // Required/prohibited sections are derived fresh from the canonical per-preview-kind template rather
  // than trusted off `preview.displayContract` — an adapter-supplied or malformed preview could otherwise
  // carry a weakened embedded contract (fewer required sections, missing prohibitions) and still pass.
  const canonical = DISPLAY_CONTRACT_TEMPLATES[preview.previewKind];
  for (const required of canonical.requiredSections) {
    if (!present.has(required) || !hasSection(preview, required)) violations.push(missingRequiredSectionViolation(required));
  }
  for (const prohibited of canonical.prohibitedSections) {
    if (present.has(prohibited)) violations.push("unsafe_display_format");
  }
  if (preview.displayContract.displayContractStatus !== "compatible") violations.push("unsafe_display_format");
  if (preview.displayContract.displayContractScore < minDisplayContractScore) violations.push("unsafe_display_format");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkClarificationFirst(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  if (preview.previewKind !== "clarification_first_preview") return { passed: true, violations: [] };
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (!hasSection(preview, "clarifying_question")) violations.push("missing_clarifying_question");
  if (!hasSection(preview, "assumptions")) violations.push("missing_assumptions");
  const present = sectionKinds(preview);
  if (present.has("route_preservation_notice") || present.has("unsupported_boundary_notice") || present.has("blocked_notice") || present.has("shadow_only_notice")) {
    violations.push("direct_decision_without_clarification");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkRoutePreservation(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  if (preview.previewKind !== "route_preservation_preview") return { passed: true, violations: [] };
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (!hasSection(preview, "route_preservation_notice")) violations.push("route_not_preserved");
  if (hasSection(preview, "clarifying_question")) violations.push("route_not_preserved");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkUnsupportedPreservation(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  if (preview.previewKind !== "unsupported_boundary_preview") return { passed: true, violations: [] };
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (!hasSection(preview, "unsupported_boundary_notice")) violations.push("unsupported_not_preserved");
  if (hasSection(preview, "clarifying_question")) violations.push("unsupported_not_preserved");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNonExecutionNotice(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  if (hasSection(preview, "non_execution_notice")) return { passed: true, violations: [] };
  return { passed: false, violations: ["missing_non_execution_notice"] };
}

function checkNoVisibilityAttempt(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (preview.userVisibleNow) violations.push("user_visible_output_attempted");
  if (preview.displaySections.some((s) => s.userVisibleNow)) violations.push("user_visible_output_attempted");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoProductionEligibility(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (preview.productionEligibleNow) violations.push("unsafe_display_format");
  // Every blocks* flag must actually be true — an adapter-supplied contract that clears
  // blocksProductionEligibility while leaving blocksExecution/blocksPersistence/blocksExternalCalls/
  // blocksDirectDecision false would otherwise be accepted as display-compatible.
  const contract = preview.displayContract;
  if (
    contract.blocksProductionEligibility !== true ||
    contract.blocksExecution !== true ||
    contract.blocksPersistence !== true ||
    contract.blocksExternalCalls !== true ||
    contract.blocksDirectDecision !== true
  ) {
    violations.push("unsafe_display_format");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

const RAW_INPUT_LIKE_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}\d/;

function checkNoLeaks(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  for (const s of preview.displaySections) {
    if (s.containsRawInput) violations.push("raw_input_leak");
    if (s.containsFullCandidate) violations.push("full_candidate_leak");
    if (s.containsPii) violations.push("pii_leak");
    if (s.containsProjectNameRaw) violations.push("project_name_leak");
    if (RAW_INPUT_LIKE_PATTERN.test(s.body)) violations.push("pii_leak");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoSideEffects(preview: DecisionSupportUserVisibleDryRunPreview): CheckResult {
  const violations: DecisionSupportUserVisibleDryRunViolationType[] = [];
  if (preview.persistedNow) violations.push("real_persistence");
  if (preview.executableNow) violations.push("action_execution");
  if (preview.externalSideEffectsAllowed) violations.push("external_call");
  for (const s of preview.displaySections) {
    if (s.containsExecutableInstruction) violations.push("action_execution");
    if (s.containsPersistenceInstruction) violations.push("real_persistence");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

const CRITICAL_VIOLATIONS = new Set<DecisionSupportUserVisibleDryRunViolationType>([
  "user_visible_output_attempted",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "action_execution",
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
]);

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type DecisionSupportUserVisibleDryRunPreviewValidationOptions = {
  config?: Partial<DecisionSupportUserVisibleDryRunEvaluationHarnessConfig>;
};

/**
 * Validates a single rendered preview against every Sprint 35R gate: internal dry-run notice presence,
 * display contract compliance, clarification-first shape (when applicable), route preservation (when
 * applicable), unsupported boundary preservation (when applicable), non-execution notice, no-visibility-
 * attempt, no-production-eligibility, no-leak guarantee, and no-side-effects guarantee. Every
 * `*Attempted` field is always the literal `false` — this harness never attempts a real side effect, so
 * there is nothing to detect beyond the preview's own declared fields.
 */
export function validateDecisionSupportUserVisibleDryRunPreview(
  preview: DecisionSupportUserVisibleDryRunPreview,
  options: DecisionSupportUserVisibleDryRunPreviewValidationOptions = {},
): DecisionSupportUserVisibleDryRunPreviewValidationResult {
  const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig(options.config);

  const internalDryRunNotice = checkInternalDryRunNotice(preview);
  const displayContract = checkDisplayContract(preview, config.minDisplayContractScore);
  const clarificationFirst = checkClarificationFirst(preview);
  const routePreservation = checkRoutePreservation(preview);
  const unsupportedPreservation = checkUnsupportedPreservation(preview);
  const nonExecutionNotice = checkNonExecutionNotice(preview);
  const noVisibilityAttempt = checkNoVisibilityAttempt(preview);
  const noProductionEligibility = checkNoProductionEligibility(preview);
  const noLeaks = checkNoLeaks(preview);
  const noSideEffects = checkNoSideEffects(preview);

  const allChecks = [
    internalDryRunNotice,
    displayContract,
    clarificationFirst,
    routePreservation,
    unsupportedPreservation,
    nonExecutionNotice,
    noVisibilityAttempt,
    noProductionEligibility,
    noLeaks,
    noSideEffects,
  ];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));

  const hasCriticalViolation = violations.some((v) => CRITICAL_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportUserVisibleDryRunPreviewQaStatus;
  let riskLevel: DecisionSupportUserVisibleDryRunPreviewRiskLevel;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
  } else if (hasCriticalViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
  } else {
    qaStatus = "fail";
    riskLevel = "high";
  }

  const valid = violations.length === 0;
  const recommendation = valid
    ? "No action needed — this preview passes every Sprint 35R gate."
    : `Fix the following before this preview can be accepted: ${violations.join(", ")}.`;

  return {
    previewId: preview.previewId,
    valid,
    qaStatus,
    riskLevel,
    violations,
    internalDryRunNoticePassed: internalDryRunNotice.passed,
    displayContractPassed: displayContract.passed,
    clarificationFirstPassed: clarificationFirst.passed,
    routePreservationPassed: routePreservation.passed,
    unsupportedPreservationPassed: unsupportedPreservation.passed,
    nonExecutionNoticePassed: nonExecutionNotice.passed,
    noVisibilityAttemptPassed: noVisibilityAttempt.passed,
    noProductionEligibilityPassed: noProductionEligibility.passed,
    noLeaksPassed: noLeaks.passed,
    noSideEffectsPassed: noSideEffects.passed,
    userVisibleOutputAttempted: false,
    productionWiringAttempted: false,
    routerChangeAttempted: false,
    composerChangeAttempted: false,
    endpointChangeAttempted: false,
    featureFlagAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    recommendation,
  } satisfies DecisionSupportUserVisibleDryRunPreviewValidationResult;
}

// ─── Harness run ────────────────────────────────────────────────────────────────────────

function statusForValidation(validation: DecisionSupportUserVisibleDryRunPreviewValidationResult): DecisionSupportUserVisibleDryRunPreviewStatus {
  if (validation.valid) return "validated";
  return validation.qaStatus === "blocked" ? "blocked" : "rejected";
}

function buildCaseResult(
  qualityCaseEvaluation: DecisionSupportResponseDraftQualityCaseEvaluation,
  config: DecisionSupportUserVisibleDryRunEvaluationHarnessConfig,
): DecisionSupportUserVisibleDryRunEvaluationCaseResult {
  const rendered = renderDecisionSupportUserVisibleDryRunPreview(qualityCaseEvaluation);
  const validation = validateDecisionSupportUserVisibleDryRunPreview(rendered, { config });
  const baseStatus = statusForValidation(validation);

  // A case whose source Sprint 34R quality evaluation is not itself pass/safeForUserVisibleDryRunHarness
  // (e.g. a custom corpus regression) must never be accepted here just because its rendered template
  // happens to satisfy the display-shape gates — requireQualityEvaluationPass is a real precondition, not
  // a nominal one. A leak/side-effect block found on the preview itself still wins over this rejection.
  const sourceQualitySafe = qualityCaseEvaluation.pass === true && qualityCaseEvaluation.safeForUserVisibleDryRunHarness === true;
  const status = baseStatus === "blocked" ? "blocked" : sourceQualitySafe ? baseStatus : "rejected";
  const preview: DecisionSupportUserVisibleDryRunPreview = { ...rendered, status };

  const warnings: string[] = [];
  if (!sourceQualitySafe) {
    warnings.push(
      `Case ${qualityCaseEvaluation.caseId}: source Sprint 34R quality evaluation is not pass / safeForUserVisibleDryRunHarness — this preview is rejected regardless of its own display-shape validation.`,
    );
  }
  if (!validation.valid) {
    warnings.push(`Case ${qualityCaseEvaluation.caseId}: preview ${preview.previewKind} is ${validation.qaStatus} — ${validation.recommendation}`);
  }

  const accepted = validation.valid && sourceQualitySafe;

  return {
    caseId: qualityCaseEvaluation.caseId,
    sourceDraftId: qualityCaseEvaluation.draftId,
    sourceDraftKind: qualityCaseEvaluation.draftKind,
    sourceRouteKind: qualityCaseEvaluation.sourceRouteKind,
    preview,
    validation,
    previewRendered: true,
    previewAccepted: accepted,
    previewRejected: !accepted && status === "rejected",
    previewBlocked: status === "blocked",
    safeForDefaultOffRouteComposerAdapter: accepted,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings,
  } satisfies DecisionSupportUserVisibleDryRunEvaluationCaseResult;
}

/**
 * Runs the full Sprint 35R user-visible dry run evaluation harness: reuses (or builds) the Sprint 34R
 * response draft quality evaluation against the same corpus (default: the Sprint 33R harness's own small
 * self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R corpus),
 * renders a synthetic preview for every case, validates each preview, and consolidates the Sprint 35R
 * allowed/prohibited actions. Never shows anything to a user, never persists anything real, and never
 * touches the router, composer, or endpoint.
 */
export function runDecisionSupportUserVisibleDryRunEvaluationHarness(
  options: DecisionSupportUserVisibleDryRunEvaluationHarnessOptions = {},
): DecisionSupportUserVisibleDryRunEvaluationHarnessResult {
  const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const evaluation = options.evaluation ?? runDecisionSupportResponseDraftQualityEvaluation({ cases: options.cases, now });
  const evaluationSummary = summarizeDecisionSupportResponseDraftQualityEvaluation(evaluation);

  const caseResults = evaluation.caseEvaluations.map((c) => buildCaseResult(c, config));

  const allowedNextActions = listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions();
  const prohibitedActions = listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions();

  const warnings: string[] = [];
  if (evaluationSummary.decision !== "ready_for_user_visible_dry_run_evaluation_harness") {
    warnings.push(`Sprint 34R response draft quality evaluation decision is "${evaluationSummary.decision}", not "ready_for_user_visible_dry_run_evaluation_harness" — this harness cannot recommend Sprint 36R until that is resolved.`);
  }
  if (evaluationSummary.passCount !== evaluationSummary.totalCases) {
    warnings.push("Not every Sprint 34R case is pass — this harness cannot recommend Sprint 36R until that is resolved.");
  }
  if (evaluationSummary.safeForUserVisibleDryRunHarnessCount !== evaluationSummary.totalCases) {
    warnings.push("Not every Sprint 34R case is safeForUserVisibleDryRunHarness — this harness cannot recommend Sprint 36R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    evaluation,
    evaluationSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportUserVisibleDryRunEvaluationHarnessResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function average(values: number[]): number {
  if (values.length === 0) return 100;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

const VISIBILITY_VIOLATIONS = new Set<DecisionSupportUserVisibleDryRunViolationType>(["user_visible_output_attempted"]);

const LEAKAGE_OR_SIDE_EFFECT_VIOLATIONS = new Set<DecisionSupportUserVisibleDryRunViolationType>([
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "action_execution",
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
]);

function computeDecision(fields: {
  totalCases: number;
  previewRenderedCount: number;
  previewAcceptedCount: number;
  previewRejectedCount: number;
  previewBlockedCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  safeForDefaultOffRouteComposerAdapterCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  averagePreviewQualityScore: number;
  averageDisplayContractScore: number;
  minPreviewQualityScoreObserved: number;
  minDisplayContractScoreObserved: number;
  internalDryRunNoticePassedCount: number;
  displayContractPassedCount: number;
  nonExecutionNoticePassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  violationCount: number;
  criticalViolationCount: number;
  visibilityViolationCount: number;
  leakageOrSideEffectViolationCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  routerChangeAttemptedCount: number;
  composerChangeAttemptedCount: number;
  endpointChangeAttemptedCount: number;
  featureFlagAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  configMinPreviewQualityScore: number;
  configMinDisplayContractScore: number;
  sprint34EvaluationDecision: string | undefined;
}): DecisionSupportUserVisibleDryRunEvaluationHarnessDecision {
  const anyAttempted =
    fields.userVisibleOutputAttemptedCount > 0 ||
    fields.productionWiringAttemptedCount > 0 ||
    fields.routerChangeAttemptedCount > 0 ||
    fields.composerChangeAttemptedCount > 0 ||
    fields.endpointChangeAttemptedCount > 0 ||
    fields.featureFlagAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0;

  if (fields.leakageOrSideEffectViolationCount > 0 || anyAttempted) return "blocked_by_leakage_or_side_effect_risk";

  const anyVisibilityRisk = fields.visibilityViolationCount > 0 || fields.safeForUserVisibleOutputNowCount > 0 || fields.safeForProductionCount > 0;
  if (anyVisibilityRisk) return "blocked_by_visibility_risk";

  if (
    fields.previewRejectedCount > 0 ||
    fields.previewBlockedCount > 0 ||
    fields.qaFailCount > 0 ||
    fields.qaBlockedCount > 0 ||
    fields.displayContractPassedCount !== fields.totalCases ||
    fields.internalDryRunNoticePassedCount !== fields.totalCases
  ) {
    return "blocked_by_preview_contract_gap";
  }

  if (
    fields.averagePreviewQualityScore < fields.configMinPreviewQualityScore ||
    fields.averageDisplayContractScore < fields.configMinDisplayContractScore ||
    fields.minPreviewQualityScoreObserved < fields.configMinPreviewQualityScore ||
    fields.minDisplayContractScoreObserved < fields.configMinDisplayContractScore
  ) {
    return "blocked_by_low_preview_quality";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.previewRenderedCount === fields.totalCases &&
    fields.previewAcceptedCount === fields.totalCases &&
    fields.previewRejectedCount === 0 &&
    fields.previewBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaWarningCount === 0 &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.safeForDefaultOffRouteComposerAdapterCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.averagePreviewQualityScore >= 90 &&
    fields.averageDisplayContractScore >= 90 &&
    fields.minPreviewQualityScoreObserved >= fields.configMinPreviewQualityScore &&
    fields.minDisplayContractScoreObserved >= fields.configMinDisplayContractScore &&
    fields.internalDryRunNoticePassedCount === fields.totalCases &&
    fields.displayContractPassedCount === fields.totalCases &&
    fields.nonExecutionNoticePassedCount === fields.totalCases &&
    fields.noVisibilityAttemptPassedCount === fields.totalCases &&
    fields.noProductionEligibilityPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.visibilityViolationCount === 0 &&
    fields.leakageOrSideEffectViolationCount === 0 &&
    !anyAttempted &&
    fields.sprint34EvaluationDecision === "ready_for_user_visible_dry_run_evaluation_harness";

  return allClean ? "ready_for_default_off_route_composer_integration_adapter" : "continue_dry_run_harness_only";
}

function recommendedNextSprintFor(decision: DecisionSupportUserVisibleDryRunEvaluationHarnessDecision): string {
  switch (decision) {
    case "ready_for_default_off_route_composer_integration_adapter":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_preview_contract_gap":
      return "Sprint 35R — User-Visible Dry Run Evaluation Harness (Preview Contract Hardening)";
    case "blocked_by_visibility_risk":
      return "Sprint 35R — User-Visible Dry Run Evaluation Harness (Visibility Risk Hardening)";
    case "blocked_by_low_preview_quality":
      return "Sprint 35R — User-Visible Dry Run Evaluation Harness (Preview Quality Hardening)";
    case "blocked_by_leakage_or_side_effect_risk":
      return "Sprint 35R — User-Visible Dry Run Evaluation Harness (Leakage/Side Effect Hardening)";
    case "continue_dry_run_harness_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportUserVisibleDryRunEvaluationHarness()` result — or a bare
 * `DecisionSupportUserVisibleDryRunEvaluationCaseResult[]` plus `options.sprint34EvaluationDecision` —
 * into a review-ready report: per-preview-kind counts, QA status counts, safety counts (every
 * production-side-effect count expected zero), score averages/minimums, a decision, and a recommended
 * next sprint. Pure — takes already-computed case results rather than re-running anything.
 */
export function summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(
  harnessOrCaseResults: DecisionSupportUserVisibleDryRunEvaluationHarnessResult | DecisionSupportUserVisibleDryRunEvaluationCaseResult[],
  options: DecisionSupportUserVisibleDryRunEvaluationHarnessSummaryOptions = {},
): DecisionSupportUserVisibleDryRunEvaluationHarnessSummary {
  const caseResults = Array.isArray(harnessOrCaseResults) ? harnessOrCaseResults : harnessOrCaseResults.caseResults;
  const sprint34EvaluationDecision = Array.isArray(harnessOrCaseResults)
    ? options.sprint34EvaluationDecision
    : (options.sprint34EvaluationDecision ?? harnessOrCaseResults.evaluationSummary.decision);
  const harnessWarnings = Array.isArray(harnessOrCaseResults) ? [] : harnessOrCaseResults.warnings;
  const config = Array.isArray(harnessOrCaseResults) ? createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig() : harnessOrCaseResults.config;

  const totalCases = caseResults.length;

  const previewRenderedCount = caseResults.filter((c) => c.previewRendered).length;
  const previewAcceptedCount = caseResults.filter((c) => c.previewAccepted).length;
  const previewRejectedCount = caseResults.filter((c) => c.previewRejected).length;
  const previewBlockedCount = caseResults.filter((c) => c.previewBlocked).length;

  const clarificationFirstPreviewCount = caseResults.filter((c) => c.preview.previewKind === "clarification_first_preview").length;
  const routePreservationPreviewCount = caseResults.filter((c) => c.preview.previewKind === "route_preservation_preview").length;
  const unsupportedBoundaryPreviewCount = caseResults.filter((c) => c.preview.previewKind === "unsupported_boundary_preview").length;
  const shadowOnlyInternalPreviewCount = caseResults.filter((c) => c.preview.previewKind === "shadow_only_internal_preview").length;
  const blockedUnsafePreviewCount = caseResults.filter((c) => c.preview.previewKind === "blocked_unsafe_preview").length;

  const qaPassCount = caseResults.filter((c) => c.validation.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.validation.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.validation.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.validation.qaStatus === "blocked").length;

  const safeForDefaultOffRouteComposerAdapterCount = caseResults.filter((c) => c.safeForDefaultOffRouteComposerAdapter).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const previewQualityScores = caseResults.map((c) => c.preview.previewQualityScore);
  const displayContractScores = caseResults.map((c) => c.preview.displayContractScore);
  const averagePreviewQualityScore = average(previewQualityScores);
  const averageDisplayContractScore = average(displayContractScores);
  const minPreviewQualityScore = previewQualityScores.length > 0 ? Math.min(...previewQualityScores) : 0;
  const minDisplayContractScore = displayContractScores.length > 0 ? Math.min(...displayContractScores) : 0;

  const internalDryRunNoticePassedCount = caseResults.filter((c) => c.validation.internalDryRunNoticePassed).length;
  const displayContractPassedCount = caseResults.filter((c) => c.validation.displayContractPassed).length;
  const clarificationFirstPassedCount = caseResults.filter((c) => c.preview.previewKind === "clarification_first_preview" && c.validation.clarificationFirstPassed).length;
  const routePreservationPassedCount = caseResults.filter((c) => c.preview.previewKind === "route_preservation_preview" && c.validation.routePreservationPassed).length;
  const unsupportedPreservationPassedCount = caseResults.filter((c) => c.preview.previewKind === "unsupported_boundary_preview" && c.validation.unsupportedPreservationPassed).length;
  const nonExecutionNoticePassedCount = caseResults.filter((c) => c.validation.nonExecutionNoticePassed).length;
  const noVisibilityAttemptPassedCount = caseResults.filter((c) => c.validation.noVisibilityAttemptPassed).length;
  const noProductionEligibilityPassedCount = caseResults.filter((c) => c.validation.noProductionEligibilityPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.validation.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.validation.noSideEffectsPassed).length;

  const allViolations = caseResults.flatMap((c) => c.validation.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = allViolations.filter((v) => CRITICAL_VIOLATIONS.has(v)).length;
  const visibilityViolationCount = allViolations.filter((v) => VISIBILITY_VIOLATIONS.has(v)).length;
  const leakageOrSideEffectViolationCount = allViolations.filter((v) => LEAKAGE_OR_SIDE_EFFECT_VIOLATIONS.has(v)).length;

  const userVisibleOutputAttemptedCount = caseResults.filter((c) => c.validation.userVisibleOutputAttempted).length;
  const productionWiringAttemptedCount = caseResults.filter((c) => c.validation.productionWiringAttempted).length;
  const routerChangeAttemptedCount = caseResults.filter((c) => c.validation.routerChangeAttempted).length;
  const composerChangeAttemptedCount = caseResults.filter((c) => c.validation.composerChangeAttempted).length;
  const endpointChangeAttemptedCount = caseResults.filter((c) => c.validation.endpointChangeAttempted).length;
  const featureFlagAttemptedCount = caseResults.filter((c) => c.validation.featureFlagAttempted).length;
  const realPersistenceAttemptedCount = caseResults.filter((c) => c.validation.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = caseResults.filter((c) => c.validation.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = caseResults.filter((c) => c.validation.supabaseWriteAttempted).length;
  const externalCallAttemptedCount = caseResults.filter((c) => c.validation.externalCallAttempted).length;

  const decision = computeDecision({
    totalCases,
    previewRenderedCount,
    previewAcceptedCount,
    previewRejectedCount,
    previewBlockedCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    safeForDefaultOffRouteComposerAdapterCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averagePreviewQualityScore,
    averageDisplayContractScore,
    minPreviewQualityScoreObserved: minPreviewQualityScore,
    minDisplayContractScoreObserved: minDisplayContractScore,
    internalDryRunNoticePassedCount,
    displayContractPassedCount,
    nonExecutionNoticePassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    violationCount,
    criticalViolationCount,
    visibilityViolationCount,
    leakageOrSideEffectViolationCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    routerChangeAttemptedCount,
    composerChangeAttemptedCount,
    endpointChangeAttemptedCount,
    featureFlagAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    configMinPreviewQualityScore: config.minPreviewQualityScore,
    configMinDisplayContractScore: config.minDisplayContractScore,
    sprint34EvaluationDecision,
  });

  const warnings = [...harnessWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    previewRenderedCount,
    previewAcceptedCount,
    previewRejectedCount,
    previewBlockedCount,
    clarificationFirstPreviewCount,
    routePreservationPreviewCount,
    unsupportedBoundaryPreviewCount,
    shadowOnlyInternalPreviewCount,
    blockedUnsafePreviewCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    safeForDefaultOffRouteComposerAdapterCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averagePreviewQualityScore,
    averageDisplayContractScore,
    minPreviewQualityScore,
    minDisplayContractScore,
    internalDryRunNoticePassedCount,
    displayContractPassedCount,
    clarificationFirstPassedCount,
    routePreservationPassedCount,
    unsupportedPreservationPassedCount,
    nonExecutionNoticePassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    violationCount,
    criticalViolationCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    routerChangeAttemptedCount,
    composerChangeAttemptedCount,
    endpointChangeAttemptedCount,
    featureFlagAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedPreviews: caseResults.filter((c) => c.previewAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedPreviews: caseResults.filter((c) => c.previewRejected),
    blockedPreviews: caseResults.filter((c) => c.previewBlocked),
    warnings,
  } satisfies DecisionSupportUserVisibleDryRunEvaluationHarnessSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 35R user-visible dry run evaluation harness — mirrors the style
 * of `explainDecisionSupportResponseDraftQualityEvaluation()` (Sprint 34R). See
 * `docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md` for full
 * context.
 */
export function explainDecisionSupportUserVisibleDryRunEvaluationHarness(): DecisionSupportUserVisibleDryRunEvaluationHarnessExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-user-visible-dry-run-evaluation-harness",
    purpose:
      "Renders a synthetic, internal-only preview of how every Sprint 34R-evaluated draft would eventually look if a future composer ever showed " +
      "it to a user, and validates each preview against a display contract — without ever showing anything to a real user, and without " +
      "connecting decision_support to production.",
    nonGoals: [
      "Show a preview to a real user.",
      "Wire the router, composer, or endpoint directly to live decision_support.",
      "Activate a production feature flag.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Call an LLM — preview content is generated from fixed, deterministic templates.",
    ],
    harnessProfile:
      'The "strict_user_visible_dry_run_evaluation_harness" profile: every allow* field (allowUserVisibleOutput/allowProductionWiring/' +
      "allowRouterChange/allowComposerChange/allowEndpointChange/allowFeatureFlag/allowRealPersistence/allowDbWrite/allowSupabaseWrite/" +
      "allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override " +
      "a caller passes, and every require* field is always true.",
    harnessModes: [
      "dry_run_harness_only (default): the full user-visible dry run evaluation harness, covering every preview kind.",
      "internal_preview_rendering: emphasizes renderDecisionSupportUserVisibleDryRunPreview() output.",
      "display_contract_evaluation: emphasizes createDecisionSupportUserVisibleDryRunDisplayContract() output.",
      "composer_readiness_review: emphasizes safeForDefaultOffRouteComposerAdapter across every case.",
      "route_preserving_preview_review: emphasizes routePreservationPassed for route_preservation_preview.",
    ],
    previewKindRules: [
      "clarification_first_draft (Sprint 33R draft kind) -> clarification_first_preview.",
      "route_preservation_draft -> route_preservation_preview.",
      "unsupported_boundary_draft -> unsupported_boundary_preview.",
      "shadow_only_internal_draft -> shadow_only_internal_preview.",
      "blocked_unsafe_draft -> blocked_unsafe_preview (the safe fallback for any draft kind this harness does not build a positive preview for).",
    ],
    displayContractRules: [
      "clarification_first_preview requires internal_dry_run_notice, acknowledgement, clarifying_question, assumptions, recommended_next_step, and non_execution_notice.",
      "route_preservation_preview requires internal_dry_run_notice, acknowledgement, route_preservation_notice, recommended_next_step, and non_execution_notice.",
      "unsupported_boundary_preview requires internal_dry_run_notice, acknowledgement, unsupported_boundary_notice, recommended_next_step, and non_execution_notice.",
      "shadow_only_internal_preview requires internal_dry_run_notice, shadow_only_notice, and non_execution_notice.",
      "blocked_unsafe_preview requires internal_dry_run_notice, blocked_notice, and non_execution_notice.",
      "Every contract is requiresInternalDryRunNotice: true, blocksDirectDecision: true, blocksExecution: true, blocksPersistence: true, blocksExternalCalls: true, blocksProductionEligibility: true, and starts displayContractStatus: compatible.",
    ],
    previewRenderingRules: [
      "Every preview is generatedForDryRunOnly: true, internalPreviewOnly: true, userVisibleNow: false, persistedNow: false, executableNow: false, externalSideEffectsAllowed: false, productionEligibleNow: false.",
      "Preview content is generated from fixed, non-LLM templates keyed by preview kind — never from raw input, a full candidate object, PII, or a raw project name.",
      "A clarification_first_preview never contains a direct decision or advisory conclusion — only an internal dry-run notice, an acknowledgement, a clarifying question, assumptions, a safe next step, and a non-execution notice.",
    ],
    previewValidationRules: [
      "internalDryRunNoticePassed checks the internal_dry_run_notice section is present and internalPreviewOnly/generatedForDryRunOnly are both true.",
      "displayContractPassed checks every required section is present, no prohibited section is present, and the display contract is compatible with a score at or above the configured floor.",
      "clarificationFirstPassed/routePreservationPassed/unsupportedPreservationPassed only apply to their matching preview kind — every other preview kind trivially passes.",
      "nonExecutionNoticePassed, noVisibilityAttemptPassed, noProductionEligibilityPassed, noLeaksPassed, and noSideEffectsPassed apply to every preview kind.",
      "qaStatus is blocked if any leak/side-effect/visibility violation is present, else fail if any other violation is present, else pass.",
    ],
    harnessRunRules: [
      "Reuses (or accepts) the Sprint 34R response draft quality evaluation against the same corpus rather than re-deriving it.",
      "Renders exactly one preview per Sprint 34R case evaluation, then validates every preview.",
      "Never shows output to a user, never persists output, and never touches the router/composer/endpoint.",
    ],
    decisionRule:
      "ready_for_default_off_route_composer_integration_adapter requires: totalCases > 0, previewRenderedCount === totalCases, " +
      "previewAcceptedCount === totalCases, every rejected/blocked count at zero, qaPassCount === totalCases, averagePreviewQualityScore >= 90, " +
      "averageDisplayContractScore >= 90, every minimum score at or above its floor, every gate-pass count === totalCases, every leak/side-effect/" +
      "visibility/attempted count at zero, and the Sprint 34R response draft quality evaluation decision === " +
      "ready_for_user_visible_dry_run_evaluation_harness. Otherwise, in priority order: blocked_by_leakage_or_side_effect_risk if any leak/side-" +
      "effect/production-wiring count is nonzero or any preview is blocked; else blocked_by_visibility_risk if any user-visible-output attempt " +
      "or a nonzero safeForUserVisibleOutputNow/safeForProduction count is observed; else blocked_by_preview_contract_gap if any preview is " +
      "rejected or fails a display-contract gate; else blocked_by_low_preview_quality if either score average is below its floor; else " +
      "continue_dry_run_harness_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every preview carries userVisibleNow: false and every case result carries safeForUserVisibleOutputNow: false — a future default-off " +
      "route/composer integration adapter must review this harness's output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This harness only renders synthetic internal-only previews offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This harness never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This harness never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated: "No production feature flag exists for decision_support, and none is created by this harness — flipping one on is a production activation decision, not a harness decision.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 34R/33R/32R plans) still resolves to " +
      "do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR " +
      "policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by rendering synthetic previews.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This harness never writes anything real — every preview stays persistedNow: false, productionEligibleNow: false.",
    whyStorageAdapterIsNotCreated: "This harness reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 34R/33R/32R/31R plans) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this harness does not build.",
    expectedSprint36Path:
      "If every preview stays qaStatus: pass, safeForDefaultOffRouteComposerAdapter: true, every leak/side-effect/visibility count stays at zero, " +
      "averagePreviewQualityScore stays >= 90, averageDisplayContractScore stays >= 90, and the Sprint 34R response draft quality evaluation " +
      "stays ready_for_user_visible_dry_run_evaluation_harness, Sprint 36R can build a Default-Off Route/Composer Integration Adapter — still " +
      "without activating a production feature flag, and still without showing anything to a real user until that future adapter is explicitly " +
      "turned on for a real workspace.",
  };
}
