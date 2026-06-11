import type { NormalizedDAG, GraphValidationResult } from "./types";

export function validateGraph(dag: NormalizedDAG): GraphValidationResult {
  const issues: GraphValidationResult["issues"] = [];

  // Check self-loops
  for (const edge of dag.edges) {
    if (edge.predecessorId === edge.successorId) {
      issues.push({
        type: "invalid_dependency",
        message: `Self-loop on task ${edge.predecessorId}`,
        taskIds: [edge.predecessorId],
      });
    }
  }

  // Check orphan references (edges referencing non-existent nodes)
  for (const edge of dag.edges) {
    if (!dag.nodes.has(edge.predecessorId)) {
      issues.push({
        type: "orphan_task",
        message: `Predecessor ${edge.predecessorId} not found`,
        taskIds: [edge.predecessorId],
      });
    }
    if (!dag.nodes.has(edge.successorId)) {
      issues.push({
        type: "orphan_task",
        message: `Successor ${edge.successorId} not found`,
        taskIds: [edge.successorId],
      });
    }
  }

  // Cycle detection via DFS. Returning the path avoids mutation-based narrowing bugs.
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function findCycle(nodeId: string, path: string[]): string[] | null {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      return path.slice(cycleStart);
    }
    if (visited.has(nodeId)) return null;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    for (const successorId of dag.successorMap.get(nodeId) ?? []) {
      const cycle = findCycle(successorId, path);
      if (cycle) return cycle;
    }

    path.pop();
    inStack.delete(nodeId);
    return null;
  }

  for (const nodeId of dag.nodes.keys()) {
    if (visited.has(nodeId)) continue;
    const cyclePath = findCycle(nodeId, []);
    if (cyclePath) {
      issues.push({
        type: "cycle_detected",
        message: `Cycle detected: ${cyclePath.join(" → ")}`,
        taskIds: cyclePath,
      });
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}
