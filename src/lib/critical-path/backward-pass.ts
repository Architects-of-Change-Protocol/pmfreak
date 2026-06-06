import type { NormalizedDAG } from "./types";
import type { ForwardPassResult } from "./forward-pass";

export type BackwardPassResult = Map<string, { lateStart: number; lateFinish: number }>;

export function backwardPass(dag: NormalizedDAG, forwardResult: ForwardPassResult): { result: BackwardPassResult; projectFinish: number } {
  let projectFinish = 0;
  for (const val of forwardResult.values()) {
    projectFinish = Math.max(projectFinish, val.earlyFinish);
  }

  const result: BackwardPassResult = new Map();
  const outDegree = new Map<string, number>();

  for (const nodeId of dag.nodes.keys()) {
    outDegree.set(nodeId, (dag.successorMap.get(nodeId) ?? []).length);
  }

  const queue: string[] = [];
  for (const [nodeId, deg] of outDegree) {
    if (deg === 0) queue.push(nodeId);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const { duration } = dag.nodes.get(nodeId)!;
    const successors = dag.successorMap.get(nodeId) ?? [];

    let lateFinish = projectFinish;
    for (const succId of successors) {
      const succ = result.get(succId);
      if (succ) {
        lateFinish = Math.min(lateFinish, succ.lateStart);
      }
    }

    // Account for lag from edges
    for (const edge of dag.edges) {
      if (edge.predecessorId === nodeId) {
        const succ = result.get(edge.successorId);
        if (succ) {
          lateFinish = Math.min(lateFinish, succ.lateStart - edge.lagDays);
        }
      }
    }

    const lateStart = lateFinish - duration;
    result.set(nodeId, { lateStart, lateFinish });

    for (const predId of dag.predecessorMap.get(nodeId) ?? []) {
      const newDeg = (outDegree.get(predId) ?? 0) - 1;
      outDegree.set(predId, newDeg);
      if (newDeg === 0) queue.push(predId);
    }
  }

  return { result, projectFinish };
}
