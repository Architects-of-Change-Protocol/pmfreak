import type { PlatformEventRow } from "@/lib/platform-events";

export type PersonalEffectivenessOutcomeClassification =
  | "success"
  | "partial_success"
  | "failure"
  | "unknown";

export type PersonalEffectivenessStatus =
  | "candidate"
  | "validated"
  | "archived"
  | "deprecated";

export type PersonalEffectivenessSourceType =
  | "platform_event"
  | "decision"
  | "decision_effectiveness"
  | "organizational_pattern"
  | "organizational_memory"
  | "personal_memory"
  | "personal_pattern"
  | "outcome"
  | "risk"
  | "task"
  | "milestone"
  | "stakeholder";

export type PersonalEffectivenessRelationshipType =
  | "supports"
  | "contradicts"
  | "caused_by"
  | "derived_from"
  | "reviewed_during"
  | "supersedes"
  | "related_to";

export type PersonalEffectivenessEventType =
  | "PERSONAL_EFFECTIVENESS_CREATED"
  | "PERSONAL_EFFECTIVENESS_UPDATED"
  | "PERSONAL_EFFECTIVENESS_VALIDATED"
  | "PERSONAL_EFFECTIVENESS_ARCHIVED"
  | "PERSONAL_EFFECTIVENESS_DEPRECATED"
  | "PERSONAL_EFFECTIVENESS_DELETED"
  | "PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED";

export const PERSONAL_EFFECTIVENESS_CAPABILITIES = [
  "PERSONAL_EFFECTIVENESS_CREATE",
  "PERSONAL_EFFECTIVENESS_UPDATE",
  "PERSONAL_EFFECTIVENESS_VALIDATE",
  "PERSONAL_EFFECTIVENESS_INSPECT",
  "PERSONAL_EFFECTIVENESS_EXPORT",
  "PERSONAL_EFFECTIVENESS_ARCHIVE",
  "PERSONAL_EFFECTIVENESS_DELETE",
  "PERSONAL_EFFECTIVENESS_OBSERVE",
] as const;
export type PersonalEffectivenessCapability =
  (typeof PERSONAL_EFFECTIVENESS_CAPABILITIES)[number];

export type PersonalEffectivenessRecord = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  personal_pattern_id: string | null;
  personal_memory_id: string | null;
  decision_id: string | null;
  decision_effectiveness_id: string | null;
  outcome_classification: PersonalEffectivenessOutcomeClassification;
  effectiveness_status: PersonalEffectivenessStatus;
  summary: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type PersonalEffectivenessSource = {
  id: string;
  effectiveness_id: string;
  source_type: PersonalEffectivenessSourceType;
  source_id: string;
  relationship_type: PersonalEffectivenessRelationshipType;
  created_at: string;
};

export type PersonalEffectivenessObservation = {
  id: string;
  effectiveness_id: string;
  observation_summary: string;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
};

export type PersonalEffectivenessResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type PersonalEffectivenessExplanation = {
  effectiveness: PersonalEffectivenessRecord;
  observations: PersonalEffectivenessObservation[];
  sources: PersonalEffectivenessSource[];
  supportingEvents: PlatformEventRow[];
  supportingDecisions: Record<string, unknown>[];
  supportingDecisionEffectiveness: Record<string, unknown>[];
  supportingOrganizationalPatterns: Record<string, unknown>[];
  supportingOrganizationalMemory: Record<string, unknown>[];
  supportingPersonalMemory: Record<string, unknown>[];
  supportingPersonalPatterns: Record<string, unknown>[];
  supportingOutcomes: Record<string, unknown>[];
  unresolvedSources: PersonalEffectivenessSource[];
};

export type PersonalEffectivenessLineage = {
  effectiveness: PersonalEffectivenessRecord;
  observations: PersonalEffectivenessObservation[];
  sources: PersonalEffectivenessSource[];
  events: PlatformEventRow[];
  decisions: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  organizationalMemory: Record<string, unknown>[];
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  outcomes: Record<string, unknown>[];
  unresolvedSources: PersonalEffectivenessSource[];
  timeline: string;
};

export type PersonalEffectivenessExport = {
  effectiveness: PersonalEffectivenessRecord;
  observations: PersonalEffectivenessObservation[];
  sources: PersonalEffectivenessSource[];
  lineage: PersonalEffectivenessLineage;
  unresolvedSources: PersonalEffectivenessSource[];
};

export type PersonalEffectivenessHealth = {
  candidateCount: number;
  validatedCount: number;
  archivedCount: number;
  deprecatedCount: number;
  observationCount: number;
  sourceCoverage: number;
  lineageCoverage: number;
  successCount: number;
  partialSuccessCount: number;
  failureCount: number;
  unknownCount: number;
};
