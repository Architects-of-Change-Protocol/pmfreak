import type { NormalizedDAG } from "./types";

export type CriticalSubgraph = {
  criticalSuccessorMap: Map<string, string[]>;
  criticalPredecessorMap: Map<string, string[]>;
  criticalRoots: string[];
  criticalTerminals: string[];
};

export function buildCriticalSubgraph(
  dag: NormalizedDAG,
  criticalSet: Set<string>,
): CriticalSubgraph {
  const criticalSuccessorMap = new Map<string, string[]>();
  const criticalPredecessorMap = new Map<string, string[]>();

  for (const nodeId of criticalSet) {
    criticalSuccessorMap.set(nodeId, []);
    criticalPredecessorMap.set(nodeId, []);
  }

  for (const nodeId of criticalSet) {
    const succs = dag.successorMap.get(nodeId) ?? [];
    for (const succId of succs) {
      if (!criticalSet.has(succId)) continue;
      criticalSuccessorMap.get(nodeId)!.push(succId);
      criticalPredecessorMap.get(succId)!.push(nodeId);
    }
  }

  const criticalRoots = [...criticalSet].filter(
    (id) => (criticalPredecessorMap.get(id) ?? []).length === 0,
  );
  const criticalTerminals = [...criticalSet].filter(
    (id) => (criticalSuccessorMap.get(id) ?? []).length === 0,
  );

  return { criticalSuccessorMap, criticalPredecessorMap, criticalRoots, criticalTerminals };
}

export function buildCriticalSubgraphFromMaps(
  successorMap: Map<string, string[]>,
  predecessorMap: Map<string, string[]>,
  criticalSet: Set<string>,
): CriticalSubgraph {
  const criticalSuccessorMap = new Map<string, string[]>();
  const criticalPredecessorMap = new Map<string, string[]>();

  for (const nodeId of criticalSet) {
    criticalSuccessorMap.set(nodeId, []);
    criticalPredecessorMap.set(nodeId, []);
  }

  for (const nodeId of criticalSet) {
    const succs = successorMap.get(nodeId) ?? [];
    for (const succId of succs) {
      if (!criticalSet.has(succId)) continue;
      criticalSuccessorMap.get(nodeId)!.push(succId);
      criticalPredecessorMap.get(succId)!.push(nodeId);
    }
  }

  const criticalRoots = [...criticalSet].filter(
    (id) => (criticalPredecessorMap.get(id) ?? []).length === 0,
  );
  const criticalTerminals = [...criticalSet].filter(
    (id) => (criticalSuccessorMap.get(id) ?? []).length === 0,
  );

  return { criticalSuccessorMap, criticalPredecessorMap, criticalRoots, criticalTerminals };
}
