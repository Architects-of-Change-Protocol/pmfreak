// AOC PMFreak Read-Only Connector v1 — connector snapshot model
//
// A snapshot is a point-in-time, deterministic normalization of whatever
// the read-only source returned. Building a snapshot never mutates its
// inputs and never generates a timestamp or random id — callers own time.

import { AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME, AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS } from "./pmfreak-read-only-connector-constants";
import type {
  AocPMFreakReadOnlyConnectorConfig,
  AocPMFreakReadOnlyConnectorEnvironment,
  AocPMFreakReadOnlyConnectorSourceKind,
} from "./pmfreak-read-only-connector-types";
import type {
  AocPMFreakActionProposalReadModel,
  AocPMFreakAgentReadModel,
  AocPMFreakApprovalReferenceReadModel,
  AocPMFreakEvidenceReferenceReadModel,
  AocPMFreakMilestoneReadModel,
  AocPMFreakProjectReadModel,
  AocPMFreakRiskReadModel,
  AocPMFreakTaskReadModel,
} from "./pmfreak-read-models";

export type AocPMFreakConnectorSnapshotCounts = {
  projects: number;
  agents: number;
  milestones: number;
  tasks: number;
  risks: number;
  evidenceReferences: number;
  approvalReferences: number;
  actionProposals: number;
};

export type AocPMFreakConnectorSnapshot = {
  connectorId: string;
  connectorName: string;
  sourceKind: AocPMFreakReadOnlyConnectorSourceKind;
  environment: AocPMFreakReadOnlyConnectorEnvironment;

  readOnly: true;
  allowMutations: false;

  projects: AocPMFreakProjectReadModel[];
  agents: AocPMFreakAgentReadModel[];
  milestones: AocPMFreakMilestoneReadModel[];
  tasks: AocPMFreakTaskReadModel[];
  risks: AocPMFreakRiskReadModel[];
  evidenceReferences: AocPMFreakEvidenceReferenceReadModel[];
  approvalReferences: AocPMFreakApprovalReferenceReadModel[];
  actionProposals: AocPMFreakActionProposalReadModel[];

  counts: AocPMFreakConnectorSnapshotCounts;

  warnings: string[];
  errors: string[];
  safeLabels: string[];
};

export type CreateAocPMFreakConnectorSnapshotInput = {
  config: AocPMFreakReadOnlyConnectorConfig;
  projects: AocPMFreakProjectReadModel[];
  agents: AocPMFreakAgentReadModel[];
  milestones: AocPMFreakMilestoneReadModel[];
  tasks: AocPMFreakTaskReadModel[];
  risks: AocPMFreakRiskReadModel[];
  evidenceReferences: AocPMFreakEvidenceReferenceReadModel[];
  approvalReferences: AocPMFreakApprovalReferenceReadModel[];
  actionProposals: AocPMFreakActionProposalReadModel[];
  warnings?: string[];
  errors?: string[];
};

// Deep copy (not just a shallow `{...item}` spread) so mutating a nested
// field (e.g. `metadata`, `milestoneIds`) on the caller's input or on a
// previously returned snapshot can never reach this snapshot's data.
function copyArray<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items)) as T[];
}

export function createAocPMFreakConnectorSnapshot(input: CreateAocPMFreakConnectorSnapshotInput): AocPMFreakConnectorSnapshot {
  const projects = copyArray(input.projects);
  const agents = copyArray(input.agents);
  const milestones = copyArray(input.milestones);
  const tasks = copyArray(input.tasks);
  const risks = copyArray(input.risks);
  const evidenceReferences = copyArray(input.evidenceReferences);
  const approvalReferences = copyArray(input.approvalReferences);
  const actionProposals = copyArray(input.actionProposals);

  return {
    connectorId: input.config.connectorId,
    connectorName: AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME,
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
    safeLabels: [...AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS],
  };
}
