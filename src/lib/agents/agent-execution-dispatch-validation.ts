// ─── Controlled Execution Finalization & Adapter Dispatch Gate — Validation ────
// Does NOT call LLMs, external APIs, or send communications.

import { createHash } from "node:crypto";
import type {
  AgentExecutionFinalizationStatus,
  AgentExecutionDispatchReadiness,
  AgentExecutionDispatchGateStatus,
  AgentExecutionLockStatus,
  AgentExecutionIdempotencyStatus,
  AgentExecutionDispatchAttemptStatus,
  AgentExecutionFinalConfirmationRequirement,
  AgentExecutionFinalConfirmationStatus,
  AgentExecutionSideEffectMode,
  AgentExecutionDispatchEventType,
  AgentExecutionDispatchCheckType,
  AgentExecutionDispatchCheckResult,
  CreateAgentExecutionFinalizationInput,
  CreateAgentExecutionDispatchGateInput,
  ConfirmAgentExecutionDispatchInput,
  DispatchAgentExecutionInput,
} from "./agent-execution-dispatch-types";

const FINALIZATION_STATUSES: AgentExecutionFinalizationStatus[] = [
  "created","readiness_pending","readiness_passed","readiness_failed",
  "confirmation_required","confirmation_satisfied","dispatch_ready","dispatch_blocked",
  "dispatch_started","dispatch_succeeded","dispatch_failed","result_reconciled",
  "cancelled","completed",
];

const DISPATCH_READINESS_VALUES: AgentExecutionDispatchReadiness[] = [
  "not_ready","ready","blocked","requires_confirmation","dispatching","dispatched","reconciled",
];

const DISPATCH_GATE_STATUSES: AgentExecutionDispatchGateStatus[] = [
  "created","allowed","blocked","confirmation_required","locked","idempotent_replay",
  "dispatching","succeeded","failed","cancelled",
];

const LOCK_STATUSES: AgentExecutionLockStatus[] = [
  "available","acquired","released","expired","blocked",
];

const IDEMPOTENCY_STATUSES: AgentExecutionIdempotencyStatus[] = [
  "new","in_progress","completed","replayed","conflict","failed",
];

const DISPATCH_ATTEMPT_STATUSES: AgentExecutionDispatchAttemptStatus[] = [
  "created","started","adapter_succeeded","adapter_failed","result_reconciled","blocked","cancelled",
];

const FINAL_CONFIRMATION_REQUIREMENTS: AgentExecutionFinalConfirmationRequirement[] = [
  "not_required","required","required_high_risk","required_critical_risk",
  "required_side_effect_potential","required_policy",
];

const FINAL_CONFIRMATION_STATUSES: AgentExecutionFinalConfirmationStatus[] = [
  "not_required","required","pending","confirmed","rejected","expired","cancelled",
];

const SIDE_EFFECT_MODES: AgentExecutionSideEffectMode[] = [
  "none","draft_only","dry_run","side_effect_potential","side_effect_blocked",
];

const DISPATCH_EVENT_TYPES: AgentExecutionDispatchEventType[] = [
  "finalization_created","readiness_checked","readiness_passed","readiness_failed",
  "approval_verified","final_confirmation_required","final_confirmation_recorded",
  "lock_acquired","lock_released","idempotency_checked","dispatch_gate_created",
  "dispatch_allowed","dispatch_blocked","adapter_selected","adapter_dispatch_started",
  "adapter_dispatch_succeeded","adapter_dispatch_failed","result_reconciled",
  "dispatch_completed","dispatch_cancelled",
];

const DISPATCH_CHECK_TYPES: AgentExecutionDispatchCheckType[] = [
  "execution_request_exists","workspace_matches","execution_request_dispatchable",
  "execution_mode_safe","approval_ready","approval_bridge_satisfied","conversion_linkage_valid",
  "adapter_mapping_exists","adapter_eligible","side_effect_mode_allowed",
  "final_confirmation_satisfied","execution_lock_available","idempotency_key_valid",
  "no_prior_successful_dispatch","payload_safe","scope_known","risk_level_known",
];

const SAFE_EXECUTION_MODES = new Set(["dry_run", "draft_only"]);

const BLOCKED_EXECUTION_MODES = new Set([
  "approved_execution","live_execution","external_side_effect",
]);

