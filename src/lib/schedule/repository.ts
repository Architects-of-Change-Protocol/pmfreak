import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { ExecutionTaskRow, ExecutionTaskDependencyRow, ProjectMilestoneRow } from "@/lib/db/database-contract";
import {
  EXECUTION_TASK_SELECTABLE_COLUMNS,
  EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS,
  PROJECT_MILESTONE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { computeScheduleHealth } from "./health";
import type { ScheduleSummary } from "./types";

const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");
const DEP_SELECT = EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS.join(",");
const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");

export async function getProjectSchedule(input: {
  projectId: string;
}): Promise<{ ok: true; schedule: ScheduleSummary } | { ok: false; error: string; failureClass: string }> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  try {
    await requireProjectAccess(input.projectId, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const [milestonesResult, tasksResult, depsResult] = await Promise.all([
    supabase
      .from("project_milestones")
      .select(MILESTONE_SELECT)
      .eq("project_id", input.projectId)
      .order("target_date", { ascending: true, nullsFirst: false })
      .overrideTypes<ProjectMilestoneRow[], { merge: false }>(),
    supabase
      .from("execution_tasks")
      .select(TASK_SELECT)
      .eq("project_id", input.projectId)
      .overrideTypes<ExecutionTaskRow[], { merge: false }>(),
    supabase
      .from("execution_task_dependencies")
      .select(DEP_SELECT)
      .eq("project_id", input.projectId)
      .overrideTypes<ExecutionTaskDependencyRow[], { merge: false }>(),
  ]);

  if (milestonesResult.error || tasksResult.error || depsResult.error) {
    return { ok: false, error: "Failed to load schedule data.", failureClass: "persistence_failed" };
  }

  const milestones = milestonesResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const dependencies = depsResult.data ?? [];

  const health = computeScheduleHealth({ tasks, milestones, dependencies });

  return {
    ok: true,
    schedule: { milestones, tasks, dependencies, health },
  };
}
