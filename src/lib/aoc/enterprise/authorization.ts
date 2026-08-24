import {
  enforceEnforcementPipeline,
  type GovernanceEvaluationInput,
  type GovernanceDecisionState,
} from "@pmfreak/aoc-enterprise-internal";
import { ensurePmfreakAocAdaptersRegistered, getEnterpriseRuntimeComposeOptions } from "@/lib/aoc/bootstrap";

export type EnterpriseRuntimeDecision = import("@/lib/aoc/contracts").CanonicalRuntimeDecision & {
  decisionSource: "enterprise-runtime" | "policy-simulation" | "compatibility-adapter";
  decision: GovernanceDecisionState;
  enforcementLevel: "hard" | "soft";
  evaluatedPolicies: string[];
  evaluatedCapabilities: string[];
  evaluatedRoles: string[];
  auditRequired: boolean;
  trustContext: { actorType: string; actorUserId: string | null; actorAgentId: string | null; riskLevel: string };
};

/* legacy alias fields retained below */
export type _LegacyEnterpriseRuntimeDecision = {
  allowed: boolean;
  decisionId: string;
  decisionSource: "enterprise-runtime" | "policy-simulation" | "compatibility-adapter";
  authoritative: boolean;
  decision: GovernanceDecisionState;
  enforcementLevel: "hard" | "soft";
  reason: string;
  evaluatedAt: string;
  evaluatedPolicies: string[];
  evaluatedCapabilities: string[];
  evaluatedRoles: string[];
  auditRequired: boolean;
  trustContext: { actorType: string; actorUserId: string | null; actorAgentId: string | null; riskLevel: string };
  runtimeMetadata: Record<string, unknown>;
};

export function normalizeRuntimeDecision(decision: Awaited<ReturnType<typeof enforceEnforcementPipeline>>["decision"]): EnterpriseRuntimeDecision {
  const lineage = {
    decisionId: decision.decisionId,
    runtimeDecisionId: decision.decisionId,
    traceId: undefined,
    actorLineage: { actorType: decision.actor.type, actorUserId: decision.actor.userId, actorAgentId: decision.actor.agentId },
    timestamps: { decidedAt: decision.evaluatedAt },
  };

  return {
    allowed: decision.allowed,
    decisionId: decision.decisionId,
    authoritySource: "enterprise-runtime",
    governanceAction: decision.matchedPolicy,
    scope: { workspaceId: decision.scope.workspaceId, projectId: decision.scope.projectId, resourceType: decision.scope.resourceType, resourceId: decision.scope.resourceId },
    actor: { actorType: decision.actor.type, actorUserId: decision.actor.userId, actorAgentId: decision.actor.agentId },
    lineage,
    policy: { matchedPolicies: [decision.matchedPolicy], requiredPermission: decision.requiredPermission, enforcementLevel: decision.allowed ? "soft" : "hard" },
    decisionSource: "enterprise-runtime",
    authoritative: true,
    decisionState: decision.decision,
    decision: decision.decision,
    enforcementLevel: decision.allowed ? "soft" : "hard",
    denialReason: decision.allowed ? undefined : decision.reason,
    reason: decision.reason,
    evaluatedAt: decision.evaluatedAt,
    evaluatedPolicies: [decision.matchedPolicy],
    evaluatedCapabilities: [decision.requiredPermission],
    evaluatedRoles: [],
    auditRequired: true,
    trustContext: {
      actorType: decision.actor.type,
      actorUserId: decision.actor.userId,
      actorAgentId: decision.actor.agentId,
      riskLevel: decision.riskLevel,
    },
    runtimeMetadata: {
      source: "runtime-wrapper",
      routeId: "authorizeRuntimeAction",
      status: decision.status,
      requiredApprovalType: decision.requiredApprovalType,
      reviewerRoleRequired: decision.reviewerRoleRequired,
      trace: { entries: decision.trace },
      scope: decision.scope,
      evaluatedAt: decision.evaluatedAt,
    },
  };
}

export async function authorizeRuntimeAction(input: GovernanceEvaluationInput) {
  ensurePmfreakAocAdaptersRegistered();
  const result = await enforceEnforcementPipeline(input, getEnterpriseRuntimeComposeOptions());
  return normalizeRuntimeDecision(result.decision);
}