const SECRET_KEYS = new Set([
  "password","secret","token","apikey","api_key","authorization","stripe_secret",
  "private_key","credential","client_secret","refresh_token","access_token",
  "session_cookie","cookie",
]);

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function validateAgentExecutionFinalizationStatus(v: string): v is AgentExecutionFinalizationStatus {
  return (FINALIZATION_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionDispatchReadiness(v: string): v is AgentExecutionDispatchReadiness {
  return (DISPATCH_READINESS_VALUES as string[]).includes(v);
}

export function validateAgentExecutionDispatchGateStatus(v: string): v is AgentExecutionDispatchGateStatus {
  return (DISPATCH_GATE_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionLockStatus(v: string): v is AgentExecutionLockStatus {
  return (LOCK_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionIdempotencyStatus(v: string): v is AgentExecutionIdempotencyStatus {
  return (IDEMPOTENCY_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionDispatchAttemptStatus(v: string): v is AgentExecutionDispatchAttemptStatus {
  return (DISPATCH_ATTEMPT_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionFinalConfirmationRequirement(v: string): v is AgentExecutionFinalConfirmationRequirement {
  return (FINAL_CONFIRMATION_REQUIREMENTS as string[]).includes(v);
}

export function validateAgentExecutionFinalConfirmationStatus(v: string): v is AgentExecutionFinalConfirmationStatus {
  return (FINAL_CONFIRMATION_STATUSES as string[]).includes(v);
}

export function validateAgentExecutionSideEffectMode(v: string): v is AgentExecutionSideEffectMode {
  return (SIDE_EFFECT_MODES as string[]).includes(v);
}

export function validateAgentExecutionDispatchEventType(v: string): v is AgentExecutionDispatchEventType {
  return (DISPATCH_EVENT_TYPES as string[]).includes(v);
}

export function validateAgentExecutionDispatchCheckType(v: string): v is AgentExecutionDispatchCheckType {
  return (DISPATCH_CHECK_TYPES as string[]).includes(v);
}

// ─── Payload Helpers ──────────────────────────────────────────────────────────

export function assertExecutionDispatchPayloadSerializable(value: unknown): void {
  try {
    JSON.stringify(value);
  } catch {
    throw new Error("Execution dispatch payload must be JSON serializable");
  }
  const str = JSON.stringify(value);
  if (str.length > 100 * 1024) {
    throw new Error("Execution dispatch payload exceeds 100 KB limit");
  }
}

export function redactExecutionDispatchPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(k.toLowerCase())) {
      result[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactExecutionDispatchPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Dedup Helpers ────────────────────────────────────────────────────────────

export function dedupeDispatchStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

// ─── Input Normalization ──────────────────────────────────────────────────────

export function normalizeCreateAgentExecutionFinalizationInput(
  input: CreateAgentExecutionFinalizationInput,
): CreateAgentExecutionFinalizationInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.executionRequestId?.trim()) throw new Error("executionRequestId is required");
  return {
    workspaceId: input.workspaceId.trim(),
    executionRequestId: input.executionRequestId.trim(),
    actionConversionId: input.actionConversionId ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeCreateAgentExecutionDispatchGateInput(
  input: CreateAgentExecutionDispatchGateInput,
): CreateAgentExecutionDispatchGateInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.finalizationId?.trim()) throw new Error("finalizationId is required");
  return {
    workspaceId: input.workspaceId.trim(),
    finalizationId: input.finalizationId.trim(),
    actorId: input.actorId ?? null,
  };
}

export function normalizeConfirmAgentExecutionDispatchInput(
  input: ConfirmAgentExecutionDispatchInput,
): ConfirmAgentExecutionDispatchInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.finalizationId?.trim()) throw new Error("finalizationId is required");
  if (!input.rationale?.trim()) throw new Error("rationale is required for final confirmation");
  if (input.rationale.length > 4000) throw new Error("rationale must be at most 4000 characters");
  return {
    workspaceId: input.workspaceId.trim(),
    finalizationId: input.finalizationId.trim(),
    rationale: input.rationale.trim(),
    actorId: input.actorId ?? null,
  };
}

export function normalizeDispatchAgentExecutionInput(
  input: DispatchAgentExecutionInput,
): DispatchAgentExecutionInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.finalizationId?.trim()) throw new Error("finalizationId is required");
  const key = input.idempotencyKey?.trim();
  if (key && key.length > 240) throw new Error("idempotencyKey must be at most 240 characters");
  return {
    workspaceId: input.workspaceId.trim(),
    finalizationId: input.finalizationId.trim(),
    idempotencyKey: key || null,
    actorId: input.actorId ?? null,
  };
}

// ─── Idempotency Key & Fingerprint ────────────────────────────────────────────

export function createDispatchIdempotencyKey(input: {
  workspaceId: string;
  executionRequestId: string;
  selectedAdapterKey?: string | null;
  selectedToolKey?: string | null;
  executionMode?: string | null;
}): string {
  const parts = [
    input.workspaceId,
    input.executionRequestId,
    input.selectedAdapterKey ?? "no-adapter",
    input.selectedToolKey ?? "no-tool",
    input.executionMode ?? "no-mode",
  ];
  return `dispatch:${parts.join(":")}`;
}

export function createDispatchFingerprint(input: {
  workspaceId: string;
  executionRequestId: string;
  selectedAdapterKey?: string | null;
  selectedToolKey?: string | null;
  executionMode?: string | null;
  safePayload?: Record<string, unknown> | null;
}): string {
  const parts = {
    w: input.workspaceId,
    r: input.executionRequestId,
    a: input.selectedAdapterKey ?? null,
    t: input.selectedToolKey ?? null,
    m: input.executionMode ?? null,
    p: input.safePayload ?? null,
  };
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

// ─── Side-Effect Mode Evaluation ─────────────────────────────────────────────

export function evaluateDispatchSideEffectMode(input: {
  executionMode: string;
  selectedAdapterKey?: string | null;
  selectedToolKey?: string | null;
  declaredSideEffectLevel?: string | null;
}): AgentExecutionSideEffectMode {
  const mode = input.executionMode;
  if (mode === "dry_run") return "dry_run";
  if (mode === "draft_only") return "draft_only";
  if (mode === "approval_required") return "side_effect_potential";
  if (BLOCKED_EXECUTION_MODES.has(mode)) return "side_effect_blocked";
  return "side_effect_blocked";
}

// ─── Final Confirmation Requirement ──────────────────────────────────────────

export function evaluateFinalConfirmationRequirement(input: {
  riskLevel: "low" | "medium" | "high" | "critical";
  executionMode: string;
  sideEffectMode: AgentExecutionSideEffectMode;
  approvalVerified: boolean;
}): {
  requirement: AgentExecutionFinalConfirmationRequirement;
  status: AgentExecutionFinalConfirmationStatus;
  reason: string;
} {
  const { riskLevel, sideEffectMode } = input;

  if (riskLevel === "critical") {
    return {
      requirement: "required_critical_risk",
      status: "required",
      reason: "Critical risk level requires final human confirmation",
    };
  }
  if (riskLevel === "high") {
    return {
      requirement: "required_high_risk",
      status: "required",
      reason: "High risk level requires final human confirmation",
    };
  }
  if (sideEffectMode === "side_effect_potential") {
    return {
      requirement: "required_side_effect_potential",
      status: "required",
      reason: "Side-effect potential requires final human confirmation",
    };
  }
  return {
    requirement: "not_required",
    status: "not_required",
    reason: "No final confirmation required for low/medium risk safe dispatch",
  };
}

// ─── Readiness Calculation ────────────────────────────────────────────────────

export function calculateDispatchReadiness(input: {
  executionRequestExists: boolean;
  workspaceMatches: boolean;
  executionRequestDispatchable: boolean;
  executionModeSafe: boolean;
  approvalReady: boolean;
  approvalBridgeSatisfied: boolean;
  conversionLinkageValid: boolean;
  adapterMappingExists: boolean;
  adapterEligible: boolean;
  sideEffectModeAllowed: boolean;
  finalConfirmationSatisfied: boolean;
  executionLockAvailable: boolean;
  idempotencyKeyValid: boolean;
  noPriorSuccessfulDispatch: boolean;
  payloadSafe: boolean;
  scopeKnown: boolean;
  riskLevelKnown: boolean;
}): {
  readiness: AgentExecutionDispatchReadiness;
  blockingReasons: string[];
  warnings: string[];
  checks: AgentExecutionDispatchCheckResult[];
} {
  const checks: AgentExecutionDispatchCheckResult[] = [
    { checkType: "execution_request_exists", passed: input.executionRequestExists, severity: "blocking", message: input.executionRequestExists ? "Execution request exists" : "Execution request not found" },
    { checkType: "workspace_matches", passed: input.workspaceMatches, severity: "blocking", message: input.workspaceMatches ? "Workspace matches" : "Workspace mismatch" },
    { checkType: "execution_request_dispatchable", passed: input.executionRequestDispatchable, severity: "blocking", message: input.executionRequestDispatchable ? "Execution request is dispatchable" : "Execution request is not in a dispatchable state" },
    { checkType: "execution_mode_safe", passed: input.executionModeSafe, severity: "blocking", message: input.executionModeSafe ? "Execution mode is safe" : "Execution mode is not safe (must be dry_run or draft_only)" },
    { checkType: "approval_ready", passed: input.approvalReady, severity: "blocking", message: input.approvalReady ? "Approval readiness confirmed" : "Execution request approval readiness not satisfied" },
    { checkType: "approval_bridge_satisfied", passed: input.approvalBridgeSatisfied, severity: "blocking", message: input.approvalBridgeSatisfied ? "Approval bridge satisfied" : "Approval bridge not satisfied" },
    { checkType: "conversion_linkage_valid", passed: input.conversionLinkageValid, severity: "warning", message: input.conversionLinkageValid ? "Conversion linkage valid" : "No conversion linkage (allowed but noted)" },
    { checkType: "adapter_mapping_exists", passed: input.adapterMappingExists, severity: "blocking", message: input.adapterMappingExists ? "Adapter mapping exists" : "No adapter mapping found for execution request" },
    { checkType: "adapter_eligible", passed: input.adapterEligible, severity: "blocking", message: input.adapterEligible ? "Adapter is eligible" : "Adapter is not eligible for dispatch" },
    { checkType: "side_effect_mode_allowed", passed: input.sideEffectModeAllowed, severity: "blocking", message: input.sideEffectModeAllowed ? "Side-effect mode is allowed" : "Side-effect mode is not allowed for dispatch" },
    { checkType: "final_confirmation_satisfied", passed: input.finalConfirmationSatisfied, severity: "blocking", message: input.finalConfirmationSatisfied ? "Final confirmation satisfied" : "Final confirmation required but not yet provided" },
    { checkType: "execution_lock_available", passed: input.executionLockAvailable, severity: "blocking", message: input.executionLockAvailable ? "Execution lock available" : "Execution lock not available" },
    { checkType: "idempotency_key_valid", passed: input.idempotencyKeyValid, severity: "blocking", message: input.idempotencyKeyValid ? "Idempotency key valid" : "Idempotency key invalid" },
    { checkType: "no_prior_successful_dispatch", passed: input.noPriorSuccessfulDispatch, severity: "blocking", message: input.noPriorSuccessfulDispatch ? "No prior successful dispatch" : "Prior successful dispatch found (idempotent replay)" },
    { checkType: "payload_safe", passed: input.payloadSafe, severity: "blocking", message: input.payloadSafe ? "Payload is safe" : "Payload safety check failed" },
    { checkType: "scope_known", passed: input.scopeKnown, severity: "warning", message: input.scopeKnown ? "Scope is known" : "Scope not explicitly defined (will proceed with warnings)" },
    { checkType: "risk_level_known", passed: input.riskLevelKnown, severity: "warning", message: input.riskLevelKnown ? "Risk level is known" : "Risk level not explicitly defined" },
  ];

  const blockingFailed = checks.filter((c) => c.severity === "blocking" && !c.passed);
  const warningFailed = checks.filter((c) => c.severity === "warning" && !c.passed);

  const blockingReasons = blockingFailed.map((c) => c.message);
  const warnings = warningFailed.map((c) => c.message);

  // Separate check: was final confirmation the only blocker?
  const onlyFinalConfirmation =
    blockingFailed.length === 1 &&
    blockingFailed[0].checkType === "final_confirmation_satisfied";

  let readiness: AgentExecutionDispatchReadiness;
  if (blockingFailed.length === 0) {
    readiness = "ready";
  } else if (onlyFinalConfirmation) {
    readiness = "requires_confirmation";
  } else {
    readiness = "blocked";
  }

  return { readiness, blockingReasons: dedupeDispatchStrings(blockingReasons), warnings: dedupeDispatchStrings(warnings), checks };
}
