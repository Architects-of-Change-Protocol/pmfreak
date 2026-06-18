// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Workspace — Builder
//
// Organizes existing constitutional artifacts into a ConstitutionalWorkspace.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every artifact in the workspace is traceable to supplied inputs.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";
import {
  buildWorkspaceSummary,
  buildKnowledgeSummary,
  buildEvidenceSummary,
  buildBriefSummary,
  buildDashboardSummary,
  buildGovernanceSummary,
} from "./workspace-summary";
import type {
  ConstitutionalWorkspace,
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
  WorkspacePatternRecord,
  WorkspaceEffectivenessRecord,
  WorkspaceBriefRecord,
  WorkspaceDashboardRecord,
  WorkspaceGovernanceArtifact,
  WorkspaceLineage,
  WorkspaceHealth,
  WorkspaceCoverageMetrics,
  WorkspaceResult,
  ConstitutionalWorkspaceExplanation,
  WorkspaceArtifactReason,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function workspaceId(workspaceId: string, generatedAt: string): string {
  return `constitutional-workspace:${workspaceId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitWorkspaceEvent(
  wsId: string,
  actorId: string | null,
  eventType: string,
  refId: string,
  correlationId: string | null,
  causationId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId: wsId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? refId,
    causationId,
    rawReferenceTable: "constitutional_workspace",
    rawReferenceId: refId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── Lineage builders ─────────────────────────────────────────────────────────

function buildEvidenceLineage(evidence: WorkspaceArtifactRecord[]): WorkspaceLineage[] {
  return evidence.map((e) => ({
    artifactType: "evidence",
    artifactId: e.id,
    sourceType: "evidence",
    sourceId: e.id,
    reasonIncluded: "Supplied as evidence artifact to the workspace.",
  }));
}

function buildMemoryLineage(memories: WorkspaceMemoryRecord[]): WorkspaceLineage[] {
  return memories.map((m) => ({
    artifactType: "memory",
    artifactId: m.id,
    sourceType: m.memoryType === "organizational" ? "organizational_memory" : "personal_memory",
    sourceId: m.id,
    reasonIncluded: `Supplied as ${m.memoryType} memory artifact to the workspace.`,
  }));
}

function buildPatternLineage(patterns: WorkspacePatternRecord[]): WorkspaceLineage[] {
  return patterns.map((p) => ({
    artifactType: "pattern",
    artifactId: p.id,
    sourceType: p.patternType === "organizational" ? "organizational_pattern" : "personal_pattern",
    sourceId: p.id,
    reasonIncluded: `Supplied as ${p.patternType} pattern artifact to the workspace.`,
  }));
}

function buildEffectivenessLineage(
  effectivenessRecords: WorkspaceEffectivenessRecord[]
): WorkspaceLineage[] {
  return effectivenessRecords.map((e) => ({
    artifactType: "effectiveness",
    artifactId: e.id,
    sourceType:
      e.effectivenessType === "organizational"
        ? "organizational_effectiveness"
        : "personal_effectiveness",
    sourceId: e.id,
    reasonIncluded: `Supplied as ${e.effectivenessType} effectiveness artifact to the workspace.`,
  }));
}

function buildContextPackageLineage(contextPackages: WorkspaceArtifactRecord[]): WorkspaceLineage[] {
  return contextPackages.map((c) => ({
    artifactType: "context_package",
    artifactId: c.id,
    sourceType: "context_package",
    sourceId: c.id,
    reasonIncluded: "Supplied as context package artifact to the workspace.",
  }));
}

function buildBriefLineage(briefs: WorkspaceBriefRecord[]): WorkspaceLineage[] {
  return briefs.map((b) => ({
    artifactType: "brief",
    artifactId: b.id,
    sourceType: `${b.briefType}_brief`,
    sourceId: b.id,
    reasonIncluded: `Supplied as ${b.briefType} brief artifact to the workspace.`,
  }));
}

function buildDashboardLineage(dashboards: WorkspaceDashboardRecord[]): WorkspaceLineage[] {
  return dashboards.map((d) => ({
    artifactType: "dashboard",
    artifactId: d.id,
    sourceType: `${d.dashboardType}_dashboard`,
    sourceId: d.id,
    reasonIncluded: `Supplied as ${d.dashboardType} dashboard artifact to the workspace.`,
  }));
}

function buildGovernanceLineage(
  governanceArtifacts: WorkspaceGovernanceArtifact[]
): WorkspaceLineage[] {
  return governanceArtifacts.map((g) => ({
    artifactType: "governance",
    artifactId: g.id,
    sourceType: `governance_${g.artifactType}`,
    sourceId: g.id,
    reasonIncluded: `Supplied as governance ${g.artifactType} artifact to the workspace.`,
  }));
}

// ─── Contradiction / unknown collection ──────────────────────────────────────

function collectContradictions(
  briefs: WorkspaceBriefRecord[],
  dashboards: WorkspaceDashboardRecord[]
): ConstitutionalContradiction[] {
  const fromBriefs = briefs.flatMap((b) => b.contradictions ?? []);
  const fromDashboards = dashboards.flatMap((d) => d.contradictions ?? []);
  return [...fromBriefs, ...fromDashboards];
}

function collectUnknowns(
  briefs: WorkspaceBriefRecord[],
  dashboards: WorkspaceDashboardRecord[]
): ConstitutionalBriefUnknown[] {
  const fromBriefs = briefs.flatMap((b) => b.unknowns ?? []);
  const fromDashboards = dashboards.flatMap((d) => d.unknowns ?? []);
  return [...fromBriefs, ...fromDashboards];
}

// ─── buildConstitutionalWorkspace ─────────────────────────────────────────────

export async function buildConstitutionalWorkspace(
  wsId: string,
  evidence: WorkspaceArtifactRecord[],
  memories: WorkspaceMemoryRecord[],
  patterns: WorkspacePatternRecord[],
  effectivenessRecords: WorkspaceEffectivenessRecord[],
  contextPackages: WorkspaceArtifactRecord[],
  briefs: WorkspaceBriefRecord[],
  dashboards: WorkspaceDashboardRecord[],
  governanceArtifacts: WorkspaceGovernanceArtifact[] = [],
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<WorkspaceResult<ConstitutionalWorkspace>> {
  const generatedAt = new Date().toISOString();
  const id = workspaceId(wsId, generatedAt);

  const contradictions = collectContradictions(briefs, dashboards);
  const unknowns = collectUnknowns(briefs, dashboards);

  const lineage: WorkspaceLineage[] = [
    ...buildEvidenceLineage(evidence),
    ...buildMemoryLineage(memories),
    ...buildPatternLineage(patterns),
    ...buildEffectivenessLineage(effectivenessRecords),
    ...buildContextPackageLineage(contextPackages),
    ...buildBriefLineage(briefs),
    ...buildDashboardLineage(dashboards),
    ...buildGovernanceLineage(governanceArtifacts),
  ];

  const workspaceSummary = buildWorkspaceSummary(
    evidence.length,
    memories,
    patterns,
    effectivenessRecords,
    contextPackages.length,
    briefs,
    dashboards,
    contradictions,
    unknowns
  );

  const workspace: ConstitutionalWorkspace = {
    id,
    workspaceId: wsId,
    generatedAt,
    workspaceSummary,
    evidenceSummary: buildEvidenceSummary(evidence.length, contextPackages.length),
    knowledgeSummary: buildKnowledgeSummary(memories, patterns, effectivenessRecords),
    briefSummary: buildBriefSummary(briefs),
    dashboardSummary: buildDashboardSummary(dashboards),
    governanceSummary: buildGovernanceSummary(governanceArtifacts),
    contradictions,
    unknowns,
    lineage,
    metadata: {},
  };

  await emitWorkspaceEvent(
    wsId,
    actorId,
    "CONSTITUTIONAL_WORKSPACE_GENERATED",
    id,
    correlationId,
    causationId,
    {
      evidenceCount: evidence.length,
      memoryCount: memories.length,
      patternCount: patterns.length,
      effectivenessCount: effectivenessRecords.length,
      contextPackageCount: contextPackages.length,
      briefCount: briefs.length,
      dashboardCount: dashboards.length,
      governanceArtifactCount: governanceArtifacts.length,
      contradictionCount: contradictions.length,
      unknownCount: unknowns.length,
    }
  );

  return { ok: true, data: workspace };
}

// ─── explainConstitutionalWorkspace ───────────────────────────────────────────

export async function explainConstitutionalWorkspace(
  workspace: ConstitutionalWorkspace,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<WorkspaceResult<ConstitutionalWorkspaceExplanation>> {
  const artifactReasons: WorkspaceArtifactReason[] = workspace.lineage.map((l) => ({
    artifactType: l.artifactType,
    artifactId: l.artifactId,
    reason: l.reasonIncluded,
  }));

  await emitWorkspaceEvent(
    workspace.workspaceId,
    actorId,
    "CONSTITUTIONAL_WORKSPACE_EXPLAINED",
    workspace.id,
    correlationId ?? workspace.id,
    causationId,
    {
      artifactCount: workspace.lineage.length,
      contradictionCount: workspace.contradictions.length,
      unknownCount: workspace.unknowns.length,
    }
  );

  return {
    ok: true,
    data: {
      workspace,
      workspaceSummary: workspace.workspaceSummary,
      artifactReasons,
      lineage: workspace.lineage,
      contradictions: workspace.contradictions,
      unknowns: workspace.unknowns,
    },
  };
}

// ─── getWorkspaceHealth ───────────────────────────────────────────────────────

export function getWorkspaceHealth(workspace: ConstitutionalWorkspace): WorkspaceHealth {
  const s = workspace.workspaceSummary;
  const gs = workspace.governanceSummary;
  const governanceTotal =
    gs.authorityArtifactCount +
    gs.delegationArtifactCount +
    gs.capabilityArtifactCount +
    gs.trustArtifactCount +
    gs.policyArtifactCount;

  const coverageMetrics: WorkspaceCoverageMetrics = {
    hasEvidence: s.evidenceCount > 0,
    hasMemories: s.memoryCount > 0,
    hasPatterns: s.patternCount > 0,
    hasEffectivenessRecords: s.effectivenessCount > 0,
    hasContextPackages: s.contextPackageCount > 0,
    hasBriefs: s.briefCount > 0,
    hasDashboards: s.dashboardCount > 0,
    hasContradictions: s.contradictionCount > 0,
    hasUnknowns: s.unknownCount > 0,
    hasGovernanceArtifacts: governanceTotal > 0,
  };

  return {
    evidenceCount: s.evidenceCount,
    memoryCount: s.memoryCount,
    patternCount: s.patternCount,
    effectivenessCount: s.effectivenessCount,
    briefCount: s.briefCount,
    dashboardCount: s.dashboardCount,
    contradictionCount: s.contradictionCount,
    unknownCount: s.unknownCount,
    coverageMetrics,
  };
}
