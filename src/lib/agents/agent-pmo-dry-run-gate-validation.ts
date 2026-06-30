// ─── PMO Controlled Policy Implementation Gate & Dry-Run Change Executor — Validation ─
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentPmoDryRunRequestStatus,
  AgentPmoDryRunPreflightStatus,
  AgentPmoDryRunGateApprovalStatus,
  AgentPmoDryRunGateDecisionType,
  AgentPmoDryRunChangeType,
  AgentPmoSimulatedPolicyVersionStatus,
  AgentPmoDryRunExecutionStatus,
  AgentPmoDryRunImpactDomain,
  AgentPmoDryRunImpactLevel,
  AgentPmoDryRunEvidencePackageStatus,
  AgentPmoDryRunEvidenceSectionType,
  AgentPmoDryRunBlockerType,
  AgentPmoDryRunBlockerStatus,
  AgentPmoDryRunBlockerSeverity,
  AgentPmoDryRunOperatorReviewStatus,
  AgentPmoDryRunOperatorReviewDecision,
  AgentPmoDryRunDecisionType,
  AgentPmoDryRunDecisionStatus,
  AgentPmoDryRunExportFormat,
  AgentPmoDryRunExportStatus,
  AgentPmoDryRunEventType,
  CreateAgentPmoDryRunExecutionRequestInput,
  CreateAgentPmoDryRunGateApprovalInput,
  RecordAgentPmoDryRunGateDecisionInput,
  RecordAgentPmoDryRunOperatorReviewInput,
  RecordAgentPmoDryRunDecisionInput,
  GenerateAgentPmoDryRunExportInput,
} from "./agent-pmo-dry-run-gate-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const DRY_RUN_REQUEST_STATUSES: AgentPmoDryRunRequestStatus[] = [
  "created", "preflight_pending", "preflight_failed", "ready_for_gate_review",
  "gate_review_required", "gate_approved", "gate_rejected", "dry_run_running",
  "dry_run_completed", "dry_run_failed", "blocked", "archived",
];

const DRY_RUN_PREFLIGHT_STATUSES: AgentPmoDryRunPreflightStatus[] = [
  "pending", "passed", "failed", "blocked", "waived",
];

const DRY_RUN_GATE_APPROVAL_STATUSES: AgentPmoDryRunGateApprovalStatus[] = [
  "created", "under_review", "approved_for_dry_run_only", "rejected",
  "changes_requested", "blocked", "archived",
];

const DRY_RUN_GATE_DECISION_TYPES: AgentPmoDryRunGateDecisionType[] = [
  "approve_for_dry_run_only", "reject", "request_changes", "block", "archive",
];

const DRY_RUN_CHANGE_TYPES: AgentPmoDryRunChangeType[] = [
  "policy_rule_addition", "policy_rule_update", "policy_rule_removal",
  "routing_rule_simulation", "scoring_rule_simulation", "evidence_requirement_simulation",
  "approval_gate_simulation", "dispatch_gate_simulation", "rollback_path_simulation",
];

const SIMULATED_POLICY_VERSION_STATUSES: AgentPmoSimulatedPolicyVersionStatus[] = [
  "created", "simulated", "review_ready", "blocked", "archived",
];

const DRY_RUN_EXECUTION_STATUSES: AgentPmoDryRunExecutionStatus[] = [
  "created", "running", "completed", "failed", "blocked", "archived",
];

const DRY_RUN_IMPACT_DOMAINS: AgentPmoDryRunImpactDomain[] = [
  "policy_behavior", "review_routing", "risk_scoring", "evidence_requirements",
  "approval_gates", "dispatch_gates", "operator_workload", "rollback_readiness",
  "data_safety", "compliance",
];

const DRY_RUN_IMPACT_LEVELS: AgentPmoDryRunImpactLevel[] = [
  "none", "low", "medium", "high", "critical", "unknown",
];

const DRY_RUN_EVIDENCE_PACKAGE_STATUSES: AgentPmoDryRunEvidencePackageStatus[] = [
  "created", "assembled", "review_ready", "accepted", "rejected", "archived",
];

const DRY_RUN_EVIDENCE_SECTION_TYPES: AgentPmoDryRunEvidenceSectionType[] = [
  "preflight_summary", "gate_approval_summary", "planning_workspace_summary",
  "change_set_summary", "simulated_policy_version_summary", "simulated_impact_summary",
  "blocker_summary", "operator_review_summary", "non_goals", "limitations",
];

const DRY_RUN_BLOCKER_TYPES: AgentPmoDryRunBlockerType[] = [
  "missing_planning_workspace", "planning_not_approved", "approval_pack_not_signed_off",
  "preflight_failed", "gate_rejected", "unsafe_payload_detected", "missing_rollback_rehearsal",
  "stakeholder_not_ready", "risk_not_reviewed", "change_window_not_reviewed",
  "simulated_policy_invalid", "simulated_impact_too_high", "unknown_baseline", "validation_failed",
];

