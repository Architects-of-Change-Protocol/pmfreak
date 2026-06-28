// ─── Agent Execution Results & Evidence Layer — Validation ────────────────────

import type {
  AgentExecutionResultType,
  AgentExecutionResultStatus,
  AgentExecutionEvidenceType,
  AgentExecutionEvidenceSource,
  AgentExecutionConfidenceLevel,
  AgentExecutionResultReviewState,
  AgentExecutionRetentionPolicy,
  AgentExecutionResultArtifactType,
  AgentExecutionResultEventType,
  AgentExecutionConfidenceResult,
  CreateAgentExecutionResultInput,
  CreateAgentExecutionEvidenceInput,
} from "./agent-execution-result-types";

const MAX_PAYLOAD_BYTES = 100 * 1024;

const SECRET_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
]);

export function validateAgentExecutionResultType(value: string): value is AgentExecutionResultType {
  return [
    "noop", "simulation", "draft_email", "draft_task", "draft_project_update",
    "draft_report", "structured_summary", "risk_analysis", "recommendation",
    "governance_note", "adapter_refusal", "adapter_failure", "execution_failure",
  ].includes(value);
}

export function validateAgentExecutionResultStatus(value: string): value is AgentExecutionResultStatus {
  return ["created", "ready_for_review", "superseded", "archived", "discarded", "failed"].includes(value);
}

export function validateAgentExecutionEvidenceType(value: string): value is AgentExecutionEvidenceType {
  return [
    "execution_request", "adapter_execution", "approval", "memory", "audit_event",
    "input_snapshot", "output_snapshot", "scope_reference", "tool_reference",
    "manual_note", "artifact_metadata",
  ].includes(value);
}

export function validateAgentExecutionEvidenceSource(value: string): value is AgentExecutionEvidenceSource {
  return [
    "agent_execution_runtime", "agent_tool_adapter_layer", "agent_memory_context",
    "agent_observability", "agent_approval", "manual", "system",
  ].includes(value);
}

export function validateAgentExecutionConfidenceLevel(value: string): value is AgentExecutionConfidenceLevel {
  return ["low", "medium", "high"].includes(value);
}

export function validateAgentExecutionResultReviewState(value: string): value is AgentExecutionResultReviewState {
  return ["not_ready", "ready", "reviewed", "rejected", "accepted", "needs_more_evidence"].includes(value);
}

export function validateAgentExecutionRetentionPolicy(value: string): value is AgentExecutionRetentionPolicy {
  return ["standard", "short_lived", "long_lived", "legal_hold", "delete_eligible"].includes(value);
}

export function validateAgentExecutionResultArtifactType(value: string): value is AgentExecutionResultArtifactType {
  return [
    "inline_json", "markdown", "draft_email", "draft_task", "draft_report",
    "risk_register_entry", "governance_note", "external_reference",
  ].includes(value);
}

export function validateAgentExecutionResultEventType(value: string): value is AgentExecutionResultEventType {
  return [
    "result_created", "result_ready_for_review", "result_superseded", "result_archived",
    "result_discarded", "evidence_created", "evidence_linked", "confidence_calculated",
    "lineage_recorded", "retention_policy_applied", "result_export_metadata_created",
  ].includes(value);
}

export function assertResultPayloadSerializable(value: unknown): void {
  if (value === null || value === undefined) return;
  try {
    const str = JSON.stringify(value);
    if (str.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Result payload exceeds max size (${MAX_PAYLOAD_BYTES} bytes)`);
    }
  } catch (e) {
    throw new Error(`Result payload is not JSON serializable: ${String(e)}`);
  }
}

export function assertEvidencePayloadSerializable(value: unknown): void {
  if (value === null || value === undefined) return;
  try {
    const str = JSON.stringify(value);
    if (str.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Evidence payload exceeds max size (${MAX_PAYLOAD_BYTES} bytes)`);
    }
  } catch (e) {
    throw new Error(`Evidence payload is not JSON serializable: ${String(e)}`);
  }
}

function redactObject(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(k.toLowerCase()) || SECRET_KEYS.has(k)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function redactResultPayload(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null) return null;
  return redactObject(value);
}

export function redactEvidencePayload(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null) return null;
  return redactObject(value);
}

