import type { PlatformEventRow } from "@/lib/platform-events";

// ─── Category ─────────────────────────────────────────────────────────────────

export type PersonalPatternCategory =
  | "decision_pattern"
  | "risk_response_pattern"
  | "stakeholder_management_pattern"
  | "communication_pattern"
  | "execution_pattern"
  | "planning_pattern"
  | "escalation_pattern"
  | "governance_pattern"
  | "delivery_pattern"
  | "approval_pattern"
  | "follow_up_pattern"
  | "dependency_resolution_pattern"
  | "other";

// ─── Status ───────────────────────────────────────────────────────────────────

export type PersonalPatternStatus = "active" | "archived" | "frozen" | "deprecated";

// ─── Confidence ───────────────────────────────────────────────────────────────

export type PersonalPatternConfidence = "low" | "medium" | "high" | "very_high";

// ─── Source types ─────────────────────────────────────────────────────────────

export type PersonalPatternSourceType =
  | "platform_event"
  | "decision"
  | "decision_effectiveness"
  | "organizational_pattern"
  | "organizational_memory"
  | "personal_memory"
  | "outcome"
  | "risk"
  | "task"
  | "milestone"
  | "stakeholder";

export type PersonalPatternSourceRelationship =
  | "supports"
  | "contradicts"
  | "caused_by"
  | "derived_from"
  | "reviewed_during"
  | "supersedes"
  | "related_to";

// ─── Audit event types ────────────────────────────────────────────────────────

export type PersonalPatternEventType =
  | "PERSONAL_PATTERN_CREATED"
  | "PERSONAL_PATTERN_UPDATED"
  | "PERSONAL_PATTERN_FROZEN"
  | "PERSONAL_PATTERN_ARCHIVED"
  | "PERSONAL_PATTERN_DEPRECATED"
  | "PERSONAL_PATTERN_DELETED"
  | "PERSONAL_PATTERN_OBSERVATION_RECORDED";

// ─── Capability vocabulary ────────────────────────────────────────────────────

export const PERSONAL_PATTERN_CAPABILITIES = [
  "PERSONAL_PATTERN_CREATE",
  "PERSONAL_PATTERN_UPDATE",
  "PERSONAL_PATTERN_INSPECT",
  "PERSONAL_PATTERN_EXPORT",
  "PERSONAL_PATTERN_FREEZE",
  "PERSONAL_PATTERN_ARCHIVE",
  "PERSONAL_PATTERN_DELETE",
  "PERSONAL_PATTERN_OBSERVE",
] as const;

export type PersonalPatternCapability = (typeof PERSONAL_PATTERN_CAPABILITIES)[number];

// ─── Database row types ───────────────────────────────────────────────────────

export type PersonalPatternRecord = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  pattern_category: PersonalPatternCategory;
  title: string;
  summary: string;
  confidence: PersonalPatternConfidence;
  status: PersonalPatternStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type PersonalPatternSource = {
  id: string;
  pattern_id: string;
  source_type: PersonalPatternSourceType;
  source_id: string;
  relationship_type: PersonalPatternSourceRelationship;
  created_at: string;
};

export type PersonalPatternObservation = {
  id: string;
  pattern_id: string;
  observation_summary: string;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
};

// ─── Composite types ───────────────────────────────────────────────────────────

export type PersonalPatternEvidence = Record<string, unknown> & { id?: string };

export type PersonalPatternExplanation = {
  pattern: PersonalPatternRecord;
  observations: PersonalPatternObservation[];
  sources: PersonalPatternSource[];
  supportingEvents: PlatformEventRow[];
  supportingDecisions: PersonalPatternEvidence[];
  supportingDecisionEffectiveness: PersonalPatternEvidence[];
  supportingOrganizationalPatterns: PersonalPatternEvidence[];
  supportingOrganizationalMemory: PersonalPatternEvidence[];
  supportingPersonalMemory: PersonalPatternEvidence[];
  supportingOutcomes: PersonalPatternEvidence[];
  unresolvedSources: PersonalPatternSource[];
};

export type PersonalPatternLineage = {
  pattern: PersonalPatternRecord;
  observations: PersonalPatternObservation[];
  sources: PersonalPatternSource[];
  events: PlatformEventRow[];
  decisions: PersonalPatternEvidence[];
  decisionEffectiveness: PersonalPatternEvidence[];
  organizationalPatterns: PersonalPatternEvidence[];
  organizationalMemory: PersonalPatternEvidence[];
  personalMemory: PersonalPatternEvidence[];
  outcomes: PersonalPatternEvidence[];
  unresolvedSources: PersonalPatternSource[];
  timeline: string;
};

export type PersonalPatternExport = {
  pattern: PersonalPatternRecord;
  observations: PersonalPatternObservation[];
  sources: PersonalPatternSource[];
  lineage: PersonalPatternLineage;
  unresolvedSources: PersonalPatternSource[];
  exportedAt: string;
};

export type PersonalPatternHealth = {
  activeCount: number;
  archivedCount: number;
  frozenCount: number;
  deprecatedCount: number;
  observationCount: number;
  sourceCoverage: number;
  lineageCoverage: number;
};

// ─── Result type ──────────────────────────────────────────────────────────────

export type PersonalPatternResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };
