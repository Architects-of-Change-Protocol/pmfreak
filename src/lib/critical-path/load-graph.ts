import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXECUTION_TASK_SELECTABLE_COLUMNS,
  EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS,
  PROJECT_MILESTONE_SELECTABLE_COLUMNS,
  type ExecutionTaskRow,
  type ExecutionTaskDependencyRow,
  type ProjectMilestoneRow,
} from "@/lib/db/database-contract";
import { resolveTaskDuration } from "./duration";
import type { NormalizedDAG, CriticalPathEdge } from "./types";

const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");
const DEP_SELECT = EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS.join(",");
const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");

export async function loadGraph(input: { projectId: string }): Promise<
  { ok: true; dag: NormalizedDAG } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const [tasksResult, depsResult, milestonesResult] = await Promise.all([
    supabase
      .from("execution_tasks")
      .select(TASK_SELECT)
      .eq("project_id", input.projectId)
      .overrideTypes<ExecutionTaskRow[], { merge: false }>(),
    supabase
      .from("execution_task_dependencies")
      .select(DEP_SELECT)
      .eq("project_id", input.projectId)
      .eq("status", "active")
      .overrideTypes<ExecutionTaskDependencyRow[], { merge: false }>(),
    supabase
      .from("project_milestones")
      .select(MILESTONE_SELECT)
      .eq("project_id", input.projectId)
      .overrideTypes<ProjectMilestoneRow[], { merge: false }>(),
  ]);

  if (tasksResult.error || depsResult.error || milestonesResult.error) {
    return { ok: false, error: "Failed to load graph data." };
  }

  const tasks = tasksResult.data ?? [];
  const deps = depsResult.data ?? [];
  const milestones = milestonesResult.data ?? [];

  const taskSet = new Set(tasks.map((t) => t.id));

  const nodes = new Map<string, { task: ExecutionTaskRow; duration: number }>();
  for (const task of tasks) {
    nodes.set(task.id, { task, duration: resolveTaskDuration(task) });
  }

  const edges: CriticalPathEdge[] = [];
  const predecessorMap = new Map<string, string[]>();
  const successorMap = new Map<string, string[]>();

  for (const task of tasks) {
    predecessorMap.set(task.id, []);
    successorMap.set(task.id, []);
  }

  for (const dep of deps) {
    if (!taskSet.has(dep.predecessor_task_id) || !taskSet.has(dep.successor_task_id)) {
      continue;
    }
    edges.push({
      predecessorId: dep.predecessor_task_id,
      successorId: dep.successor_task_id,
      lagDays: dep.lag_days ?? 0,
    });
    predecessorMap.get(dep.successor_task_id)!.push(dep.predecessor_task_id);
    successorMap.get(dep.predecessor_task_id)!.push(dep.successor_task_id);
  }

  return { ok: true, dag: { nodes, edges, predecessorMap, successorMap, milestones } };
}
