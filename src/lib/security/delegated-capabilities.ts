import { ensurePmfreakAocAdaptersRegistered } from "@/lib/aoc/bootstrap";
import { getAocAdapter } from "@/aoc/runtime/adapters";
import { composeRuntimeContext } from "@/lib/governance/authority/runtime";
import {
  buildAuthorityLineage,
  explainDelegationChain,
  resolveAuthorityChain as _resolveAuthorityChain,
  evaluateDelegatedAccess as _evaluateDelegatedAccess,
  issueDelegatedCapability as _issueDelegatedCapability,
  validateDelegatedCapability as _validateDelegatedCapability,
  revokeDelegatedCapability as _revokeDelegatedCapability,
  consumeDelegatedCapability as _consumeDelegatedCapability,
  type DelegationInput,
} from "@/lib/governance/authority/runtime/delegated-capabilities";

export { buildAuthorityLineage, explainDelegationChain };
export type { DelegationConstraints, DelegationDecision, DelegationInput } from "@/lib/governance/authority/runtime/delegated-capabilities";

function getComposeOptions() {
  return {
    adapters: {
      trustDomain: getAocAdapter("trustDomain"),
      trustCoordination: getAocAdapter("trustCoordination"),
      securityAudit: getAocAdapter("securityAudit"),
      privilegedDb: getAocAdapter("privilegedDb"),
      accessVerification: getAocAdapter("accessVerification"),
      agentAttestation: getAocAdapter("agentAttestation"),
      policyEvaluator: getAocAdapter("policyEvaluator"),
    },
  };
}

export async function resolveAuthorityChain(input: Parameters<typeof _resolveAuthorityChain>[1]) {
  ensurePmfreakAocAdaptersRegistered();
  return _resolveAuthorityChain(composeRuntimeContext(getComposeOptions()), input);
}

export async function evaluateDelegatedAccess(input: DelegationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _evaluateDelegatedAccess(composeRuntimeContext(getComposeOptions()), input);
}

export async function issueDelegatedCapability(input: DelegationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _issueDelegatedCapability(composeRuntimeContext(getComposeOptions()), input);
}

export async function validateDelegatedCapability(input: DelegationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _validateDelegatedCapability(composeRuntimeContext(getComposeOptions()), input);
}

export async function revokeDelegatedCapability(input: DelegationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _revokeDelegatedCapability(composeRuntimeContext(getComposeOptions()), input);
}

export async function consumeDelegatedCapability(input: DelegationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _consumeDelegatedCapability(composeRuntimeContext(getComposeOptions()), input);
}
