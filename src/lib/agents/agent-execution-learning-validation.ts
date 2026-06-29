// ─── Controlled Execution Learning Signals & Governance Feedback Loop — Validation
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentExecutionLearningSignalStatus,
  AgentExecutionLearningSignalType,
  AgentExecutionLearningSignalCategory,
  AgentExecutionLearningSourceType,
  AgentExecutionLearningPrivacyClassification,
  AgentExecutionLearningRetentionClass,
  AgentExecutionLearningExtractionStatus,
  AgentExecutionGovernanceFeedbackStatus,
  AgentExecutionGovernanceFeedbackType,
  AgentExecutionGovernanceFeedbackSeverity,
  AgentExecutionRiskCalibrationDirection,
  AgentExecutionTrendDirection,
  AgentExecutionRouteEffectiveness,
  AgentExecutionLearningEventType,
  CreateAgentExecutionLearningSignalInput,
  ExtractLearningSignalsInput,
  GenerateGovernanceFeedbackInput,
  GenerateWorkspaceLearningSummaryInput,
} from "./agent-execution-learning-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const LEARNING_SIGNAL_STATUSES: AgentExecutionLearningSignalStatus[] = [
  "created","privacy_pending","privacy_passed","privacy_blocked",
  "active","archived","invalidated",
];

const LEARNING_SIGNAL_TYPES: AgentExecutionLearningSignalType[] = [
  "outcome_accepted","outcome_rejected","correction_requested",
  "retry_recommended","evidence_missing","evidence_complete",
  "confidence_low","confidence_high","intended_actual_matched",
  "intended_actual_mismatched","dispatch_failed","triage_retryable",
  "triage_escalated","risk_underestimated","risk_overestimated",
  "risk_aligned","adapter_quality_positive","adapter_quality_negative",
  "review_route_effective","review_route_ineffective",
];

const LEARNING_SIGNAL_CATEGORIES: AgentExecutionLearningSignalCategory[] = [
  "outcome","evidence","confidence","risk","adapter","review","triage","governance",
];

const LEARNING_SOURCE_TYPES: AgentExecutionLearningSourceType[] = [
  "execution_outcome","outcome_reconciliation","outcome_comparison",
  "evidence_completeness","outcome_confidence","human_outcome_review",
  "failed_dispatch_triage","correction_loop","review_decision","dispatch_attempt",
];

const LEARNING_PRIVACY_CLASSIFICATIONS: AgentExecutionLearningPrivacyClassification[] = [
  "safe","redacted","blocked_sensitive","blocked_raw_payload",
  "blocked_identifier","blocked_free_text","unknown",
];

const LEARNING_RETENTION_CLASSES: AgentExecutionLearningRetentionClass[] = [
  "signal_only","summary_only","redacted_metadata","blocked",
];

const LEARNING_EXTRACTION_STATUSES: AgentExecutionLearningExtractionStatus[] = [
  "created","running","succeeded","partial","failed","privacy_blocked","cancelled",
];

const GOVERNANCE_FEEDBACK_STATUSES: AgentExecutionGovernanceFeedbackStatus[] = [
  "created","open","reviewed","accepted","rejected","archived",
];

const GOVERNANCE_FEEDBACK_TYPES: AgentExecutionGovernanceFeedbackType[] = [
  "risk_calibration","evidence_requirement","adapter_quality",
  "review_routing","human_review_policy","triage_policy","governance_observation",
];

const GOVERNANCE_FEEDBACK_SEVERITIES: AgentExecutionGovernanceFeedbackSeverity[] = [
  "info","low","medium","high","critical",
];

const RISK_CALIBRATION_DIRECTIONS: AgentExecutionRiskCalibrationDirection[] = [
  "underestimated","overestimated","aligned","unknown",
];

const TREND_DIRECTIONS: AgentExecutionTrendDirection[] = [
  "improving","worsening","stable","insufficient_data",
];

const ROUTE_EFFECTIVENESS_VALUES: AgentExecutionRouteEffectiveness[] = [
  "effective","ineffective","unknown",
];

const LEARNING_EVENT_TYPES: AgentExecutionLearningEventType[] = [
  "learning_signal_created","learning_signal_privacy_checked",
  "learning_signal_privacy_passed","learning_signal_privacy_blocked",
  "learning_extraction_started","learning_extraction_succeeded",
  "learning_extraction_failed","governance_feedback_created",
  "risk_calibration_signal_created","evidence_quality_signal_created",
  "adapter_performance_signal_created","review_decision_pattern_created",
  "review_routing_feedback_created","workspace_learning_summary_created",
  "aggregate_signal_created","learning_signal_archived",
];

// ─── Sensitive / redact keys ──────────────────────────────────────────────────

