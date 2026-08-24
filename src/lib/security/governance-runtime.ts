/**
 * LEGACY SHIM — governance logic has moved to @aoc-enterprise/runtime.
 * This file is kept for backward compatibility only.
 * Do not add new imports or logic here.
 * TODO(aoc-migration): remove this shim once all direct importers are gone.
 * Last known direct importers: none (as of this migration).
 */
export type {
  GovernanceActorType,
  GovernanceDecisionState,
  GovernanceDecisionStatus,
  GovernanceAction,
  GovernanceEvaluationInput,
} from "@pmfreak/aoc-enterprise-internal";

export {
  GOVERNANCE_POLICY_REGISTRY,
  evaluateGovernanceAction,
  enforceGovernanceAction,
  createApprovalRequestFromDecision,
  explainGovernanceDecision,
} from "@pmfreak/aoc-enterprise-internal";
