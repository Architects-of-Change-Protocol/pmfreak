// PMFreak AOC Read-Only Integration Surface v1 — public exports
//
// pmfreak.integration.aoc.read_only_surface.v1
//
// Read-only integration surface PMFreak exposes to AOC Enterprise. PMFreak
// is the data provider; AOC Enterprise is the downstream consumer. See
// README.md for scope and safety guarantees.

export {
  PMFREAK_AOC_CONSUMER_SYSTEM_ID,
  PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS,
  PMFREAK_AOC_PROVIDER_SYSTEM_ID,
  PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES,
  PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS,
  PMFREAK_AOC_READ_ONLY_SURFACE_ID,
  PMFREAK_AOC_READ_ONLY_SURFACE_NAME,
  PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES,
  PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS,
} from "./pmfreak-aoc-read-only-surface-constants";

export type {
  PMFreakAocSurfaceError,
  PMFreakAocSurfaceErrorCode,
  PMFreakAocSurfaceHealth,
  PMFreakAocSurfaceHealthStatus,
  PMFreakAocReadOnlySurfaceConfig,
  PMFreakAocReadOnlySurfaceDescriptor,
  PMFreakAocReadOnlySurfaceEnvironment,
  PMFreakAocReadOnlySurfaceRedactionMode,
  PMFreakAocReadOnlySurfaceSourceKind,
} from "./pmfreak-aoc-read-only-surface-types";

export { createPMFreakAocReadOnlySurfaceDescriptor } from "./pmfreak-aoc-read-only-surface-descriptor";
export { createPMFreakAocReadOnlySurfaceConfig } from "./pmfreak-aoc-read-only-surface-config";
export { createPMFreakAocSurfaceError } from "./pmfreak-aoc-surface-errors";

export {
  PMFreakAocMutationNotAllowedError,
  assertPMFreakAocReadOnlyOperation,
  isPMFreakAocForbiddenSurfaceOperation,
} from "./pmfreak-aoc-no-mutation-guard";

export { redactPMFreakAocSurfaceSnapshot, redactPMFreakAocSurfaceValue } from "./pmfreak-aoc-redaction";

export type {
  PMFreakActionProposalCategory,
  PMFreakActionProposalReadModel,
  PMFreakActionProposalStatus,
  PMFreakAgentReadModel,
  PMFreakAgentRole,
  PMFreakAgentStatus,
  PMFreakApprovalKind,
  PMFreakApprovalReferenceReadModel,
  PMFreakEvidenceKind,
  PMFreakEvidenceReferenceReadModel,
  PMFreakMilestoneReadModel,
  PMFreakMilestoneStatus,
  PMFreakProjectPhase,
  PMFreakProjectReadModel,
  PMFreakProjectStatus,
  PMFreakRiskReadModel,
  PMFreakRiskSeverity,
  PMFreakRiskStatus,
  PMFreakTaskReadModel,
  PMFreakTaskStatus,
} from "./pmfreak-read-models";

export type { PMFreakAocReadOnlySource } from "./pmfreak-aoc-read-only-source";

export {
  PMFREAK_DEMO_ACTION_PROPOSAL_ID,
  PMFREAK_DEMO_ACTION_PROPOSALS,
  PMFREAK_DEMO_AGENT_ID,
  PMFREAK_DEMO_AGENTS,
  PMFREAK_DEMO_APPROVAL_REFERENCE_ID,
  PMFREAK_DEMO_APPROVAL_REFERENCES,
  PMFREAK_DEMO_CUSTOMER_ID,
  PMFREAK_DEMO_EVIDENCE_REFERENCE_ID,
  PMFREAK_DEMO_EVIDENCE_REFERENCES,
  PMFREAK_DEMO_MILESTONE_ID,
  PMFREAK_DEMO_MILESTONES,
  PMFREAK_DEMO_PROJECT_ID,
  PMFREAK_DEMO_PROJECTS,
  PMFREAK_DEMO_RISK_ID,
  PMFREAK_DEMO_RISKS,
  PMFREAK_DEMO_TASK_ID,
  PMFREAK_DEMO_TASKS,
  PMFREAK_DEMO_TENANT_ID,
  PMFREAK_DEMO_WORKSPACE_ID,
} from "./pmfreak-aoc-read-only-surface-fixtures";

export { createInMemoryPMFreakAocReadOnlySource } from "./pmfreak-aoc-in-memory-source";
export type { PMFreakAocInMemorySourceFixtures } from "./pmfreak-aoc-in-memory-source";

export { createUnsupportedPMFreakAocRealReadOnlySource } from "./pmfreak-aoc-real-source-adapter";

export { createPMFreakAocSurfaceSnapshot } from "./pmfreak-aoc-surface-snapshot";
export type {
  PMFreakAocSurfaceSnapshot,
  PMFreakAocSurfaceSnapshotCounts,
  CreatePMFreakAocSurfaceSnapshotInput,
} from "./pmfreak-aoc-surface-snapshot";

export { createPMFreakAocSurfaceHealth } from "./pmfreak-aoc-surface-health";
export type { CreatePMFreakAocSurfaceHealthInput } from "./pmfreak-aoc-surface-health";

export {
  createPMFreakAocReadOnlySurfaceClient,
} from "./pmfreak-aoc-read-only-surface-client";
export type {
  PMFreakAocReadOnlySurfaceClient,
  CreatePMFreakAocReadOnlySurfaceClientInput,
} from "./pmfreak-aoc-read-only-surface-client";

export {
  PMFreakAocReadOnlySurfaceOverclaimError,
  assertNoPMFreakAocReadOnlySurfaceOverclaim,
  evaluatePMFreakAocReadOnlySurfaceClaimSafety,
} from "./pmfreak-aoc-read-only-claim-safety";
export type { ClaimSafetyResult } from "./pmfreak-aoc-read-only-claim-safety";
