import type {
  ExecutionTaskDependencyType,
  ExecutionTaskDependencyStatus,
  ExecutionTaskDependencyRow,
  ExecutionTaskRow,
} from "@/lib/db/database-contract";

export type {
  ExecutionTaskDependencyType,
  ExecutionTaskDependencyStatus,
  ExecutionTaskDependencyRow,
};

export type ExecutionTaskGraphNode = {
  task: ExecutionTaskRow;
  predecessorIds: string[];
  successorIds: string[];
  isReady: boolean;
  isBlocked: boolean;
};

export type ExecutionTaskGraphEdge = {
  dependency: ExecutionTaskDependencyRow;
  predecessorTask: ExecutionTaskRow;
  successorTask: ExecutionTaskRow;
};

export type ExecutionTaskGraph = {
  nodes: Map<string, ExecutionTaskGraphNode>;
  edges: ExecutionTaskGraphEdge[];
};

export type ExecutionNetworkSummary = {
  totalTasks: number;
  totalDependencies: number;
  readyTasks: number;
  blockedTasks: number;
  completedTasks: number;
  proposedDependencies: number;
  activeDependencies: number;
  cycleRisk: boolean;
};
