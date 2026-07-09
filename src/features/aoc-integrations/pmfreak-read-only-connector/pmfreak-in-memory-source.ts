// AOC PMFreak Read-Only Connector v1 — in-memory deterministic source
//
// Used for tests and demo/dev mode. Every list* method returns a deep copy
// so callers can never mutate the fixtures (or each other's results) by
// mutating a returned array/object.

import {
  AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  AOC_PMFREAK_DEMO_AGENTS,
  AOC_PMFREAK_DEMO_APPROVAL_REFERENCES,
  AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES,
  AOC_PMFREAK_DEMO_MILESTONES,
  AOC_PMFREAK_DEMO_PROJECTS,
  AOC_PMFREAK_DEMO_RISKS,
  AOC_PMFREAK_DEMO_TASKS,
} from "./pmfreak-read-only-connector-fixtures";
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
import type { AocPMFreakReadOnlySource } from "./pmfreak-read-only-source";

export type AocPMFreakInMemorySourceFixtures = {
  projects: AocPMFreakProjectReadModel[];
  agents: AocPMFreakAgentReadModel[];
  milestones: AocPMFreakMilestoneReadModel[];
  tasks: AocPMFreakTaskReadModel[];
  risks: AocPMFreakRiskReadModel[];
  evidenceReferences: AocPMFreakEvidenceReferenceReadModel[];
  approvalReferences: AocPMFreakApprovalReferenceReadModel[];
  actionProposals: AocPMFreakActionProposalReadModel[];
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInMemoryAocPMFreakReadOnlySource(
  fixtures?: Partial<AocPMFreakInMemorySourceFixtures>
): AocPMFreakReadOnlySource {
  const data: AocPMFreakInMemorySourceFixtures = {
    projects: fixtures?.projects ?? AOC_PMFREAK_DEMO_PROJECTS,
    agents: fixtures?.agents ?? AOC_PMFREAK_DEMO_AGENTS,
    milestones: fixtures?.milestones ?? AOC_PMFREAK_DEMO_MILESTONES,
    tasks: fixtures?.tasks ?? AOC_PMFREAK_DEMO_TASKS,
    risks: fixtures?.risks ?? AOC_PMFREAK_DEMO_RISKS,
    evidenceReferences: fixtures?.evidenceReferences ?? AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES,
    approvalReferences: fixtures?.approvalReferences ?? AOC_PMFREAK_DEMO_APPROVAL_REFERENCES,
    actionProposals: fixtures?.actionProposals ?? AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  };

  return {
    sourceKind: "in_memory",

    async listProjects() {
      return deepClone(data.projects);
    },

    async listAgents() {
      return deepClone(data.agents);
    },

    async listMilestones() {
      return deepClone(data.milestones);
    },

    async listTasks() {
      return deepClone(data.tasks);
    },

    async listRisks() {
      return deepClone(data.risks);
    },

    async listEvidenceReferences() {
      return deepClone(data.evidenceReferences);
    },

    async listApprovalReferences() {
      return deepClone(data.approvalReferences);
    },

    async listActionProposals() {
      return deepClone(data.actionProposals);
    },
  };
}
