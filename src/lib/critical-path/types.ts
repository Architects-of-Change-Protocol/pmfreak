import type { ExecutionTaskRow, ProjectMilestoneRow } from "@/lib/db/database-contract";

export type CriticalPathNode = {
  taskId: string;
  title: string;
  duration: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  criticalityScore: number;
  predecessorIds: string[];
  successorIds: string[];
};

export type CriticalPathEdge = {
  predecessorId: string;
  successorId: string;
  lagDays: number;
};

export type CriticalTask = {
  taskId: string;
  title: string;
  totalFloat: number;
  freeFloat: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  criticalityScore: number;
  varianceDays: number;
};

export type CriticalMilestone = {
  milestoneId: string;
  title: string;
  targetDate: string | null;
  forecastDate: string | null;
  varianceDays: number;
  isCritical: boolean;
  isAtRisk: boolean;
  isDelayed: boolean;
  linkedTaskIds: string[];
};

export type ScheduleVariance = {
  taskId: string;
  title: string;
  plannedFinish: string | null;
  forecastFinish: string | null;
  varianceDays: number;
};

export type ProjectForecast = {
  plannedFinish: string | null;
  forecastFinish: string | null;
  varianceDays: number;
};

export type CriticalPathSegment = {
  id: string;
  taskIds: string[];
  length: number;
  startTaskId: string;
  endTaskId: string;
  isCompletePath: boolean;
};

export type CriticalPathBranchPoint = {
  taskId: string;
  outgoingCriticalSuccessors: string[];
  incomingCriticalPredecessors: string[];
  branchType: "split" | "merge" | "split_merge";
};

export type CriticalPathTopology = {
  paths: CriticalPathSegment[];
  branchPoints: CriticalPathBranchPoint[];
  criticalComponentCount: number;
  hasMultipleCriticalPaths: boolean;
  hasCriticalBranches: boolean;
};

export type CriticalPathResult = {
  projectFinish: number;
  criticalTaskIds: string[];
  criticalPath: string[];
  criticalLength: number;
  criticalPaths: CriticalPathSegment[];
  criticalSegments: CriticalPathSegment[];
  topology: CriticalPathTopology;
};

export type CriticalPathSummary = {
  totalTasks: number;
  criticalTaskCount: number;
  criticalMilestoneCount: number;
  projectDurationDays: number;
  forecastVarianceDays: number;
  scheduleConfidence: number;
  criticalPathCount: number;
  criticalComponentCount: number;
  hasMultipleCriticalPaths: boolean;
  hasCriticalBranches: boolean;
};

export type GraphValidationResult = {
  valid: boolean;
  issues: Array<{
    type: "cycle_detected" | "invalid_dependency" | "orphan_task";
    message: string;
    taskIds?: string[];
  }>;
};

export type NormalizedDAG = {
  nodes: Map<string, { task: ExecutionTaskRow; duration: number }>;
  edges: CriticalPathEdge[];
  predecessorMap: Map<string, string[]>;
  successorMap: Map<string, string[]>;
  milestones: ProjectMilestoneRow[];
};
