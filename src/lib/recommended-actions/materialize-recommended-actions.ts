import type { SupabaseClient } from "@supabase/supabase-js";

import { generateRecommendedActions } from "@/lib/recommended-actions/generate-recommended-actions";
import type { RaidCategory } from "@/lib/raid";

type RaidItemRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  category: string;
  title: string;
  description: string;
  confidence_score: number;
  owner: string | null;
  source_signal_id: string | null;
};

export type RecommendedActionsMaterializationResult = {
  created: number;
  updated: number;
  skipped: number;
};

export async function materializeRecommendedActions(input: {
  workspaceId: string;
  projectId: string;
  supabase: SupabaseClient;
  requestId?: string;
}): Promise<RecommendedActionsMaterializationResult> {
  const startedAt = Date.now();

  console.info("recommended_actions.started", {
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });

  try {
    const { data: raidRows, error: raidError } = await input.supabase
      .from("raid_items")
      .select("id,workspace_id,project_id,category,title,description,confidence_score,owner,source_signal_id")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .in("status", ["open", "monitoring"]);

    if (raidError) throw new Error(`Unable to load RAID items: ${raidError.message}`);

    const items = (raidRows ?? []) as RaidItemRow[];

    if (items.length === 0) {
      const result = { created: 0, updated: 0, skipped: 0 };
      console.info("recommended_actions.completed", {
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        ...result,
        durationMs: Date.now() - startedAt,
      });
      return result;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raidItem of items) {
      const actions = generateRecommendedActions({
        id: raidItem.id,
        workspaceId: raidItem.workspace_id,
        projectId: raidItem.project_id,
        category: raidItem.category as RaidCategory,
        title: raidItem.title,
        description: raidItem.description,
        confidenceScore: Number(raidItem.confidence_score),
        owner: raidItem.owner,
        sourceSignalId: raidItem.source_signal_id,
      });

      for (const action of actions) {
        const { data: existing, error: selectError } = await input.supabase
          .from("recommended_actions")
          .select("id,confidence_score,status")
          .eq("workspace_id", input.workspaceId)
          .eq("fingerprint", action.fingerprint)
          .maybeSingle<{ id: string; confidence_score: number; status: string }>();

        if (selectError) throw new Error(`Unable to check existing recommended action: ${selectError.message}`);

        if (existing) {
          if (existing.status !== "proposed") {
            console.info("recommended_actions.preserved_decision", {
              actionId: existing.id,
              status: existing.status,
              projectId: raidItem.project_id,
              raidItemId: raidItem.id,
              fingerprint: action.fingerprint,
            });
            skipped += 1;
            continue;
          }
          const newConfidence = Math.max(Number(existing.confidence_score ?? 0), action.confidenceScore);
          const { error: updateError } = await input.supabase
            .from("recommended_actions")
            .update({
              confidence_score: newConfidence,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updateError) throw new Error(`Unable to update recommended action: ${updateError.message}`);
          updated += 1;
          continue;
        }

        const { error: insertError } = await input.supabase.from("recommended_actions").insert({
          id: action.id,
          workspace_id: action.workspaceId,
          project_id: action.projectId,
          raid_item_id: action.raidItemId,
          title: action.title,
          description: action.description,
          recommended_action_type: action.recommendedActionType,
          status: action.status,
          confidence_score: action.confidenceScore,
          impact_level: action.impactLevel,
          rationale: action.rationale,
          recommended_owner: action.recommendedOwner,
          recommended_due_window: action.recommendedDueWindow,
          evidence_summary: action.evidenceSummary,
          source_signal_id: action.sourceSignalId,
          fingerprint: action.fingerprint,
        });

        if (insertError) throw new Error(`Unable to insert recommended action: ${insertError.message}`);
        created += 1;
      }
    }

    const result = { created, updated, skipped };
    console.info("recommended_actions.completed", {
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      ...result,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    console.error("recommended_actions.failed", {
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
