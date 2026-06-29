// ─── Controlled PMO Governance Intelligence Dashboard — Validation ────────────
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentPmoGovernanceDashboardSnapshotStatus,
  AgentPmoGovernanceInsightCardType,
  AgentPmoGovernanceInsightSeverity,
  AgentPmoGovernanceInsightStatus,
  AgentPmoGovernanceTrendDirection,
  AgentPmoGovernanceActionability,
  AgentPmoGovernanceFeedbackQueueStatus,
  AgentPmoPolicyProposalType,
  AgentPmoPolicyProposalStatus,
  AgentPmoPolicyProposalDecision,
  AgentPmoGovernanceReportExportFormat,
  AgentPmoGovernanceReportExportStatus,
  AgentPmoGovernanceDashboardEventType,
  CreateGovernanceDashboardSnapshotInput,
  CreatePmoPolicyProposalInput,
  ReviewPmoPolicyProposalInput,
  GenerateGovernanceReportExportInput,
} from "./agent-pmo-governance-dashboard-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const SNAPSHOT_STATUSES: AgentPmoGovernanceDashboardSnapshotStatus[] = [
  "created", "active", "archived",
];

const INSIGHT_CARD_TYPES: AgentPmoGovernanceInsightCardType[] = [
  "risk_calibration", "evidence_quality", "adapter_performance",
  "review_routing", "governance_feedback", "privacy_health",
  "learning_signal_volume", "policy_proposal", "workspace_summary",
];

const INSIGHT_SEVERITIES: AgentPmoGovernanceInsightSeverity[] = [
  "info", "low", "medium", "high", "critical",
];

const INSIGHT_STATUSES: AgentPmoGovernanceInsightStatus[] = [
  "created", "open", "reviewed", "archived",
];

const TREND_DIRECTIONS: AgentPmoGovernanceTrendDirection[] = [
  "improving", "worsening", "stable", "insufficient_data",
];

const ACTIONABILITIES: AgentPmoGovernanceActionability[] = [
  "informational", "review_recommended", "proposal_recommended", "pmo_attention_required",
];

const FEEDBACK_QUEUE_STATUSES: AgentPmoGovernanceFeedbackQueueStatus[] = [
  "open", "reviewed", "accepted", "rejected", "archived",
];

const POLICY_PROPOSAL_TYPES: AgentPmoPolicyProposalType[] = [
  "risk_policy", "evidence_requirement", "adapter_quality_review",
  "review_routing", "human_review_policy", "triage_policy", "governance_process",
];

const POLICY_PROPOSAL_STATUSES: AgentPmoPolicyProposalStatus[] = [
  "created", "open", "under_review", "approved_for_future_implementation", "rejected", "archived",
];

const POLICY_PROPOSAL_DECISIONS: AgentPmoPolicyProposalDecision[] = [
  "approve_for_future_implementation", "reject", "archive", "request_more_review",
];

const REPORT_EXPORT_FORMATS: AgentPmoGovernanceReportExportFormat[] = [
  "markdown", "json", "csv",
];

const REPORT_EXPORT_STATUSES: AgentPmoGovernanceReportExportStatus[] = [
  "created", "generated", "failed", "downloaded", "archived",
];

const DASHBOARD_EVENT_TYPES: AgentPmoGovernanceDashboardEventType[] = [
  "dashboard_snapshot_created",
  "insight_card_created",
  "governance_feedback_reviewed",
  "policy_proposal_created",
  "policy_proposal_reviewed",
  "governance_report_export_created",
  "governance_report_export_downloaded",
  "dashboard_filter_applied",
  "dashboard_summary_viewed",
];

// ─── Blocked Field Names ──────────────────────────────────────────────────────

const BLOCKED_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
  "raw_payload", "payload", "outcomePayload", "safeOutcomePayload",
  "intendedSummary", "actualSummary", "rationale", "failureMessage",
  "correctionReason", "customer", "client", "project_name",
  "email", "phone", "address",
]);

const BLOCKED_TERMS = [
  "raw_payload", "outcomePayload", "safeOutcomePayload",
  "intendedSummary", "actualSummary", "failureMessage", "correctionReason",
];

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoGovernanceDashboardSnapshotStatus(v: unknown): v is AgentPmoGovernanceDashboardSnapshotStatus {
  return SNAPSHOT_STATUSES.includes(v as AgentPmoGovernanceDashboardSnapshotStatus);
}

