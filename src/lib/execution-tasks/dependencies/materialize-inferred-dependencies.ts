import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExecutionTaskRow, ExecutionTaskDependencyRow } from "@/lib/db/database-contract";
import { inferExecutionTaskDependencies } from "./infer-dependencies";
import { detectDependencyCycle } from "./graph";

export type MaterializationResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string };

export async function materializeInferredExecutionTaskDependencies(input: {
  projectId: string;
  workspaceId: string;
  actorUserId?: string;
}): Promise<MaterializationResult> {
  console.info("task_dependencies.materialization.started", {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
  });

  const supabase = await createSupabaseServerClient();

  const { data: tasks, error: taskError } = await supabase
    .from("execution_tasks")
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .eq("project_id", input.projectId)
    .eq("workspace_id", input.workspaceId);

  if (taskError) {
    console.error("task_dependencies.materialization.failed", { error: taskError.message });
    return { ok: false, error: "Unable to load tasks." };
  }

  const { data: existingDeps, error: depsError } = await supabase
    .from("execution_task_dependencies")
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .eq("project_id", input.projectId);

  if (depsError) {
    console.error("task_dependencies.materialization.failed", { error: depsError.message });
    return { ok: false, error: "Unable to load existing dependencies." };
  }

  const proposed = inferExecutionTaskDependencies(
    (tasks ?? []) as ExecutionTaskRow[],
    (existingDeps ?? []) as ExecutionTaskDependencyRow[]
  );

  const existingEdges = (existingDeps ?? [])
    .filter((d: ExecutionTaskDependencyRow) => d.status === "active" || d.status === "proposed")
    .map((d: ExecutionTaskDependencyRow) => ({
      predecessorId: d.predecessor_task_id,
      successorId: d.successor_task_id,
    }));

  let inserted = 0;
  let skipped = 0;

  for (const dep of proposed) {
    const { hasCycle } = detectDependencyCycle(existingEdges, {
      predecessorId: dep.predecessorTaskId,
      successorId: dep.successorTaskId,
    });
    if (hasCycle) { skipped++; continue; }

    const { error } = await supabase
      .from("execution_task_dependencies")
      .insert({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        predecessor_task_id: dep.predecessorTaskId,
        successor_task_id: dep.successorTaskId,
        dependency_type: dep.dependencyType,
        status: "proposed",
        lag_days: 0,
        reason: dep.reason,
        source_type: dep.sourceType,
        source_payload: dep.sourcePayload,
        confidence_score: dep.confidenceScore,
        created_by: input.actorUserId ?? null,
      });

    if (!error) {
      inserted++;
      existingEdges.push({ predecessorId: dep.predecessorTaskId, successorId: dep.successorTaskId });
    } else {
      skipped++;
    }
  }

  console.info("task_dependencies.materialization.completed", {
    projectId: input.projectId,
    inserted,
    skipped,
  });

  return { ok: true, inserted, skipped };
}
