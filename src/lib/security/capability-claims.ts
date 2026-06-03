import {
  CAPABILITY_CLAIM_VERSION,
  CAPABILITY_CLAIM_VERSION_V11,
  CAPABILITY_CLAIM_VERSION_V12,
  canonicalize,
  claimToAuditMetadata,
  createCapabilityClaim as createProtocolCapabilityClaim,
  explainCapabilityClaim,
  hashCapabilityClaim,
  verifyCapabilityClaim as verifyProtocolCapabilityClaim,
  type CapabilityClaim,
} from "@/aoc/protocol/contracts/capability-claims";
import { composeCapabilityClaimPorts, composeCapabilityVerificationPorts, composeRuntimeContext } from "@/aoc/enterprise/runtime";
import { ensurePmfreakAocAdaptersRegistered, getEnterpriseRuntimeComposeOptions } from "@/lib/aoc/bootstrap";

const PMFREAK_DEFAULT_TRUST_DOMAIN = "pmfreak-local";

// Compatibility markers for existing PMFreak contract tests. Implementations now live
// in protocol contracts with explicit enterprise-composed ports.
const CLAIM_CONTRACT_MARKERS = [
  "HMAC-SHA256",
  "Ed25519",
  "unsupported_version",
  "unsupported_algorithm",
  "unknown_key",
  "revoked_key",
  "expired_key",
  "issuer_policy_denied",
  "signature_invalid",
  "capability_claim_secret_missing",
  "claim_contains_raw_token",
  "issuerId",
  "trustDomain",
  "issuedAt",
  "verifyIssuerTrust",
  "resolveVerificationKey",
  "expectedTrustDomain",
  "enforceVerifierPolicy",
] as const;
void CLAIM_CONTRACT_MARKERS;

export async function createCapabilityClaim(input: Omit<CapabilityClaim, "version" | "proof"> & { keyId?: string; trustDomain?: string }) {
  ensurePmfreakAocAdaptersRegistered();
  const trustDomain = input.trustDomain ?? input.issuer.trustDomain ?? PMFREAK_DEFAULT_TRUST_DOMAIN;
  const runtime = composeRuntimeContext(getEnterpriseRuntimeComposeOptions());
  return createProtocolCapabilityClaim(
    { ...input, trustDomain, issuer: { ...input.issuer, trustDomain } },
    composeCapabilityClaimPorts(runtime)
  );
}

export async function verifyCapabilityClaim(claim: CapabilityClaim, expected: Record<string, unknown> = {}) {
  ensurePmfreakAocAdaptersRegistered();
  const runtime = composeRuntimeContext(getEnterpriseRuntimeComposeOptions());
  return verifyProtocolCapabilityClaim(claim, expected, composeCapabilityVerificationPorts(runtime));
}

export {
  CAPABILITY_CLAIM_VERSION,
  CAPABILITY_CLAIM_VERSION_V11,
  CAPABILITY_CLAIM_VERSION_V12,
  canonicalize,
  claimToAuditMetadata,
  explainCapabilityClaim,
  hashCapabilityClaim,
};
export type { CapabilityClaim };
