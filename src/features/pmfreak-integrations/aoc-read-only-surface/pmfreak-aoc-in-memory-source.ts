// PMFreak AOC Read-Only Integration Surface v1 — in-memory deterministic source
//
// Used for tests and demo/dev mode. Every list* method returns a deep copy
// so callers can never mutate the fixtures (or each other's results) by
// mutating a returned array/object.

import {
  PMFREAK_DEMO_ACTION_PROPOSALS,
  PMFREAK_DEMO_AGENTS,
  PMFREAK_DEMO_APPROVAL_REFERENCES,
  PMFREAK_DEMO_EVIDENCE_REFERENCES,
  PMFREAK_DEMO_MILESTONES,
  PMFREAK_DEMO_PROJECTS,
  PMFREAK_DEMO_RISKS,
  PMFREAK_DEMO_TASKS,
} from "./pmfreak-aoc-read-only-surface-fixtures";
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
import type { PMFreakAocReadOnlySource } from "./pmfreak-aoc-read-only-source";

export type PMFreakAocInMemorySourceFixtures = {
  projects: PMFreakProjectReadModel[];
  agents: PMFreakAgentReadModel[];
  milestones: PMFreakMilestoneReadModel[];
  tasks: PMFreakTaskReadModel[];
  risks: PMFreakRiskReadModel[];
  evidenceReferences: PMFreakEvidenceReferenceReadModel[];
  approvalReferences: PMFreakApprovalReferenceReadModel[];
  actionProposals: PMFreakActionProposalReadModel[];
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInMemoryPMFreakAocReadOnlySource(
  fixtures?: Partial<PMFreakAocInMemorySourceFixtures>
): PMFreakAocReadOnlySource {
  const data: PMFreakAocInMemorySourceFixtures = {
    projects: fixtures?.projects ?? PMFREAK_DEMO_PROJECTS,
    agents: fixtures?.agents ?? PMFREAK_DEMO_AGENTS,
    milestones: fixtures?.milestones ?? PMFREAK_DEMO_MILESTONES,
    tasks: fixtures?.tasks ?? PMFREAK_DEMO_TASKS,
    risks: fixtures?.risks ?? PMFREAK_DEMO_RISKS,
    evidenceReferences: fixtures?.evidenceReferences ?? PMFREAK_DEMO_EVIDENCE_REFERENCES,
    approvalReferences: fixtures?.approvalReferences ?? PMFREAK_DEMO_APPROVAL_REFERENCES,
    actionProposals: fixtures?.actionProposals ?? PMFREAK_DEMO_ACTION_PROPOSALS,
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
