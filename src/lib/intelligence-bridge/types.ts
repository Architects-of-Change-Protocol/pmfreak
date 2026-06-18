// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Bridge — TypeScript types
//
// Explicit, auditable bridge records connecting personal PM intelligence
// to organizational intelligence without AI, scoring, profiling, ranking,
// or cross-PM leakage.
// ─────────────────────────────────────────────────────────────────────────────

export type IntelligenceBridgeRelationshipType =
  | "personal_pattern_supports_org_pattern"
  | "personal_pattern_contradicts_org_pattern"
  | "personal_effectiveness_supports_org_effectiveness"
  | "personal_effectiveness_contradicts_org_effectiveness"
  | "personal_memory_supports_org_memory"
  | "personal_memory_contradicts_org_memory"
  | "personal_candidate_supports_org_candidate"
  | "personal_candidate_contradicts_org_candidate"
  | "org_pattern_contextualizes_personal_pattern"
  | "org_memory_contextualizes_personal_memory"
  | "org_effectiveness_contextualizes_personal_effectiveness"
  | "shared_evidence"
  | "related_to";

export type IntelligenceBridgePersonalSourceType =
  | "personal_memory"
  | "personal_pattern"
  | "personal_effectiveness"
  | "personal_pattern_candidate"
  | "personal_event";

export type IntelligenceBridgeOrganizationalSourceType =
  | "organizational_memory"
  | "organizational_pattern"
  | "decision_effectiveness"
  | "pattern_candidate"
  | "platform_event"
  | "decision"
  | "outcome";

export type IntelligenceBridgeStatus = "active" | "archived" | "frozen" | "deprecated";

export type IntelligenceBridgeSourceRelationshipType =
  | "supports"
  | "contradicts"
  | "derived_from"
  | "reviewed_during"
  | "contextualizes"
  | "related_to";

export type IntelligenceBridgeCapability =
  | "INTELLIGENCE_BRIDGE_CREATE"
  | "INTELLIGENCE_BRIDGE_UPDATE"
  | "INTELLIGENCE_BRIDGE_INSPECT"
  | "INTELLIGENCE_BRIDGE_EXPORT"
  | "INTELLIGENCE_BRIDGE_FREEZE"
  | "INTELLIGENCE_BRIDGE_ARCHIVE"
  | "INTELLIGENCE_BRIDGE_DELETE"
  | "INTELLIGENCE_BRIDGE_OBSERVE";

export type IntelligenceBridgeRecord = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  relationship_type: IntelligenceBridgeRelationshipType;
  status: IntelligenceBridgeStatus;
  personal_source_type: IntelligenceBridgePersonalSourceType;
  personal_source_id: string;
  organizational_source_type: IntelligenceBridgeOrganizationalSourceType;
  organizational_source_id: string;
  summary: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type IntelligenceBridgeSource = {
  id: string;
  bridge_id: string;
  source_type: IntelligenceBridgePersonalSourceType | IntelligenceBridgeOrganizationalSourceType;
  source_id: string;
  relationship_type: IntelligenceBridgeSourceRelationshipType;
  created_at: string;
};

export type IntelligenceBridgeObservation = {
  id: string;
  bridge_id: string;
  observation_summary: string;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
};

export type UnresolvedBridgeSource = {
  sourceType: string;
  sourceId: string;
  reason: string;
};

export type IntelligenceBridgeTimelineEvent = {
  occurredAt: string;
  eventType: string;
  description: string;
  referenceId: string | null;
};

export type IntelligenceBridgeExplanation = {
  bridge: IntelligenceBridgeRecord;
  observations: IntelligenceBridgeObservation[];
  sources: IntelligenceBridgeSource[];
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  personalEffectiveness: Record<string, unknown>[];
  personalPatternCandidates: Record<string, unknown>[];
  organizationalMemory: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  patternCandidates: Record<string, unknown>[];
  events: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  outcomes: Record<string, unknown>[];
  unresolvedSources: UnresolvedBridgeSource[];
};

