import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type {
  ExecutionTaskRow,
  ExecutionTaskDependencyRow,
} from "@/lib/db/database-contract";
import type { ExecutionTaskDependencyType } from "./types";
import { detectDependencyCycle } from "./graph";

export type CreateExecutionTaskDependencyResult =
  | { ok: true; dependency: ExecutionTaskDependencyRow; duplicate: boolean }
  | { ok: false; error: string; failureClass: string };

export async function createExecutionTaskDependency(input: {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType?: ExecutionTaskDependencyType;
  reason?: string;
  lagDays?: number;
  status?: "proposed" | "active";
  sourceType?: "manual" | "recommended_action" | "raid" | "discovery" | "system";
  sourcePayload?: Record<string, unknown>;
  confidenceScore?: number | null;
  actorUserId?: string;
}): Promise<CreateExecutionTaskDependencyResult> {
  const depType = input.dependencyType ?? "finish_to_start";
  const depStatus = input.status ?? "active";

  // 1. Authenticate
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

  // 5. Prevent self-dependency
  if (input.predecessorTaskId === input.successorTaskId) {
    return { ok: false, error: "A task cannot depend on itself.", failureClass: "self_dependency" };
  }

  const supabase = await createSupabaseServerClient();

  // 2. Load both tasks
  const [predResult, succResult] = await Promise.all([
    supabase
      .from("execution_tasks")
      .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
      .eq("id", input.predecessorTaskId)
      .maybeSingle<ExecutionTaskRow>(),
    supabase
      .from("execution_tasks")
      .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
      .eq("id", input.successorTaskId)
      .maybeSingle<ExecutionTaskRow>(),
  ]);

  if (predResult.error || succResult.error) {
    return { ok: false, error: "Unable to load tasks.", failureClass: "persistence_failed" };
  }
  if (!predResult.data) {
    return { ok: false, error: "Predecessor task not found.", failureClass: "not_found" };
  }
  if (!succResult.data) {
    return { ok: false, error: "Successor task not found.", failureClass: "not_found" };
  }

  const predTask = predResult.data;
  const succTask = succResult.data;

  // 3. Validate same workspace and project
  if (predTask.workspace_id !== succTask.workspace_id || predTask.project_id !== succTask.project_id) {
    return {
      ok: false,
      error: "Dependencies must be within the same project.",
      failureClass: "cross_project_dependency",
    };
  }

  // 4. Validate project access
  try {
    await requireProjectAccess(predTask.project_id, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization check failed.", failureClass: "unauthorized" };
  }

  // 6. Check for duplicate
  const { data: existing, error: dupError } = await supabase
    .from("execution_task_dependencies")
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .eq("workspace_id", predTask.workspace_id)
    .eq("predecessor_task_id", input.predecessorTaskId)
    .eq("successor_task_id", input.successorTaskId)
    .eq("dependency_type", depType)
    .maybeSingle<ExecutionTaskDependencyRow>();

  if (dupError) {
    return { ok: false, error: "Unable to check for existing dependency.", failureClass: "persistence_failed" };
  }
  if (existing) {
    return { ok: true, dependency: existing, duplicate: true };
  }

  // 7. Detect direct reverse dependency
  const { data: reverse } = await supabase
    .from("execution_task_dependencies")
    .select("id")
    .eq("predecessor_task_id", input.successorTaskId)
    .eq("successor_task_id", input.predecessorTaskId)
    .in("status", ["active", "proposed"])
    .maybeSingle();

  if (reverse) {
    return {
      ok: false,
      error: "A reverse dependency already exists between these tasks.",
      failureClass: "reverse_dependency",
    };
  }

  // 8. Detect cycle in graph
  const { data: allDeps } = await supabase
    .from("execution_task_dependencies")
    .select("id,predecessor_task_id,successor_task_id,status")
    .eq("project_id", predTask.project_id)
    .in("status", ["active", "proposed"]);

  const existingEdges = (allDeps ?? []).map((d: { predecessor_task_id: string; successor_task_id: string }) => ({
    predecessorId: d.predecessor_task_id,
    successorId: d.successor_task_id,
  }));

  const { hasCycle, path } = detectDependencyCycle(existingEdges, {
    predecessorId: input.predecessorTaskId,
    successorId: input.successorTaskId,
  });

  if (hasCycle) {
    await supabase.from("execution_task_events").insert({
      workspace_id: predTask.workspace_id,
      project_id: predTask.project_id,
      task_id: input.predecessorTaskId,
      event_type: "dependency_cycle_rejected",
      event_payload: {
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        dependencyType: depType,
        cyclePath: path,
      },
      actor_user_id: userId,
    });
    return {
      ok: false,
      error: `Dependency would create a cycle: ${path.join(" → ")}.`,
      failureClass: "cycle_detected",
    };
  }

  // 9. Insert dependency
  const { data: dep, error: insertError } = await supabase
    .from("execution_task_dependencies")
    .insert({
      workspace_id: predTask.workspace_id,
      project_id: predTask.project_id,
      predecessor_task_id: input.predecessorTaskId,
      successor_task_id: input.successorTaskId,
      dependency_type: depType,
      status: depStatus,
      lag_days: input.lagDays ?? 0,
      reason: input.reason ?? null,
      source_type: input.sourceType ?? "manual",
      source_payload: input.sourcePayload ?? {},
      confidence_score: input.confidenceScore ?? null,
      created_by: userId,
    })
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .single<ExecutionTaskDependencyRow>();

  if (insertError || !dep) {
    return { ok: false, error: "Unable to create dependency.", failureClass: "persistence_failed" };
  }

  // 10. Write audit events
  await Promise.all([
    supabase.from("execution_task_events").insert({
      workspace_id: predTask.workspace_id,
      project_id: predTask.project_id,
      task_id: input.predecessorTaskId,
      event_type: "dependency_created",
      event_payload: {
        dependencyId: dep.id,
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        dependencyType: depType,
        newStatus: depStatus,
        actorUserId: userId,
        reason: input.reason ?? null,
      },
      actor_user_id: userId,
    }),
    supabase.from("execution_task_events").insert({
      workspace_id: succTask.workspace_id,
      project_id: succTask.project_id,
      task_id: input.successorTaskId,
      event_type: "dependency_added",
      event_payload: {
        dependencyId: dep.id,
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        dependencyType: depType,
        newStatus: depStatus,
        actorUserId: userId,
        reason: input.reason ?? null,
      },
      actor_user_id: userId,
    }),
  ]);

  return { ok: true, dependency: dep, duplicate: false };
}
