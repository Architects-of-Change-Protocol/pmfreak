// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Dashboard — Export
//
// JSON-only export. No PDF. No UI.
// Every exported artifact is traceable to source briefs.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ConstitutionalDashboard,
  ConstitutionalDashboardExport,
  DashboardResult,
} from "./types";

// ─── exportConstitutionalDashboard ────────────────────────────────────────────

export async function exportConstitutionalDashboard(
  dashboard: ConstitutionalDashboard,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<DashboardResult<ConstitutionalDashboardExport>> {
  const exportedAt = new Date().toISOString();

  const result: ConstitutionalDashboardExport = {
    dashboard,
    widgets: dashboard.widgets,
    briefReferences: dashboard.briefReferences,
    evidenceSummary: dashboard.evidenceSummary,
    timelineSummary: dashboard.timelineSummary,
    contradictions: dashboard.contradictions,
    unknowns: dashboard.unknowns,
    exportedAt,
    format: "json",
  };

  await createPlatformEvent({
    workspaceId: dashboard.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "CONSTITUTIONAL_DASHBOARD_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? dashboard.id,
    causationId,
    rawReferenceTable: "constitutional_dashboard",
    rawReferenceId: dashboard.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: dashboard.pmUserId,
      dashboardType: dashboard.dashboardType,
      widgetCount: dashboard.widgets.length,
      briefCount: dashboard.briefReferences.length,
      format: "json",
      exportedAt,
    },
  });

  return { ok: true, data: result };
}