export type IntelligenceBridgeLineage = {
  bridge: IntelligenceBridgeRecord;
  observations: IntelligenceBridgeObservation[];
  sources: IntelligenceBridgeSource[];
  personalSide: {
    sourceType: IntelligenceBridgePersonalSourceType;
    sourceId: string;
    resolved: boolean;
    record: Record<string, unknown> | null;
  };
  organizationalSide: {
    sourceType: IntelligenceBridgeOrganizationalSourceType;
    sourceId: string;
    resolved: boolean;
    record: Record<string, unknown> | null;
  };
  supportingEvidence: Record<string, unknown>[];
  unresolvedSources: UnresolvedBridgeSource[];
  timeline: IntelligenceBridgeTimelineEvent[];
};

export type IntelligenceBridgeExport = {
  bridge: IntelligenceBridgeRecord;
  observations: IntelligenceBridgeObservation[];
  sources: IntelligenceBridgeSource[];
  lineage: IntelligenceBridgeLineage;
  unresolvedSources: UnresolvedBridgeSource[];
  exportedAt: string;
};

export type IntelligenceBridgeHealth = {
  activeCount: number;
  archivedCount: number;
  frozenCount: number;
  deprecatedCount: number;
  observationCount: number;
  sourceCoverage: number;
  lineageCoverage: number;
  relationshipTypeCounts: Record<IntelligenceBridgeRelationshipType, number>;
};

export type BridgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Vocabulary constants ─────────────────────────────────────────────────────

export const ALLOWED_RELATIONSHIP_TYPES: IntelligenceBridgeRelationshipType[] = [
  "personal_pattern_supports_org_pattern",
  "personal_pattern_contradicts_org_pattern",
  "personal_effectiveness_supports_org_effectiveness",
  "personal_effectiveness_contradicts_org_effectiveness",
  "personal_memory_supports_org_memory",
  "personal_memory_contradicts_org_memory",
  "personal_candidate_supports_org_candidate",
  "personal_candidate_contradicts_org_candidate",
  "org_pattern_contextualizes_personal_pattern",
  "org_memory_contextualizes_personal_memory",
  "org_effectiveness_contextualizes_personal_effectiveness",
  "shared_evidence",
  "related_to",
];

export const ALLOWED_PERSONAL_SOURCE_TYPES: IntelligenceBridgePersonalSourceType[] = [
  "personal_memory",
  "personal_pattern",
  "personal_effectiveness",
  "personal_pattern_candidate",
  "personal_event",
];

export const ALLOWED_ORGANIZATIONAL_SOURCE_TYPES: IntelligenceBridgeOrganizationalSourceType[] = [
  "organizational_memory",
  "organizational_pattern",
  "decision_effectiveness",
  "pattern_candidate",
  "platform_event",
  "decision",
  "outcome",
];

export const ALLOWED_BRIDGE_STATUSES: IntelligenceBridgeStatus[] = [
  "active",
  "archived",
  "frozen",
  "deprecated",
];

export const INTELLIGENCE_BRIDGE_CAPABILITIES: Record<IntelligenceBridgeCapability, IntelligenceBridgeCapability> = {
  INTELLIGENCE_BRIDGE_CREATE:  "INTELLIGENCE_BRIDGE_CREATE",
  INTELLIGENCE_BRIDGE_UPDATE:  "INTELLIGENCE_BRIDGE_UPDATE",
  INTELLIGENCE_BRIDGE_INSPECT: "INTELLIGENCE_BRIDGE_INSPECT",
  INTELLIGENCE_BRIDGE_EXPORT:  "INTELLIGENCE_BRIDGE_EXPORT",
  INTELLIGENCE_BRIDGE_FREEZE:  "INTELLIGENCE_BRIDGE_FREEZE",
  INTELLIGENCE_BRIDGE_ARCHIVE: "INTELLIGENCE_BRIDGE_ARCHIVE",
  INTELLIGENCE_BRIDGE_DELETE:  "INTELLIGENCE_BRIDGE_DELETE",
  INTELLIGENCE_BRIDGE_OBSERVE: "INTELLIGENCE_BRIDGE_OBSERVE",
};
