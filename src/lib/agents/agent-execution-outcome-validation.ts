// ─── Controlled Execution Result Reconciliation & Human Outcome Review — Validation
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentExecutionOutcomeStatus,
  AgentExecutionOutcomeType,
  AgentExecutionOutcomeMatchStatus,
  AgentExecutionEvidenceCompletenessLevel,
  AgentExecutionOutcomeConfidenceLevel,
  AgentExecutionOutcomeReviewRequirement,
  AgentExecutionOutcomeReviewStatus,
  AgentExecutionOutcomeDecisionType,
  AgentExecutionFailureCategory,
  AgentExecutionCorrectionType,
  AgentExecutionCorrectionStatus,
  AgentExecutionOutcomeEventType,
  CreateAgentExecutionOutcomeInput,
  ReconcileDispatchOutcomeInput,
  CreateHumanOutcomeReviewInput,
  RecordHumanOutcomeDecisionInput,
} from "./agent-execution-outcome-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const OUTCOME_STATUSES: AgentExecutionOutcomeStatus[] = [
  "created","reconciling","reconciled","evidence_review","comparison_pending",
  "comparison_complete","confidence_scored","review_required","review_in_progress",
  "review_complete","correction_required","correction_in_progress","correction_complete",
  "archived","failed",
];

const OUTCOME_TYPES: AgentExecutionOutcomeType[] = [
  "dispatch_success","dispatch_failure","adapter_success","adapter_failure",
  "partial_success","noop","blocked","cancelled","reconciliation_failure",
];

const OUTCOME_MATCH_STATUSES: AgentExecutionOutcomeMatchStatus[] = [
  "matched","partial_match","mismatch","undetermined","no_intended_outcome",
];

const EVIDENCE_COMPLETENESS_LEVELS: AgentExecutionEvidenceCompletenessLevel[] = [
  "none","minimal","partial","sufficient","complete",
];

const OUTCOME_CONFIDENCE_LEVELS: AgentExecutionOutcomeConfidenceLevel[] = [
  "low","medium","high",
];

const OUTCOME_REVIEW_REQUIREMENTS: AgentExecutionOutcomeReviewRequirement[] = [
  "not_required","required_low_confidence","required_mismatch","required_failure",
  "required_correction","required_policy",
];

const OUTCOME_REVIEW_STATUSES: AgentExecutionOutcomeReviewStatus[] = [
  "not_required","pending","in_progress","approved","rejected","deferred","cancelled",
];

const OUTCOME_DECISION_TYPES: AgentExecutionOutcomeDecisionType[] = [
  "approve","reject","request_correction","archive","escalate","defer",
];

const FAILURE_CATEGORIES: AgentExecutionFailureCategory[] = [
  "dispatch_blocked","adapter_refused","adapter_error","idempotency_conflict",
  "lock_unavailable","confirmation_rejected","evidence_insufficient","reconciliation_error","unknown",
];

const CORRECTION_TYPES: AgentExecutionCorrectionType[] = [
  "retry_dispatch","re_evaluate_readiness","update_evidence","manual_override",
  "escalate_to_human","cancel_execution",
];

const CORRECTION_STATUSES: AgentExecutionCorrectionStatus[] = [
  "created","in_progress","applied","failed","cancelled",
];

const OUTCOME_EVENT_TYPES: AgentExecutionOutcomeEventType[] = [
  "outcome_created","reconciliation_started","reconciliation_complete",
  "evidence_completeness_scored","comparison_started","comparison_complete",
  "confidence_scored","review_requirement_determined","human_review_created",
  "human_review_decision_recorded","failed_dispatch_triaged","correction_loop_created",
  "correction_loop_applied","outcome_archived",
];

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function validateAgentExecutionOutcomeStatus(v: unknown): v is AgentExecutionOutcomeStatus {
  return OUTCOME_STATUSES.includes(v as AgentExecutionOutcomeStatus);
}

