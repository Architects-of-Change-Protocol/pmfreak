import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { isValidStatusTransition } from "@/lib/execution-tasks/lifecycle";
import type { ExecutionTaskRow, ExecutionTaskStatus } from "@/lib/db/database-contract";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON.", failureClass: "validation_failed" }, { status: 400 });
  }

  const { taskId, status, ownerUserId, ownerName, progressPercent, dueDate } = body as Record<string, unknown>;

  if (!taskId || typeof taskId !== "string") {
    return NextResponse.json({ ok: false, error: "taskId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: task, error: taskError } = await supabase
    .from("execution_tasks")
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .eq("id", taskId)
    .maybeSingle<ExecutionTaskRow>();

  if (taskError) {
    return NextResponse.json({ ok: false, error: "Unable to load task.", failureClass: "persistence_failed" }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found.", failureClass: "not_found" }, { status: 404 });
  }

  try {
    await requireProjectAccess(task.project_id, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const events: Array<{ event_type: string; event_payload: Record<string, unknown> }> = [];

  if (status !== undefined) {
    if (typeof status !== "string") {
      return NextResponse.json({ ok: false, error: "status must be a string.", failureClass: "validation_failed" }, { status: 400 });
    }
    const newStatus = status as ExecutionTaskStatus;
    if (!isValidStatusTransition(task.status, newStatus)) {
      return NextResponse.json({
        ok: false,
        error: `Invalid status transition: ${task.status} → ${newStatus}.`,
        failureClass: "invalid_transition",
      }, { status: 400 });
    }
    updates.status = newStatus;
    events.push({
      event_type: newStatus === "completed" ? "task_completed" : newStatus === "cancelled" ? "task_cancelled" : "status_changed",
      event_payload: { previousStatus: task.status, newStatus },
    });
    if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.progress_percent = 100;
    }
  }

  if (ownerUserId !== undefined || ownerName !== undefined) {
    if (ownerUserId !== undefined) updates.owner_user_id = ownerUserId ?? null;
    if (ownerName !== undefined) updates.owner_name = ownerName ?? null;
    events.push({
      event_type: "owner_changed",
      event_payload: {
        previousOwnerUserId: task.owner_user_id,
        previousOwnerName: task.owner_name,
        newOwnerUserId: ownerUserId ?? task.owner_user_id,
        newOwnerName: ownerName ?? task.owner_name,
      },
    });
  }

  if (progressPercent !== undefined) {
    if (typeof progressPercent !== "number" || progressPercent < 0 || progressPercent > 100) {
      return NextResponse.json({ ok: false, error: "progressPercent must be 0–100.", failureClass: "validation_failed" }, { status: 400 });
    }
    updates.progress_percent = progressPercent;
    events.push({
      event_type: "progress_updated",
      event_payload: { previousProgress: task.progress_percent, newProgress: progressPercent },
    });
  }

  if (dueDate !== undefined) {
    updates.due_date = dueDate ?? null;
    events.push({
      event_type: "due_date_changed",
      event_payload: { previousDueDate: task.due_date, newDueDate: dueDate ?? null },
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("execution_tasks")
    .update(updates)
    .eq("id", task.id)
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .single<ExecutionTaskRow>();

  if (updateError || !updated) {
    return NextResponse.json({ ok: false, error: "Unable to update task.", failureClass: "persistence_failed" }, { status: 500 });
  }

  for (const ev of events) {
    await supabase.from("execution_task_events").insert({
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: task.id,
      event_type: ev.event_type,
      event_payload: ev.event_payload,
      actor_user_id: userId,
    });
  }

  const finalStatus = updated.status as ExecutionTaskStatus;
  console.info("execution_task.updated", {
    workspaceId: updated.workspace_id,
    projectId: updated.project_id,
    taskId: updated.id,
    status: finalStatus,
    owner: updated.owner_name,
  });

  if (finalStatus === "completed") {
    console.info("execution_task.completed", {
      workspaceId: updated.workspace_id,
      projectId: updated.project_id,
      taskId: updated.id,
      status: finalStatus,
      owner: updated.owner_name,
    });
  }

  return NextResponse.json({ ok: true, task: updated });
}
