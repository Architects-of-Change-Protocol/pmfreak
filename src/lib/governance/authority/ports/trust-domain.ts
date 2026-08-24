// PMFreak port: trust domain resolution and signing-key lifecycle.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// Upstream's nearest surface is TrustRegistryProvider, reachable only via a
// @deprecated alias: a single canonical-request method. This port is a seven-method
// key-lifecycle surface, and resolveHmacSecret is synchronous and env/vault-backed.
// Host secret resolution stays deliberately on the PMFreak side of the boundary.
// Not equivalent; not adopted.

export interface TrustKeyRecord {
  key_id: string;
  algorithm: "HMAC-SHA256" | "Ed25519";
  status: "active" | "rotated" | "revoked";
  secret_ref?: string | null;
  public_metadata?: {
    public_key_pem?: string | null;
    public_key_jwk?: Record<string, unknown>;
  } | null;
}

export interface TrustDomainRecord {
  id: string;
  domain_key: string;
  issuer_app: string;
  status: string;
  verification_mode?: string;
  workspace_id?: string | null;
}

export interface TrustVerificationResult {
  ok: boolean;
  reason?: string;
  trustDomain: TrustDomainRecord;
}

export interface TrustDomainPort {
  getActiveSigningKey(trustDomain: string): Promise<TrustKeyRecord | null>;
  getActiveAsymmetricSigningKey(trustDomain: string): Promise<TrustKeyRecord | null>;
  resolveVerificationKey(input: {
    trustDomainId: string;
    keyId: string;
  }): Promise<TrustKeyRecord | null>;
  // Returns a crypto.KeyObject (Node.js); typed as unknown here to avoid a node:crypto
  // dependency in this layer. Callers that perform Ed25519 verification
  // (e.g. capability-claims.ts) cast the return value to crypto.KeyObject at use-site.
   
  resolvePublicVerificationKey(key: TrustKeyRecord): unknown;
  verifyIssuerTrust(input: {
    trustDomain: string;
    issuerApp: string;
    expectedTrustDomain?: string;
  }): Promise<TrustVerificationResult>;
  evaluateVerifierPolicy(input: {
    verifierWorkspaceId: string;
    trustDomainId: string;
    issuerApp: string;
    action?: string;
    resourceType?: string;
  }): Promise<{ ok: boolean; reason?: string }>;
  // Host resolves the HMAC secret for HMAC-SHA256 signing.
  // This keeps env var / vault lookups in PMFreak infrastructure, out of the domain.
  resolveHmacSecret(trustDomain: string): string;
}