export function validateAgentExecutionOutcomeType(v: unknown): v is AgentExecutionOutcomeType {
  return OUTCOME_TYPES.includes(v as AgentExecutionOutcomeType);
}

export function validateAgentExecutionOutcomeMatchStatus(v: unknown): v is AgentExecutionOutcomeMatchStatus {
  return OUTCOME_MATCH_STATUSES.includes(v as AgentExecutionOutcomeMatchStatus);
}

export function validateAgentExecutionEvidenceCompletenessLevel(v: unknown): v is AgentExecutionEvidenceCompletenessLevel {
  return EVIDENCE_COMPLETENESS_LEVELS.includes(v as AgentExecutionEvidenceCompletenessLevel);
}

export function validateAgentExecutionOutcomeConfidenceLevel(v: unknown): v is AgentExecutionOutcomeConfidenceLevel {
  return OUTCOME_CONFIDENCE_LEVELS.includes(v as AgentExecutionOutcomeConfidenceLevel);
}

export function validateAgentExecutionOutcomeReviewRequirement(v: unknown): v is AgentExecutionOutcomeReviewRequirement {
  return OUTCOME_REVIEW_REQUIREMENTS.includes(v as AgentExecutionOutcomeReviewRequirement);
}

export function validateAgentExecutionOutcomeReviewStatus(v: unknown): v is AgentExecutionOutcomeReviewStatus {
  return OUTCOME_REVIEW_STATUSES.includes(v as AgentExecutionOutcomeReviewStatus);
}

export function validateAgentExecutionOutcomeDecisionType(v: unknown): v is AgentExecutionOutcomeDecisionType {
  return OUTCOME_DECISION_TYPES.includes(v as AgentExecutionOutcomeDecisionType);
}

export function validateAgentExecutionFailureCategory(v: unknown): v is AgentExecutionFailureCategory {
  return FAILURE_CATEGORIES.includes(v as AgentExecutionFailureCategory);
}

export function validateAgentExecutionCorrectionType(v: unknown): v is AgentExecutionCorrectionType {
  return CORRECTION_TYPES.includes(v as AgentExecutionCorrectionType);
}

export function validateAgentExecutionCorrectionStatus(v: unknown): v is AgentExecutionCorrectionStatus {
  return CORRECTION_STATUSES.includes(v as AgentExecutionCorrectionStatus);
}

export function validateAgentExecutionOutcomeEventType(v: unknown): v is AgentExecutionOutcomeEventType {
  return OUTCOME_EVENT_TYPES.includes(v as AgentExecutionOutcomeEventType);
}

// ─── Serialization Guard ──────────────────────────────────────────────────────

export function assertExecutionOutcomePayloadSerializable(payload: unknown): void {
  try {
    JSON.stringify(payload);
  } catch {
    throw new Error("Execution outcome payload is not JSON-serializable");
  }
}

// ─── Redaction ────────────────────────────────────────────────────────────────

const REDACT_KEYS = new Set([
  "password","secret","token","apiKey","api_key","authorization",
  "stripe_secret","private_key","credential","client_secret","refresh_token",
  "access_token","session_cookie","cookie",
]);

