// ─────────────────────────────────────────────────────────────────────────────
// Execution Augmentation Layer — TypeScript types
//
// Provides deterministic constitutional context augmentation for operational
// execution artifacts. No AI. No ML. No embeddings. No scoring. No ranking.
// No prediction. No recommendations. No autonomous reasoning.
//
// Every augmentation is traceable to evidence, memory, patterns, effectiveness,
// context packages, briefs, dashboards, and workspace lineage.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";

// ─── Supported Artifact Types ──────────────────────────────────────────────

export type ExecutionArtifactType =
  | "task"
  | "decision"
  | "milestone"
  | "dependency"
  | "risk"
  | "blocker"
  | "escalation"
  | "stakeholder"
  | "project"
  | "portfolio";

export const ALL_EXECUTION_ARTIFACT_TYPES: ExecutionArtifactType[] = [
  "task",
  "decision",
  "milestone",
  "dependency",
  "risk",
  "blocker",
  "escalation",
  "stakeholder",
  "project",
  "portfolio",
];

// ─── Augmentation Artifact ─────────────────────────────────────────────────
// Each constitutional artifact included in an augmentation must carry an
// explicit reasonIncluded — never inferred, never guessed.

export type AugmentationArtifact = {
  artifactType: string;
  artifactId: string;
  title: string;
  summary: string;
  reasonIncluded: string;
  evidenceCount: number;
  lineage: AugmentationLineageEntry[];
};

// ─── Lineage Entry ─────────────────────────────────────────────────────────

export type AugmentationLineageEntry = {
  recordType: string;
  recordId: string;
  relationship: string;
  resolvedAt: string;
};

// ─── Execution Augmentation ────────────────────────────────────────────────

export type ExecutionAugmentation = {
  id: string;
  workspaceId: string;
  artifactType: ExecutionArtifactType;
  artifactId: string;
  generatedAt: string;
  contextArtifacts: AugmentationArtifact[];
  evidenceArtifacts: AugmentationArtifact[];
  memoryArtifacts: AugmentationArtifact[];
  patternArtifacts: AugmentationArtifact[];
  effectivenessArtifacts: AugmentationArtifact[];
  briefArtifacts: AugmentationArtifact[];
  dashboardArtifacts: AugmentationArtifact[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  lineage: AugmentationLineageEntry[];
  metadata: Record<string, unknown>;
};

// ─── Available Artifacts (input to builders) ───────────────────────────────

export type AvailableArtifacts = {
  evidence?: Record<string, unknown>[];
  memories?: Record<string, unknown>[];
  patterns?: Record<string, unknown>[];
  effectivenessRecords?: Record<string, unknown>[];
  briefs?: Record<string, unknown>[];
  dashboards?: Record<string, unknown>[];
  contradictions?: ConstitutionalContradiction[];
  unknowns?: ConstitutionalBriefUnknown[];
  lineage?: AugmentationLineageEntry[];
  metadata?: Record<string, unknown>;
};

// ─── Export ────────────────────────────────────────────────────────────────

export type ExecutionAugmentationExport = {
  augmentation: ExecutionAugmentation;
  artifacts: AugmentationArtifact[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  lineage: AugmentationLineageEntry[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ───────────────────────────────────────────────────────────

export type AugmentationArtifactReason = {
  artifactType: string;
  artifactId: string;
  reasonIncluded: string;
};

export type ExecutionAugmentationExplanation = {
  augmentation: ExecutionAugmentation;
  artifactReasons: AugmentationArtifactReason[];
  lineage: AugmentationLineageEntry[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Health ────────────────────────────────────────────────────────────────

export type AugmentationHealth = {
  artifactCount: number;
  evidenceCount: number;
  memoryCount: number;
  patternCount: number;
  effectivenessCount: number;
  briefCount: number;
  dashboardCount: number;
  contradictionCount: number;
  unknownCount: number;
};

// ─── Result ────────────────────────────────────────────────────────────────

export type AugmentationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ─────────────────────────────────────────────────────

export type ExecutionAugmentationEventType =
  | "EXECUTION_AUGMENTATION_GENERATED"
  | "EXECUTION_AUGMENTATION_EXPLAINED"
  | "EXECUTION_AUGMENTATION_EXPORTED";
