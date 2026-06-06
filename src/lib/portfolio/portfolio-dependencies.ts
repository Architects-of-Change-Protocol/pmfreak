import type { ExecutionTaskDependencyRow } from "@/lib/db/database-contract";
import type { PortfolioDependencyRisk, DependencyRiskLevel } from "./types";

export type TaskProjectMap = Map<string, string>; // taskId -> projectId

// Identify cross-project dependencies from execution task dependencies
export function computeCrossProjectDependencies(
  allDependencies: ExecutionTaskDependencyRow[],
  taskProjectMap: TaskProjectMap,
): PortfolioDependencyRisk[] {
  const activeDeps = allDependencies.filter(
    (d) => d.status === "active" || d.status === "proposed",
  );

  // Count dependencies between project pairs
  const pairCounts = new Map<string, number>();

  for (const dep of activeDeps) {
    const sourceProject = taskProjectMap.get(dep.predecessor_task_id);
    const targetProject = taskProjectMap.get(dep.successor_task_id);

    if (!sourceProject || !targetProject || sourceProject === targetProject) continue;

    const key = `${sourceProject}::${targetProject}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const risks: PortfolioDependencyRisk[] = [];

  for (const [key, count] of pairCounts) {
    const [sourceProjectId, targetProjectId] = key.split("::");
    risks.push({
      sourceProjectId,
      targetProjectId,
      dependencyCount: count,
      riskLevel: classifyDependencyRisk(count),
    });
  }

  return risks.sort((a, b) => b.dependencyCount - a.dependencyCount);
}

function classifyDependencyRisk(count: number): DependencyRiskLevel {
  if (count >= 7) return "critical";
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export function buildCrossProjectDependencyCountMap(
  dependencyRisks: PortfolioDependencyRisk[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const risk of dependencyRisks) {
    const current = map.get(risk.sourceProjectId) ?? 0;
    map.set(risk.sourceProjectId, current + risk.dependencyCount);
  }
  return map;
}
