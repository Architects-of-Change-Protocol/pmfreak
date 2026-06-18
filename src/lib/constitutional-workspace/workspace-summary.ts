// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Workspace — Summary Builders
//
// Builds workspace summaries from supplied artifact counts.
// No AI. No ML. No scoring. No ranking. No prediction.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WorkspaceMemoryRecord,
  WorkspacePatternRecord,
  WorkspaceEffectivenessRecord,
  WorkspaceBriefRecord,
  WorkspaceDashboardRecord,
  WorkspaceGovernanceArtifact,
  ConstitutionalWorkspaceSummary,
  WorkspaceKnowledgeSummary,
  WorkspaceEvidenceSummary,
  WorkspaceBriefSummary,
  WorkspaceDashboardSummary,
  WorkspaceGovernanceSummary,
} from "./types";
import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";

// ─── buildWorkspaceSummary ────────────────────────────────────────────────────

export function buildWorkspaceSummary(
  evidenceCount: number,
  memories: WorkspaceMemoryRecord[],
  patterns: WorkspacePatternRecord[],
  effectivenessRecords: WorkspaceEffectivenessRecord[],
  contextPackageCount: number,
  briefs: WorkspaceBriefRecord[],
  dashboards: WorkspaceDashboardRecord[],
  contradictions: ConstitutionalContradiction[],
  unknowns: ConstitutionalBriefUnknown[]
): ConstitutionalWorkspaceSummary {
  return {
    evidenceCount,
    memoryCount: memories.length,
    patternCount: patterns.length,
    effectivenessCount: effectivenessRecords.length,
    contextPackageCount,
    briefCount: briefs.length,
    dashboardCount: dashboards.length,
    contradictionCount: contradictions.length,
    unknownCount: unknowns.length,
  };
}

// ─── buildKnowledgeSummary ────────────────────────────────────────────────────

export function buildKnowledgeSummary(
  memories: WorkspaceMemoryRecord[],
  patterns: WorkspacePatternRecord[],
  effectivenessRecords: WorkspaceEffectivenessRecord[]
): WorkspaceKnowledgeSummary {
  const organizationalMemoryCount = memories.filter((m) => m.memoryType === "organizational").length;
  const personalMemoryCount = memories.filter((m) => m.memoryType === "personal").length;

  const organizationalPatternCount = patterns.filter((p) => p.patternType === "organizational").length;
  const personalPatternCount = patterns.filter((p) => p.patternType === "personal").length;

  const organizationalEffectivenessCount = effectivenessRecords.filter(
    (e) => e.effectivenessType === "organizational"
  ).length;
  const personalEffectivenessCount = effectivenessRecords.filter(
    (e) => e.effectivenessType === "personal"
  ).length;

  return {
    memoryCount: memories.length,
    organizationalMemoryCount,
    personalMemoryCount,
    patternCount: patterns.length,
    organizationalPatternCount,
    personalPatternCount,
    effectivenessCount: effectivenessRecords.length,
    organizationalEffectivenessCount,
    personalEffectivenessCount,
  };
}

// ─── buildEvidenceSummary ─────────────────────────────────────────────────────

export function buildEvidenceSummary(
  evidenceCount: number,
  contextPackageCount: number
): WorkspaceEvidenceSummary {
  return {
    evidenceCount,
    contextPackageCount,
  };
}

// ─── buildBriefSummary ────────────────────────────────────────────────────────

export function buildBriefSummary(
  briefs: WorkspaceBriefRecord[]
): WorkspaceBriefSummary {
  return {
    constitutionalBriefCount: briefs.filter((b) => b.briefType === "constitutional").length,
    executiveBriefCount: briefs.filter((b) => b.briefType === "executive").length,
    governanceBriefCount: briefs.filter((b) => b.briefType === "governance").length,
    operationalBriefCount: briefs.filter((b) => b.briefType === "operational").length,
    portfolioBriefCount: briefs.filter((b) => b.briefType === "portfolio").length,
  };
}

// ─── buildDashboardSummary ────────────────────────────────────────────────────

export function buildDashboardSummary(
  dashboards: WorkspaceDashboardRecord[]
): WorkspaceDashboardSummary {
  return {
    executiveDashboardCount: dashboards.filter((d) => d.dashboardType === "executive").length,
    governanceDashboardCount: dashboards.filter((d) => d.dashboardType === "governance").length,
    operationalDashboardCount: dashboards.filter((d) => d.dashboardType === "operational").length,
    portfolioDashboardCount: dashboards.filter((d) => d.dashboardType === "portfolio").length,
    workspaceDashboardCount: dashboards.filter((d) => d.dashboardType === "workspace").length,
    mixedDashboardCount: dashboards.filter((d) => d.dashboardType === "mixed").length,
  };
}

// ─── buildGovernanceSummary ───────────────────────────────────────────────────

export function buildGovernanceSummary(
  governanceArtifacts: WorkspaceGovernanceArtifact[]
): WorkspaceGovernanceSummary {
  return {
    authorityArtifactCount: governanceArtifacts.filter((a) => a.artifactType === "authority").length,
    delegationArtifactCount: governanceArtifacts.filter((a) => a.artifactType === "delegation").length,
    capabilityArtifactCount: governanceArtifacts.filter((a) => a.artifactType === "capability").length,
    trustArtifactCount: governanceArtifacts.filter((a) => a.artifactType === "trust").length,
    policyArtifactCount: governanceArtifacts.filter((a) => a.artifactType === "policy").length,
  };
}
