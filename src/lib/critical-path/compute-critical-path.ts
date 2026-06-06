import type {
  NormalizedDAG,
  CriticalPathResult,
  CriticalPathSegment,
  CriticalPathBranchPoint,
  CriticalPathTopology,
} from "./types";
import type { ForwardPassResult } from "./forward-pass";
import type { BackwardPassResult } from "./backward-pass";
import type { FloatResult } from "./float";
import { buildCriticalSubgraph, type CriticalSubgraph } from "./critical-subgraph";

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

  const criticalSet = new Set(criticalTaskIds);
  const criticalPath = topologicalSort(dag, criticalSet);

  const subgraph = buildCriticalSubgraph(dag, criticalSet);
  const { paths: criticalPaths, truncated } = enumerateCriticalPaths(subgraph);
  const criticalSegments = extractCriticalSegments(subgraph);
  const branchPoints = detectBranchPoints(subgraph);
  const criticalComponentCount = computeComponentCount(subgraph);

  const topology: CriticalPathTopology = {
    paths: criticalPaths,
    branchPoints,
    criticalComponentCount,
    hasMultipleCriticalPaths: criticalPaths.length > 1,
    hasCriticalBranches: branchPoints.length > 0,
  };

  return {
    result: {
      projectFinish,
      criticalTaskIds,
      criticalPath,
      criticalLength: criticalPath.length,
      criticalPaths,
      criticalSegments,
      topology,
      ...(truncated ? { _pathsTruncated: true } : {}),
    } as CriticalPathResult & { _pathsTruncated?: boolean },
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

export function enumerateCriticalPaths(
  subgraph: CriticalSubgraph,
  maxPaths = 50,
): { paths: CriticalPathSegment[]; truncated: boolean } {
  const { criticalSuccessorMap, criticalRoots, criticalTerminals } = subgraph;
  const terminalSet = new Set(criticalTerminals);
  const results: string[][] = [];

  function dfs(nodeId: string, currentPath: string[], visited: Set<string>): void {
    if (results.length >= maxPaths) return;
    if (visited.has(nodeId)) return;

    const path = [...currentPath, nodeId];
    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    const succs = criticalSuccessorMap.get(nodeId) ?? [];

    if (terminalSet.has(nodeId) || succs.length === 0) {
      results.push(path);
      return;
    }

    for (const succId of succs) {
      if (results.length >= maxPaths) break;
      dfs(succId, path, nextVisited);
    }
  }

  for (const root of criticalRoots) {
    if (results.length >= maxPaths) break;
    dfs(root, [], new Set());
  }

  const truncated = results.length >= maxPaths;

  const paths: CriticalPathSegment[] = results.map((taskIds) => ({
    id: taskIds.join("|"),
    taskIds,
    length: taskIds.length,
    startTaskId: taskIds[0] ?? "",
    endTaskId: taskIds[taskIds.length - 1] ?? "",
    isCompletePath: true,
  }));

  paths.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { paths, truncated };
}

export function extractCriticalSegments(subgraph: CriticalSubgraph): CriticalPathSegment[] {
  const { criticalSuccessorMap, criticalPredecessorMap } = subgraph;
  const segments: CriticalPathSegment[] = [];

  function isSegmentStart(nodeId: string): boolean {
    const preds = criticalPredecessorMap.get(nodeId) ?? [];
    if (preds.length !== 1) return true;
    const predSuccs = criticalSuccessorMap.get(preds[0]) ?? [];
    return predSuccs.length !== 1;
  }

  const allCriticalNodes = [...criticalSuccessorMap.keys()];
  const segmentStarts = allCriticalNodes.filter(isSegmentStart);

  for (const startNode of segmentStarts) {
    const taskIds: string[] = [startNode];
    let current = startNode;

    while (true) {
      const succs = criticalSuccessorMap.get(current) ?? [];
      if (succs.length !== 1) break;
      const next = succs[0];
      const nextPreds = criticalPredecessorMap.get(next) ?? [];
      if (nextPreds.length !== 1) break;
      taskIds.push(next);
      current = next;
    }

    const isRoot = (criticalPredecessorMap.get(startNode) ?? []).length === 0;
    const isTerminal = (criticalSuccessorMap.get(current) ?? []).length === 0;

    segments.push({
      id: taskIds.join("|"),
      taskIds,
      length: taskIds.length,
      startTaskId: startNode,
      endTaskId: current,
      isCompletePath: isRoot && isTerminal,
    });
  }

  return segments;
}

export function detectBranchPoints(subgraph: CriticalSubgraph): CriticalPathBranchPoint[] {
  const { criticalSuccessorMap, criticalPredecessorMap } = subgraph;
  const branchPoints: CriticalPathBranchPoint[] = [];

  for (const nodeId of criticalSuccessorMap.keys()) {
    const outgoing = criticalSuccessorMap.get(nodeId) ?? [];
    const incoming = criticalPredecessorMap.get(nodeId) ?? [];

    const isSplit = outgoing.length > 1;
    const isMerge = incoming.length > 1;

    if (!isSplit && !isMerge) continue;

    const branchType: CriticalPathBranchPoint["branchType"] =
      isSplit && isMerge ? "split_merge" : isSplit ? "split" : "merge";

    branchPoints.push({
      taskId: nodeId,
      outgoingCriticalSuccessors: outgoing,
      incomingCriticalPredecessors: incoming,
      branchType,
    });
  }

  return branchPoints.sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
}

export function computeComponentCount(subgraph: CriticalSubgraph): number {
  const { criticalSuccessorMap, criticalPredecessorMap } = subgraph;
  const allNodes = new Set(criticalSuccessorMap.keys());
  const visited = new Set<string>();
  let count = 0;

  function bfs(start: string): void {
    const queue = [start];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const s of criticalSuccessorMap.get(node) ?? []) {
        if (!visited.has(s)) queue.push(s);
      }
      for (const p of criticalPredecessorMap.get(node) ?? []) {
        if (!visited.has(p)) queue.push(p);
      }
    }
  }

  for (const nodeId of allNodes) {
    if (!visited.has(nodeId)) {
      count++;
      bfs(nodeId);
    }
  }

  return count;
}

export function computeTopologyFromSubgraph(subgraph: CriticalSubgraph): {
  criticalPaths: CriticalPathSegment[];
  criticalSegments: CriticalPathSegment[];
  branchPoints: CriticalPathBranchPoint[];
  topology: CriticalPathTopology;
} {
  const { paths: criticalPaths } = enumerateCriticalPaths(subgraph);
  const criticalSegments = extractCriticalSegments(subgraph);
  const branchPoints = detectBranchPoints(subgraph);
  const criticalComponentCount = computeComponentCount(subgraph);

  const topology: CriticalPathTopology = {
    paths: criticalPaths,
    branchPoints,
    criticalComponentCount,
    hasMultipleCriticalPaths: criticalPaths.length > 1,
    hasCriticalBranches: branchPoints.length > 0,
  };

  return { criticalPaths, criticalSegments, branchPoints, topology };
}
