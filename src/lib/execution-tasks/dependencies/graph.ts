import type {
  ExecutionTaskRow,
  ExecutionTaskDependencyRow,
} from "@/lib/db/database-contract";
import type {
  ExecutionTaskGraph,
  ExecutionTaskGraphNode,
  ExecutionTaskGraphEdge,
  ExecutionNetworkSummary,
} from "./types";

const ACTIVE_STATUSES = new Set(["active", "proposed"]);
const COMPLETE_STATUSES = new Set(["completed", "cancelled"]);
const INCOMPLETE_STATUSES = new Set(["not_started", "in_progress", "blocked"]);

export function buildExecutionTaskGraph(
  tasks: ExecutionTaskRow[],
  dependencies: ExecutionTaskDependencyRow[]
): ExecutionTaskGraph {
  const nodes = new Map<string, ExecutionTaskGraphNode>();

  for (const task of tasks) {
    nodes.set(task.id, {
      task,
      predecessorIds: [],
      successorIds: [],
      isReady: false,
      isBlocked: false,
    });
  }

  const edges: ExecutionTaskGraphEdge[] = [];

  for (const dep of dependencies) {
    if (!ACTIVE_STATUSES.has(dep.status)) continue;
    const pred = nodes.get(dep.predecessor_task_id);
    const succ = nodes.get(dep.successor_task_id);
    if (!pred || !succ) continue;
    pred.successorIds.push(dep.successor_task_id);
    succ.predecessorIds.push(dep.predecessor_task_id);
    edges.push({ dependency: dep, predecessorTask: pred.task, successorTask: succ.task });
  }

  for (const node of nodes.values()) {
    node.isBlocked =
      node.task.status === "blocked" ||
      node.predecessorIds.some((pid) => {
        const predNode = nodes.get(pid);
        return predNode && INCOMPLETE_STATUSES.has(predNode.task.status);
      });

    node.isReady =
      node.task.status === "not_started" &&
      node.predecessorIds.every((pid) => {
        const predNode = nodes.get(pid);
        return predNode && COMPLETE_STATUSES.has(predNode.task.status);
      });
  }

  return { nodes, edges };
}

export function detectDependencyCycle(
  existingEdges: Array<{ predecessorId: string; successorId: string }>,
  candidateEdge: { predecessorId: string; successorId: string }
): { hasCycle: boolean; path: string[] } {
  // Build adjacency: predecessor → successors
  const adj = new Map<string, Set<string>>();
  for (const edge of existingEdges) {
    if (!adj.has(edge.predecessorId)) adj.set(edge.predecessorId, new Set());
    adj.get(edge.predecessorId)!.add(edge.successorId);
  }
  // Add candidate
  if (!adj.has(candidateEdge.predecessorId)) adj.set(candidateEdge.predecessorId, new Set());
  adj.get(candidateEdge.predecessorId)!.add(candidateEdge.successorId);

  // DFS from candidate successor to see if we can reach candidate predecessor
  const target = candidateEdge.predecessorId;
  const start = candidateEdge.successorId;
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (node === target) {
      path.push(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    path.push(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    path.pop();
    return false;
  }

  const hasCycle = dfs(start);
  return { hasCycle, path: hasCycle ? [candidateEdge.predecessorId, ...path] : [] };
}

export function getBlockedTasks(taskId: string, graph: ExecutionTaskGraph): ExecutionTaskRow[] {
  const node = graph.nodes.get(taskId);
  if (!node) return [];
  return node.successorIds
    .map((id) => graph.nodes.get(id))
    .filter((n): n is ExecutionTaskGraphNode => !!n && n.isBlocked)
    .map((n) => n.task);
}

export function getBlockingTasks(taskId: string, graph: ExecutionTaskGraph): ExecutionTaskRow[] {
  const node = graph.nodes.get(taskId);
  if (!node) return [];
  return node.predecessorIds
    .map((id) => graph.nodes.get(id))
    .filter((n): n is ExecutionTaskGraphNode => {
      if (!n) return false;
      return INCOMPLETE_STATUSES.has(n.task.status);
    })
    .map((n) => n.task);
}

export function getReadyTasks(graph: ExecutionTaskGraph): ExecutionTaskRow[] {
  return Array.from(graph.nodes.values())
    .filter((n) => n.isReady)
    .map((n) => n.task);
}

export function getExecutionNetworkSummary(
  graph: ExecutionTaskGraph,
  allDependencies: ExecutionTaskDependencyRow[]
): ExecutionNetworkSummary {
  let blockedTasks = 0;
  let completedTasks = 0;
  let readyTasks = 0;

  for (const node of graph.nodes.values()) {
    if (COMPLETE_STATUSES.has(node.task.status)) completedTasks++;
    if (node.isReady) readyTasks++;
    if (node.isBlocked) blockedTasks++;
  }

  const activeDependencies = allDependencies.filter((d) => d.status === "active").length;
  const proposedDependencies = allDependencies.filter((d) => d.status === "proposed").length;

  return {
    totalTasks: graph.nodes.size,
    totalDependencies: allDependencies.length,
    readyTasks,
    blockedTasks,
    completedTasks,
    proposedDependencies,
    activeDependencies,
    cycleRisk: false,
  };
}
