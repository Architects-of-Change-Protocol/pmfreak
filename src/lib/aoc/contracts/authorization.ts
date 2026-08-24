import type { GovernanceAction, GovernanceEvaluationInput } from "@/lib/governance/authority/runtime";
import type { RuntimeScope } from "@/lib/aoc/contracts/metadata";

export type RuntimeAuthorizationRequest = {
  actor: { actorType: "user" | "ai_agent"; actorUserId: string; actorAgentId?: string | null; agentToken?: string | null };
  action: GovernanceAction;
  scope: RuntimeScope;
  routeId: string;
  requestMetadata?: Record<string, unknown>;
  auditCorrelation?: { requestId?: string; traceId?: string };
  delegationContext?: Record<string, unknown>;
  runtimeContext?: Record<string, unknown>;
};

export function toGovernanceEvaluationInput(request: RuntimeAuthorizationRequest): GovernanceEvaluationInput {
  return {
    actorType: request.actor.actorType,
    actorUserId: request.actor.actorUserId,
    actorAgentId: request.actor.actorAgentId ?? null,
    workspaceId: request.scope.workspaceId ?? null,
    projectId: request.scope.projectId ?? null,
    resourceType: request.scope.resourceType ?? null,
    resourceId: request.scope.resourceId ?? null,
    action: request.action,
    routeId: request.routeId,
    agentToken: request.actor.agentToken ?? null,
    metadata: {
      ...(request.requestMetadata ?? {}),
      auditCorrelation: request.auditCorrelation,
      delegationContext: request.delegationContext,
      runtimeContext: request.runtimeContext,
    },
  };
}
