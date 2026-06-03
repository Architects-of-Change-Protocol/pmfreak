// PMFreak adapter: TrustDomainPort implementation.
// Delegates to PMFreak's trust-domains module and resolves HMAC secrets from PMFreak env vars.
import {
  getActiveSigningKey,
  getActiveAsymmetricSigningKey,
  resolveVerificationKey,
  resolvePublicVerificationKey,
  verifyIssuerTrust,
  evaluateVerifierPolicy,
} from "@/lib/security/trust-domains";
import type { TrustDomainPort, TrustKeyRecord, TrustVerificationResult } from "@/aoc/protocol/ports/trust-domain";

export class PmfreakTrustDomainAdapter implements TrustDomainPort {
  async getActiveSigningKey(trustDomain: string): Promise<TrustKeyRecord | null> {
    return getActiveSigningKey(trustDomain);
  }

  async getActiveAsymmetricSigningKey(trustDomain: string): Promise<TrustKeyRecord | null> {
    return getActiveAsymmetricSigningKey(trustDomain);
  }

  async resolveVerificationKey(input: { trustDomainId: string; keyId: string }): Promise<TrustKeyRecord | null> {
    return resolveVerificationKey(input);
  }

  resolvePublicVerificationKey(key: TrustKeyRecord): unknown {
    return resolvePublicVerificationKey(key);
  }

  async verifyIssuerTrust(input: { trustDomain: string; issuerApp: string; expectedTrustDomain?: string }): Promise<TrustVerificationResult> {
    const result = await verifyIssuerTrust(input);
    if (!result.ok || !result.trustDomain) {
      return { ok: false, reason: result.reason, trustDomain: result.trustDomain as unknown as TrustVerificationResult["trustDomain"] };
    }
    return { ok: true, reason: result.reason, trustDomain: result.trustDomain };
  }

  async evaluateVerifierPolicy(input: {
    verifierWorkspaceId: string;
    trustDomainId: string;
    issuerApp: string;
    action?: string;
    resourceType?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    return evaluateVerifierPolicy(input);
  }

  // Resolves the HMAC secret used for HMAC-SHA256 capability claim signing.
  // The env var name is a PMFreak vertical concern and must not appear in AOC protocol code.
  resolveHmacSecret(_trustDomain: string): string {
    const secret = process.env.PMFREAK_CAPABILITY_CLAIM_SECRET;
    if (!secret) throw new Error("capability_claim_secret_missing");
    return secret;
  }
}
