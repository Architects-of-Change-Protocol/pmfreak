import { getRuntimeAuthorityPort } from "./authority-provider";

export class AccessDeniedError extends Error {
  constructor(message: string, readonly metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export async function requireWorkspaceMembership(workspaceId: string) { return getRuntimeAuthorityPort().requireWorkspaceMembership(workspaceId); }
export async function requireWorkspaceRole(workspaceId: string, allowedRoles: string[]) { return getRuntimeAuthorityPort().requireWorkspaceRole(workspaceId, allowedRoles); }
export async function requireProjectAccess(projectId: string) { return getRuntimeAuthorityPort().requireProjectAccess(projectId); }
export async function requireProjectPermission(projectId: string, permission: string) { return getRuntimeAuthorityPort().requireProjectPermission(projectId, permission); }
export async function requireGovernancePermission(workspaceId: string, permission: string) { return getRuntimeAuthorityPort().requireGovernancePermission(workspaceId, permission); }
export async function requireScopedResourceAccess(input: { workspaceId?: string; projectId?: string }) {
  if (input.projectId) return requireProjectAccess(input.projectId);
  if (input.workspaceId) return requireWorkspaceMembership(input.workspaceId);
  throw new AccessDeniedError("Scoped access requires workspaceId or projectId.", { reason: "scope_missing" });
}
