import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  GovernanceComplianceResult,
  GetGovernanceComplianceLineageInput,
  GovernanceComplianceLineage,
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
function notFound<T>(resource = "Resource"): GovernanceComplianceResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}

// ─── getGovernanceComplianceLineage ──────────────────────────────────────────

export async function getGovernanceComplianceLineage(
  input: GetGovernanceComplianceLineageInput
): Promise<GovernanceComplianceResult<GovernanceComplianceLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: pm } = await supabase
    .from("project_managers")
    .select("id,display_name,email")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!pm) return notFound("Project Manager");

  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("id,project_id")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const projectIds = [...new Set((assignments ?? []).map((a: { project_id: string }) => a.project_id))];

  const [constitutionsRes, authoritiesRes, decisionsRes, ratificationsRes, commitmentsRes, memoriesRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("project_constitutions").select("id,project_id,lifecycle_status").eq("workspace_id", input.workspaceId).in("project_id", projectIds)
      : { data: [] },
    supabase.from("authority_assignments").select("id,status,expires_at").eq("pm_id", input.pmId).eq("workspace_id", input.workspaceId),
    projectIds.length > 0
      ? supabase.from("operational_decisions").select("id,status,authority_id").eq("workspace_id", input.workspaceId).in("project_id", projectIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from("constitutional_ratifications").select("id,status").eq("workspace_id", input.workspaceId)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from("governance_commitments").select("id,status").eq("workspace_id", input.workspaceId).in("project_id", projectIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from("operational_memory").select("id").eq("workspace_id", input.workspaceId).in("project_id", projectIds)
      : { data: [] },
  ]);

  const decisionList = decisionsRes.data ?? [];
  const decisionIds  = decisionList.map((d: { id: string }) => d.id);

  const { data: outcomeRows } = decisionIds.length > 0
    ? await supabase.from("operational_decision_outcomes").select("decision_id").eq("workspace_id", input.workspaceId).in("decision_id", decisionIds)
    : { data: [] };

  const decisionsWithOutcome = new Set((outcomeRows ?? []).map((o: { decision_id: string }) => o.decision_id));

  const { data: latestSnapshot } = await supabase
    .from("governance_compliance_snapshots")
    .select("id,overall_score,compliance_status,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lineage: GovernanceComplianceLineage = {
    pm:            { id: pm.id, name: pm.display_name, email: pm.email },
    constitutions: (constitutionsRes.data ?? []).map((c: { id: string; project_id: string; lifecycle_status: string }) => ({
      id: c.id, projectId: c.project_id, lifecycleStatus: c.lifecycle_status,
    })),
    authorities:   (authoritiesRes.data ?? []).map((a: { id: string; status: string; expires_at: string | null }) => ({
      id: a.id, status: a.status, expiresAt: a.expires_at,
    })),
    decisions:     decisionList.map((d: { id: string; status: string }) => ({
      id: d.id, status: d.status, hasOutcome: decisionsWithOutcome.has(d.id),
    })),
    ratifications: (ratificationsRes.data ?? []).map((r: { id: string; status: string }) => ({ id: r.id, status: r.status })),
    commitments:   (commitmentsRes.data ?? []).map((c: { id: string; status: string }) => ({ id: c.id, status: c.status })),
    memories:      (memoriesRes.data ?? []).map((m: { id: string }) => ({ id: m.id })),
    complianceSnapshot: latestSnapshot
      ? {
          id:          latestSnapshot.id,
          overallScore: Number(latestSnapshot.overall_score),
          status:      latestSnapshot.compliance_status,
          generatedAt: latestSnapshot.generated_at,
        }
      : null,
  };

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           null,
    actorType:         "system",
    eventType:         "GOVERNANCE_LINEAGE_GENERATED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     input.pmId,
    causationId:       null,
    rawReferenceTable: "project_managers",
    rawReferenceId:    input.pmId,
    eventPayload:      { pm_id: input.pmId, constitution_count: lineage.constitutions.length, decision_count: lineage.decisions.length },
  });

  return { ok: true, data: lineage };
}
