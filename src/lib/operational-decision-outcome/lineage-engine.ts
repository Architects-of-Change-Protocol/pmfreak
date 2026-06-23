import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OutcomeLineage, OutcomeLineageLayer, OutcomeResult } from "./types";

// ─── getDecisionOutcomeLineage ────────────────────────────────────────────────
// Reconstructs the full causal chain from Constitution to Outcome.

export async function getDecisionOutcomeLineage(params: {
  workspaceId: string;
  outcomeId: string;
  decisionId: string;
}): Promise<OutcomeResult<OutcomeLineage>> {
  const { workspaceId, outcomeId, decisionId } = params;
  const supabase = await createSupabaseServerClient();

  const chain: OutcomeLineageLayer[] = [];

  // ── Constitution ──
  const { count: constitutionCount } = await supabase
    .from("project_constitutions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "constitution",
    entityType: "project_constitutions",
    entityId: null,
    label: "Project Constitution",
    count: constitutionCount ?? 0,
  });

  // ── Memory ──
  const { count: memoryCount } = await supabase
    .from("constitutional_memory_records")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "memory",
    entityType: "constitutional_memory_records",
    entityId: null,
    label: "Constitutional Memory",
    count: memoryCount ?? 0,
  });

  // ── Learning ──
  const { count: learningCount } = await supabase
    .from("constitutional_learning_patterns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "learning",
    entityType: "constitutional_learning_patterns",
    entityId: null,
    label: "Constitutional Learning",
    count: learningCount ?? 0,
  });

  // ── Recommendation ──
  const { count: recCount } = await supabase
    .from("recommended_actions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "recommendation",
    entityType: "recommended_actions",
    entityId: null,
    label: "Recommendations",
    count: recCount ?? 0,
  });

  // ── Signal ──
  const { count: signalCount } = await supabase
    .from("governance_signals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "signal",
    entityType: "governance_signals",
    entityId: null,
    label: "Governance Signals",
    count: signalCount ?? 0,
  });

  // ── Action ──
  const { count: actionCount } = await supabase
    .from("governance_actions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "action",
    entityType: "governance_actions",
    entityId: null,
    label: "Governance Actions",
    count: actionCount ?? 0,
  });

  // ── Commitment ──
  const { count: commitmentCount } = await supabase
    .from("governance_commitments")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "commitment",
    entityType: "governance_commitments",
    entityId: null,
    label: "Governance Commitments",
    count: commitmentCount ?? 0,
  });

  // ── Projection ──
  const { count: projectionCount } = await supabase
    .from("execution_projections")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "projection",
    entityType: "execution_projections",
    entityId: null,
    label: "Execution Projections",
    count: projectionCount ?? 0,
  });

  // ── Reality ──
  const { count: realityCount } = await supabase
    .from("execution_reality_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "reality",
    entityType: "execution_reality_snapshots",
    entityId: null,
    label: "Execution Reality",
    count: realityCount ?? 0,
  });

  // ── Snapshot ──
  const { count: snapshotCount } = await supabase
    .from("project_os_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "snapshot",
    entityType: "project_os_snapshots",
    entityId: null,
    label: "Project OS Snapshots",
    count: snapshotCount ?? 0,
  });

  // ── Focus Item ──
  const { count: focusCount } = await supabase
    .from("operational_focus_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  chain.push({
    layer: "focus_item",
    entityType: "operational_focus_items",
    entityId: null,
    label: "Operational Focus Items",
    count: focusCount ?? 0,
  });

  // ── Consequence ──
  const { data: decision } = await supabase
    .from("operational_decisions")
    .select("consequence_id")
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .single();
  const consequenceId = (decision?.consequence_id as string) ?? null;
  chain.push({
    layer: "consequence",
    entityType: "operational_consequences",
    entityId: consequenceId,
    label: "Consequence Analysis",
    count: consequenceId ? 1 : 0,
  });

  // ── Decision ──
  chain.push({
    layer: "decision",
    entityType: "operational_decisions",
    entityId: decisionId,
    label: "Operational Decision",
    count: 1,
  });

  // ── Outcome ──
  chain.push({
    layer: "outcome",
    entityType: "operational_decision_outcomes",
    entityId: outcomeId,
    label: "Decision Outcome",
    count: 1,
  });

  return {
    ok: true,
    data: {
      outcomeId,
      decisionId,
      workspaceId,
      chain,
      generatedAt: new Date().toISOString(),
    },
  };
}
