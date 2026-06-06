import type { NormalizedDAG } from "./types";

export type ForwardPassResult = Map<string, { earlyStart: number; earlyFinish: number }>;

export function forwardPass(dag: NormalizedDAG): ForwardPassResult {
  const result: ForwardPassResult = new Map();
  const inDegree = new Map<string, number>();

  for (const nodeId of dag.nodes.keys()) {
    inDegree.set(nodeId, (dag.predecessorMap.get(nodeId) ?? []).length);
  }

  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) queue.push(nodeId);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const { duration } = dag.nodes.get(nodeId)!;
    const predecessors = dag.predecessorMap.get(nodeId) ?? [];

    let earlyStart = 0;
    for (const predId of predecessors) {
      const pred = result.get(predId);
      if (pred) {
        earlyStart = Math.max(earlyStart, pred.earlyFinish);
      }
    }

    // Add lag from edges
    for (const edge of dag.edges) {
      if (edge.successorId === nodeId) {
        const pred = result.get(edge.predecessorId);
        if (pred) {
          earlyStart = Math.max(earlyStart, pred.earlyFinish + edge.lagDays);
        }
      }
    }

    const earlyFinish = earlyStart + duration;
    result.set(nodeId, { earlyStart, earlyFinish });

    for (const successorId of dag.successorMap.get(nodeId) ?? []) {
      const newDeg = (inDegree.get(successorId) ?? 0) - 1;
      inDegree.set(successorId, newDeg);
      if (newDeg === 0) queue.push(successorId);
    }
  }

  return result;
}
