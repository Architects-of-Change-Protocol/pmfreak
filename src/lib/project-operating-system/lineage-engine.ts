import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectOSResult, ProjectOSLineage, ProjectOSLineageLayer } from "./types";

// ─── getProjectOSLineage ───────────────────────────────────────────────────────
//
// Reconstructs the full operating lineage for a project:
//
//   Constitution → Memory → Digest → Learning → Recommendation
//   → Signal → Action → Commitment → Projection → Reality → Snapshot

export async function getProjectOSLineage(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProjectOSResult<ProjectOSLineage>> {
  const supabase = await createSupabaseServerClient();
  const { workspaceId, projectId } = input;

  const [
    constitutionResult,
    memoryResult,
    digestResult,
    learningResult,
    recommendationResult,
    signalResult,
    actionResult,
    commitmentResult,
    projectionResult,
    realityResult,
    snapshotResult,
  ] = await Promise.all([
    supabase
      .from("project_constitutions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .limit(1),

    supabase
      .from("operational_memory_entries")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .limit(1),

    supabase
      .from("constitutional_digests")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(100),

    supabase
      .from("learning_patterns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1),

    supabase
      .from("recommendations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1),

    supabase
      .from("governance_signals")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1),

    supabase
      .from("governance_actions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1),

    supabase
      .from("governance_commitments")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .limit(1),

    supabase
      .from("execution_projections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .limit(1),

    supabase
      .from("execution_realities")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .limit(1),

    supabase
      .from("project_os_snapshots")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const chain: ProjectOSLineageLayer[] = [
    {
      layer: "constitution",
      entityType: "project_constitutions",
      entityId: constitutionResult.data?.[0]?.id ?? null,
      label: "Project Constitution",
      count: constitutionResult.data?.length ?? 0,
    },
    {
      layer: "memory",
      entityType: "operational_memory_entries",
      entityId: memoryResult.data?.[0]?.id ?? null,
      label: "Operational Memory",
      count: memoryResult.data?.length ?? 0,
    },
    {
      layer: "digest",
      entityType: "constitutional_digests",
      entityId: digestResult.data?.[0]?.id ?? null,
      label: "Constitutional Digest",
      count: digestResult.data?.length ?? 0,
    },
    {
      layer: "learning",
      entityType: "learning_patterns",
      entityId: learningResult.data?.[0]?.id ?? null,
      label: "Learning Pattern",
      count: learningResult.data?.length ?? 0,
    },
    {
      layer: "recommendation",
      entityType: "recommendations",
      entityId: recommendationResult.data?.[0]?.id ?? null,
      label: "Recommendation",
      count: recommendationResult.data?.length ?? 0,
    },
    {
      layer: "signal",
      entityType: "governance_signals",
      entityId: signalResult.data?.[0]?.id ?? null,
      label: "Governance Signal",
      count: signalResult.data?.length ?? 0,
    },
    {
      layer: "action",
      entityType: "governance_actions",
      entityId: actionResult.data?.[0]?.id ?? null,
      label: "Governance Action",
      count: actionResult.data?.length ?? 0,
    },
    {
      layer: "commitment",
      entityType: "governance_commitments",
      entityId: commitmentResult.data?.[0]?.id ?? null,
      label: "Governance Commitment",
      count: commitmentResult.data?.length ?? 0,
    },
    {
      layer: "projection",
      entityType: "execution_projections",
      entityId: projectionResult.data?.[0]?.id ?? null,
      label: "Execution Projection",
      count: projectionResult.data?.length ?? 0,
    },
    {
      layer: "reality",
      entityType: "execution_realities",
      entityId: realityResult.data?.[0]?.id ?? null,
      label: "Execution Reality",
      count: realityResult.data?.length ?? 0,
    },
    {
      layer: "snapshot",
      entityType: "project_os_snapshots",
      entityId: snapshotResult.data?.[0]?.id ?? null,
      label: "Project OS Snapshot",
      count: snapshotResult.data?.length ?? 0,
    },
  ];

  return {
    ok: true,
    data: {
      projectId,
      workspaceId,
      chain,
      generatedAt: new Date().toISOString(),
    },
  };
}