export function normalizeCreateAgentExecutionResultInput(input: CreateAgentExecutionResultInput): CreateAgentExecutionResultInput {
  if (!input.workspaceId || typeof input.workspaceId !== "string" || input.workspaceId.trim() === "") {
    throw new Error("CreateAgentExecutionResultInput: workspaceId is required");
  }
  if (!input.executionRequestId || typeof input.executionRequestId !== "string" || input.executionRequestId.trim() === "") {
    throw new Error("CreateAgentExecutionResultInput: executionRequestId is required");
  }
  if (!validateAgentExecutionResultType(input.resultType)) {
    throw new Error(`CreateAgentExecutionResultInput: invalid resultType "${input.resultType}"`);
  }
  if (!input.title || typeof input.title !== "string" || input.title.trim() === "") {
    throw new Error("CreateAgentExecutionResultInput: title is required");
  }
  if (input.title.length > 240) {
    throw new Error("CreateAgentExecutionResultInput: title exceeds 240 characters");
  }
  if (input.summary && input.summary.length > 4000) {
    throw new Error("CreateAgentExecutionResultInput: summary exceeds 4000 characters");
  }
  if (input.resultPayload !== undefined && input.resultPayload !== null) {
    assertResultPayloadSerializable(input.resultPayload);
  }
  return {
    ...input,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? null,
    evidenceIds: [...new Set(input.evidenceIds ?? [])],
    lineageRefs: [...new Set(input.lineageRefs ?? [])],
    retentionPolicy: input.retentionPolicy ?? "standard",
    artifactType: input.artifactType ?? "inline_json",
  };
}

export function normalizeCreateAgentExecutionEvidenceInput(input: CreateAgentExecutionEvidenceInput): CreateAgentExecutionEvidenceInput {
  if (!input.workspaceId || typeof input.workspaceId !== "string" || input.workspaceId.trim() === "") {
    throw new Error("CreateAgentExecutionEvidenceInput: workspaceId is required");
  }
  if (!validateAgentExecutionEvidenceType(input.evidenceType)) {
    throw new Error(`CreateAgentExecutionEvidenceInput: invalid evidenceType "${input.evidenceType}"`);
  }
  if (!validateAgentExecutionEvidenceSource(input.evidenceSource)) {
    throw new Error(`CreateAgentExecutionEvidenceInput: invalid evidenceSource "${input.evidenceSource}"`);
  }
  if (!input.title || typeof input.title !== "string" || input.title.trim() === "") {
    throw new Error("CreateAgentExecutionEvidenceInput: title is required");
  }
  if (input.evidencePayload !== undefined && input.evidencePayload !== null) {
    assertEvidencePayloadSerializable(input.evidencePayload);
  }
  const weight = input.confidenceWeight ?? 0;
  return {
    ...input,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? null,
    confidenceWeight: Math.min(100, Math.max(0, weight)),
    retentionPolicy: input.retentionPolicy ?? "standard",
  };
}

// Deterministic fingerprint — NOT a cryptographic hash. Used for lineage deduplication only.
export function calculateDeterministicEvidenceHash(value: Record<string, unknown> | null): string | null {
  if (value === null) return null;
  const stable = JSON.stringify(value, Object.keys(value).sort());
  let h = 0;
  for (let i = 0; i < stable.length; i++) {
    h = ((h << 5) - h + stable.charCodeAt(i)) | 0;
  }
  return `fp_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function calculateExecutionConfidence(input: {
  executionRequestExists: boolean;
  adapterExecutionExists: boolean;
  adapterSucceeded: boolean;
  approvalPresent: boolean;
  requiredApprovalSatisfied: boolean;
  inputSnapshotPresent: boolean;
  outputPayloadPresent: boolean;
  evidenceCount: number;
  auditTrailPresent: boolean;
  scopeKnown: boolean;
  hasErrors: boolean;
  hasRefusal: boolean;
}): AgentExecutionConfidenceResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.executionRequestExists) { score += 15; reasons.push("execution request exists"); }
  if (input.adapterExecutionExists) { score += 15; reasons.push("adapter execution exists"); }
  if (input.adapterSucceeded) { score += 15; reasons.push("adapter succeeded"); }
  if (input.approvalPresent) { score += 10; reasons.push("approval present"); }
  if (input.requiredApprovalSatisfied) { score += 10; reasons.push("required approval satisfied"); }
  if (input.inputSnapshotPresent) { score += 10; reasons.push("input snapshot present"); }
  if (input.outputPayloadPresent) { score += 10; reasons.push("output payload present"); }
  if (input.evidenceCount >= 3) { score += 10; reasons.push("sufficient evidence items"); }
  if (input.auditTrailPresent) { score += 5; reasons.push("audit trail present"); }
  if (input.scopeKnown) { score += 5; reasons.push("scope known"); }
  if (input.hasErrors) { score -= 30; reasons.push("errors present (penalty)"); }
  if (input.hasRefusal) { score -= 30; reasons.push("refusal present (penalty)"); }

  score = Math.min(100, Math.max(0, score));

  const level: AgentExecutionConfidenceLevel =
    score >= 75 ? "high" : score >= 40 ? "medium" : "low";

  return { confidenceScore: score, confidenceLevel: level, confidenceReasons: reasons };
}
