import type { PlatformEventRow } from "@/lib/platform-events";

// ─── Category ─────────────────────────────────────────────────────────────────

export type PersonalMemoryCategory =
  | "decision_behavior"
  | "risk_behavior"
  | "stakeholder_behavior"
  | "communication_behavior"
  | "execution_behavior"
  | "planning_behavior"
  | "escalation_behavior"
  | "governance_behavior"
  | "delivery_behavior"
  | "leadership_behavior"
  | "other";

// ─── Status ───────────────────────────────────────────────────────────────────

export type PersonalMemoryStatus = "active" | "archived" | "frozen" | "deprecated";

// ─── Confidence ───────────────────────────────────────────────────────────────

export type PersonalMemoryConfidence = "low" | "medium" | "high" | "very_high";

// ─── Source types ─────────────────────────────────────────────────────────────

export type PersonalMemorySourceType =
  | "platform_event"
  | "decision"
  | "decision_effectiveness"
  | "organizational_pattern"
  | "organizational_memory"
  | "outcome"
  | "risk"
  | "task"
  | "milestone"
  | "stakeholder";

export type PersonalMemorySourceRelationship =
  | "supports"
  | "contradicts"
  | "caused_by"
  | "derived_from"
  | "reviewed_during"
  | "supersedes"
  | "related_to";

// ─── Audit event types ────────────────────────────────────────────────────────

export type PersonalMemoryEventType =
  | "PERSONAL_MEMORY_CREATED"
  | "PERSONAL_MEMORY_UPDATED"
  | "PERSONAL_MEMORY_FROZEN"
  | "PERSONAL_MEMORY_ARCHIVED"
  | "PERSONAL_MEMORY_DEPRECATED"
  | "PERSONAL_MEMORY_DELETED"
  | "PERSONAL_MEMORY_OBSERVATION_RECORDED";

// ─── Capability vocabulary ────────────────────────────────────────────────────

export const PERSONAL_MEMORY_CAPABILITIES = [
  "PERSONAL_MEMORY_CREATE",
  "PERSONAL_MEMORY_UPDATE",
  "PERSONAL_MEMORY_INSPECT",
  "PERSONAL_MEMORY_EXPORT",
  "PERSONAL_MEMORY_FREEZE",
  "PERSONAL_MEMORY_ARCHIVE",
  "PERSONAL_MEMORY_DELETE",
] as const;

export type PersonalMemoryCapability = (typeof PERSONAL_MEMORY_CAPABILITIES)[number];

// ─── Database rows ─────────────────────────────────────────────────────────────

export type PersonalMemoryRecord = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  memory_category: PersonalMemoryCategory;
  title: string;
  summary: string;
  confidence: PersonalMemoryConfidence;
  status: PersonalMemoryStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type PersonalMemorySource = {
  id: string;
  memory_id: string;
  source_type: PersonalMemorySourceType;
  source_id: string;
  relationship_type: PersonalMemorySourceRelationship;
  created_at: string;
};

export type PersonalMemoryObservation = {
  id: string;
  memory_id: string;
  observation_summary: string;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
};

// ─── Composite types ───────────────────────────────────────────────────────────

export type PersonalMemoryEvidence = Record<string, unknown> & { id?: string };

export type PersonalMemoryExplanation = {
  memory: PersonalMemoryRecord;
  observations: PersonalMemoryObservation[];
  supportingEvents: PlatformEventRow[];
  supportingDecisions: PersonalMemoryEvidence[];
  supportingOutcomes: PersonalMemoryEvidence[];
  supportingPatterns: PersonalMemoryEvidence[];
  supportingEffectiveness: PersonalMemoryEvidence[];
  sources: PersonalMemorySource[];
};

export type PersonalMemoryLineage = {
  memory: PersonalMemoryRecord;
  observations: PersonalMemoryObservation[];
  sources: PersonalMemorySource[];
  events: PlatformEventRow[];
  decisions: PersonalMemoryEvidence[];
  outcomes: PersonalMemoryEvidence[];
  patterns: PersonalMemoryEvidence[];
  effectiveness: PersonalMemoryEvidence[];
};

export type PersonalMemoryExport = {
  memory: PersonalMemoryRecord;
  observations: PersonalMemoryObservation[];
  sources: PersonalMemorySource[];
  lineage: PersonalMemoryLineage;
  exportedAt: string;
};

export type PersonalMemoryHealth = {
  activeCount: number;
  archivedCount: number;
  frozenCount: number;
  deprecatedCount: number;
  observationCount: number;
  sourceCoverage: number;
  lineageCoverage: number;
};

// ─── Result type ──────────────────────────────────────────────────────────────

export type PersonalMemoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };
