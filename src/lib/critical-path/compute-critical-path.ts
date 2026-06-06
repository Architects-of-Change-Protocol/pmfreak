import type { NormalizedDAG, CriticalPathResult } from "./types";
import type { ForwardPassResult } from "./forward-pass";
import type { BackwardPassResult } from "./backward-pass";
import type { FloatResult } from "./float";

export type CriticalityMap = Map<string, { isCritical: boolean; criticalityScore: number }>;

export function computeCriticalPath(
  dag: NormalizedDAG,
  forward: ForwardPassResult,
  backward: BackwardPassResult,
  floats: FloatResult,
  projectFinish: number,
): { result: CriticalPathResult; criticalityMap: CriticalityMap } {
  const criticalTaskIds: string[] = [];
  const criticalityMap: CriticalityMap = new Map();

  const maxFloat = Math.max(...Array.from(floats.values()).map((f) => f.totalFloat), 1);

  for (const nodeId of dag.nodes.keys()) {
    const f = floats.get(nodeId);
    if (!f) continue;

    const isCritical = f.totalFloat <= 0;
    if (isCritical) criticalTaskIds.push(nodeId);

    const criticalityScore = isCritical
      ? 100
      : Math.max(0, 100 - (f.totalFloat / maxFloat) * 100);

    criticalityMap.set(nodeId, { isCritical, criticalityScore });
  }

  // Build critical path as ordered sequence of critical nodes
  const criticalSet = new Set(criticalTaskIds);
  const criticalPath = topologicalSort(dag, criticalSet);

  return {
    result: {
      projectFinish,
      criticalTaskIds,
      criticalPath,
      criticalLength: criticalPath.length,
    },
    criticalityMap,
  };
}

function topologicalSort(dag: NormalizedDAG, nodeFilter: Set<string>): string[] {
  const inDegree = new Map<string, number>();
  for (const nodeId of nodeFilter) {
    const preds = (dag.predecessorMap.get(nodeId) ?? []).filter((p) => nodeFilter.has(p));
    inDegree.set(nodeId, preds.length);
  }

  const queue = [...nodeFilter].filter((n) => inDegree.get(n) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);
    for (const succId of dag.successorMap.get(nodeId) ?? []) {
      if (!nodeFilter.has(succId)) continue;
      const newDeg = (inDegree.get(succId) ?? 0) - 1;
      inDegree.set(succId, newDeg);
      if (newDeg === 0) queue.push(succId);
    }
  }

  return sorted;
}
