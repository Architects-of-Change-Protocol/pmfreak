// AOC PMFreak Read-Only Connector v1 — read-only source interface
//
// Every implementation of this interface (in-memory, or a future real
// source adapter) must be read-only: it must not mutate source data, must
// not call the PMFreak Agent Passport resolver, must not call the PMFreak
// Project Governance Scenario runner, and must not write back to PMFreak.

import type { AocPMFreakReadOnlyConnectorConfig, AocPMFreakReadOnlyConnectorSourceKind } from "./pmfreak-read-only-connector-types";
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

export type AocPMFreakReadOnlySource = {
  sourceKind: AocPMFreakReadOnlyConnectorSourceKind;

  listProjects(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakProjectReadModel[]>;

  listAgents(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakAgentReadModel[]>;

  listMilestones(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakMilestoneReadModel[]>;

  listTasks(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakTaskReadModel[]>;

  listRisks(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakRiskReadModel[]>;

  listEvidenceReferences(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakEvidenceReferenceReadModel[]>;

  listApprovalReferences(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakApprovalReferenceReadModel[]>;

  listActionProposals(config: AocPMFreakReadOnlyConnectorConfig): Promise<AocPMFreakActionProposalReadModel[]>;
};
