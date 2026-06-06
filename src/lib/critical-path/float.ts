import type { ForwardPassResult } from "./forward-pass";
import type { BackwardPassResult } from "./backward-pass";
import type { NormalizedDAG } from "./types";

export type FloatResult = Map<string, { totalFloat: number; freeFloat: number }>;

export function computeFloat(dag: NormalizedDAG, forward: ForwardPassResult, backward: BackwardPassResult): FloatResult {
  const result: FloatResult = new Map();

  for (const nodeId of dag.nodes.keys()) {
    const fwd = forward.get(nodeId);
    const bwd = backward.get(nodeId);
    if (!fwd || !bwd) continue;

    const totalFloat = bwd.lateFinish - fwd.earlyFinish;

    let minSuccessorES = Infinity;
    for (const succId of dag.successorMap.get(nodeId) ?? []) {
      const succFwd = forward.get(succId);
      if (succFwd) {
        minSuccessorES = Math.min(minSuccessorES, succFwd.earlyStart);
      }
    }

    const freeFloat = minSuccessorES === Infinity ? 0 : minSuccessorES - fwd.earlyFinish;

    result.set(nodeId, { totalFloat: Math.max(0, totalFloat), freeFloat: Math.max(0, freeFloat) });
  }

  return result;
}
