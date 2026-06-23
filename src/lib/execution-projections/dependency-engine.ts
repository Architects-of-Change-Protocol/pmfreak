import type {
  ExecutionProjectionDependencyType,
  ProjectionDependency,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Dependency Engine
//
// Derives execution dependencies from action type and signal context.
// ─────────────────────────────────────────────────────────────────────────────

type DependencyInput = {
  actionType: string;
  commitmentId: string;
  signalId?: string | null;
  baseDependencyTypes: ExecutionProjectionDependencyType[];
};

const DEPENDENCY_LABELS: Record<ExecutionProjectionDependencyType, string> = {
  decision:     "governance_decision",
  authority:    "authority_registry",
  ratification: "ratification_record",
  amendment:    "amendment_proposal",
  resource:     "resource_allocation",
};

const CRITICALITY_MAP: Record<ExecutionProjectionDependencyType, "low" | "medium" | "high" | "critical"> = {
  decision:     "high",
  authority:    "critical",
  ratification: "high",
  amendment:    "medium",
  resource:     "low",
};

export function calculateProjectionDependencies(input: DependencyInput): ProjectionDependency[] {
  const deps: ProjectionDependency[] = input.baseDependencyTypes.map((type) => ({
    dependencyType:      type,
    dependencyReference: DEPENDENCY_LABELS[type],
    criticality:         CRITICALITY_MAP[type],
  }));

  // Every projection depends on the originating commitment being accepted
  deps.push({
    dependencyType:      "decision",
    dependencyReference: `commitment:${input.commitmentId}`,
    criticality:         "critical",
  });

  return deps;
}