const DRY_RUN_BLOCKER_STATUSES: AgentPmoDryRunBlockerStatus[] = [
  "open", "resolved", "accepted", "waived", "blocked", "archived",
];

const DRY_RUN_BLOCKER_SEVERITIES: AgentPmoDryRunBlockerSeverity[] = [
  "low", "medium", "high", "critical",
];

const DRY_RUN_OPERATOR_REVIEW_STATUSES: AgentPmoDryRunOperatorReviewStatus[] = [
  "created", "under_review", "accepted", "changes_requested", "rejected", "blocked", "archived",
];

const DRY_RUN_OPERATOR_REVIEW_DECISIONS: AgentPmoDryRunOperatorReviewDecision[] = [
  "accept_dry_run_result", "request_changes", "reject_dry_run_result",
  "block_future_activation", "archive",
];

const DRY_RUN_DECISION_TYPES: AgentPmoDryRunDecisionType[] = [
  "pass_for_future_activation_planning", "fail", "blocked", "request_changes", "archive",
];

const DRY_RUN_DECISION_STATUSES: AgentPmoDryRunDecisionStatus[] = [
  "created", "recorded", "archived",
];

const DRY_RUN_EXPORT_FORMATS: AgentPmoDryRunExportFormat[] = [
  "markdown", "json", "csv",
];

const DRY_RUN_EXPORT_STATUSES: AgentPmoDryRunExportStatus[] = [
  "created", "generated", "safety_validated", "available", "archived",
];

const DRY_RUN_EVENT_TYPES: AgentPmoDryRunEventType[] = [
  "dry_run_request_created", "dry_run_preflight_created", "dry_run_preflight_completed",
  "dry_run_gate_approval_created", "dry_run_gate_decision_recorded", "dry_run_change_set_created",
  "simulated_policy_version_created", "dry_run_execution_created", "dry_run_execution_started",
  "dry_run_execution_completed", "dry_run_execution_failed", "simulated_impact_recorded",
  "dry_run_evidence_package_created", "dry_run_blocker_recorded", "dry_run_operator_review_recorded",
  "dry_run_decision_recorded", "dry_run_export_created", "dry_run_request_archived",
];

// ─── Blocked Keys ─────────────────────────────────────────────────────────────

const BLOCKED_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "private_key", "credential", "client_secret", "refresh_token", "access_token",
  "session_cookie", "cookie", "raw_payload", "outcomePayload",
  "safeOutcomePayload", "intendedSummary", "actualSummary", "rationale_from_learning",
  "failureMessage", "correctionReason", "customer", "client", "project_name",
  "email", "phone", "address",
]);

// ─── Forbidden Executable Semantics ──────────────────────────────────────────

const FORBIDDEN_EXECUTABLE_PATTERNS = [
  "applyPolicy", "mutatePolicy", "updateLivePolicy", "changeLiveRouting",
  "updateLiveScoring", "executePolicyChange", "activatePolicy", "deployPolicy",
  "runLiveImplementation", "executeLiveImplementation", "createJiraTicket",
  "createGithubIssue", "sendApprovalEmail", "sendSlackNotification",
  "implementPolicy", "createCalendarEvent", "scheduleChangeWindow",
  "executeRollback", "dispatchExecutionToAdapter", "executeAdapter", "runAdapter",
];

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoDryRunRequestStatus(s: string): boolean {
  return DRY_RUN_REQUEST_STATUSES.includes(s as AgentPmoDryRunRequestStatus);
}

export function validateAgentPmoDryRunPreflightStatus(s: string): boolean {
  return DRY_RUN_PREFLIGHT_STATUSES.includes(s as AgentPmoDryRunPreflightStatus);
}

export function validateAgentPmoDryRunGateApprovalStatus(s: string): boolean {
  return DRY_RUN_GATE_APPROVAL_STATUSES.includes(s as AgentPmoDryRunGateApprovalStatus);
}

export function validateAgentPmoDryRunGateDecisionType(s: string): boolean {
  return DRY_RUN_GATE_DECISION_TYPES.includes(s as AgentPmoDryRunGateDecisionType);
}

export function validateAgentPmoDryRunChangeType(s: string): boolean {
  return DRY_RUN_CHANGE_TYPES.includes(s as AgentPmoDryRunChangeType);
}

export function validateAgentPmoSimulatedPolicyVersionStatus(s: string): boolean {
  return SIMULATED_POLICY_VERSION_STATUSES.includes(s as AgentPmoSimulatedPolicyVersionStatus);
}

export function validateAgentPmoDryRunExecutionStatus(s: string): boolean {
  return DRY_RUN_EXECUTION_STATUSES.includes(s as AgentPmoDryRunExecutionStatus);
}

