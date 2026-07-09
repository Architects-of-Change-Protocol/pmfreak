// PMFreak AOC Read-Only Integration Surface v1 — surface snapshot model
//
// A snapshot is a point-in-time, deterministic normalization of whatever
// the read-only source returned. Building a snapshot never mutates its
// inputs and never generates a timestamp or random id — callers own time.

import { PMFREAK_AOC_READ_ONLY_SURFACE_NAME, PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS } from "./pmfreak-aoc-read-only-surface-constants";
import type {
  PMFreakAocReadOnlySurfaceConfig,
  PMFreakAocReadOnlySurfaceEnvironment,
  PMFreakAocReadOnlySurfaceSourceKind,
} from "./pmfreak-aoc-read-only-surface-types";
import type {
  PMFreakActionProposalReadModel,
  PMFreakAgentReadModel,
  PMFreakApprovalReferenceReadModel,
  PMFreakEvidenceReferenceReadModel,
  PMFreakMilestoneReadModel,
  PMFreakProjectReadModel,
  PMFreakRiskReadModel,
  PMFreakTaskReadModel,
} from "./pmfreak-read-models";

export type PMFreakAocSurfaceSnapshotCounts = {
  projects: number;
  agents: number;
  milestones: number;
  tasks: number;
  risks: number;
  evidenceReferences: number;
  approvalReferences: number;
  actionProposals: number;
};

export type PMFreakAocSurfaceSnapshot = {
  surfaceId: string;
  surfaceName: string;
  sourceKind: PMFreakAocReadOnlySurfaceSourceKind;
  environment: PMFreakAocReadOnlySurfaceEnvironment;

  readOnly: true;
  allowMutations: false;

  projects: PMFreakProjectReadModel[];
  agents: PMFreakAgentReadModel[];
  milestones: PMFreakMilestoneReadModel[];
  tasks: PMFreakTaskReadModel[];
  risks: PMFreakRiskReadModel[];
  evidenceReferences: PMFreakEvidenceReferenceReadModel[];
  approvalReferences: PMFreakApprovalReferenceReadModel[];
  actionProposals: PMFreakActionProposalReadModel[];

  counts: PMFreakAocSurfaceSnapshotCounts;

  warnings: string[];
  errors: string[];
  safeLabels: string[];
};

export type CreatePMFreakAocSurfaceSnapshotInput = {
  config: PMFreakAocReadOnlySurfaceConfig;
  projects: PMFreakProjectReadModel[];
  agents: PMFreakAgentReadModel[];
  milestones: PMFreakMilestoneReadModel[];
  tasks: PMFreakTaskReadModel[];
  risks: PMFreakRiskReadModel[];
  evidenceReferences: PMFreakEvidenceReferenceReadModel[];
  approvalReferences: PMFreakApprovalReferenceReadModel[];
  actionProposals: PMFreakActionProposalReadModel[];
  warnings?: string[];
  errors?: string[];
};

// Deep copy (not just a shallow `{...item}` spread) so mutating a nested
// field (e.g. `metadata`, `milestoneIds`) on the caller's input or on a
// previously returned snapshot can never reach this snapshot's data.
function copyArray<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items)) as T[];
}

export function createPMFreakAocSurfaceSnapshot(input: CreatePMFreakAocSurfaceSnapshotInput): PMFreakAocSurfaceSnapshot {
  const projects = copyArray(input.projects);
  const agents = copyArray(input.agents);
  const milestones = copyArray(input.milestones);
  const tasks = copyArray(input.tasks);
  const risks = copyArray(input.risks);
  const evidenceReferences = copyArray(input.evidenceReferences);
  const approvalReferences = copyArray(input.approvalReferences);
  const actionProposals = copyArray(input.actionProposals);

  return {
    surfaceId: input.config.surfaceId,
    surfaceName: PMFREAK_AOC_READ_ONLY_SURFACE_NAME,
    sourceKind: input.config.sourceKind,
    environment: input.config.environment,

    readOnly: true,
    allowMutations: false,

    projects,
    agents,
    milestones,
    tasks,
    risks,
    evidenceReferences,
    approvalReferences,
    actionProposals,

    counts: {
      projects: projects.length,
      agents: agents.length,
      milestones: milestones.length,
      tasks: tasks.length,
      risks: risks.length,
      evidenceReferences: evidenceReferences.length,
      approvalReferences: approvalReferences.length,
      actionProposals: actionProposals.length,
    },

    warnings: [...(input.warnings ?? [])],
    errors: [...(input.errors ?? [])],
    safeLabels: [...PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS],
  };
}