export function validateAgentPmoGovernanceInsightCardType(v: unknown): v is AgentPmoGovernanceInsightCardType {
  return INSIGHT_CARD_TYPES.includes(v as AgentPmoGovernanceInsightCardType);
}

export function validateAgentPmoGovernanceInsightSeverity(v: unknown): v is AgentPmoGovernanceInsightSeverity {
  return INSIGHT_SEVERITIES.includes(v as AgentPmoGovernanceInsightSeverity);
}

export function validateAgentPmoGovernanceInsightStatus(v: unknown): v is AgentPmoGovernanceInsightStatus {
  return INSIGHT_STATUSES.includes(v as AgentPmoGovernanceInsightStatus);
}

export function validateAgentPmoGovernanceTrendDirection(v: unknown): v is AgentPmoGovernanceTrendDirection {
  return TREND_DIRECTIONS.includes(v as AgentPmoGovernanceTrendDirection);
}

export function validateAgentPmoGovernanceActionability(v: unknown): v is AgentPmoGovernanceActionability {
  return ACTIONABILITIES.includes(v as AgentPmoGovernanceActionability);
}

export function validateAgentPmoGovernanceFeedbackQueueStatus(v: unknown): v is AgentPmoGovernanceFeedbackQueueStatus {
  return FEEDBACK_QUEUE_STATUSES.includes(v as AgentPmoGovernanceFeedbackQueueStatus);
}

export function validateAgentPmoPolicyProposalType(v: unknown): v is AgentPmoPolicyProposalType {
  return POLICY_PROPOSAL_TYPES.includes(v as AgentPmoPolicyProposalType);
}

export function validateAgentPmoPolicyProposalStatus(v: unknown): v is AgentPmoPolicyProposalStatus {
  return POLICY_PROPOSAL_STATUSES.includes(v as AgentPmoPolicyProposalStatus);
}

export function validateAgentPmoPolicyProposalDecision(v: unknown): v is AgentPmoPolicyProposalDecision {
  return POLICY_PROPOSAL_DECISIONS.includes(v as AgentPmoPolicyProposalDecision);
}

export function validateAgentPmoGovernanceReportExportFormat(v: unknown): v is AgentPmoGovernanceReportExportFormat {
  return REPORT_EXPORT_FORMATS.includes(v as AgentPmoGovernanceReportExportFormat);
}

export function validateAgentPmoGovernanceReportExportStatus(v: unknown): v is AgentPmoGovernanceReportExportStatus {
  return REPORT_EXPORT_STATUSES.includes(v as AgentPmoGovernanceReportExportStatus);
}

export function validateAgentPmoGovernanceDashboardEventType(v: unknown): v is AgentPmoGovernanceDashboardEventType {
  return DASHBOARD_EVENT_TYPES.includes(v as AgentPmoGovernanceDashboardEventType);
}

// ─── Payload Serialization ────────────────────────────────────────────────────

export function assertGovernanceDashboardPayloadSerializable(value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 20 * 1024) {
      throw new Error("Governance dashboard payload exceeds 20KB limit");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("20KB")) throw e;
    throw new Error("Governance dashboard payload is not JSON-serializable");
  }
}

// ─── Redaction ────────────────────────────────────────────────────────────────

export function redactGovernanceDashboardPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (value === null) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!BLOCKED_KEYS.has(k)) {
      result[k] = v;
    }
  }
  return result;
}

// ─── Text Sanitization ────────────────────────────────────────────────────────

export function sanitizeGovernanceDashboardText(value: string, maxLength = 240): string {
  return value.slice(0, maxLength);
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreateGovernanceDashboardSnapshotInput(
  input: CreateGovernanceDashboardSnapshotInput,
): CreateGovernanceDashboardSnapshotInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.periodStart) throw new Error("periodStart is required");
  if (!input.periodEnd) throw new Error("periodEnd is required");
  if (new Date(input.periodEnd) <= new Date(input.periodStart)) {
    throw new Error("periodEnd must be after periodStart");
  }
  return { ...input, createdBy: input.createdBy ?? null };
}

