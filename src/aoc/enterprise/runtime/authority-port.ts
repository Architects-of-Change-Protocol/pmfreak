import type { DelegationInput, ExecutionGrantInput } from "./runtime-input-contracts";
import type {
  RuntimeAgentAccessInput,
  RuntimeAgentScopeInput,
  RuntimeAuthUserContext,
  RuntimeAuthorityPortResult,
  RuntimeAuthorityProviderMetadata,
  RuntimeEnterpriseDecision,
  RuntimeEnforcementResult,
  RuntimeGovernanceEvaluationInput,
  RuntimePermission,
  RuntimeWorkspaceRole,
} from "./runtime-contracts";

export type {
  InProcessAuthorityDependencies,
  RuntimeAgentAccessInput,
  RuntimeAgentScopeInput,
  RuntimeAuthUserContext,
  RuntimeAuthorityPortResult,
  RuntimeAuthorityProviderKind,
  RuntimeAuthorityProviderMetadata,
  RuntimeEnterpriseDecision,
  RuntimeEnforcementResult,
  RuntimeGovernanceEvaluationInput,
  RuntimePermission,
  RuntimeWorkspaceRole,
} from "./runtime-contracts";
export { RuntimeAuthorityDependencyError, RuntimeAuthorityUnavailableError } from "./runtime-contracts";

export interface RuntimeAuthorityPort {
  getProviderMetadata(): RuntimeAuthorityProviderMetadata;
  authorizeAction(input: RuntimeGovernanceEvaluationInput): Promise<RuntimeAuthorityPortResult<RuntimeEnterpriseDecision>>;
  enforceAuthorization(input: RuntimeGovernanceEvaluationInput): Promise<RuntimeAuthorityPortResult<RuntimeEnforcementResult>>;
  issueExecutionGrant(input: ExecutionGrantInput): Promise<unknown>;
  consumeExecutionGrant(input: ExecutionGrantInput): Promise<unknown>;
  verifyExecutionGrant(input: ExecutionGrantInput): Promise<unknown>;
  issueDelegatedCapability(input: DelegationInput): Promise<unknown>;
  consumeDelegatedCapability(input: DelegationInput): Promise<unknown>;
  revokeDelegatedCapability(input: DelegationInput): Promise<unknown>;
  evaluateDelegatedAccess(input: DelegationInput): Promise<unknown>;
  resolveAuthorityChain(input: Record<string, unknown>): Promise<unknown>;
  validateDelegatedCapability(input: DelegationInput): Promise<unknown>;
  evaluateAgentAccess(input: RuntimeAgentAccessInput): Promise<unknown>;
  requireAgentScope(input: RuntimeAgentScopeInput): Promise<unknown>;
  grantAgentScope(input: RuntimeAgentScopeInput): Promise<unknown>;
  requireWorkspaceMembership(workspaceId: string): Promise<RuntimeAuthorityPortResult<{ user: RuntimeAuthUserContext; workspaceId: string; role: RuntimeWorkspaceRole }>>;
  requireWorkspaceRole(workspaceId: string, allowedRoles: RuntimeWorkspaceRole[]): Promise<unknown>;
  requireProjectAccess(projectId: string): Promise<unknown>;
  requireProjectPermission(projectId: string, permission: RuntimePermission): Promise<unknown>;
  requireGovernancePermission(workspaceId: string, permission: RuntimePermission): Promise<unknown>;
}
