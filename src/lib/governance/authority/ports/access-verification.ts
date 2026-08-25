// PMFreak port: workspace/project/agent access verification.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// Upstream's nearest surface is ExecutionAuthorizationProvider, reachable only via
// a @deprecated alias: one canonical-request method returning AdapterResult<…>.
// This port is a four-method domain surface that throws on denial. Not equivalent;
// not adopted.
// Implemented by PmfreakAccessVerificationAdapter over Supabase membership/RBAC.

export class GovernanceAccessDeniedError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "GovernanceAccessDeniedError";
  }
}

export interface AccessVerificationPort {
  requireWorkspaceMembership(workspaceId: string): Promise<{ role: string }>;
  requireProjectPermission(
    projectId: string,
    permission: string
  ): Promise<{ role: string; workspaceId: string }>;
  requireGovernancePermission(
    workspaceId: string,
    permission: string
  ): Promise<{ role: string }>;
  requireAgentScope(input: {
    workspaceId: string;
    agentId: string;
    permission: string;
    projectId?: string;
  }): Promise<{ workspaceId: string; agentId: string; permission: string }>;
}