export function redactExecutionOutcomePayload(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (REDACT_KEYS.has(k)) {
      result[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactExecutionOutcomePayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

export function dedupeOutcomeStrings(arr: string[]): string[] {
  return [...new Set(arr.filter((s) => s.length > 0))];
}

// ─── Normalize Input ──────────────────────────────────────────────────────────

export function normalizeCreateAgentExecutionOutcomeInput(
  input: CreateAgentExecutionOutcomeInput,
): CreateAgentExecutionOutcomeInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.executionRequestId?.trim()) throw new Error("executionRequestId is required");
  return {
    ...input,
    workspaceId: input.workspaceId.trim(),
    executionRequestId: input.executionRequestId.trim(),
    finalizationId: input.finalizationId ?? null,
    dispatchAttemptId: input.dispatchAttemptId ?? null,
    dispatchGateId: input.dispatchGateId ?? null,
    adapterExecutionId: input.adapterExecutionId ?? null,
    resultId: input.resultId ?? null,
    outcomeType: input.outcomeType ?? "noop",
    intendedOutcomeSummary: input.intendedOutcomeSummary?.trim() ?? null,
    actualOutcomeSummary: input.actualOutcomeSummary?.trim() ?? null,
    outcomePayload: input.outcomePayload ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeReconcileDispatchOutcomeInput(
  input: ReconcileDispatchOutcomeInput,
): ReconcileDispatchOutcomeInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.outcomeId?.trim()) throw new Error("outcomeId is required");
  return {
    workspaceId: input.workspaceId.trim(),
    outcomeId: input.outcomeId.trim(),
    actorId: input.actorId ?? null,
  };
}

export function normalizeCreateHumanOutcomeReviewInput(
  input: CreateHumanOutcomeReviewInput,
): CreateHumanOutcomeReviewInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.outcomeId?.trim()) throw new Error("outcomeId is required");
  return {
    ...input,
    workspaceId: input.workspaceId.trim(),
    outcomeId: input.outcomeId.trim(),
    priority: input.priority ?? "normal",
    title: input.title?.trim() ?? "Human Outcome Review",
    summary: input.summary?.trim() ?? null,
    dueAt: input.dueAt ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeRecordHumanOutcomeDecisionInput(
  input: RecordHumanOutcomeDecisionInput,
): RecordHumanOutcomeDecisionInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.outcomeId?.trim()) throw new Error("outcomeId is required");
  if (!input.humanReviewId?.trim()) throw new Error("humanReviewId is required");
  if (!validateAgentExecutionOutcomeDecisionType(input.decisionType)) {
    throw new Error(`Invalid decisionType: ${String(input.decisionType)}`);
  }
  return {
    ...input,
    workspaceId: input.workspaceId.trim(),
    outcomeId: input.outcomeId.trim(),
    humanReviewId: input.humanReviewId.trim(),
    decisionRationale: input.decisionRationale?.trim() ?? null,
    decidedBy: input.decidedBy ?? null,
  };
}

// ─── Evidence Completeness ────────────────────────────────────────────────────

export type EvidenceCompletenessResult = {
  completenessScore: number;
  level: AgentExecutionEvidenceCompletenessLevel;
  presentTypes: string[];
  missingTypes: string[];
  blockingGaps: string[];
  warnings: string[];
};

export function calculateEvidenceCompleteness(params: {
  dispatchSucceeded: boolean;
  adapterExecutionExists: boolean;
  resultExists: boolean;
  evidenceCount: number;
  lineageComplete: boolean;
}): EvidenceCompletenessResult {
  const { dispatchSucceeded, adapterExecutionExists, resultExists, evidenceCount, lineageComplete } = params;
  const presentTypes: string[] = [];
  const missingTypes: string[] = [];
  const blockingGaps: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (dispatchSucceeded) { presentTypes.push("dispatch_record"); score += 20; }
  else { missingTypes.push("dispatch_record"); blockingGaps.push("Dispatch did not succeed"); }

  if (adapterExecutionExists) { presentTypes.push("adapter_execution"); score += 25; }
  else { missingTypes.push("adapter_execution"); blockingGaps.push("No adapter execution record"); }

  if (resultExists) { presentTypes.push("execution_result"); score += 25; }
  else { missingTypes.push("execution_result"); warnings.push("No execution result found"); }

  if (evidenceCount >= 1) { presentTypes.push("evidence_items"); score += 20; }
  else { missingTypes.push("evidence_items"); warnings.push("No evidence items attached"); }

  if (lineageComplete) { presentTypes.push("lineage"); score += 10; }
  else { missingTypes.push("lineage"); warnings.push("Lineage references incomplete"); }

  const clampedScore = Math.max(0, Math.min(100, score));
  let level: AgentExecutionEvidenceCompletenessLevel;
  if (clampedScore === 0) level = "none";
  else if (clampedScore <= 20) level = "minimal";
  else if (clampedScore <= 50) level = "partial";
  else if (clampedScore < 100) level = "sufficient";
  else level = "complete";

  return { completenessScore: clampedScore, level, presentTypes, missingTypes, blockingGaps, warnings };
}

