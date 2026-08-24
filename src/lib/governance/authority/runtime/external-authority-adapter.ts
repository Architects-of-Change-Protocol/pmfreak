import { RuntimeAuthorityUnavailableError, type RuntimeAuthorityPort, type RuntimeAuthorityProviderKind, type RuntimeAuthorityProviderMetadata, type RuntimeGovernanceEvaluationInput, type RuntimeAgentAccessInput, type RuntimeAgentScopeInput, type RuntimePermission, type RuntimeWorkspaceRole } from "./authority-port";
import type { DelegationInput, ExecutionGrantInput } from "./runtime-input-contracts";

export class ExternalRuntimeAuthorityAdapter implements RuntimeAuthorityPort {
  constructor(private readonly kind: Extract<RuntimeAuthorityProviderKind, "external_sdk" | "remote_service" | "federated">) {}
  private metadata(): RuntimeAuthorityProviderMetadata {
    return { authorityProviderKind: this.kind, authorityProviderId: `pmfreak.${this.kind}`, authoritySource: "external-runtime", delegatedTo: "external-runtime", failClosed: true, reason: "external_runtime_not_configured" };
  }
  getProviderMetadata() { return this.metadata(); }
  private unavailable(): never { throw new RuntimeAuthorityUnavailableError("external_runtime_not_configured"); }
  async authorizeAction(_input: RuntimeGovernanceEvaluationInput): Promise<never> { return this.unavailable(); }
  async enforceAuthorization(_input: RuntimeGovernanceEvaluationInput): Promise<never> { return this.unavailable(); }
  async issueExecutionGrant(_input: ExecutionGrantInput): Promise<never> { return this.unavailable(); }
  async consumeExecutionGrant(_input: ExecutionGrantInput): Promise<never> { return this.unavailable(); }
  async verifyExecutionGrant(_input: ExecutionGrantInput): Promise<never> { return this.unavailable(); }
  async issueDelegatedCapability(_input: DelegationInput): Promise<never> { return this.unavailable(); }
  async consumeDelegatedCapability(_input: DelegationInput): Promise<never> { return this.unavailable(); }
  async revokeDelegatedCapability(_input: DelegationInput): Promise<never> { return this.unavailable(); }
  async evaluateDelegatedAccess(_input: DelegationInput): Promise<never> { return this.unavailable(); }
  async resolveAuthorityChain(_input: { workspaceId: string; delegationId?: string | null; capabilityId?: string | null; includeRevoked?: boolean }): Promise<never> { return this.unavailable(); }
  async validateDelegatedCapability(_input: DelegationInput): Promise<never> { return this.unavailable(); }
  async evaluateAgentAccess(_input: RuntimeAgentAccessInput): Promise<never> { return this.unavailable(); }
  async requireAgentScope(_input: RuntimeAgentScopeInput): Promise<never> { return this.unavailable(); }
  async grantAgentScope(_input: RuntimeAgentScopeInput): Promise<never> { return this.unavailable(); }
  async requireWorkspaceMembership(_workspaceId: string): Promise<never> { return this.unavailable(); }
  async requireWorkspaceRole(_workspaceId: string, _allowedRoles: RuntimeWorkspaceRole[]): Promise<never> { return this.unavailable(); }
  async requireProjectAccess(_projectId: string): Promise<never> { return this.unavailable(); }
  async requireProjectPermission(_projectId: string, _permission: RuntimePermission): Promise<never> { return this.unavailable(); }
  async requireGovernancePermission(_workspaceId: string, _permission: RuntimePermission): Promise<never> { return this.unavailable(); }
}
