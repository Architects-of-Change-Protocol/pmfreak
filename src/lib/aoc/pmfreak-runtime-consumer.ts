import type { AuthUserContext } from "@/lib/auth";
import type { GovernanceAction } from "@/lib/governance/authority/runtime";
import { toGovernanceEvaluationInput, type RuntimeAuthorizationRequest } from "@/lib/aoc/contracts";

export type PMFreakRuntimeContextInput = {
  user: AuthUserContext;
  action: GovernanceAction;
  routeId: string;
  workspaceId?: string | null;
  projectId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  actorAgentId?: string | null;
  agentToken?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildEnterpriseRuntimeRequest(input: PMFreakRuntimeContextInput) {
  const request: RuntimeAuthorizationRequest = {
    actor: {
      actorType: input.actorAgentId ? "ai_agent" : "user",
      actorUserId: input.user.id,
      actorAgentId: input.actorAgentId ?? null,
      agentToken: input.agentToken ?? null,
    },
    action: input.action,
    scope: {
      workspaceId: input.workspaceId ?? null,
      projectId: input.projectId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
    },
    routeId: input.routeId,
    requestMetadata: { source: "pmfreak-runtime-consumer", ...(input.metadata ?? {}) },
  };

  return toGovernanceEvaluationInput(request);
}
