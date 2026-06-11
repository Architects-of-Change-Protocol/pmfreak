import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { generateTaskDraftFromRecommendedAction } from "@/lib/task-drafts/generate-task-draft";
import type { TaskDraftRow, TaskDraftStatus } from "@/lib/db/database-contract";

export type TaskDraftMaterializationResult =
  | { ok: true; draft: TaskDraftRow; created: boolean; preserved: boolean }
  | { ok: false; error: string; failureClass: string };

const IMMUTABLE_STATUSES: TaskDraftStatus[] = ["approved", "discarded", "converted_to_task"];

export async function materializeTaskDraftForRecommendedAction(input: {
  recommendedActionId: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<TaskDraftMaterializationResult> {
  const startedAt = Date.now();

  let userId: string;
  if (input.actorUserId) {
    userId = input.actorUserId;
  } else {
    try {
      const { user } = await requireAuthenticatedUser();
      userId = user.id;
    } catch {
      return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
    }
  }

  const supabase = await createSupabaseServerClient();

  const { data: action, error: actionError } = await supabase
    .from("recommended_actions")
    .select("id,workspace_id,project_id,raid_item_id,governance_event_id,title,description,recommended_action_type,impact_level,confidence_score,recommended_owner,recommended_due_window,rationale,evidence_summary,status,converted_task_id,decided_by,decided_at,decision_reason,decision_metadata")
    .eq("id", input.recommendedActionId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      project_id: string;
      raid_item_id: string | null;
      governance_event_id: string | null;
      title: string;
      description: string;
      recommended_action_type: string;
      impact_level: string | null;
      confidence_score: number | null;
      recommended_owner: string | null;
      recommended_due_window: string | null;
      rationale: Record<string, unknown> | null;
      evidence_summary: Record<string, unknown> | null;
      status: string;
      converted_task_id: string | null;
      decided_by: string | null;
      decided_at: string | null;
      decision_reason: string | null;
      decision_metadata: Record<string, unknown>;
    }>();

  if (actionError) {
    return { ok: false, error: "Unable to load recommended action.", failureClass: "persistence_failed" };
  }
  if (!action) {
    return { ok: false, error: "Recommended action not found.", failureClass: "not_found" };
  }
  if (action.governance_event_id) {
    return { ok: false, error: "Governed recommendations must be decided through the evidence-backed operational decision flow.", failureClass: "governed_flow_required" };
  }

  try {
    await requireProjectAccess(action.project_id, "write");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization check failed.", failureClass: "unauthorized" };
  }

  let raidItem: {
    id: string;
    category: string;
    title: string;
    description: string;
    owner: string | null;
    due_date: string | null;
  } | null = null;

  if (action.raid_item_id) {
    const { data: raidRow } = await supabase
      .from("raid_items")
      .select("id,category,title,description,owner,due_date")
      .eq("id", action.raid_item_id)
      .maybeSingle<{ id: string; category: string; title: string; description: string; owner: string | null; due_date: string | null }>();
    raidItem = raidRow ?? null;
  }

  console.info("task_draft.materialization.started", {
    workspaceId: action.workspace_id,
    projectId: action.project_id,
    recommendedActionId: action.id,
    raidItemId: raidItem?.id ?? null,
  });

  let generated;
  try {
    generated = generateTaskDraftFromRecommendedAction({
      recommendedAction: action,
      raidItem,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown";
    console.error("task_draft.materialization.failed", {
      workspaceId: action.workspace_id,
      projectId: action.project_id,
      recommendedActionId: action.id,
      raidItemId: raidItem?.id ?? null,
      durationMs: Date.now() - startedAt,
      error: msg,
    });
    return { ok: false, error: "Draft generation failed.", failureClass: "generation_failed" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("task_drafts")
    .select("id,draft_status,workspace_id,project_id,recommended_action_id,raid_item_id,title,description,suggested_owner,suggested_due_date,suggested_due_window,priority,source_type,source_payload,acceptance_criteria,checklist,confidence_score,created_by,created_at,updated_at")
    .eq("workspace_id", action.workspace_id)
    .eq("recommended_action_id", action.id)
    .maybeSingle<TaskDraftRow>();

  if (existingError) {
    return { ok: false, error: "Unable to check for existing draft.", failureClass: "persistence_failed" };
  }

  let draft: TaskDraftRow;
  let created = false;
  let preserved = false;

  if (existing) {
    const status = existing.draft_status as TaskDraftStatus;
    if (IMMUTABLE_STATUSES.includes(status)) {
      preserved = true;
      draft = existing;

      console.info("task_draft.materialization.completed", {
        workspaceId: action.workspace_id,
        projectId: action.project_id,
        recommendedActionId: action.id,
        raidItemId: raidItem?.id ?? null,
        created: false,
        preserved: true,
        durationMs: Date.now() - startedAt,
      });

      return { ok: true, draft, created, preserved };
    }

    const { data: updated, error: updateError } = await supabase
      .from("task_drafts")
      .update({
        title: generated.title,
        description: generated.description,
        suggested_owner: generated.suggestedOwner,
        suggested_due_window: generated.suggestedDueWindow,
        priority: generated.priority,
        source_payload: generated.sourcePayload,
        acceptance_criteria: generated.acceptanceCriteria,
        checklist: generated.checklist,
        confidence_score: generated.confidenceScore,
        raid_item_id: raidItem?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id,draft_status,workspace_id,project_id,recommended_action_id,raid_item_id,title,description,suggested_owner,suggested_due_date,suggested_due_window,priority,source_type,source_payload,acceptance_criteria,checklist,confidence_score,created_by,created_at,updated_at")
      .single<TaskDraftRow>();

    if (updateError || !updated) {
      return { ok: false, error: "Unable to update draft.", failureClass: "persistence_failed" };
    }

    draft = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("task_drafts")
      .insert({
        workspace_id: action.workspace_id,
        project_id: action.project_id,
        recommended_action_id: action.id,
        raid_item_id: raidItem?.id ?? null,
        title: generated.title,
        description: generated.description,
        draft_status: "draft",
        suggested_owner: generated.suggestedOwner,
        suggested_due_window: generated.suggestedDueWindow,
        priority: generated.priority,
        source_type: "recommended_action",
        source_payload: generated.sourcePayload,
        acceptance_criteria: generated.acceptanceCriteria,
        checklist: generated.checklist,
        confidence_score: generated.confidenceScore,
        created_by: userId,
      })
      .select("id,draft_status,workspace_id,project_id,recommended_action_id,raid_item_id,title,description,suggested_owner,suggested_due_date,suggested_due_window,priority,source_type,source_payload,acceptance_criteria,checklist,confidence_score,created_by,created_at,updated_at")
      .single<TaskDraftRow>();

    if (insertError || !inserted) {
      return { ok: false, error: "Unable to create draft.", failureClass: "persistence_failed" };
    }

    draft = inserted;
    created = true;
  }

  // Update recommended_action to converted_to_task and set converted_task_id
  const previousStatus = action.status;
  const needsStatusUpdate = action.status !== "converted_to_task";

  if (needsStatusUpdate || action.converted_task_id !== draft.id) {
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      converted_task_id: draft.id,
      updated_at: now,
    };
    if (needsStatusUpdate) {
      updatePayload.status = "converted_to_task";
      updatePayload.decided_by = userId;
      updatePayload.decided_at = now;
    }

    await supabase
      .from("recommended_actions")
      .update(updatePayload)
      .eq("id", action.id);

    if (needsStatusUpdate) {
      await supabase.from("recommended_action_decisions").insert({
        workspace_id: action.workspace_id,
        project_id: action.project_id,
        recommended_action_id: action.id,
        previous_status: previousStatus,
        new_status: "converted_to_task",
        decision_reason: "Task draft created via H5 materialization",
        decision_metadata: input.metadata ?? {},
        decided_by: userId,
        decided_at: now,
      });
    }
  }

  console.info("task_draft.materialization.completed", {
    workspaceId: action.workspace_id,
    projectId: action.project_id,
    recommendedActionId: action.id,
    raidItemId: raidItem?.id ?? null,
    created,
    preserved: false,
    durationMs: Date.now() - startedAt,
  });

  return { ok: true, draft, created, preserved: false };
}
