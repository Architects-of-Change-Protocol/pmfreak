import type { GovernanceActorContext } from "@/lib/governance/authority/actor-model";
import type { AuthUserContext } from "@/lib/auth";

export type { GovernanceActorContext };

export function resolveUserGovernanceActorContext(
  user: AuthUserContext,
  opts?: { workspaceId?: string; projectId?: string; roles?: string[]; permissions?: string[] }
): GovernanceActorContext {
  return {
    actorId: user.id,
    actorType: "user",
    workspaceId: opts?.workspaceId,
    projectId: opts?.projectId,
    roles: opts?.roles,
    permissions: opts?.permissions,
  };
}

export function resolveAgentGovernanceActorContext(
  agentId: string,
  opts?: { workspaceId?: string; projectId?: string; scopes?: string[] }
): GovernanceActorContext {
  return {
    actorId: agentId,
    actorType: "ai_agent",
    workspaceId: opts?.workspaceId,
    projectId: opts?.projectId,
    permissions: opts?.scopes,
  };
}

export function createSystemGovernanceActorContext(
  purpose: string,
  opts?: { workspaceId?: string; projectId?: string }
): GovernanceActorContext {
  return {
    actorId: `system:${purpose}`,
    actorType: "system",
    workspaceId: opts?.workspaceId,
    projectId: opts?.projectId,
  };
}
