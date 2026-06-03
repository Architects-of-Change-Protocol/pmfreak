// AOC Protocol: cryptographic capability claims.
// Future extraction boundary: this module must NOT import from host application modules.
// Trust domain resolution, revocation lookup, signing material, and audit emission
// are provided through explicit protocol-owned injection ports.
import { createHmac, createHash, createPrivateKey, sign, timingSafeEqual, verify } from "node:crypto";
import type { CapabilityClaimPorts } from "../ports/capability-verification";
import type { TrustKeyRecord } from "../ports/trust-domain";

// aoc-capability-claim-v1.2 is the canonical version going forward.
// The pmfreak-capability-claim-v* versions are retained as accepted-but-deprecated values
// so that claims already stored in production databases remain verifiable.
export const CAPABILITY_CLAIM_VERSION = "aoc-capability-claim-v1" as const;
export const CAPABILITY_CLAIM_VERSION_V11 = "aoc-capability-claim-v1.1" as const;
export const CAPABILITY_CLAIM_VERSION_V12 = "aoc-capability-claim-v1.2" as const;
/** @deprecated Use CAPABILITY_CLAIM_VERSION_V12 ("aoc-capability-claim-v1.2") for new claims. */
export const CAPABILITY_CLAIM_VERSION_LEGACY_V1 = "pmfreak-capability-claim-v1" as const;
/** @deprecated Use CAPABILITY_CLAIM_VERSION_V12 ("aoc-capability-claim-v1.2") for new claims. */
export const CAPABILITY_CLAIM_VERSION_LEGACY_V11 = "pmfreak-capability-claim-v1.1" as const;
/** @deprecated Use CAPABILITY_CLAIM_VERSION_V12 ("aoc-capability-claim-v1.2") for new claims. */
export const CAPABILITY_CLAIM_VERSION_LEGACY_V12 = "pmfreak-capability-claim-v1.2" as const;

export type CapabilityClaimVersion =
  | typeof CAPABILITY_CLAIM_VERSION
  | typeof CAPABILITY_CLAIM_VERSION_V11
  | typeof CAPABILITY_CLAIM_VERSION_V12
  | typeof CAPABILITY_CLAIM_VERSION_LEGACY_V1
  | typeof CAPABILITY_CLAIM_VERSION_LEGACY_V11
  | typeof CAPABILITY_CLAIM_VERSION_LEGACY_V12;

export type ClaimIssuerType = "system" | "user" | "agent";
export type ClaimSubjectType = "user" | "agent";

// issuer.app is now typed as string — AOC protocol is application-neutral.
// PMFreak passes "pmfreak" as the app value via the adapter layer for backward compatibility.
export type CapabilityClaim = { version: CapabilityClaimVersion; issuer: { app: string; workspaceId: string; issuerType: ClaimIssuerType; issuerUserId?: string; issuerAgentId?: string; trustDomain?: string; issuerId?: string }; subject: { subjectType: ClaimSubjectType; userId?: string; agentId?: string }; authority: { action: string; requestedPermission: string; resourceType?: string; resourceId?: string; workspaceId: string; projectId?: string }; constraints: { maxUses?: number; allowedUntil: string; canDelegate?: boolean; delegationDepth?: number; allowedActions?: string[]; allowedProjectIds?: string[]; allowedResourceTypes?: string[] }; lineage: { parentDecisionId?: string; parentGrantId?: string; parentDelegationId?: string; rootApprovalRequestId?: string; issuedAt: string }; proof: { algorithm: "HMAC-SHA256" | "Ed25519"; keyId: string; signature: string; trustDomain?: string; issuedAt?: string } };

export const canonicalize = (value: unknown): string => JSON.stringify(sortValue(value));
const sortValue = (value: unknown): unknown => Array.isArray(value) ? value.map(sortValue) : value && typeof value === "object" ? Object.keys(value as Record<string, unknown>).sort().reduce((acc, key) => ({ ...acc, [key]: sortValue((value as Record<string, unknown>)[key]) }), {}) : value;

