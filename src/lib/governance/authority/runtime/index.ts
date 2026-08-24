import {
  evaluateGovernanceAction as evaluateGovernanceActionWithContext,
  enforceGovernanceAction as enforceGovernanceActionWithContext,
  type GovernanceEvaluationInput,
} from "./governance-core";
import { composeRuntimeContext } from "./composition";
import type { ComposeRuntimeContextOptions } from "./composition";

export type { GovernanceEvaluationInput };
export type {
  GovernanceActorType,
  GovernanceDecisionState,
  GovernanceDecisionStatus,
  GovernanceAction,
  GovernanceDecisionResult,
} from "./governance-core";
export {
  GOVERNANCE_POLICY_REGISTRY,
  evaluateGovernanceAction,
  enforceGovernanceAction,
  createApprovalRequestFromDecision,
  explainGovernanceDecision,
} from "./governance-core";
export type {
  RuntimeContext,
  RuntimeSecurityContext,
  RuntimeGovernanceContext,
  RuntimeCapabilityContext,
  RuntimeAuditContext,
  RuntimeMetadata,
} from "./context";
export {
  runtimeContextToCapabilityClaimPorts,
  runtimeContextToCapabilityVerificationPorts,
} from "./context";
export {
  composeRuntimeContext,
  composeCapabilityClaimPorts,
  composeCapabilityVerificationPorts,
} from "./composition";

// NAME DELIBERATELY DIFFERENT FROM UPSTREAM.
// @aoc-enterprise/runtime exports `evaluateEnforcementPipeline` and
// `enforceEnforcementPipeline` with the same arity but a different contract:
//   upstream: (input: AuthorizationGrantInput, deps: AuthorizationOrchestrationDeps)
//             => Promise<{ allowed, reasonCodes, audit }>
//   PMFreak:  (input: GovernanceEvaluationInput, options: ComposeRuntimeContextOptions)
//             => PMFreak governance decision (decisionId, trace, riskLevel, approval routing)
// The shared name plus shared arity made a silent mis-binding possible. These are
// PMFreak's, and they say so.
export async function evaluateGovernancePipeline(input: GovernanceEvaluationInput, options: ComposeRuntimeContextOptions) {
  return evaluateGovernanceActionWithContext(composeRuntimeContext(options), input);
}

export async function enforceGovernancePipeline(input: GovernanceEvaluationInput, options: ComposeRuntimeContextOptions) {
  return enforceGovernanceActionWithContext(composeRuntimeContext(options), input);
}