export function validateAgentPmoDryRunImpactDomain(s: string): boolean {
  return DRY_RUN_IMPACT_DOMAINS.includes(s as AgentPmoDryRunImpactDomain);
}

export function validateAgentPmoDryRunImpactLevel(s: string): boolean {
  return DRY_RUN_IMPACT_LEVELS.includes(s as AgentPmoDryRunImpactLevel);
}

export function validateAgentPmoDryRunEvidencePackageStatus(s: string): boolean {
  return DRY_RUN_EVIDENCE_PACKAGE_STATUSES.includes(s as AgentPmoDryRunEvidencePackageStatus);
}

export function validateAgentPmoDryRunEvidenceSectionType(s: string): boolean {
  return DRY_RUN_EVIDENCE_SECTION_TYPES.includes(s as AgentPmoDryRunEvidenceSectionType);
}

export function validateAgentPmoDryRunBlockerType(s: string): boolean {
  return DRY_RUN_BLOCKER_TYPES.includes(s as AgentPmoDryRunBlockerType);
}

export function validateAgentPmoDryRunBlockerStatus(s: string): boolean {
  return DRY_RUN_BLOCKER_STATUSES.includes(s as AgentPmoDryRunBlockerStatus);
}

export function validateAgentPmoDryRunBlockerSeverity(s: string): boolean {
  return DRY_RUN_BLOCKER_SEVERITIES.includes(s as AgentPmoDryRunBlockerSeverity);
}

export function validateAgentPmoDryRunOperatorReviewStatus(s: string): boolean {
  return DRY_RUN_OPERATOR_REVIEW_STATUSES.includes(s as AgentPmoDryRunOperatorReviewStatus);
}

export function validateAgentPmoDryRunOperatorReviewDecision(s: string): boolean {
  return DRY_RUN_OPERATOR_REVIEW_DECISIONS.includes(s as AgentPmoDryRunOperatorReviewDecision);
}

export function validateAgentPmoDryRunDecisionType(s: string): boolean {
  return DRY_RUN_DECISION_TYPES.includes(s as AgentPmoDryRunDecisionType);
}

export function validateAgentPmoDryRunDecisionStatus(s: string): boolean {
  return DRY_RUN_DECISION_STATUSES.includes(s as AgentPmoDryRunDecisionStatus);
}

export function validateAgentPmoDryRunExportFormat(s: string): boolean {
  return DRY_RUN_EXPORT_FORMATS.includes(s as AgentPmoDryRunExportFormat);
}

export function validateAgentPmoDryRunExportStatus(s: string): boolean {
  return DRY_RUN_EXPORT_STATUSES.includes(s as AgentPmoDryRunExportStatus);
}

export function validateAgentPmoDryRunEventType(s: string): boolean {
  return DRY_RUN_EVENT_TYPES.includes(s as AgentPmoDryRunEventType);
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

export function assertDryRunPayloadSerializable(payload: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
    if (serialized.length > 50 * 1024) {
      throw new Error("Dry-run payload exceeds 50KB limit");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("50KB")) throw err;
    throw new Error("Dry-run payload is not JSON-serializable");
  }
  for (const pattern of FORBIDDEN_EXECUTABLE_PATTERNS) {
    if (serialized.includes(pattern)) {
      throw new Error(`Dry-run payload contains forbidden executable semantic: ${pattern}`);
    }
  }
  if (typeof payload === "object" && payload !== null) {
    for (const key of Object.keys(payload as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      for (const blockedKey of BLOCKED_KEYS) {
        if (keyLower.includes(blockedKey.toLowerCase())) {
          throw new Error(`Dry-run payload contains blocked content pattern in key: ${key}`);
        }
      }
    }
  }
}

export function redactDryRunPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const kLower = k.toLowerCase();
    let blocked = false;
    for (const blockedKey of BLOCKED_KEYS) {
      if (kLower.includes(blockedKey.toLowerCase())) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      result[k] = v;
    }
  }
  return result;
}

// ─── Text Sanitization ────────────────────────────────────────────────────────

export function sanitizeDryRunText(text: string, maxLength: number): string {
  return text.trim().slice(0, maxLength);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function dedupeDryRunStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreateDryRunRequestInput(
  input: CreateAgentPmoDryRunExecutionRequestInput,
): CreateAgentPmoDryRunExecutionRequestInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.planningWorkspaceId) throw new Error("planningWorkspaceId is required");
  if (!input.requestReason || !input.requestReason.trim()) throw new Error("requestReason is required");
  return {
    ...input,
    requestReason: sanitizeDryRunText(input.requestReason, 2000),
  };
}

export function normalizeCreateDryRunGateApprovalInput(
  input: CreateAgentPmoDryRunGateApprovalInput,
): CreateAgentPmoDryRunGateApprovalInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  return input;
}