const REDACT_KEYS = new Set([
  "password","secret","token","apiKey","api_key","authorization","stripe_secret",
  "private_key","credential","client_secret","refresh_token","access_token",
  "session_cookie","cookie","email","phone","address","customer","client",
  "project_name","raw_payload","payload","body","message","description","notes",
]);

const RAW_PAYLOAD_KEYS = new Set(["payload","body","raw","raw_payload"]);
const CUSTOMER_IDENTIFIER_KEYS = new Set(["customer","client","email","phone","address"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function validateAgentExecutionLearningSignalStatus(v: unknown): v is AgentExecutionLearningSignalStatus {
  return LEARNING_SIGNAL_STATUSES.includes(v as AgentExecutionLearningSignalStatus);
}

export function validateAgentExecutionLearningSignalType(v: unknown): v is AgentExecutionLearningSignalType {
  return LEARNING_SIGNAL_TYPES.includes(v as AgentExecutionLearningSignalType);
}

export function validateAgentExecutionLearningSignalCategory(v: unknown): v is AgentExecutionLearningSignalCategory {
  return LEARNING_SIGNAL_CATEGORIES.includes(v as AgentExecutionLearningSignalCategory);
}

export function validateAgentExecutionLearningSourceType(v: unknown): v is AgentExecutionLearningSourceType {
  return LEARNING_SOURCE_TYPES.includes(v as AgentExecutionLearningSourceType);
}

export function validateAgentExecutionLearningPrivacyClassification(v: unknown): v is AgentExecutionLearningPrivacyClassification {
  return LEARNING_PRIVACY_CLASSIFICATIONS.includes(v as AgentExecutionLearningPrivacyClassification);
}

export function validateAgentExecutionLearningRetentionClass(v: unknown): v is AgentExecutionLearningRetentionClass {
  return LEARNING_RETENTION_CLASSES.includes(v as AgentExecutionLearningRetentionClass);
}

export function validateAgentExecutionLearningExtractionStatus(v: unknown): v is AgentExecutionLearningExtractionStatus {
  return LEARNING_EXTRACTION_STATUSES.includes(v as AgentExecutionLearningExtractionStatus);
}

export function validateAgentExecutionGovernanceFeedbackStatus(v: unknown): v is AgentExecutionGovernanceFeedbackStatus {
  return GOVERNANCE_FEEDBACK_STATUSES.includes(v as AgentExecutionGovernanceFeedbackStatus);
}

export function validateAgentExecutionGovernanceFeedbackType(v: unknown): v is AgentExecutionGovernanceFeedbackType {
  return GOVERNANCE_FEEDBACK_TYPES.includes(v as AgentExecutionGovernanceFeedbackType);
}

export function validateAgentExecutionGovernanceFeedbackSeverity(v: unknown): v is AgentExecutionGovernanceFeedbackSeverity {
  return GOVERNANCE_FEEDBACK_SEVERITIES.includes(v as AgentExecutionGovernanceFeedbackSeverity);
}

export function validateAgentExecutionRiskCalibrationDirection(v: unknown): v is AgentExecutionRiskCalibrationDirection {
  return RISK_CALIBRATION_DIRECTIONS.includes(v as AgentExecutionRiskCalibrationDirection);
}

export function validateAgentExecutionTrendDirection(v: unknown): v is AgentExecutionTrendDirection {
  return TREND_DIRECTIONS.includes(v as AgentExecutionTrendDirection);
}

export function validateAgentExecutionRouteEffectiveness(v: unknown): v is AgentExecutionRouteEffectiveness {
  return ROUTE_EFFECTIVENESS_VALUES.includes(v as AgentExecutionRouteEffectiveness);
}

export function validateAgentExecutionLearningEventType(v: unknown): v is AgentExecutionLearningEventType {
  return LEARNING_EVENT_TYPES.includes(v as AgentExecutionLearningEventType);
}

// ─── Payload Serialization ────────────────────────────────────────────────────

export function assertLearningSignalPayloadSerializable(value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 20 * 1024) {
      throw new Error("Learning signal payload exceeds 20KB limit");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("20KB")) throw e;
    throw new Error("Learning signal payload is not JSON-serializable");
  }
}

// ─── Redaction ────────────────────────────────────────────────────────────────

