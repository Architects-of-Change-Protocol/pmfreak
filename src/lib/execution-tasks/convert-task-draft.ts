import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { ExecutionTaskRow, TaskDraftRow } from "@/lib/db/database-contract";

export type TaskConversionResult =
  | { ok: true; task: ExecutionTaskRow }
  | { ok: false; error: string; failureClass: string };

export async function convertTaskDraftToExecutionTask(input: {
  taskDraftId: string;
  actorUserId?: string;
}): Promise<TaskConversionResult> {
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

  const { data: draft, error: draftError } = await supabase
    .from("task_drafts")
    .select("id,workspace_id,project_id,recommended_action_id,raid_item_id,title,description,draft_status,suggested_owner,suggested_due_date,suggested_due_window,priority,source_type,source_payload,acceptance_criteria,checklist,confidence_score,created_by,created_at,updated_at")
    .eq("id", input.taskDraftId)
    .maybeSingle<TaskDraftRow>();

  if (draftError) {
    return { ok: false, error: "Unable to load task draft.", failureClass: "persistence_failed" };
  }
  if (!draft) {
    return { ok: false, error: "Task draft not found.", failureClass: "not_found" };
  }

  try {
    await requireProjectAccess(draft.project_id, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization check failed.", failureClass: "unauthorized" };
  }

  if (draft.draft_status !== "approved") {
    return {
      ok: false,
      error: `Draft must be approved before conversion. Current status: ${draft.draft_status}.`,
      failureClass: "invalid_transition",
    };
  }

  // Duplicate prevention: check if a task already exists for this draft
  const { data: existing, error: existingError } = await supabase
    .from("execution_tasks")
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .eq("task_draft_id", input.taskDraftId)
    .maybeSingle<ExecutionTaskRow>();

  if (existingError) {
    return { ok: false, error: "Unable to check for existing task.", failureClass: "persistence_failed" };
  }
  if (existing) {
    return { ok: false, error: "Execution task already exists for this draft.", failureClass: "duplicate" };
  }

  console.info("execution_task.conversion.started", {
    workspaceId: draft.workspace_id,
    projectId: draft.project_id,
    taskDraftId: draft.id,
  });

  const sourcePayload: Record<string, unknown> = {
    ...(draft.source_payload ?? {}),
    taskDraftId: draft.id,
    recommendedActionId: draft.recommended_action_id ?? null,
    raidItemId: draft.raid_item_id ?? null,
    convertedAt: new Date().toISOString(),
    convertedBy: userId,
  };

  const { data: task, error: insertError } = await supabase
    .from("execution_tasks")
    .insert({
      workspace_id: draft.workspace_id,
      project_id: draft.project_id,
      task_draft_id: draft.id,
      recommended_action_id: draft.recommended_action_id ?? null,
      raid_item_id: draft.raid_item_id ?? null,
      title: draft.title,
      description: draft.description,
      status: "not_started",
      priority: draft.priority,
      owner_name: draft.suggested_owner ?? null,
      due_date: draft.suggested_due_date ?? null,
      acceptance_criteria: draft.acceptance_criteria ?? [],
      checklist: draft.checklist ?? [],
      confidence_score: draft.confidence_score ?? null,
      source_payload: sourcePayload,
      created_by: userId,
    })
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .single<ExecutionTaskRow>();

  if (insertError || !task) {
    console.error("execution_task.conversion.failed", {
      workspaceId: draft.workspace_id,
      projectId: draft.project_id,
      taskDraftId: draft.id,
      durationMs: Date.now() - startedAt,
      error: insertError?.message ?? "insert returned no data",
    });
    return { ok: false, error: "Unable to create execution task.", failureClass: "persistence_failed" };
  }

  // Mark the draft as converted
  await supabase
    .from("task_drafts")
    .update({ draft_status: "converted_to_task", updated_at: new Date().toISOString() })
    .eq("id", draft.id);

  // Write task_created activity event
  await supabase.from("execution_task_events").insert({
    workspace_id: task.workspace_id,
    project_id: task.project_id,
    task_id: task.id,
    event_type: "task_created",
    event_payload: {
      taskDraftId: draft.id,
      recommendedActionId: draft.recommended_action_id ?? null,
      raidItemId: draft.raid_item_id ?? null,
      title: task.title,
      priority: task.priority,
      status: task.status,
    },
    actor_user_id: userId,
  });

  console.info("execution_task.created", {
    workspaceId: task.workspace_id,
    projectId: task.project_id,
    taskId: task.id,
    status: task.status,
    owner: task.owner_name,
    durationMs: Date.now() - startedAt,
  });

  return { ok: true, task };
}
