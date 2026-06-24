import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyGovernanceComplianceStatus } from "./engines/status-classification";
import { identifyGovernanceHotspots } from "./engines/hotspot-engine";
import { calculateGovernanceDebt } from "./engines/debt-engine";
import { generateGovernanceComplianceSnapshot } from "./compliance-registry";

import type {
  GovernanceComplianceResult,
  GeneratePMOComplianceSummaryInput,
  PMOComplianceSummary,
  GovernanceGap,
  GovernanceComplianceDomain,
  GovernanceGapSeverity,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): GovernanceComplianceResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}

// ─── generatePMOComplianceSummary ─────────────────────────────────────────────

export async function generatePMOComplianceSummary(
  input: GeneratePMOComplianceSummaryInput
): Promise<GovernanceComplianceResult<PMOComplianceSummary>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // Get all active PMs in workspace
  const { data: pms } = await supabase
    .from("project_managers")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  const pmList = pms ?? [];

  if (pmList.length === 0) {
    return {
      ok: true,
      data: {
        pmo: { pms: 0, compliant: 0, warning: 0, critical: 0 },
        overall: 0,
        hotspots: [],
        totalDebt: { low: 0, medium: 0, high: 0, critical: 0, total: 0 },
      },
    };
  }

  // Generate snapshots for each PM (best-effort — skip failures)
  const snapshotResults = await Promise.all(
    pmList.map((pm: { id: string }) =>
      generateGovernanceComplianceSnapshot({ workspaceId: input.workspaceId, pmId: pm.id })
    )
  );

  const successfulSnapshots = snapshotResults.flatMap((r) => (r.ok ? [r.data] : []));

  let compliant = 0;
  let warning   = 0;
  let critical  = 0;
  let scoreSum  = 0;

  for (const snap of successfulSnapshots) {
    const status = snap.compliance_status;
    if (status === "compliant")      compliant++;
    else if (status === "warning")   warning++;
    else                             critical++;
    scoreSum += Number(snap.overall_score);
  }

  const overall = successfulSnapshots.length > 0
    ? Math.round(scoreSum / successfulSnapshots.length)
    : 0;

  // Aggregate gaps across all snapshots
  const snapshotIds = successfulSnapshots.map((s) => s.id);
  let allGaps: GovernanceGap[] = [];

  if (snapshotIds.length > 0) {
    const { data: gapRows } = await supabase
      .from("governance_compliance_gaps")
      .select("domain,gap_type,severity,description,evidence_count")
      .eq("workspace_id", input.workspaceId)
      .in("snapshot_id", snapshotIds);

    allGaps = (gapRows ?? []).map((g: { domain: GovernanceComplianceDomain; gap_type: string; severity: GovernanceGapSeverity; description: string; evidence_count: number }) => ({
      domain:        g.domain,
      gapType:       g.gap_type,
      severity:      g.severity,
      description:   g.description,
      evidenceCount: g.evidence_count,
    }));
  }

  const hotspots  = identifyGovernanceHotspots(allGaps);
  const totalDebt = calculateGovernanceDebt(allGaps);

  return {
    ok: true,
    data: {
      pmo: { pms: pmList.length, compliant, warning, critical },
      overall,
      hotspots,
      totalDebt,
    },
  };
}
