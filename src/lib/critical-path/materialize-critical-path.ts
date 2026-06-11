import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadGraph } from "./load-graph";
import { validateGraph } from "./validate-graph";
import { forwardPass } from "./forward-pass";
import { backwardPass } from "./backward-pass";
import { computeFloat } from "./float";
import { computeCriticalPath } from "./compute-critical-path";
import { computeTaskVariance } from "./variance";

export type MaterializeResult =
  | { ok: true; criticalTaskIds: string[]; projectFinish: number }
  | { ok: false; error: string; failureClass: string };

export async function materializeCriticalPath(input: { projectId: string }): Promise<MaterializeResult> {
  console.log(JSON.stringify({ event: "critical_path.started", projectId: input.projectId }));

  try {
    const graphResult = await loadGraph(input);
    if (!graphResult.ok) {
      return { ok: false, error: graphResult.error, failureClass: "load_failed" };
    }
    const { dag } = graphResult;

    const validation = validateGraph(dag);
    if (!validation.valid) {
      const failureClass = validation.issues[0]?.type ?? "invalid_graph";
      console.log(JSON.stringify({ event: "critical_path.failed", projectId: input.projectId, issues: validation.issues }));
      return { ok: false, error: `Graph invalid: ${validation.issues[0]?.message}`, failureClass };
    }

    const forward = forwardPass(dag);
    const { result: backward, projectFinish } = backwardPass(dag, forward);
    const floats = computeFloat(dag, forward, backward);
    const { result: cpResult, criticalityMap } = computeCriticalPath(dag, forward, backward, floats, projectFinish);

    const supabase = await createSupabaseServerClient();

    const updates: Array<Promise<void>> = [];
    for (const [taskId, node] of dag.nodes) {
      const fwd = forward.get(taskId);
      const bwd = backward.get(taskId);
      const fl = floats.get(taskId);
      const criticality = criticalityMap.get(taskId);
      const task = node.task;
      const varianceDays = computeTaskVariance(task);

      if (!fwd || !bwd || !fl || !criticality) continue;

      updates.push((async () => {
        const { error } = await supabase
          .from("execution_tasks")
          .update({
            is_critical: criticality.isCritical,
            early_start: fwd.earlyStart,
            early_finish: fwd.earlyFinish,
            late_start: bwd.lateStart,
            late_finish: bwd.lateFinish,
            total_float: fl.totalFloat,
            free_float: fl.freeFloat,
            variance_days: varianceDays,
            criticality_score: Math.round(criticality.criticalityScore * 100) / 100,
          })
          .eq("id", taskId);
        if (error) {
          throw new Error(`Failed to materialize critical path task ${taskId}: ${error.message}`);
        }
      })());
    }

    await Promise.all(updates);

    console.log(JSON.stringify({
      event: "critical_path.completed",
      projectId: input.projectId,
      projectFinish,
      criticalTaskCount: cpResult.criticalTaskIds.length,
    }));

    return { ok: true, criticalTaskIds: cpResult.criticalTaskIds, projectFinish };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ event: "critical_path.failed", projectId: input.projectId, error: message }));
    return { ok: false, error: message, failureClass: "unexpected_error" };
  }
}