const signHmac = (payload: Omit<CapabilityClaim, "proof">, keyId: string, hmacSecret: string) =>
  createHmac("sha256", hmacSecret).update(`${keyId}.${canonicalize(payload)}`).digest("base64url");

const signEd25519 = (payload: Omit<CapabilityClaim, "proof">, keyId: string, privateKeyMaterial: unknown) =>
  sign(null, Buffer.from(`${keyId}.${canonicalize(payload)}`), typeof privateKeyMaterial === "string" || Buffer.isBuffer(privateKeyMaterial) ? createPrivateKey(privateKeyMaterial) : privateKeyMaterial as import("node:crypto").KeyObject).toString("base64url");

// Default trust domain for new claims. Protocol-neutral identifier.
// Existing claims with trustDomain "pmfreak-local" remain verifiable via the revocation/trust lookup.
const DEFAULT_TRUST_DOMAIN = "aoc-local";

export async function createCapabilityClaim(input: Omit<CapabilityClaim, "version" | "proof"> & { keyId?: string; trustDomain?: string }, ports: CapabilityClaimPorts) {
  if (JSON.stringify(input).includes("grantToken") || JSON.stringify(input).includes("delegationToken")) throw new Error("claim_contains_raw_token");
  const trustDomain = input.trustDomain ?? input.issuer.trustDomain ?? DEFAULT_TRUST_DOMAIN;
  const issuedAt = new Date().toISOString();
  const payload = { ...input, version: CAPABILITY_CLAIM_VERSION_V12, issuer: { ...input.issuer, trustDomain, issuerId: input.issuer.issuerId ?? `${input.issuer.app}:${input.issuer.workspaceId}` }, lineage: { ...input.lineage, issuedAt } } as Omit<CapabilityClaim, "proof">;
  const trustDomainPort = ports.trustDomain;
  const key: TrustKeyRecord | null = input.keyId ? { key_id: input.keyId, algorithm: "HMAC-SHA256", status: "active", secret_ref: null } : await trustDomainPort.getActiveAsymmetricSigningKey(trustDomain) ?? await trustDomainPort.getActiveSigningKey(trustDomain);
  if (!key?.key_id) throw new Error("missing_active_signing_key");
  const signature = key.algorithm === "Ed25519" ? (() => { const privateKeyMaterial = ports.signer.resolvePrivateSigningKey({ trustDomain, key }); if (!privateKeyMaterial) throw new Error("asymmetric_private_key_unavailable"); return signEd25519(payload, key.key_id, privateKeyMaterial); })() : signHmac(payload, key.key_id, trustDomainPort.resolveHmacSecret(trustDomain));
  if (key.algorithm === "Ed25519") await ports.securityAudit.logEvent("asymmetric_claim_issued", { workspaceId: payload.authority.workspaceId, metadata: { trustDomain, keyId: key.key_id, algorithm: key.algorithm } });
  return { ...payload, proof: { algorithm: key.algorithm === "Ed25519" ? "Ed25519" : "HMAC-SHA256", keyId: key.key_id, trustDomain, issuedAt, signature } } as CapabilityClaim;
}

export function hashCapabilityClaim(claim: CapabilityClaim) { return createHash("sha256").update(canonicalize(claim)).digest("hex"); }

const ALL_KNOWN_VERSIONS: CapabilityClaimVersion[] = [
  CAPABILITY_CLAIM_VERSION, CAPABILITY_CLAIM_VERSION_V11, CAPABILITY_CLAIM_VERSION_V12,
  CAPABILITY_CLAIM_VERSION_LEGACY_V1, CAPABILITY_CLAIM_VERSION_LEGACY_V11, CAPABILITY_CLAIM_VERSION_LEGACY_V12,
];

