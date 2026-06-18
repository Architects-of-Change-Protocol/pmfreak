// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Workspace — Export
//
// JSON-only export. No PDF. No UI.
// Every exported artifact is traceable to supplied inputs.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ConstitutionalWorkspace,
  ConstitutionalWorkspaceExport,
  WorkspaceResult,
} from "./types";

// ─── exportConstitutionalWorkspace ────────────────────────────────────────────

export async function exportConstitutionalWorkspace(
  workspace: ConstitutionalWorkspace,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<WorkspaceResult<ConstitutionalWorkspaceExport>> {
  const exportedAt = new Date().toISOString();

  const result: ConstitutionalWorkspaceExport = {
    workspace,
    summaries: {
      workspaceSummary: workspace.workspaceSummary,
      evidenceSummary: workspace.evidenceSummary,
      knowledgeSummary: workspace.knowledgeSummary,
      briefSummary: workspace.briefSummary,
      dashboardSummary: workspace.dashboardSummary,
      governanceSummary: workspace.governanceSummary,
    },
    contradictions: workspace.contradictions,
    unknowns: workspace.unknowns,
    lineage: workspace.lineage,
    exportedAt,
    format: "json",
  };

  await createPlatformEvent({
    workspaceId: workspace.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "CONSTITUTIONAL_WORKSPACE_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? workspace.id,
    causationId,
    rawReferenceTable: "constitutional_workspace",
    rawReferenceId: workspace.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      evidenceCount: workspace.workspaceSummary.evidenceCount,
      memoryCount: workspace.workspaceSummary.memoryCount,
      patternCount: workspace.workspaceSummary.patternCount,
      effectivenessCount: workspace.workspaceSummary.effectivenessCount,
      briefCount: workspace.workspaceSummary.briefCount,
      dashboardCount: workspace.workspaceSummary.dashboardCount,
      contradictionCount: workspace.contradictions.length,
      unknownCount: workspace.unknowns.length,
      lineageCount: workspace.lineage.length,
      format: "json",
      exportedAt,
    },
  });

  return { ok: true, data: result };
}
