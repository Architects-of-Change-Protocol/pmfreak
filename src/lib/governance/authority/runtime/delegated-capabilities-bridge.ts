import { buildAuthorityLineage, explainDelegationChain, type DelegationConstraints, type DelegationDecision, type DelegationInput } from "./delegated-capabilities";
import { getRuntimeAuthorityPort } from "./authority-provider";

export { buildAuthorityLineage, explainDelegationChain };
export type { DelegationConstraints, DelegationDecision, DelegationInput };

export async function resolveAuthorityChain(input: DelegationInput) { return getRuntimeAuthorityPort().resolveAuthorityChain(input); }
export async function evaluateDelegatedAccess(input: DelegationInput) { return getRuntimeAuthorityPort().evaluateDelegatedAccess(input); }
export async function issueDelegatedCapability(input: DelegationInput) { return getRuntimeAuthorityPort().issueDelegatedCapability(input); }
export async function validateDelegatedCapability(input: DelegationInput) { return getRuntimeAuthorityPort().validateDelegatedCapability(input); }
export async function consumeDelegatedCapability(input: DelegationInput) { return getRuntimeAuthorityPort().consumeDelegatedCapability(input); }
export async function revokeDelegatedCapability(input: DelegationInput) { return getRuntimeAuthorityPort().revokeDelegatedCapability(input); }
