import type { PlatformEventRow } from "@/lib/platform-events";

export type MemoryScope = "workspace" | "project" | "team";
export type MemoryCategory =
  | "risk_pattern"
  | "decision_pattern"
  | "stakeholder_pattern"
  | "schedule_pattern"
  | "delivery_pattern"
  | "dependency_pattern"
  | "resource_pattern"
  | "governance_pattern"
  | "execution_pattern"
  | "other";
export type MemoryConfidence = "low" | "medium" | "high" | "very_high";
export type MemoryStatus = "active" | "archived" | "frozen" | "deprecated";
export type MemorySourceType = "platform_event" | "decision" | "outcome" | "risk" | "task" | "milestone" | "dependency" | "stakeholder" | "recommendation";
export type MemorySourceRelationship = "supports" | "contradicts" | "caused_by" | "derived_from" | "reviewed_during" | "supersedes" | "related_to";
export type MemoryEventType = "MEMORY_CREATED" | "MEMORY_UPDATED" | "MEMORY_FROZEN" | "MEMORY_ARCHIVED" | "MEMORY_DEPRECATED" | "MEMORY_DELETED";
export const MEMORY_CAPABILITIES = [
  "MEMORY_CREATE",
  "MEMORY_UPDATE",
  "MEMORY_FREEZE",
  "MEMORY_ARCHIVE",
  "MEMORY_DEPRECATE",
  "MEMORY_DELETE",
  "MEMORY_INSPECT",
  "MEMORY_EXPORT",
] as const;
export type MemoryCapability = (typeof MEMORY_CAPABILITIES)[number];


export type MemoryEntry = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  memory_scope: MemoryScope;
  memory_category: MemoryCategory;
  title: string;
  summary: string;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type MemorySource = {
  id: string;
  memory_id: string;
  source_type: MemorySourceType;
  source_id: string;
  relationship_type: MemorySourceRelationship;
  created_at: string;
};

export type MemoryResult<T> = { ok: true; data: T } | { ok: false; error: string; failureClass: string };
export type MemoryEvidence = Record<string, unknown> & { source_type?: MemorySourceType; id?: string };
export type MemoryExplanation = { memory: MemoryEntry; supportingEvidence: MemorySource[]; supportingEvents: PlatformEventRow[]; supportingDecisions: MemoryEvidence[]; supportingOutcomes: MemoryEvidence[]; unresolvedSources: MemorySource[] };
export type MemoryInspection = { memory: MemoryEntry; lineage: MemorySource[]; confidence: MemoryConfidence; sources: MemorySource[]; unresolvedSources: MemorySource[]; timeline: Array<MemorySource | PlatformEventRow> };
export type MemoryExport = { memory: MemoryEntry; sources: MemorySource[]; events: PlatformEventRow[]; decisions: MemoryEvidence[]; outcomes: MemoryEvidence[]; lineage: MemorySource[]; unresolvedSources: MemorySource[] };
export type MemoryHealth = { activeCount: number; frozenCount: number; archivedCount: number; deprecatedCount: number; sourceCoverage: number; lineageCoverage: number };
