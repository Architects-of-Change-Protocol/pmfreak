import type { GovernanceSignalRow } from "@/lib/db/database-contract";

export type { GovernanceSignalRow };

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type GovernanceSignalType =
  | "approval_delay"
  | "authority_gap"
  | "escalation_gap"
  | "decision_bottleneck"
  | "amendment_backlog"
  | "ratification_stall"
  | "risk_accumulation"
  | "recommendation_ignored"
  | "governance_violation"
  | "delivery_drift";

export type GovernanceSignalSeverity = "low" | "medium" | "high" | "critical";
export type GovernanceSignalStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type GovernanceSignalSource =
  | "constitution"
  | "decision"
  | "amendment"
  | "ratification"
  | "authority"
  | "delegation"
  | "recommendation"
  | "risk"
  | "project";

export type GovernanceSignalEvidenceType =
  | "decision_observation"
  | "amendment_observation"
  | "authority_observation"
  | "ratification_observation"
  | "recommendation_observation"
  | "violation_observation"
  | "pattern_match"
  | "historical_data";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GOVERNANCE_SIGNAL_TYPES: GovernanceSignalType[] = [
  "approval_delay",
  "authority_gap",
  "escalation_gap",
  "decision_bottleneck",
  "amendment_backlog",
  "ratification_stall",
  "risk_accumulation",
  "recommendation_ignored",
  "governance_violation",
  "delivery_drift",
];

export const GOVERNANCE_SIGNAL_SEVERITIES: GovernanceSignalSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const GOVERNANCE_SIGNAL_STATUSES: GovernanceSignalStatus[] = [
  "active",
  "acknowledged",
  "resolved",
  "dismissed",
];

export const GOVERNANCE_SIGNAL_SOURCES: GovernanceSignalSource[] = [
  "constitution",
  "decision",
  "amendment",
  "ratification",
  "authority",
  "delegation",
  "recommendation",
  "risk",
  "project",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type GovernanceSignalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type GovernanceSignalEventType =
  | "GOVERNANCE_SIGNAL_DETECTED"
  | "GOVERNANCE_SIGNAL_ACKNOWLEDGED"
  | "GOVERNANCE_SIGNAL_RESOLVED"
  | "GOVERNANCE_SIGNAL_DISMISSED"
  | "GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED"
  | "GOVERNANCE_SIGNAL_SEVERITY_CALCULATED"
  | "GOVERNANCE_SIGNAL_CORRELATED"
  | "GOVERNANCE_HEALTH_CALCULATED";

// ─── Service Input Types ──────────────────────────────────────────────────────

export type DetectSignalInput = {
  workspaceId: string;
  signalType: GovernanceSignalType;
  signalSource: GovernanceSignalSource;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  severity: GovernanceSignalSeverity;
  confidenceScore: number;
  evidence: Array<{
    evidenceType: GovernanceSignalEvidenceType;
    referenceEntityType: string;
    referenceEntityId: string;
    contributionWeight: number;
  }>;
  actorId: string;
};

export type AcknowledgeSignalInput = {
  workspaceId: string;
  signalId: string;
  actorId: string;
};

export type ResolveSignalInput = {
  workspaceId: string;
  signalId: string;
  actorId: string;
};

export type DismissSignalInput = {
  workspaceId: string;
  signalId: string;
  dismissedReason: string;
  actorId: string;
};

export type ListSignalsInput = {
  workspaceId: string;
  severity?: GovernanceSignalSeverity;
  status?: GovernanceSignalStatus;
  signalType?: GovernanceSignalType;
  source?: GovernanceSignalSource;
  fromDate?: string;
  toDate?: string;
};

export type DetectGovernanceSignalsInput = {
  workspaceId: string;
  actorId: string;
};

// ─── Output / View Types ──────────────────────────────────────────────────────

export type SignalEvidenceItem = {
  id: string;
  evidenceType: GovernanceSignalEvidenceType;
  referenceEntityType: string;
  referenceEntityId: string;
  contributionWeight: number;
};

export type SignalWithEvidence = GovernanceSignalRow & {
  evidence: SignalEvidenceItem[];
};

export type SignalCorrelation = {
  signalId: string;
  signalType: GovernanceSignalType;
  relatedSignalId: string;
  relatedSignalType: GovernanceSignalType;
  correlationReason: string;
  confidence: number;
};

export type GovernanceHealthScore = {
  workspaceId: string;
  score: number;
  activeSignals: number;
  criticalSignals: number;
  highSignals: number;
  mediumSignals: number;
  lowSignals: number;
  resolvedSignals: number;
  calculatedAt: string;
};

export type SignalLineage = {
  signalId: string;
  signalType: GovernanceSignalType;
  chain: Array<{
    layer: "artifact" | "memory" | "digest" | "learning_pattern" | "recommendation" | "signal";
    entityType: string;
    entityId: string | null;
    label: string;
  }>;
};

export type DetectionSummary = {
  workspaceId: string;
  signalsDetected: number;
  signalsByType: Record<GovernanceSignalType, number>;
  detectedAt: string;
};
