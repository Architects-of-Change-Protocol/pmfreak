import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommandCenterResult, CommandCenterLineage, CommandCenterLineageLayer } from "./types";

// ─── Lineage Engine ───────────────────────────────────────────────────────────
//
// Reconstructs the full operational lineage from Constitution down to Focus Item.
// This makes every focus item traceable to its origin (Principle 4).

export async function getOperationalFocusLineage(input: {
  workspaceId: string;
  commandCenterId: string;
}): Promise<CommandCenterResult<CommandCenterLineage>> {
  const { workspaceId, commandCenterId } = input;
  const supabase = await createSupabaseServerClient();

  // Load the command center to get projectId and snapshotId
  const { data: cc, error: ccError } = await supabase
    .from("operational_command_centers")
    .select("id,project_id,snapshot_id,workspace_id")
    .eq("id", commandCenterId)
    .eq("workspace_id", workspaceId)
    .single();

  if (ccError || !cc) {
    return { ok: false, error: "Command center not found.", failureClass: "not_found" };
  }

  const projectId = cc.project_id as string;

  // Fetch domain counts in parallel
  const [
    constitutionResult,
    memoryResult,
    learningResult,
    recommendationResult,
    signalResult,
    actionResult,
    commitmentResult,
    projectionResult,
    realityResult,
    focusItemResult,
  ] = await Promise.all([
    supabase.from("project_constitutions").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId),
    supabase.from("operational_memory_entries").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId),
    supabase.from("learning_patterns").select("id").eq("workspace_id", workspaceId),
    supabase.from("recommendations").select("id").eq("workspace_id", workspaceId),
    supabase.from("governance_signals").select("id").eq("workspace_id", workspaceId),
    supabase.from("governance_actions").select("id").eq("workspace_id", workspaceId),
    supabase.from("governance_commitments").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId),
    supabase.from("execution_projections").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId),
    supabase.from("execution_realities").select("id").eq("workspace_id", workspaceId),
    supabase.from("operational_focus_items").select("id").eq("workspace_id", workspaceId).eq("command_center_id", commandCenterId),
  ]);

  const chain: CommandCenterLineageLayer[] = [
    {
      layer: "constitution",
      entityType: "project_constitutions",
      entityId: null,
      label: "Constitution",
      count: (constitutionResult.data ?? []).length,
    },
    {
      layer: "memory",
      entityType: "operational_memory_entries",
      entityId: null,
      label: "Memory",
      count: (memoryResult.data ?? []).length,
    },
    {
      layer: "learning",
      entityType: "learning_patterns",
      entityId: null,
      label: "Learning",
      count: (learningResult.data ?? []).length,
    },
    {
      layer: "recommendation",
      entityType: "recommendations",
      entityId: null,
      label: "Recommendation",
      count: (recommendationResult.data ?? []).length,
    },
    {
      layer: "signal",
      entityType: "governance_signals",
      entityId: null,
      label: "Signal",
      count: (signalResult.data ?? []).length,
    },
    {
      layer: "action",
      entityType: "governance_actions",
      entityId: null,
      label: "Action",
      count: (actionResult.data ?? []).length,
    },
    {
      layer: "commitment",
      entityType: "governance_commitments",
      entityId: null,
      label: "Commitment",
      count: (commitmentResult.data ?? []).length,
    },
    {
      layer: "projection",
      entityType: "execution_projections",
      entityId: null,
      label: "Projection",
      count: (projectionResult.data ?? []).length,
    },
    {
      layer: "reality",
      entityType: "execution_realities",
      entityId: null,
      label: "Reality",
      count: (realityResult.data ?? []).length,
    },
    {
      layer: "snapshot",
      entityType: "project_os_snapshots",
      entityId: cc.snapshot_id as string,
      label: "Project OS Snapshot",
      count: 1,
    },
    {
      layer: "command_center",
      entityType: "operational_command_centers",
      entityId: commandCenterId,
      label: "Command Center",
      count: 1,
    },
    {
      layer: "focus_item",
      entityType: "operational_focus_items",
      entityId: null,
      label: "Focus Item",
      count: (focusItemResult.data ?? []).length,
    },
  ];

  return {
    ok: true,
    data: {
      projectId,
      workspaceId,
      commandCenterId,
      chain,
      generatedAt: new Date().toISOString(),
    },
  };
}
