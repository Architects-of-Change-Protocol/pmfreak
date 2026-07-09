// PMFreak AOC Read-Only Integration Surface v1 — read-only source interface
//
// Every implementation of this interface (in-memory, or a future real
// source adapter) must be read-only: it must not mutate PMFreak's own
// source data, must not call the PMFreak Agent Passport resolver, must not
// call the PMFreak Project Governance Scenario runner, and must not accept
// writeback from AOC.

import type { PMFreakAocReadOnlySurfaceConfig, PMFreakAocReadOnlySurfaceSourceKind } from "./pmfreak-aoc-read-only-surface-types";
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

export type PMFreakAocReadOnlySource = {
  sourceKind: PMFreakAocReadOnlySurfaceSourceKind;

  listProjects(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakProjectReadModel[]>;

  listAgents(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakAgentReadModel[]>;

  listMilestones(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakMilestoneReadModel[]>;

  listTasks(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakTaskReadModel[]>;

  listRisks(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakRiskReadModel[]>;

  listEvidenceReferences(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakEvidenceReferenceReadModel[]>;

  listApprovalReferences(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakApprovalReferenceReadModel[]>;

  listActionProposals(config: PMFreakAocReadOnlySurfaceConfig): Promise<PMFreakActionProposalReadModel[]>;
};
