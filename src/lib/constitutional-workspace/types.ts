// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Workspace Foundation — TypeScript types
//
// Top-level constitutional container that organizes all constitutional artifacts
// belonging to a workspace. No AI. No ML. No embeddings. No scoring. No ranking.
// No prediction. Every artifact is traceable to evidence, context packages,
// briefs, dashboards, and lineage.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";

// ─── Workspace Artifact Record (generic identified artifact) ──────────────────

export type WorkspaceArtifactRecord = {
  id: string;
  [key: string]: unknown;
};

// ─── Memory Record ────────────────────────────────────────────────────────────

export type WorkspaceMemoryRecord = {
  id: string;
  memoryType: "organizational" | "personal";
  [key: string]: unknown;
};

// ─── Pattern Record ───────────────────────────────────────────────────────────

export type WorkspacePatternRecord = {
  id: string;
  patternType: "organizational" | "personal";
  [key: string]: unknown;
};

// ─── Effectiveness Record ─────────────────────────────────────────────────────

export type WorkspaceEffectivenessRecord = {
  id: string;
  effectivenessType: "organizational" | "personal";
  [key: string]: unknown;
};

// ─── Brief Record (constitutional, executive, governance, operational, portfolio) ──

export type WorkspaceBriefType =
  | "constitutional"
  | "executive"
  | "governance"
  | "operational"
  | "portfolio";

export const ALL_WORKSPACE_BRIEF_TYPES: WorkspaceBriefType[] = [
  "constitutional",
  "executive",
  "governance",
  "operational",
  "portfolio",
];

export type WorkspaceBriefRecord = {
  id: string;
  briefType: WorkspaceBriefType;
  contradictions?: ConstitutionalContradiction[];
  unknowns?: ConstitutionalBriefUnknown[];
  [key: string]: unknown;
};

// ─── Dashboard Record ─────────────────────────────────────────────────────────

export type WorkspaceDashboardType =
  | "executive"
  | "governance"
  | "operational"
  | "portfolio"
  | "workspace"
  | "mixed";

export const ALL_WORKSPACE_DASHBOARD_TYPES: WorkspaceDashboardType[] = [
  "executive",
  "governance",
  "operational",
  "portfolio",
  "workspace",
  "mixed",
];

export type WorkspaceDashboardRecord = {
  id: string;
  dashboardType: WorkspaceDashboardType;
  contradictions?: ConstitutionalContradiction[];
  unknowns?: ConstitutionalBriefUnknown[];
  [key: string]: unknown;
};

// ─── Governance Artifact Record ───────────────────────────────────────────────

export type WorkspaceGovernanceArtifactType =
  | "authority"
  | "delegation"
  | "capability"
  | "trust"
  | "policy";

export const ALL_GOVERNANCE_ARTIFACT_TYPES: WorkspaceGovernanceArtifactType[] = [
  "authority",
  "delegation",
  "capability",
  "trust",
  "policy",
];

export type WorkspaceGovernanceArtifact = {
  id: string;
  artifactType: WorkspaceGovernanceArtifactType;
  [key: string]: unknown;
};

// ─── Workspace Summary ────────────────────────────────────────────────────────

export type ConstitutionalWorkspaceSummary = {
  evidenceCount: number;
  memoryCount: number;
  patternCount: number;
  effectivenessCount: number;
  contextPackageCount: number;
  briefCount: number;
  dashboardCount: number;
  contradictionCount: number;
  unknownCount: number;
};

// ─── Knowledge Summary ────────────────────────────────────────────────────────

export type WorkspaceKnowledgeSummary = {
  memoryCount: number;
  organizationalMemoryCount: number;
  personalMemoryCount: number;
  patternCount: number;
  organizationalPatternCount: number;
  personalPatternCount: number;
  effectivenessCount: number;
  organizationalEffectivenessCount: number;
  personalEffectivenessCount: number;
};

// ─── Evidence Summary ─────────────────────────────────────────────────────────

export type WorkspaceEvidenceSummary = {
  evidenceCount: number;
  contextPackageCount: number;
};

// ─── Brief Summary ────────────────────────────────────────────────────────────

export type WorkspaceBriefSummary = {
  constitutionalBriefCount: number;
  executiveBriefCount: number;
  governanceBriefCount: number;
  operationalBriefCount: number;
  portfolioBriefCount: number;
};

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export type WorkspaceDashboardSummary = {
  executiveDashboardCount: number;
  governanceDashboardCount: number;
  operationalDashboardCount: number;
  portfolioDashboardCount: number;
  workspaceDashboardCount: number;
  mixedDashboardCount: number;
};

// ─── Governance Summary ───────────────────────────────────────────────────────

export type WorkspaceGovernanceSummary = {
  authorityArtifactCount: number;
  delegationArtifactCount: number;
  capabilityArtifactCount: number;
  trustArtifactCount: number;
  policyArtifactCount: number;
};

// ─── Lineage ──────────────────────────────────────────────────────────────────

export type WorkspaceLineage = {
  artifactType: string;
  artifactId: string;
  sourceType: string;
  sourceId: string;
  reasonIncluded: string;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type WorkspaceCoverageMetrics = {
  hasEvidence: boolean;
  hasMemories: boolean;
  hasPatterns: boolean;
  hasEffectivenessRecords: boolean;
  hasContextPackages: boolean;
  hasBriefs: boolean;
  hasDashboards: boolean;
  hasContradictions: boolean;
  hasUnknowns: boolean;
  hasGovernanceArtifacts: boolean;
};

// ─── Workspace Health ─────────────────────────────────────────────────────────

export type WorkspaceHealth = {
  evidenceCount: number;
  memoryCount: number;
  patternCount: number;
  effectivenessCount: number;
  briefCount: number;
  dashboardCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: WorkspaceCoverageMetrics;
};

// ─── Constitutional Workspace ─────────────────────────────────────────────────

export type ConstitutionalWorkspace = {
  id: string;
  workspaceId: string;
  generatedAt: string;
  workspaceSummary: ConstitutionalWorkspaceSummary;
  evidenceSummary: WorkspaceEvidenceSummary;
  knowledgeSummary: WorkspaceKnowledgeSummary;
  briefSummary: WorkspaceBriefSummary;
  dashboardSummary: WorkspaceDashboardSummary;
  governanceSummary: WorkspaceGovernanceSummary;
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  lineage: WorkspaceLineage[];
  metadata: Record<string, unknown>;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type ConstitutionalWorkspaceExport = {
  workspace: ConstitutionalWorkspace;
  summaries: {
    workspaceSummary: ConstitutionalWorkspaceSummary;
    evidenceSummary: WorkspaceEvidenceSummary;
    knowledgeSummary: WorkspaceKnowledgeSummary;
    briefSummary: WorkspaceBriefSummary;
    dashboardSummary: WorkspaceDashboardSummary;
    governanceSummary: WorkspaceGovernanceSummary;
  };
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  lineage: WorkspaceLineage[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type WorkspaceArtifactReason = {
  artifactType: string;
  artifactId: string;
  reason: string;
};

export type ConstitutionalWorkspaceExplanation = {
  workspace: ConstitutionalWorkspace;
  workspaceSummary: ConstitutionalWorkspaceSummary;
  artifactReasons: WorkspaceArtifactReason[];
  lineage: WorkspaceLineage[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type WorkspaceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type ConstitutionalWorkspaceEventType =
  | "CONSTITUTIONAL_WORKSPACE_GENERATED"
  | "CONSTITUTIONAL_WORKSPACE_EXPLAINED"
  | "CONSTITUTIONAL_WORKSPACE_EXPORTED";