// ─── Intended vs Actual Comparison ───────────────────────────────────────────

export type OutcomeComparisonResult = {
  matchStatus: AgentExecutionOutcomeMatchStatus;
  mismatchReasons: string[];
  confidenceImpact: number;
  requiresCorrection: boolean;
};

export function compareIntendedVsActualOutcome(params: {
  intendedOutcomeSummary: string | null;
  actualOutcomeSummary: string | null;
  outcomeType: AgentExecutionOutcomeType;
  dispatchSucceeded: boolean;
}): OutcomeComparisonResult {
  const { intendedOutcomeSummary, actualOutcomeSummary, outcomeType, dispatchSucceeded } = params;

  if (!intendedOutcomeSummary) {
    return {
      matchStatus: "no_intended_outcome",
      mismatchReasons: [],
      confidenceImpact: 0,
      requiresCorrection: false,
    };
  }

  if (!actualOutcomeSummary) {
    return {
      matchStatus: "undetermined",
      mismatchReasons: ["No actual outcome summary available for comparison"],
      confidenceImpact: -10,
      requiresCorrection: outcomeType === "dispatch_failure" || outcomeType === "adapter_failure",
    };
  }

  const mismatchReasons: string[] = [];
  let confidenceImpact = 0;

  const dispatchFailed = !dispatchSucceeded || outcomeType === "dispatch_failure" || outcomeType === "adapter_failure";
  if (dispatchFailed) {
    mismatchReasons.push("Dispatch or adapter execution did not succeed as intended");
    confidenceImpact -= 20;
  }

  const normalizedIntended = intendedOutcomeSummary.toLowerCase().trim();
  const normalizedActual = actualOutcomeSummary.toLowerCase().trim();

  if (normalizedIntended === normalizedActual) {
    return { matchStatus: "matched", mismatchReasons, confidenceImpact: confidenceImpact + 10, requiresCorrection: false };
  }

  // Check for partial overlap by word intersection
  const intendedWords = new Set(normalizedIntended.split(/\s+/).filter((w) => w.length > 3));
  const actualWords = new Set(normalizedActual.split(/\s+/).filter((w) => w.length > 3));
  const intersection = [...intendedWords].filter((w) => actualWords.has(w));
  const unionSize = new Set([...intendedWords, ...actualWords]).size;
  const similarity = unionSize > 0 ? intersection.length / unionSize : 0;

  if (dispatchFailed) {
    mismatchReasons.push("Actual outcome does not match intended outcome");
    return { matchStatus: "mismatch", mismatchReasons, confidenceImpact, requiresCorrection: true };
  }

  if (similarity >= 0.5) {
    if (mismatchReasons.length === 0) {
      mismatchReasons.push("Actual outcome partially matches intended outcome");
    }
    return { matchStatus: "partial_match", mismatchReasons, confidenceImpact: confidenceImpact + 5, requiresCorrection: false };
  }

  mismatchReasons.push("Actual outcome does not match intended outcome");
  return { matchStatus: "mismatch", mismatchReasons, confidenceImpact: confidenceImpact - 10, requiresCorrection: true };
}

// ─── Confidence Scoring ───────────────────────────────────────────────────────

export type OutcomeConfidenceResult = {
  confidenceScore: number;
  confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  confidenceReasons: string[];
};

