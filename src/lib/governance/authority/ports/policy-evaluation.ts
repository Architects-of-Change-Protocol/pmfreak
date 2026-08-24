// PMFreak port: policy evaluation.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// Upstream's nearest surface is PolicyDecisionProvider, reachable only via a
// @deprecated alias, which returns the three-state canonical PolicyDecision.
// This port returns PMFreak's five-state outcome plus matched policy/grant
// provenance. Not equivalent; not adopted.

import type { GovernanceActorContext } from "../actor-model";
import type { PolicyEvaluationOutcome } from "../persistence/records";

export type { GovernanceActorContext };

// Deduplicated: this vocabulary was previously declared twice inside the former
// pseudo-upstream tree. It has a single PMFreak-owned definition now.
export type { PolicyEvaluationOutcome } from "../persistence/records";

export type PolicyEvaluationInput = {
  actor: GovernanceActorContext;
  workspaceId?: string;
  resourceType: string;
  resourceId: string;
  permission: string;
  requestedDurationHours?: number;
  justification?: string;
  rbacAllowed: boolean;
};

export type PolicyEvaluationResult = {
  decision: PolicyEvaluationOutcome;
  reason: string;
  matchedPolicyIds: string[];
  matchedGrantId?: string;
  actorUserId: string;
  actorType: string;
  workspaceId: string | null;
  resourceType: string;
  resourceId: string;
  permission: string;
  evaluatedAt: string;
};

export interface PolicyEvaluatorPort {
  evaluatePolicyDecision(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult>;
}
