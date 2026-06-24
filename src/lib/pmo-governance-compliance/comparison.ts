import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import { classifyGovernanceComplianceStatus } from "./engines/status-classification";
import { generateGovernanceComplianceSnapshot } from "./compliance-registry";

import type {
  GovernanceComplianceResult,
  CompareGovernanceComplianceInput,
  GovernanceComplianceComparison,
  GovernanceComplianceDomain,
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

const DOMAINS: GovernanceComplianceDomain[] = ["constitution", "authority", "ratification", "decision", "execution", "learning"];

// ─── compareGovernanceCompliance ──────────────────────────────────────────────

export async function compareGovernanceCompliance(
  input: CompareGovernanceComplianceInput
): Promise<GovernanceComplianceResult<GovernanceComplianceComparison>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmAId))       return validation("pmAId must be a valid UUID.");
  if (!validUuid(input.pmBId))       return validation("pmBId must be a valid UUID.");
  if (input.pmAId === input.pmBId)   return validation("pmAId and pmBId must be different.");

  const supabase = await createSupabaseServerClient();

  const [pmAResult, pmBResult] = await Promise.all([
    generateGovernanceComplianceSnapshot({ workspaceId: input.workspaceId, pmId: input.pmAId }),
    generateGovernanceComplianceSnapshot({ workspaceId: input.workspaceId, pmId: input.pmBId }),
  ]);

  if (!pmAResult.ok) return pmAResult;
  if (!pmBResult.ok) return pmBResult;

  const snapA = pmAResult.data;
  const snapB = pmBResult.data;

  const [pmA, pmB] = await Promise.all([
    supabase.from("project_managers").select("id,display_name").eq("id", input.pmAId).eq("workspace_id", input.workspaceId).single(),
    supabase.from("project_managers").select("id,display_name").eq("id", input.pmBId).eq("workspace_id", input.workspaceId).single(),
  ]);

  const scoreA = Number(snapA.overall_score);
  const scoreB = Number(snapB.overall_score);
  const diff   = Math.round((scoreA - scoreB) * 100) / 100;

  const domainComparison = {} as GovernanceComplianceComparison["domainComparison"];
  for (const domain of DOMAINS) {
    const aScore = Number(snapA[`${domain}_score` as keyof typeof snapA]);
    const bScore = Number(snapB[`${domain}_score` as keyof typeof snapB]);
    domainComparison[domain] = {
      pmA:    aScore,
      pmB:    bScore,
      winner: aScore > bScore ? "a" : aScore < bScore ? "b" : "equal",
    };
  }

  const comparison: GovernanceComplianceComparison = {
    pmA: {
      id:           input.pmAId,
      name:         pmA.data?.display_name ?? input.pmAId,
      overallScore: scoreA,
      status:       classifyGovernanceComplianceStatus(scoreA),
    },
    pmB: {
      id:           input.pmBId,
      name:         pmB.data?.display_name ?? input.pmBId,
      overallScore: scoreB,
      status:       classifyGovernanceComplianceStatus(scoreB),
    },
    difference:       diff,
    stronger:         diff > 0 ? "a" : diff < 0 ? "b" : "equal",
    domainComparison,
  };

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           null,
    actorType:         "system",
    eventType:         "GOVERNANCE_COMPLIANCE_COMPARED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     snapA.id,
    causationId:       null,
    rawReferenceTable: "governance_compliance_snapshots",
    rawReferenceId:    snapA.id,
    eventPayload:      { pm_a_id: input.pmAId, pm_b_id: input.pmBId, score_a: scoreA, score_b: scoreB, difference: diff },
  });

  return { ok: true, data: comparison };
}
