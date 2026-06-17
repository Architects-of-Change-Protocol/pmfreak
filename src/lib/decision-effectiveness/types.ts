import type { PlatformEventRow } from "@/lib/platform-events";

export type DecisionOutcomeClassification =
  | "success"
  | "partial_success"
  | "failure"
  | "unknown";

export type DecisionEffectivenessStatus =
  | "candidate"
  | "validated"
  | "archived";

export type DecisionEffectivenessObservationSourceType =
  | "platform_event"
  | "decision"
  | "outcome"
  | "organizational_pattern"
  | "evidence"
  | "implementation";

export type DecisionEffectivenessObservationType =
  | "outcome_recorded"
  | "pattern_linked"
  | "evidence_noted"
  | "implementation_noted"
  | "duration_computed"
  | "classification_set"
  | "other";

export type DecisionEffectivenessEventType =
  | "DECISION_EFFECTIVENESS_CREATED"
  | "DECISION_EFFECTIVENESS_UPDATED"
  | "DECISION_EFFECTIVENESS_ARCHIVED"
  | "DECISION_EFFECTIVENESS_OBSERVATION_RECORDED";

export const DECISION_EFFECTIVENESS_CAPABILITIES = [
  "DECISION_EFFECTIVENESS_CREATE",
  "DECISION_EFFECTIVENESS_READ",
  "DECISION_EFFECTIVENESS_EXPORT",
  "DECISION_EFFECTIVENESS_ARCHIVE",
  "DECISION_EFFECTIVENESS_INSPECT",
] as const;
export type DecisionEffectivenessCapability = (typeof DECISION_EFFECTIVENESS_CAPABILITIES)[number];

export type DecisionEffectivenessRecord = {
  id: string;
  workspace_id: string;
  decision_id: string;
  project_id: string;
  effectiveness_status: DecisionEffectivenessStatus;
  outcome_classification: DecisionOutcomeClassification;
  approval_duration_seconds: number | null;
  implementation_duration_seconds: number | null;
  time_to_outcome_seconds: number | null;
  evidence_count: number;
  outcome_count: number;
  pattern_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type DecisionEffectivenessObservation = {
  id: string;
  effectiveness_id: string;
  observation_type: DecisionEffectivenessObservationType;
  summary: string;
  source_type: DecisionEffectivenessObservationSourceType;
  source_id: string;
  recorded_at: string;
};

export type DecisionEffectivenessResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type DecisionEffectivenessMetrics = {
  approval_duration_seconds: number | null;
  implementation_duration_seconds: number | null;
  time_to_outcome_seconds: number | null;
  evidence_count: number;
  outcome_count: number;
  pattern_count: number;
};

export type DecisionEffectivenessSummary = {
  record: DecisionEffectivenessRecord;
  metrics: DecisionEffectivenessMetrics;
  observation_count: number;
};

export type DecisionEffectivenessExplanation = {
  record: DecisionEffectivenessRecord;
  decision: Record<string, unknown>;
  implementation: Record<string, unknown> | null;
  outcomes: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  metrics: DecisionEffectivenessMetrics;
  observations: DecisionEffectivenessObservation[];
};

export type DecisionEffectivenessLineage = {
  record: DecisionEffectivenessRecord;
  decision: Record<string, unknown>;
  implementation: Record<string, unknown> | null;
  outcomes: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
  observations: DecisionEffectivenessObservation[];
  events: PlatformEventRow[];
};

export type DecisionEffectivenessExport = {
  record: DecisionEffectivenessRecord;
  decision: Record<string, unknown>;
  implementation: Record<string, unknown> | null;
  outcomes: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
  metrics: DecisionEffectivenessMetrics;
  observations: DecisionEffectivenessObservation[];
  events: PlatformEventRow[];
};

export type DecisionEffectivenessComputeInput = {
  decision: {
    id: string;
    workspace_id: string;
    project_id: string;
    created_at: string;
    approved_at: string | null;
    implemented_at: string | null;
    closed_at: string | null;
  };
  outcomes: Array<{ id: string; outcome_status: string }>;
  patterns: Array<{ id: string }>;
  evidence: Array<{ id: string }>;
};