export function calculateOutcomeConfidence(params: {
  dispatchSucceeded: boolean;
  adapterExecutionExists: boolean;
  resultExists: boolean;
  evidenceCompletenessLevel: AgentExecutionEvidenceCompletenessLevel;
  lineageComplete: boolean;
  matchStatus: AgentExecutionOutcomeMatchStatus;
  outcomeType: AgentExecutionOutcomeType;
}): OutcomeConfidenceResult {
  const {
    dispatchSucceeded, adapterExecutionExists, resultExists,
    evidenceCompletenessLevel, lineageComplete, matchStatus, outcomeType,
  } = params;

  let score = 0;
  const reasons: string[] = [];

  if (dispatchSucceeded) { score += 25; reasons.push("Dispatch succeeded"); }
  else { reasons.push("Dispatch did not succeed"); }

  if (adapterExecutionExists) { score += 20; reasons.push("Adapter execution record exists"); }
  else { reasons.push("No adapter execution record"); }

  if (resultExists) { score += 20; reasons.push("Execution result exists"); }
  else { reasons.push("No execution result found"); }

  if (evidenceCompletenessLevel === "complete" || evidenceCompletenessLevel === "sufficient") {
    score += 20;
    reasons.push("Evidence completeness is sufficient or above");
  } else {
    reasons.push(`Evidence completeness level: ${evidenceCompletenessLevel}`);
  }

  if (lineageComplete) { score += 10; reasons.push("Lineage is complete"); }
  else { reasons.push("Lineage references incomplete"); }

  if (matchStatus === "matched") { score += 10; reasons.push("Outcome matched intended"); }
  else if (matchStatus === "partial_match") { score += 5; reasons.push("Outcome partially matched intended"); }

  // Penalties
  if (outcomeType === "dispatch_failure") { score -= 20; reasons.push("Outcome type is dispatch failure"); }
  else if (outcomeType === "adapter_failure") { score -= 15; reasons.push("Outcome type is adapter failure"); }
  else if (outcomeType === "reconciliation_failure") { score -= 25; reasons.push("Outcome type is reconciliation failure"); }

  if (matchStatus === "mismatch") { score -= 15; reasons.push("Outcome mismatched intended"); }

  const clampedScore = Math.max(0, Math.min(100, score));
  let confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  if (clampedScore < 50) confidenceLevel = "low";
  else if (clampedScore < 80) confidenceLevel = "medium";
  else confidenceLevel = "high";

  return { confidenceScore: clampedScore, confidenceLevel, confidenceReasons: reasons };
}

// ─── Review Requirement ───────────────────────────────────────────────────────

export type OutcomeReviewRequirementResult = {
  reviewRequirement: AgentExecutionOutcomeReviewRequirement;
  reviewStatus: AgentExecutionOutcomeReviewStatus;
  priority: "low" | "normal" | "high" | "urgent";
};

export function determineOutcomeReviewRequirement(params: {
  confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  matchStatus: AgentExecutionOutcomeMatchStatus;
  outcomeType: AgentExecutionOutcomeType;
  requiresCorrection: boolean;
}): OutcomeReviewRequirementResult {
  const { confidenceLevel, matchStatus, outcomeType, requiresCorrection } = params;

  const isFailure = outcomeType === "dispatch_failure" || outcomeType === "adapter_failure" || outcomeType === "reconciliation_failure";

  if (requiresCorrection) {
    return {
      reviewRequirement: "required_correction",
      reviewStatus: "pending",
      priority: "high",
    };
  }

  if (isFailure) {
    return {
      reviewRequirement: "required_failure",
      reviewStatus: "pending",
      priority: "high",
    };
  }

  if (matchStatus === "mismatch") {
    return {
      reviewRequirement: "required_mismatch",
      reviewStatus: "pending",
      priority: "high",
    };
  }

  if (confidenceLevel === "low") {
    return {
      reviewRequirement: "required_low_confidence",
      reviewStatus: "pending",
      priority: "normal",
    };
  }

  return {
    reviewRequirement: "not_required",
    reviewStatus: "not_required",
    priority: "low",
  };
}
