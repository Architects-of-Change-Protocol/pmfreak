import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConsequenceLineage, ConsequenceLineageLayer, ConsequenceResult } from "./types";

// ─── getOperationalConsequenceLineage ─────────────────────────────────────────
// Reconstructs the full lineage chain from constitution → consequence_analysis.
// 13 layers total: constitution, memory, learning, recommendation, signal, action,
// commitment, projection, reality, snapshot, command_center, focus_item, consequence_analysis.

export async function getOperationalConsequenceLineage(input: {
  workspaceId: string;
  consequenceId: string;
}): Promise<ConsequenceResult<ConsequenceLineage>> {
  const supabase = await createSupabaseServerClient();

  // Load consequence to get focus_item_id
  const { data: consequence, error: cErr } = await supabase
    .from("operational_consequences")
    .select("id, workspace_id, focus_item_id")
    .eq("id", input.consequenceId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (cErr || !consequence) {
    return { ok: false, error: "Consequence not found.", failureClass: "not_found" };
  }

  // Load focus item to get command_center_id
  const { data: focusItem } = await supabase
    .from("operational_focus_items")
    .select("id, command_center_id, attention_item_id, focus_type")
    .eq("id", consequence.focus_item_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  // Load command center to get snapshot_id and project_id
  const commandCenterId = focusItem?.command_center_id ?? null;
  const { data: commandCenter } = commandCenterId
    ? await supabase
        .from("operational_command_centers")
        .select("id, snapshot_id, project_id")
        .eq("id", commandCenterId)
        .eq("workspace_id", input.workspaceId)
        .single()
    : { data: null };

  const snapshotId  = commandCenter?.snapshot_id ?? null;
  const projectId   = commandCenter?.project_id  ?? input.workspaceId;

  // Count upstream entities
  const [constitutions, memories, learnings, recommendations, signals, actions, commitments, projections, realities] =
    await Promise.all([
      count(supabase, "project_constitutions",       "project_id",  projectId,         input.workspaceId),
      count(supabase, "organizational_memories",     "workspace_id", input.workspaceId, null),
      count(supabase, "constitutional_learnings",    "workspace_id", input.workspaceId, null),
      count(supabase, "sovereign_recommendations",   "workspace_id", input.workspaceId, null),
      count(supabase, "governance_signals",          "workspace_id", input.workspaceId, null),
      count(supabase, "governance_actions",          "workspace_id", input.workspaceId, null),
      count(supabase, "governance_commitments",      "workspace_id", input.workspaceId, null),
      count(supabase, "execution_projections",       "workspace_id", input.workspaceId, null),
      count(supabase, "execution_realities",         "workspace_id", input.workspaceId, null),
    ]);

  const chain: ConsequenceLineageLayer[] = [
    { layer: "constitution",        entityType: "project_constitutions",     entityId: projectId,                 label: "Project Constitution",        count: constitutions  },
    { layer: "memory",              entityType: "organizational_memories",   entityId: null,                      label: "Organizational Memory",        count: memories       },
    { layer: "learning",            entityType: "constitutional_learnings",  entityId: null,                      label: "Constitutional Learning",      count: learnings      },
    { layer: "recommendation",      entityType: "sovereign_recommendations", entityId: null,                      label: "Sovereign Recommendation",     count: recommendations },
    { layer: "signal",              entityType: "governance_signals",        entityId: null,                      label: "Governance Signal",            count: signals        },
    { layer: "action",              entityType: "governance_actions",        entityId: null,                      label: "Governance Action",            count: actions        },
    { layer: "commitment",          entityType: "governance_commitments",    entityId: null,                      label: "Governance Commitment",        count: commitments    },
    { layer: "projection",          entityType: "execution_projections",     entityId: null,                      label: "Execution Projection",         count: projections    },
    { layer: "reality",             entityType: "execution_realities",       entityId: null,                      label: "Execution Reality",            count: realities      },
    { layer: "snapshot",            entityType: "project_os_snapshots",      entityId: snapshotId,                label: "Project OS Snapshot",          count: snapshotId ? 1 : 0 },
    { layer: "command_center",      entityType: "operational_command_centers", entityId: commandCenterId,         label: "Operational Command Center",   count: commandCenterId ? 1 : 0 },
    { layer: "focus_item",          entityType: "operational_focus_items",   entityId: consequence.focus_item_id, label: "Operational Focus Item",       count: 1              },
    { layer: "consequence_analysis", entityType: "operational_consequences", entityId: input.consequenceId,       label: "Consequence Analysis",         count: 1              },
  ];

  return {
    ok: true,
    data: {
      focusItemId:   consequence.focus_item_id,
      consequenceId: input.consequenceId,
      workspaceId:   input.workspaceId,
      chain,
      generatedAt:   new Date().toISOString(),
    },
  };
}

async function count(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  field: string,
  value: string | null,
  workspaceId: string | null
): Promise<number> {
  if (!value) return 0;
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq(field, value);
  if (workspaceId && field !== "workspace_id") q = q.eq("workspace_id", workspaceId);
  const { count: c } = await q;
  return c ?? 0;
}