export function normalizeCreatePmoPolicyProposalInput(
  input: CreatePmoPolicyProposalInput,
): CreatePmoPolicyProposalInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.proposalType) throw new Error("proposalType is required");
  if (!input.proposedChangeSummary) throw new Error("proposedChangeSummary is required");
  return {
    ...input,
    proposedChangeSummary: sanitizeGovernanceDashboardText(input.proposedChangeSummary, 1000),
    sourceFeedbackIds: dedupeGovernanceDashboardStrings(input.sourceFeedbackIds ?? []),
    sourceSignalIds: dedupeGovernanceDashboardStrings(input.sourceSignalIds ?? []),
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeReviewPmoPolicyProposalInput(
  input: ReviewPmoPolicyProposalInput,
): ReviewPmoPolicyProposalInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.proposalId) throw new Error("proposalId is required");
  if (!input.decision) throw new Error("decision is required");
  if (!input.reviewRationale) throw new Error("reviewRationale is required");
  return {
    ...input,
    reviewRationale: sanitizeGovernanceDashboardText(input.reviewRationale, 4000),
    reviewedBy: input.reviewedBy ?? null,
  };
}

export function normalizeGenerateGovernanceReportExportInput(
  input: GenerateGovernanceReportExportInput,
): GenerateGovernanceReportExportInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.exportFormat) throw new Error("exportFormat is required");
  if (!input.periodStart) throw new Error("periodStart is required");
  if (!input.periodEnd) throw new Error("periodEnd is required");
  return { ...input, generatedBy: input.generatedBy ?? null };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function dedupeGovernanceDashboardStrings(values: string[]): string[] {
  return [...new Set(values)];
}

// ─── Derived Values ───────────────────────────────────────────────────────────

export function deriveGovernanceInsightSeverity(input: {
  cardType: AgentPmoGovernanceInsightCardType;
  metricValue?: number | null;
  trendDirection?: AgentPmoGovernanceTrendDirection;
  sourceCount?: number;
}): AgentPmoGovernanceInsightSeverity {
  const { metricValue, trendDirection, sourceCount } = input;
  const count = metricValue ?? sourceCount ?? 0;
  if (trendDirection === "worsening" && count >= 10) return "critical";
  if (trendDirection === "worsening" && count >= 5) return "high";
  if (trendDirection === "worsening") return "medium";
  if (count >= 5) return "medium";
  if (count >= 1) return "low";
  return "info";
}

export function deriveGovernanceActionability(input: {
  severity: AgentPmoGovernanceInsightSeverity;
  cardType: AgentPmoGovernanceInsightCardType;
  sourceCount?: number;
}): AgentPmoGovernanceActionability {
  const { severity } = input;
  if (severity === "critical") return "pmo_attention_required";
  if (severity === "high") return "proposal_recommended";
  if (severity === "medium") return "review_recommended";
  return "informational";
}

// ─── Report Export Safety ─────────────────────────────────────────────────────

export function validateGovernanceReportExportSafety(input: {
  contentText?: string | null;
  contentJson?: Record<string, unknown> | null;
}): { safe: boolean; blockedReasons: string[] } {
  const blockedReasons: string[] = [];

  if (input.contentText) {
    for (const term of [...BLOCKED_TERMS, ...Array.from(BLOCKED_KEYS)]) {
      if (input.contentText.toLowerCase().includes(term.toLowerCase())) {
        blockedReasons.push(`blocked_term_in_text:${term}`);
      }
    }
  }

  if (input.contentJson) {
    function scanObject(obj: unknown, path = ""): void {
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const fullKey = path ? `${path}.${k}` : k;
        if (BLOCKED_KEYS.has(k)) {
          blockedReasons.push(`blocked_key:${fullKey}`);
        }
        if (typeof v === "string") {
          for (const term of BLOCKED_TERMS) {
            if (v.toLowerCase().includes(term.toLowerCase())) {
              blockedReasons.push(`blocked_term_in_value:${fullKey}:${term}`);
              break;
            }
          }
        }
        if (v && typeof v === "object") {
          scanObject(v, fullKey);
        }
      }
    }
    scanObject(input.contentJson);
  }

  return { safe: blockedReasons.length === 0, blockedReasons };
}
