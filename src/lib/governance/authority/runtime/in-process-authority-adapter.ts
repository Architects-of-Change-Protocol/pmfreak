import type { InProcessAuthorityDependencies, RuntimeAuthorityPort, RuntimeAuthorityPortResult, RuntimeAuthorityProviderMetadata, RuntimeAuthUserContext, RuntimeEnterpriseDecision, RuntimeEnforcementResult, RuntimeWorkspaceRole } from "./authority-port";

const metadata: RuntimeAuthorityProviderMetadata = { authorityProviderKind: "in_process", authorityProviderId: "pmfreak.in-process", authoritySource: "enterprise-runtime", failClosed: true };

export class InProcessRuntimeAuthorityAdapter implements RuntimeAuthorityPort {
  constructor(private readonly deps: InProcessAuthorityDependencies) {}
  getProviderMetadata() { return metadata; }
  private withProvider(result: unknown) { return { ...(result as object), authorityProvider: metadata }; }
  async authorizeAction(input: Parameters<InProcessAuthorityDependencies["authorizeAction"]>[0]) { return this.withProvider(await this.deps.authorizeAction(input)) as RuntimeAuthorityPortResult<RuntimeEnterpriseDecision>; }
  async enforceAuthorization(input: Parameters<InProcessAuthorityDependencies["enforceAuthorization"]>[0]) { return this.withProvider(await this.deps.enforceAuthorization(input)) as RuntimeAuthorityPortResult<RuntimeEnforcementResult>; }
  async issueExecutionGrant(input: Parameters<InProcessAuthorityDependencies["issueExecutionGrant"]>[0]) { return this.withProvider(await this.deps.issueExecutionGrant(input)); }
  async consumeExecutionGrant(input: Parameters<InProcessAuthorityDependencies["consumeExecutionGrant"]>[0]) { return this.withProvider(await this.deps.consumeExecutionGrant(input)); }
  async verifyExecutionGrant(input: Parameters<InProcessAuthorityDependencies["verifyExecutionGrant"]>[0]) { return this.withProvider(await this.deps.verifyExecutionGrant(input)); }
  async issueDelegatedCapability(input: Parameters<InProcessAuthorityDependencies["issueDelegatedCapability"]>[0]) { return this.withProvider(await this.deps.issueDelegatedCapability(input)); }
  async consumeDelegatedCapability(input: Parameters<InProcessAuthorityDependencies["consumeDelegatedCapability"]>[0]) { return this.withProvider(await this.deps.consumeDelegatedCapability(input)); }
  async revokeDelegatedCapability(input: Parameters<InProcessAuthorityDependencies["revokeDelegatedCapability"]>[0]) { return this.withProvider(await this.deps.revokeDelegatedCapability(input)); }
  async evaluateDelegatedAccess(input: Parameters<InProcessAuthorityDependencies["evaluateDelegatedAccess"]>[0]) { return this.withProvider(await this.deps.evaluateDelegatedAccess(input)); }
  async resolveAuthorityChain(input: Parameters<InProcessAuthorityDependencies["resolveAuthorityChain"]>[0]) { return this.withProvider(await this.deps.resolveAuthorityChain(input)); }
  async validateDelegatedCapability(input: Parameters<InProcessAuthorityDependencies["validateDelegatedCapability"]>[0]) { return this.withProvider(await this.deps.validateDelegatedCapability(input)); }
  async evaluateAgentAccess(input: Parameters<InProcessAuthorityDependencies["evaluateAgentAccess"]>[0]) { return this.withProvider(await this.deps.evaluateAgentAccess(input)); }
  async requireAgentScope(input: Parameters<InProcessAuthorityDependencies["requireAgentScope"]>[0]) { return this.withProvider(await this.deps.requireAgentScope(input)); }
  async grantAgentScope(input: Parameters<InProcessAuthorityDependencies["grantAgentScope"]>[0]) { return this.withProvider(await this.deps.grantAgentScope(input)); }
  async requireWorkspaceMembership(workspaceId: string) { return this.withProvider(await this.deps.requireWorkspaceMembership(workspaceId)) as RuntimeAuthorityPortResult<{ user: RuntimeAuthUserContext; workspaceId: string; role: RuntimeWorkspaceRole }>; }
  async requireWorkspaceRole(workspaceId: string, allowedRoles: Parameters<InProcessAuthorityDependencies["requireWorkspaceRole"]>[1]) { return this.withProvider(await this.deps.requireWorkspaceRole(workspaceId, allowedRoles)); }
  async requireProjectAccess(projectId: string) { return this.withProvider(await this.deps.requireProjectAccess(projectId)); }
  async requireProjectPermission(projectId: string, permission: Parameters<InProcessAuthorityDependencies["requireProjectPermission"]>[1]) { return this.withProvider(await this.deps.requireProjectPermission(projectId, permission)); }
  async requireGovernancePermission(workspaceId: string, permission: Parameters<InProcessAuthorityDependencies["requireGovernancePermission"]>[1]) { return this.withProvider(await this.deps.requireGovernancePermission(workspaceId, permission)); }
}