export function normalizeDryRunGateDecisionInput(
  input: RecordAgentPmoDryRunGateDecisionInput,
): RecordAgentPmoDryRunGateDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.gateApprovalId) throw new Error("gateApprovalId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  if (!validateAgentPmoDryRunGateDecisionType(input.decisionType)) {
    throw new Error(`Invalid decisionType: ${input.decisionType}`);
  }
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required");
  return {
    ...input,
    rationale: sanitizeDryRunText(input.rationale, 4000),
  };
}

export function normalizeDryRunOperatorReviewInput(
  input: RecordAgentPmoDryRunOperatorReviewInput,
): RecordAgentPmoDryRunOperatorReviewInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  if (!validateAgentPmoDryRunOperatorReviewDecision(input.reviewDecision)) {
    throw new Error(`Invalid reviewDecision: ${input.reviewDecision}`);
  }
  return {
    ...input,
    reviewRationale: input.reviewRationale
      ? sanitizeDryRunText(input.reviewRationale, 4000)
      : input.reviewRationale ?? null,
  };
}

export function normalizeDryRunDecisionInput(
  input: RecordAgentPmoDryRunDecisionInput,
): RecordAgentPmoDryRunDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  if (!validateAgentPmoDryRunDecisionType(input.decisionType)) {
    throw new Error(`Invalid decisionType: ${input.decisionType}`);
  }
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required");
  return {
    ...input,
    rationale: sanitizeDryRunText(input.rationale, 4000),
  };
}

export function normalizeDryRunExportInput(
  input: GenerateAgentPmoDryRunExportInput,
): GenerateAgentPmoDryRunExportInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  if (!validateAgentPmoDryRunExportFormat(input.exportFormat)) {
    throw new Error(`Invalid exportFormat: ${input.exportFormat}`);
  }
  return input;
}

// ─── Evaluation Functions ─────────────────────────────────────────────────────

export function evaluateDryRunPreflightStatus(checks: {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
}): AgentPmoDryRunPreflightStatus {
  if (checks.blocked > 0) return "blocked";
  if (checks.failed > 0) return "failed";
  if (checks.passed === checks.total && checks.total > 0) return "passed";
  return "pending";
}

export function evaluateDryRunGateReadiness(
  requestStatus: AgentPmoDryRunRequestStatus,
): boolean {
  return requestStatus === "ready_for_gate_review";
}

export function evaluateDryRunImpactLevel(
  affectedCount: number,
  _domain: AgentPmoDryRunImpactDomain,
): AgentPmoDryRunImpactLevel {
  if (affectedCount === 0) return "none";
  if (affectedCount <= 2) return "low";
  if (affectedCount <= 5) return "medium";
  if (affectedCount <= 10) return "high";
  return "critical";
}

export function deriveDryRunRequestStatus(
  preflightStatus: AgentPmoDryRunPreflightStatus | null,
  gateApprovalStatus: AgentPmoDryRunGateApprovalStatus | null,
  executionStatus: AgentPmoDryRunExecutionStatus | null,
): AgentPmoDryRunRequestStatus {
  if (preflightStatus === "blocked" || gateApprovalStatus === "blocked" || executionStatus === "blocked") {
    return "blocked";
  }
  if (executionStatus === "running") return "dry_run_running";
  if (executionStatus === "completed") return "dry_run_completed";
  if (executionStatus === "failed") return "dry_run_failed";
  if (gateApprovalStatus === "approved_for_dry_run_only") return "gate_approved";
  if (gateApprovalStatus === "rejected") return "gate_rejected";
  if (gateApprovalStatus === "under_review" || gateApprovalStatus === "changes_requested") {
    return "gate_review_required";
  }
  if (preflightStatus === "passed") return "ready_for_gate_review";
  if (preflightStatus === "failed") return "preflight_failed";
  if (preflightStatus === "pending") return "preflight_pending";
  return "created";
}

export function deriveDryRunExecutionStatus(
  running: boolean,
  failed: boolean,
): AgentPmoDryRunExecutionStatus {
  if (running) return "running";
  if (failed) return "failed";
  return "completed";
}

export function validateDryRunExportSafety(
  content: string,
): { safe: boolean; blockedPatterns: string[] } {
  const blockedPatterns: string[] = [];
  for (const key of BLOCKED_KEYS) {
    if (content.includes(`"${key}"`) || content.includes(`${key}:`)) {
      blockedPatterns.push(key);
    }
  }
  for (const pattern of FORBIDDEN_EXECUTABLE_PATTERNS) {
    if (content.includes(pattern)) {
      blockedPatterns.push(pattern);
    }
  }
  return { safe: blockedPatterns.length === 0, blockedPatterns };
}
