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

  // Cycle detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let cyclePath: string[] | null = null;

  function dfs(nodeId: string, path: string[]): boolean {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cyclePath = path.slice(cycleStart);
      return true;
    }
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    for (const successorId of dag.successorMap.get(nodeId) ?? []) {
      if (dfs(successorId, path)) return true;
    }

    path.pop();
    inStack.delete(nodeId);
    return false;
  }

  for (const nodeId of dag.nodes.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId, [])) {
        issues.push({
          type: "cycle_detected",
          message: `Cycle detected: ${cyclePath?.join(" → ")}`,
          taskIds: cyclePath ?? [],
        });
        break;
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
