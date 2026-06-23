import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OperationalDecisionLineage, DecisionLineageLayer, DecisionResult } from "./types";

// ─── getOperationalDecisionLineage ────────────────────────────────────────────
// Reconstructs the full lineage chain from constitution → decision.
// 14 layers: constitution, memory, learning, recommendation, signal, action,
// commitment, projection, reality, snapshot, command_center, focus_item,
// consequence_analysis, decision.

export async function getOperationalDecisionLineage(input: {
  workspaceId: string;
  decisionId:  string;
}): Promise<DecisionResult<OperationalDecisionLineage>> {
  const supabase = await createSupabaseServerClient();

  // Load decision to get consequence_id
  const { data: decision, error: dErr } = await supabase
    .from("operational_decisions")
    .select("id, workspace_id, consequence_id")
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (dErr || !decision) {
    return { ok: false, error: "Decision not found.", failureClass: "not_found" };
  }

  // Load consequence to get focus_item_id
  const { data: consequence } = await supabase
    .from("operational_consequences")
    .select("id, focus_item_id")
    .eq("id", decision.consequence_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  const focusItemId = consequence?.focus_item_id ?? null;

  // Load focus item to get command_center_id
  const { data: focusItem } = focusItemId
    ? await supabase
        .from("operational_focus_items")
        .select("id, command_center_id")
        .eq("id", focusItemId)
        .eq("workspace_id", input.workspaceId)
        .single()
    : { data: null };

  const commandCenterId = focusItem?.command_center_id ?? null;

  // Load command center to get snapshot_id and project_id
  const { data: commandCenter } = commandCenterId
    ? await supabase
        .from("operational_command_centers")
        .select("id, snapshot_id, project_id")
        .eq("id", commandCenterId)
        .eq("workspace_id", input.workspaceId)
        .single()
    : { data: null };

  const snapshotId = commandCenter?.snapshot_id ?? null;
  const projectId  = (commandCenter?.project_id as string) ?? null;

  // Fetch domain counts in parallel — 9 upstream layers
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
  ] = await Promise.all([
    supabase.from("project_constitutions")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", projectId ?? ""),

    supabase.from("operational_memory_entries")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", projectId ?? ""),

    supabase.from("learning_patterns")
      .select("id")
      .eq("workspace_id", input.workspaceId),

    supabase.from("recommendations")
      .select("id")
      .eq("workspace_id", input.workspaceId),

    supabase.from("governance_signals")
      .select("id")
      .eq("workspace_id", input.workspaceId),

    supabase.from("governance_actions")
      .select("id")
      .eq("workspace_id", input.workspaceId),

    supabase.from("governance_commitments")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", projectId ?? ""),

    supabase.from("execution_projections")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", projectId ?? ""),

    supabase.from("execution_realities")
      .select("id")
      .eq("workspace_id", input.workspaceId),
  ]);

  // 14 layers total
  const chain: DecisionLineageLayer[] = [
    { layer: "constitution",         entityType: "project_constitutions",       entityId: projectId,           label: "Project Constitution",       count: (constitutionResult.data    ?? []).length },
    { layer: "memory",               entityType: "operational_memory_entries",  entityId: null,                label: "Operational Memory",          count: (memoryResult.data          ?? []).length },
    { layer: "learning",             entityType: "learning_patterns",           entityId: null,                label: "Constitutional Learning",     count: (learningResult.data        ?? []).length },
    { layer: "recommendation",       entityType: "recommendations",             entityId: null,                label: "Sovereign Recommendation",    count: (recommendationResult.data  ?? []).length },
    { layer: "signal",               entityType: "governance_signals",          entityId: null,                label: "Governance Signal",           count: (signalResult.data          ?? []).length },
    { layer: "action",               entityType: "governance_actions",          entityId: null,                label: "Governance Action",           count: (actionResult.data          ?? []).length },
    { layer: "commitment",           entityType: "governance_commitments",      entityId: null,                label: "Governance Commitment",       count: (commitmentResult.data      ?? []).length },
    { layer: "projection",           entityType: "execution_projections",       entityId: null,                label: "Execution Projection",        count: (projectionResult.data      ?? []).length },
    { layer: "reality",              entityType: "execution_realities",         entityId: null,                label: "Execution Reality",           count: (realityResult.data         ?? []).length },
    { layer: "snapshot",             entityType: "project_os_snapshots",        entityId: snapshotId,          label: "Project OS Snapshot",         count: snapshotId      ? 1 : 0    },
    { layer: "command_center",       entityType: "operational_command_centers", entityId: commandCenterId,     label: "Operational Command Center",  count: commandCenterId ? 1 : 0    },
    { layer: "focus_item",           entityType: "operational_focus_items",     entityId: focusItemId,         label: "Operational Focus Item",      count: focusItemId     ? 1 : 0    },
    { layer: "consequence_analysis", entityType: "operational_consequences",    entityId: decision.consequence_id, label: "Consequence Analysis",    count: 1                           },
    { layer: "decision",             entityType: "operational_decisions",       entityId: input.decisionId,    label: "Operational Decision",        count: 1                           },
  ];

  return {
    ok:   true,
    data: {
      decisionId:    input.decisionId,
      consequenceId: decision.consequence_id,
      workspaceId:   input.workspaceId,
      chain,
      generatedAt:   new Date().toISOString(),
    },
  };
}
