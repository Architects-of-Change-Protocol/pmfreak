// PMFreak adapter: AccessVerificationPort implementation.
// Wraps PMFreak access-guards and re-throws as AocAccessDeniedError so AOC runtime
// code never catches PMFreak-specific error types.
import {
  AccessDeniedError,
  requireWorkspaceMembership,
  requireProjectPermission,
  requireGovernancePermission,
  requireAgentScope,
} from "@/lib/security/access-guards";
import type { AccessVerificationPort } from "@/aoc/protocol/ports/access-verification";
import { AocAccessDeniedError } from "@/aoc/protocol/ports/access-verification";
import type { Permission } from "@/lib/security/rbac";

function wrap(error: unknown): never {
  if (error instanceof AccessDeniedError) {
    throw new AocAccessDeniedError(error.message, error.metadata);
  }
  throw error;
}

export class PmfreakAccessVerificationAdapter implements AccessVerificationPort {
  async requireWorkspaceMembership(workspaceId: string) {
    try {
      const ctx = await requireWorkspaceMembership(workspaceId);
      return { role: ctx.role };
    } catch (e) { wrap(e); }
  }

  async requireProjectPermission(projectId: string, permission: string) {
    try {
      const ctx = await requireProjectPermission(projectId, permission as Permission);
      return { role: ctx.role, workspaceId: ctx.workspaceId };
    } catch (e) { wrap(e); }
  }

  async requireGovernancePermission(workspaceId: string, permission: string) {
    try {
      const ctx = await requireGovernancePermission(workspaceId, permission as Permission);
      return { role: ctx.role };
    } catch (e) { wrap(e); }
  }

  async requireAgentScope(input: { workspaceId: string; agentId: string; permission: string; projectId?: string }) {
    try {
      await requireAgentScope({ workspaceId: input.workspaceId, agentId: input.agentId, permission: input.permission as Permission, projectId: input.projectId });
      return { workspaceId: input.workspaceId, agentId: input.agentId, permission: input.permission };
    } catch (e) { wrap(e); }
  }
}
