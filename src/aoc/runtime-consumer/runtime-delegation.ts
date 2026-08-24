import {
  buildAuthorityLineage,
  consumeDelegatedCapability as consumeLegacyDelegatedCapability,
  evaluateDelegatedAccess,
  explainDelegationChain,
  issueDelegatedCapability,
  resolveAuthorityChain,
  revokeDelegatedCapability,
  validateDelegatedCapability,
  type DelegationConstraints,
  type DelegationDecision,
  type DelegationInput,
} from "@/lib/governance/authority/runtime/delegated-capabilities-bridge";

export {
  buildAuthorityLineage,
  evaluateDelegatedAccess,
  explainDelegationChain,
  issueDelegatedCapability,
  resolveAuthorityChain,
  revokeDelegatedCapability,
  validateDelegatedCapability,
};
export type { DelegationConstraints, DelegationDecision, DelegationInput };

export async function consumeDelegatedCapability(input: DelegationInput) {
  try {
    return await consumeLegacyDelegatedCapability(input);
  } catch (error) {
    return { ok: false as const, reason: "runtime_dependency_unavailable", metadata: { authoritySource: "runtime-consumer", delegatedTo: "enterprise-runtime", failClosed: true, error: error instanceof Error ? error.message : String(error) } };
  }
}
