import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { validateUpdateExecutionTaskInput } from "@/lib/execution-tasks/validate-update-execution-task-input";
import { listWorkspaceMembersForAssignment } from "@/lib/workspace-team";
import type { ExecutionTaskEventRow, ExecutionTaskRow } from "@/lib/db/database-contract";

type Params = { params: Promise<{ taskId: string }> };

const TASK_COLUMNS =
  "id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at";

/**
 * Task Detail read/write surface (see docs/architecture/
 * daily-execution-workspace.md). Additive alongside the existing
 * /update and /activity sub-routes, which stay in place for Command
 * Center and ProjectTaskList's quick status control — this route is what
 * the shared TaskDetail drawer and Daily Execution Workspace call.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: task, error: taskError } = await supabase
    .from("execution_tasks")
    .select(TASK_COLUMNS)
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
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }

  // canEdit/canAssign share one gate (project "write") — this domain has no
  // separate assign-only permission tier. canDelete is always false: this
  // sprint does not implement archive/delete (see Known gaps).
  let canEdit = false;
  try {
    await requireProjectAccess(task.project_id, "write");
    canEdit = true;
  } catch {
    canEdit = false;
  }

  const { data: events, error: eventsError } = await supabase
    .from("execution_task_events")
    .select("id,workspace_id,project_id,task_id,event_type,event_payload,actor_user_id,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .returns<ExecutionTaskEventRow[]>();

  if (eventsError) {
    return NextResponse.json({ ok: false, error: "Unable to load activity.", failureClass: "persistence_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      task,
      permissions: { canEdit, canAssign: canEdit, canDelete: false },
      activity: events ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

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

  const supabase = await createSupabaseServerClient();

  const { data: task, error: taskError } = await supabase
    .from("execution_tasks")
    .select(TASK_COLUMNS)
    .eq("id", taskId)
    .maybeSingle<ExecutionTaskRow>();

  if (taskError) {
    return NextResponse.json({ ok: false, error: "Unable to load task.", failureClass: "persistence_failed" }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found.", failureClass: "not_found" }, { status: 404 });
  }

  const governedTask =
    (task.source_payload as { source?: unknown } | null)?.source === "governed_action";
  const rawPatch = body as Record<string, unknown>;
  const governedLifecycleMutation = governedTask && rawPatch.status !== undefined;

  if (governedLifecycleMutation) {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", task.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { ok: false, error: "Unable to verify task write role.", failureClass: "persistence_failed" },
        { status: 500 },
      );
    }

    if (!membership?.role || !["owner", "admin", "pm"].includes(String(membership.role))) {
      return NextResponse.json(
        { ok: false, error: "Access denied.", failureClass: "unauthorized" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Governed Task lifecycle must use internal execution.",
        failureClass: "governed_task_status_requires_internal_execution",
      },
      { status: 409 },
    );
  }

  // Preserve the existing Enterprise runtime authorization for every
  // non-governed Task mutation.
  try {
    await requireProjectAccess(task.project_id, "write");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }
  const validated = validateUpdateExecutionTaskInput(body, task.status);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: "Invalid update.", failureClass: "validation_failed", fieldErrors: validated.errors }, { status: 400 });
  }
  const patch = validated.data;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No valid fields to update.", failureClass: "validation_failed" }, { status: 400 });
  }

  // An assignee must be a real member of this task's own workspace — never
  // trust the client, never allow a foreign-workspace user through. Reuses
  // the same member directory + display-name resolution as the Quick Add
  // Task assignee selector rather than a second lookup path.
  let ownerName: string | null | undefined;
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId === null) {
      ownerName = null;
    } else {
      const members = await listWorkspaceMembersForAssignment(task.workspace_id);
      const member = members.find((m) => m.userId === patch.assigneeId);
      if (!member) {
        return NextResponse.json(
          { ok: false, error: "Assignee must be a member of this workspace.", failureClass: "validation_failed", fieldErrors: [{ field: "assigneeId", message: "Assignee must be a member of this workspace." }] },
          { status: 400 },
        );
      }
      ownerName = member.displayName;
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const events: Array<{ event_type: string; event_payload: Record<string, unknown> }> = [];

  if (patch.title !== undefined && patch.title !== task.title) {
    updates.title = patch.title;
    events.push({ event_type: "task_title_changed", event_payload: { previousTitle: task.title, newTitle: patch.title } });
  }

  if (patch.description !== undefined && patch.description !== task.description) {
    updates.description = patch.description ?? "";
    events.push({ event_type: "task_description_changed", event_payload: { previousDescription: task.description, newDescription: patch.description ?? "" } });
  }

  if (patch.status !== undefined && patch.status !== task.status) {
    updates.status = patch.status;
    events.push({
      event_type: patch.status === "completed" ? "task_completed" : patch.status === "cancelled" ? "task_cancelled" : "task_status_changed",
      event_payload: { previousStatus: task.status, newStatus: patch.status },
    });
    if (patch.status === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.progress_percent = 100;
    } else if (task.status === "completed") {
      // Reopening a completed task clears the completion stamp — a task
      // that is in_progress again was not, in fact, completed.
      updates.completed_at = null;
    }
  }

  if (patch.priority !== undefined && patch.priority !== task.priority) {
    updates.priority = patch.priority;
    events.push({ event_type: "task_priority_changed", event_payload: { previousPriority: task.priority, newPriority: patch.priority } });
  }

  if (patch.assigneeId !== undefined && patch.assigneeId !== task.owner_user_id) {
    updates.owner_user_id = patch.assigneeId;
    updates.owner_name = ownerName ?? null;
    events.push({
      event_type: "task_assignee_changed",
      event_payload: { previousOwnerUserId: task.owner_user_id, newOwnerUserId: patch.assigneeId },
    });
  }

  if (patch.dueDate !== undefined && patch.dueDate !== task.due_date) {
    updates.due_date = patch.dueDate;
    events.push({ event_type: "task_due_date_changed", event_payload: { previousDueDate: task.due_date, newDueDate: patch.dueDate } });
  }

  if (events.length === 0) {
    // Every requested field already matched the current value — nothing to
    // persist or audit, but this is not an error (e.g. re-saving the drawer).
    return NextResponse.json({ ok: true, task });
  }

  const { data: updated, error: updateError } = await supabase
    .from("execution_tasks")
    .update(updates)
    .eq("id", task.id)
    .select(TASK_COLUMNS)
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

  console.info("execution_task.detail_updated", {
    workspaceId: updated.workspace_id,
    projectId: updated.project_id,
    taskId: updated.id,
    fields: events.map((e) => e.event_type),
  });

  return NextResponse.json({ ok: true, task: updated });
}