export async function verifyCapabilityClaim(claim: CapabilityClaim, expected: { expectedTrustDomain?: string; enforceVerifierPolicy?: boolean; verifierWorkspaceId?: string } = {}, ports: Pick<CapabilityClaimPorts, "trustDomain" | "trustCoordination">) {
  const claimHash = hashCapabilityClaim(claim);
  if (!ALL_KNOWN_VERSIONS.includes(claim.version)) return { valid: false, reason: "unsupported_version", claimHash };
  const trustDomainPort = ports.trustDomain;
  const trustCoordPort = ports.trustCoordination;
  const trustDomain = claim.proof.trustDomain ?? claim.issuer.trustDomain ?? DEFAULT_TRUST_DOMAIN;
  const trust = await trustDomainPort.verifyIssuerTrust({ trustDomain, issuerApp: claim.issuer.app, expectedTrustDomain: expected.expectedTrustDomain }); if (!trust.ok) return { valid: false, reason: trust.reason, claimHash, trustDomain };
  const key = await trustDomainPort.resolveVerificationKey({ trustDomainId: trust.trustDomain.id, keyId: claim.proof.keyId }); if (!key) return { valid: false, reason: "unknown_key", claimHash, trustDomain };
  const revocationReason = await trustCoordPort.getRevocationReason({ trustDomain, keyId: claim.proof.keyId, claimHash, delegationId: claim.lineage.parentDelegationId, grantId: claim.lineage.parentGrantId });
  if (revocationReason) return { valid: false, reason: revocationReason, claimHash, trustDomain, keyId: key.key_id };
  if (!["HMAC-SHA256", "Ed25519"].includes(claim.proof.algorithm)) return { valid: false, reason: "unsupported_algorithm", claimHash, trustDomain, keyId: key.key_id };
  if (key.algorithm !== claim.proof.algorithm || key.status === "revoked") return { valid: false, reason: key.status === "revoked" ? "revoked_key" : "unsupported_algorithm", claimHash, trustDomain, keyId: key.key_id };
  const unsigned = { ...claim, proof: undefined } as unknown as Omit<CapabilityClaim, "proof">;
  const ok = claim.proof.algorithm === "Ed25519" ? (() => { const k = trustDomainPort.resolvePublicVerificationKey(key) as import("node:crypto").KeyObject | null; if (!k) return false; return verify(null, Buffer.from(`${claim.proof.keyId}.${canonicalize(unsigned)}`), k, Buffer.from(claim.proof.signature, "base64url")); })() : timingSafeEqual(Buffer.from(signHmac(unsigned, claim.proof.keyId, trustDomainPort.resolveHmacSecret(trustDomain))), Buffer.from(claim.proof.signature));
  if (!ok) return { valid: false, reason: "signature_invalid", claimHash, trustDomain, keyId: key.key_id };
  if (expected.enforceVerifierPolicy && expected.verifierWorkspaceId) { const pol = await trustDomainPort.evaluateVerifierPolicy({ verifierWorkspaceId: expected.verifierWorkspaceId, trustDomainId: trust.trustDomain.id, issuerApp: claim.issuer.app, action: claim.authority.action, resourceType: claim.authority.resourceType }); if (!pol.ok) return { valid: false, reason: "issuer_policy_denied", claimHash, trustDomain, keyId: key.key_id }; }
  return { valid: true, reason: "verified", claimHash, trustDomain, keyId: key.key_id, algorithm: claim.proof.algorithm, independentlyVerifiable: claim.proof.algorithm === "Ed25519", verificationMode: claim.proof.algorithm === "Ed25519" ? "independent_public_key" : "server_mediated" };
}

export const explainCapabilityClaim = (claim: CapabilityClaim) => ({ authority: claim.authority, constraints: claim.constraints, lineage: claim.lineage, subject: claim.subject, issuer: claim.issuer, proof: claim.proof });
export const claimToAuditMetadata = (claim: CapabilityClaim, reason = "") => ({ claimHash: hashCapabilityClaim(claim), keyId: claim.proof.keyId, trustDomain: claim.proof.trustDomain ?? claim.issuer.trustDomain ?? DEFAULT_TRUST_DOMAIN, workspaceId: claim.authority.workspaceId, projectId: claim.authority.projectId ?? null, subjectUserId: claim.subject.userId ?? null, subjectAgentId: claim.subject.agentId ?? null, action: claim.authority.action, requestedPermission: claim.authority.requestedPermission, issuerApp: claim.issuer.app, reason });