export function redactLearningSignalPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (value === null) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const keyLower = k.toLowerCase();
    const isRedacted = Array.from(REDACT_KEYS).some((rk) =>
      keyLower.includes(rk.toLowerCase()),
    );
    if (isRedacted) {
      result[k] = "[REDACTED]";
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreateAgentExecutionLearningSignalInput(
  input: CreateAgentExecutionLearningSignalInput,
): CreateAgentExecutionLearningSignalInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.sourceType) throw new Error("sourceType is required");
  if (!input.sourceId) throw new Error("sourceId is required");
  if (!input.signalValue) throw new Error("signalValue is required");
  if (input.signalValue.length > 240) throw new Error("signalValue must not exceed 240 characters");
  if (input.signalPayload !== undefined && input.signalPayload !== null) {
    assertLearningSignalPayloadSerializable(input.signalPayload);
  }
  return {
    ...input,
    signalWeight: Math.max(0, Math.min(100, input.signalWeight ?? 50)),
    confidenceScore: Math.max(0, Math.min(100, input.confidenceScore ?? 40)),
    outcomeId: input.outcomeId ?? null,
    reviewId: input.reviewId ?? null,
    decisionId: input.decisionId ?? null,
    dispatchAttemptId: input.dispatchAttemptId ?? null,
    adapterKey: input.adapterKey ?? null,
    toolKey: input.toolKey ?? null,
    actionType: input.actionType ?? null,
    signalPayload: input.signalPayload ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeExtractLearningSignalsInput(
  input: ExtractLearningSignalsInput,
): ExtractLearningSignalsInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.sourceType) throw new Error("sourceType is required");
  if (!input.sourceId) throw new Error("sourceId is required");
  return {
    ...input,
    actorId: input.actorId ?? null,
  };
}

export function normalizeGenerateGovernanceFeedbackInput(
  input: GenerateGovernanceFeedbackInput,
): GenerateGovernanceFeedbackInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  return {
    ...input,
    sourceSignalIds: dedupeLearningStrings(input.sourceSignalIds ?? []),
    actorId: input.actorId ?? null,
  };
}

export function normalizeGenerateWorkspaceLearningSummaryInput(
  input: GenerateWorkspaceLearningSummaryInput,
): GenerateWorkspaceLearningSummaryInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.periodStart) throw new Error("periodStart is required");
  if (!input.periodEnd) throw new Error("periodEnd is required");
  if (new Date(input.periodEnd) <= new Date(input.periodStart)) {
    throw new Error("periodEnd must be after periodStart");
  }
  return {
    ...input,
    actorId: input.actorId ?? null,
  };
}

export function dedupeLearningStrings(values: string[]): string[] {
  return [...new Set(values)];
}

// ─── Privacy Filter ───────────────────────────────────────────────────────────

type PrivacyFilterInput = {
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  candidateSignalType: AgentExecutionLearningSignalType;
  signalValue: string;
  signalPayload: Record<string, unknown> | null;
};

type PrivacyFilterResult = {
  containsRawPayload: boolean;
  containsFreeText: boolean;
  containsSensitiveKey: boolean;
  containsCustomerIdentifier: boolean;
  containsProjectIdentifier: boolean;
  safeToStore: boolean;
  redactionApplied: boolean;
  privacyClassification: AgentExecutionLearningPrivacyClassification;
  retentionClass: AgentExecutionLearningRetentionClass;
  filterReasons: string[];
  safePayload: Record<string, unknown> | null;
};

export function evaluateLearningPrivacyFilter(input: PrivacyFilterInput): PrivacyFilterResult {
  const { signalValue, signalPayload } = input;
  const filterReasons: string[] = [];
  let containsRawPayload = false;
  let containsFreeText = false;
  let containsSensitiveKey = false;
  let containsCustomerIdentifier = false;
  let containsProjectIdentifier = false;

  // Check payload keys
  if (signalPayload) {
    for (const key of Object.keys(signalPayload)) {
      const kl = key.toLowerCase();
      if (Array.from(RAW_PAYLOAD_KEYS).some((r) => kl.includes(r))) {
        containsRawPayload = true;
        filterReasons.push(`raw_payload_key:${key}`);
      }
      if (Array.from(REDACT_KEYS).some((r) => kl.includes(r.toLowerCase()))) {
        containsSensitiveKey = true;
        filterReasons.push(`sensitive_key:${key}`);
      }
      if (Array.from(CUSTOMER_IDENTIFIER_KEYS).some((r) => kl.includes(r))) {
        containsCustomerIdentifier = true;
        filterReasons.push(`customer_identifier_key:${key}`);
      }
      // Project identifier: key contains "project_name" or "project_id" when value is UUID
      if (kl.includes("project_name") || (kl.includes("project_id") && typeof signalPayload[key] === "string" && UUID_RE.test(signalPayload[key] as string))) {
        containsProjectIdentifier = true;
        filterReasons.push(`project_identifier_key:${key}`);
      }
      // Check string values for free text
      if (typeof signalPayload[key] === "string" && (signalPayload[key] as string).length > 100) {
        containsFreeText = true;
        filterReasons.push(`free_text_value:${key}`);
      }
    }
  }

  // Check signalValue for free text
  if (signalValue.length > 240) {
    containsFreeText = true;
    filterReasons.push("free_text_signal_value");
  }

  const blocked = containsRawPayload || containsSensitiveKey || containsCustomerIdentifier || containsProjectIdentifier || containsFreeText;
  const safeToStore = !blocked;

  let privacyClassification: AgentExecutionLearningPrivacyClassification;
  let retentionClass: AgentExecutionLearningRetentionClass;

  if (containsRawPayload) {
    privacyClassification = "blocked_raw_payload";
    retentionClass = "blocked";
  } else if (containsSensitiveKey) {
    privacyClassification = "blocked_sensitive";
    retentionClass = "blocked";
  } else if (containsCustomerIdentifier || containsProjectIdentifier) {
    privacyClassification = "blocked_identifier";
    retentionClass = "blocked";
  } else if (containsFreeText) {
    privacyClassification = "blocked_free_text";
    retentionClass = "blocked";
  } else {
    privacyClassification = "safe";
    retentionClass = "signal_only";
  }

  let safePayload: Record<string, unknown> | null = null;
  let redactionApplied = false;

  if (safeToStore && signalPayload) {
    safePayload = redactLearningSignalPayload(signalPayload);
    redactionApplied = true;
  }

  return {
    containsRawPayload,
    containsFreeText,
    containsSensitiveKey,
    containsCustomerIdentifier,
    containsProjectIdentifier,
    safeToStore,
    redactionApplied,
    privacyClassification,
    retentionClass,
    filterReasons,
    safePayload,
  };
}

