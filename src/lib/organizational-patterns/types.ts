import type { PlatformEventRow } from "@/lib/platform-events";

export type PatternCategory =
  | "risk_pattern"
  | "decision_pattern"
  | "schedule_pattern"
  | "stakeholder_pattern"
  | "delivery_pattern"
  | "resource_pattern"
  | "dependency_pattern"
  | "governance_pattern"
  | "execution_pattern"
  | "memory_pattern"
  | "other";

export type PatternStatus = "candidate" | "validated" | "deprecated" | "archived";

export type PatternConfidence = "low" | "medium" | "high" | "very_high";

export type PatternSourceType =
  | "organizational_memory"
  | "platform_event"
  | "decision"
  | "outcome"
  | "risk"
  | "task"
  | "milestone"
  | "dependency"
  | "stakeholder";

export type PatternSourceRelationship =
  | "supports"
  | "contradicts"
  | "caused_by"
  | "derived_from"
  | "reviewed_during"
  | "supersedes"
  | "related_to";

export type PatternEventType =
  | "PATTERN_CREATED"
  | "PATTERN_UPDATED"
  | "PATTERN_VALIDATED"
  | "PATTERN_ARCHIVED"
  | "PATTERN_DEPRECATED"
  | "PATTERN_DELETED"
  | "PATTERN_OBSERVATION_RECORDED";

export const PATTERN_CAPABILITIES = [
  "PATTERN_CREATE",
  "PATTERN_UPDATE",
  "PATTERN_VALIDATE",
  "PATTERN_ARCHIVE",
  "PATTERN_DEPRECATE",
  "PATTERN_DELETE",
  "PATTERN_EXPORT",
  "PATTERN_INSPECT",
] as const;
export type PatternCapability = (typeof PATTERN_CAPABILITIES)[number];

export const PATTERN_VALIDATION_THRESHOLD = 3;

export type PatternRecord = {
  id: string;
  workspace_id: string;
  pattern_category: PatternCategory;
  status: PatternStatus;
  confidence: PatternConfidence;
  title: string;
  summary: string;
  observation_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type PatternSource = {
  id: string;
  pattern_id: string;
  source_type: PatternSourceType;
  source_id: string;
  relationship_type: PatternSourceRelationship;
  created_at: string;
};

export type PatternObservation = {
  id: string;
  pattern_id: string;
  source_type: PatternSourceType;
  source_id: string;
  observation_summary: string;
  recorded_at: string;
};

export type PatternResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type PatternEvidence = Record<string, unknown> & {
  source_type?: PatternSourceType;
  id?: string;
};

export type PatternExplanation = {
  pattern: PatternRecord;
  observations: PatternObservation[];
  supportingMemories: PatternEvidence[];
  supportingEvents: PlatformEventRow[];
  supportingDecisions: PatternEvidence[];
  supportingOutcomes: PatternEvidence[];
};

export type PatternExport = {
  pattern: PatternRecord;
  observations: PatternObservation[];
  sources: PatternSource[];
  memories: PatternEvidence[];
  events: PlatformEventRow[];
  decisions: PatternEvidence[];
  outcomes: PatternEvidence[];
  lineage: PatternSource[];
};

export type PatternHealth = {
  candidateCount: number;
  validatedCount: number;
  deprecatedCount: number;
  archivedCount: number;
  averageObservationCount: number;
  lineageCoverage: number;
};
