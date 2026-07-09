// AOC PMFreak Read-Only Connector v1 — public exports
//
// aoc.integration.pmfreak.read_only_connector.v1
//
// Read-only integration boundary between AOC Enterprise and PMFreak data.
// See README.md for scope and safety guarantees.

export {
  AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_ID,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS,
  AOC_PMFREAK_SYSTEM_ID,
} from "./pmfreak-read-only-connector-constants";

export type {
  AocPMFreakConnectorError,
  AocPMFreakConnectorErrorCode,
  AocPMFreakConnectorHealth,
  AocPMFreakConnectorHealthStatus,
  AocPMFreakReadOnlyConnectorConfig,
  AocPMFreakReadOnlyConnectorDescriptor,
  AocPMFreakReadOnlyConnectorEnvironment,
  AocPMFreakReadOnlyConnectorRedactionMode,
  AocPMFreakReadOnlyConnectorSourceKind,
} from "./pmfreak-read-only-connector-types";

export { createAocPMFreakReadOnlyConnectorDescriptor } from "./pmfreak-read-only-connector-descriptor";
export { createAocPMFreakReadOnlyConnectorConfig } from "./pmfreak-read-only-connector-config";
export { createAocPMFreakConnectorError } from "./pmfreak-connector-errors";

export {
  AocPMFreakMutationNotAllowedError,
  assertAocPMFreakReadOnlyOperation,
  isAocPMFreakForbiddenConnectorOperation,
} from "./pmfreak-no-mutation-guard";

export { redactAocPMFreakConnectorSnapshot, redactAocPMFreakConnectorValue } from "./pmfreak-redaction";

export type {
  AocPMFreakActionProposalCategory,
  AocPMFreakActionProposalReadModel,
  AocPMFreakActionProposalStatus,
  AocPMFreakAgentReadModel,
  AocPMFreakAgentRole,
  AocPMFreakAgentStatus,
  AocPMFreakApprovalKind,
  AocPMFreakApprovalReferenceReadModel,
  AocPMFreakEvidenceKind,
  AocPMFreakEvidenceReferenceReadModel,
  AocPMFreakMilestoneReadModel,
  AocPMFreakMilestoneStatus,
  AocPMFreakProjectPhase,
  AocPMFreakProjectReadModel,
  AocPMFreakProjectStatus,
  AocPMFreakRiskReadModel,
  AocPMFreakRiskSeverity,
  AocPMFreakRiskStatus,
  AocPMFreakTaskReadModel,
  AocPMFreakTaskStatus,
} from "./pmfreak-read-models";

export type { AocPMFreakReadOnlySource } from "./pmfreak-read-only-source";

export {
  AOC_PMFREAK_DEMO_ACTION_PROPOSAL_ID,
  AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  AOC_PMFREAK_DEMO_AGENT_ID,
  AOC_PMFREAK_DEMO_AGENTS,
  AOC_PMFREAK_DEMO_APPROVAL_REFERENCE_ID,
  AOC_PMFREAK_DEMO_APPROVAL_REFERENCES,
  AOC_PMFREAK_DEMO_CUSTOMER_ID,
  AOC_PMFREAK_DEMO_EVIDENCE_REFERENCE_ID,
  AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES,
  AOC_PMFREAK_DEMO_MILESTONE_ID,
  AOC_PMFREAK_DEMO_MILESTONES,
  AOC_PMFREAK_DEMO_PROJECT_ID,
  AOC_PMFREAK_DEMO_PROJECTS,
  AOC_PMFREAK_DEMO_RISK_ID,
  AOC_PMFREAK_DEMO_RISKS,
  AOC_PMFREAK_DEMO_TASK_ID,
  AOC_PMFREAK_DEMO_TASKS,
  AOC_PMFREAK_DEMO_TENANT_ID,
  AOC_PMFREAK_DEMO_WORKSPACE_ID,
} from "./pmfreak-read-only-connector-fixtures";

export { createInMemoryAocPMFreakReadOnlySource } from "./pmfreak-in-memory-source";
export type { AocPMFreakInMemorySourceFixtures } from "./pmfreak-in-memory-source";

export { createUnsupportedAocPMFreakRealReadOnlySource } from "./pmfreak-real-source-adapter";

export { createAocPMFreakConnectorSnapshot } from "./pmfreak-connector-snapshot";
export type {
  AocPMFreakConnectorSnapshot,
  AocPMFreakConnectorSnapshotCounts,
  CreateAocPMFreakConnectorSnapshotInput,
} from "./pmfreak-connector-snapshot";

export { createAocPMFreakConnectorHealth } from "./pmfreak-connector-health";
export type { CreateAocPMFreakConnectorHealthInput } from "./pmfreak-connector-health";

export {
  createAocPMFreakReadOnlyConnectorClient,
} from "./pmfreak-read-only-client";
export type {
  AocPMFreakReadOnlyConnectorClient,
  CreateAocPMFreakReadOnlyConnectorClientInput,
} from "./pmfreak-read-only-client";

export {
  AocPMFreakReadOnlyConnectorOverclaimError,
  assertNoAocPMFreakReadOnlyConnectorOverclaim,
  evaluateAocPMFreakReadOnlyConnectorClaimSafety,
} from "./pmfreak-read-only-claim-safety";
export type { ClaimSafetyResult } from "./pmfreak-read-only-claim-safety";