// ─── Risk Calibration Direction ───────────────────────────────────────────────

type RiskCalibrationInput = {
  originalRiskLevel: "low" | "medium" | "high" | "critical" | null;
  correctionRequested?: boolean;
  retryRecommended?: boolean;
  reviewDecisionType?: string | null;
  outcomeConfidenceLevel?: string | null;
};

export function deriveRiskCalibrationDirection(
  input: RiskCalibrationInput,
): AgentExecutionRiskCalibrationDirection {
  const { originalRiskLevel, correctionRequested, retryRecommended, reviewDecisionType, outcomeConfidenceLevel } = input;
  if (!originalRiskLevel) return "unknown";

  const isLowRisk = originalRiskLevel === "low" || originalRiskLevel === "medium";
  const isHighRisk = originalRiskLevel === "high" || originalRiskLevel === "critical";
  const rejected = reviewDecisionType === "reject" || reviewDecisionType === "request_correction";

  if (isLowRisk && (correctionRequested || retryRecommended || rejected)) {
    return "underestimated";
  }
  if (isHighRisk && reviewDecisionType === "approve" && outcomeConfidenceLevel === "high") {
    return "overestimated";
  }
  if (reviewDecisionType === "approve" && !correctionRequested && !retryRecommended) {
    return "aligned";
  }
  return "unknown";
}

// ─── Governance Feedback Severity ─────────────────────────────────────────────

type FeedbackSeverityInput = {
  signalWeight: number;
  confidenceScore: number;
};

export function deriveGovernanceFeedbackSeverity(
  input: FeedbackSeverityInput,
): AgentExecutionGovernanceFeedbackSeverity {
  const { signalWeight, confidenceScore } = input;
  if (signalWeight >= 80 && confidenceScore >= 70) return "high";
  if (signalWeight >= 60) return "medium";
  if (signalWeight >= 40) return "low";
  return "info";
}

// ─── Signal Weight ────────────────────────────────────────────────────────────

type SignalWeightInput = {
  humanDecisionType?: string | null;
  riskLevel?: string | null;
  evidenceCompletenessLevel?: string | null;
  confidenceLevel?: string | null;
};

export function calculateSignalWeight(input: SignalWeightInput): number {
  let weight = 50;
  if (input.humanDecisionType === "reject" || input.humanDecisionType === "request_correction") weight += 20;
  if (input.riskLevel === "high" || input.riskLevel === "critical") weight += 15;
  if (input.evidenceCompletenessLevel === "none" || input.evidenceCompletenessLevel === "low") weight += 10;
  if (input.confidenceLevel === "low") weight += 10;
  return Math.max(0, Math.min(100, weight));
}

// ─── Learning Confidence ──────────────────────────────────────────────────────

type LearningConfidenceInput = {
  sourceAvailable: boolean;
  privacySafe: boolean;
  humanDecisionPresent: boolean;
  evidenceCompletenessLevel?: string | null;
};

export function calculateLearningConfidence(input: LearningConfidenceInput): number {
  let score = 40;
  if (input.sourceAvailable) score += 20;
  if (input.privacySafe) score += 20;
  if (input.humanDecisionPresent) score += 10;
  if (input.evidenceCompletenessLevel === "high" || input.evidenceCompletenessLevel === "complete") score += 10;
  return Math.max(0, Math.min(100, score));
}
