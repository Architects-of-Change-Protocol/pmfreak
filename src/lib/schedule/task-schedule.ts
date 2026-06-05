import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { ExecutionTaskRow, ProjectMilestoneRow, TaskScheduleStatus } from "@/lib/db/database-contract";
import { EXECUTION_TASK_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";

const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");

export type TaskScheduleResult =
  | { ok: true; task: ExecutionTaskRow }
  | { ok: false; error: string; failureClass: string };

export async function updateExecutionTaskSchedule(input: {
  taskId: string;
  plannedStartDate?: string | null;
  plannedFinishDate?: string | null;
  baselineStartDate?: string | null;
  baselineFinishDate?: string | null;
  forecastStartDate?: string | null;
  forecastFinishDate?: string | null;
  milestoneId?: string | null;
  scheduleStatus?: TaskScheduleStatus;
  scheduleConfidence?: number | null;
}): Promise<TaskScheduleResult> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: task } = await supabase
    .from("execution_tasks")
    .select(TASK_SELECT)
    .eq("id", input.taskId)
    .maybeSingle<ExecutionTaskRow>();

  if (!task) {
    return { ok: false, error: "Task not found.", failureClass: "not_found" };
  }

  try {
    await requireProjectAccess(task.project_id, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  // Validate date windows
  if (input.plannedStartDate && input.plannedFinishDate) {
    if (new Date(input.plannedStartDate) > new Date(input.plannedFinishDate)) {
      return { ok: false, error: "planned_start_date must be <= planned_finish_date.", failureClass: "validation_failed" };
    }
  }
  if (input.baselineStartDate && input.baselineFinishDate) {
    if (new Date(input.baselineStartDate) > new Date(input.baselineFinishDate)) {
      return { ok: false, error: "baseline_start_date must be <= baseline_finish_date.", failureClass: "validation_failed" };
    }
  }
  if (input.forecastStartDate && input.forecastFinishDate) {
    if (new Date(input.forecastStartDate) > new Date(input.forecastFinishDate)) {
      return { ok: false, error: "forecast_start_date must be <= forecast_finish_date.", failureClass: "validation_failed" };
    }
  }

  // Validate milestone belongs to same project/workspace
  const previousMilestoneId = task.milestone_id;
  if (input.milestoneId) {
    const { data: milestone } = await supabase
      .from("project_milestones")
      .select("id,project_id,workspace_id")
      .eq("id", input.milestoneId)
      .maybeSingle<Pick<ProjectMilestoneRow, "id" | "project_id" | "workspace_id">>();

    if (!milestone) {
      return { ok: false, error: "Milestone not found.", failureClass: "not_found" };
    }
    if (milestone.project_id !== task.project_id || milestone.workspace_id !== task.workspace_id) {
      return { ok: false, error: "Milestone belongs to a different project.", failureClass: "validation_failed" };
    }
  }

  const updates: Record<string, unknown> = {};
  if (input.plannedStartDate !== undefined) updates.planned_start_date = input.plannedStartDate;
  if (input.plannedFinishDate !== undefined) updates.planned_finish_date = input.plannedFinishDate;
  if (input.baselineStartDate !== undefined) updates.baseline_start_date = input.baselineStartDate;
  if (input.baselineFinishDate !== undefined) updates.baseline_finish_date = input.baselineFinishDate;
  if (input.forecastStartDate !== undefined) updates.forecast_start_date = input.forecastStartDate;
  if (input.forecastFinishDate !== undefined) updates.forecast_finish_date = input.forecastFinishDate;
  if (input.milestoneId !== undefined) updates.milestone_id = input.milestoneId;
  if (input.scheduleStatus !== undefined) updates.schedule_status = input.scheduleStatus;
  if (input.scheduleConfidence !== undefined) updates.schedule_confidence = input.scheduleConfidence;

  const { data: updated, error } = await supabase
    .from("execution_tasks")
    .update(updates)
    .eq("id", input.taskId)
    .select(TASK_SELECT)
    .single<ExecutionTaskRow>();

  if (error || !updated) {
    return { ok: false, error: "Failed to update task schedule.", failureClass: "persistence_failed" };
  }

  // Audit events
  const events: Array<Record<string, unknown>> = [
    {
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: task.id,
      event_type: "schedule_updated",
      event_payload: {
        plannedStartDate: input.plannedStartDate,
        plannedFinishDate: input.plannedFinishDate,
        scheduleStatus: input.scheduleStatus,
        updatedBy: userId,
      },
      actor_user_id: userId,
    },
  ];

  if (input.milestoneId !== undefined && input.milestoneId !== null && input.milestoneId !== previousMilestoneId) {
    events.push({
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: task.id,
      event_type: "milestone_linked",
      event_payload: { milestoneId: input.milestoneId, updatedBy: userId },
      actor_user_id: userId,
    });
  } else if (input.milestoneId === null && previousMilestoneId) {
    events.push({
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: task.id,
      event_type: "milestone_unlinked",
      event_payload: { previousMilestoneId, updatedBy: userId },
      actor_user_id: userId,
    });
  }

  await supabase.from("execution_task_events").insert(events);

  return { ok: true, task: updated };
}
