import { createPublicKey, verify, type JsonWebKeyInput } from "node:crypto";
import { hashCapabilityClaim } from "@/lib/security/capability-claims";
import { logSecurityEvent } from "@/lib/security/telemetry";
import type { CapabilityClaim } from "@/lib/security/capability-claims";

type OfflineKeyRecord = {
  keyId: string;
  trustDomain: string;
  status: string;
  publicJwk?: Record<string, unknown>;
  publicPem?: string;
};

type RevocationRecord = {
  revocation_type: string;
  trust_domain?: string;
  key_id?: string | null;
  claim_hash?: string | null;
  delegation_id?: string | null;
  source_event_id?: string;
};

type TrustGraphEdge = {
  source_domain: string;
  target_domain?: string;
  relationship: string;
  status: string;
};

type TrustEventRecord = {
  event_id?: string;
  event_type: string;
  trust_domain?: string;
  key_id?: string | null;
  claim_hash?: string | null;
  delegation_id?: string | null;
  issuer_app?: string;
  source_verifier?: string;
  nonce?: string;
  created_at?: string;
  sequence_number?: number;
  [key: string]: unknown;
};

type TrustAnchorRecord = {
  trust_domain: string;
  status: string;
  anchor_id?: string;
  [key: string]: unknown;
};

type LocalTrustPolicy = {
  distrustedIssuers?: string[];
  revokedDomains?: string[];
};

export async function fetchIssuerMetadata(baseUrl: string) { const res = await fetch(`${baseUrl}/api/governance/trust/.well-known/capability-issuer`); const metadata = await res.json() as Record<string, unknown>; await logSecurityEvent("independent_verifier_metadata_fetched", { metadata: { issuer: (metadata.issuerApp as string | null) ?? null } }); return metadata; }
export async function fetchIssuerKeys(baseUrl: string) { const res = await fetch(`${baseUrl}/api/governance/trust/keys`); const keys = await res.json() as { keys?: unknown[] }; await logSecurityEvent("independent_verifier_keys_fetched", { metadata: { keyCount: keys.keys?.length ?? 0 } }); return keys; }
export function evaluateLocalVerifierTrustPolicy(input: { claim: CapabilityClaim; expectedTrustDomain: string; revokedDomains?: string[]; distrustedIssuers?: string[] }) { if (input.revokedDomains?.includes(input.expectedTrustDomain)) return { ok: false, reason: "trust_domain_revoked" }; if (input.distrustedIssuers?.includes(input.claim?.issuer?.issuerId ?? "")) return { ok: false, reason: "issuer_distrusted" }; return input.claim?.proof?.trustDomain === input.expectedTrustDomain ? { ok: true, reason: "local_policy_allow" } : { ok: false, reason: "unexpected_trust_domain" }; }
export function verifyClaimOffline(input: { claim: CapabilityClaim; keySet: OfflineKeyRecord[]; expectedTrustDomain: string; revocationRegistry?: RevocationRecord[]; trustGraphEdges?: TrustGraphEdge[] }) { const local = evaluateLocalVerifierTrustPolicy({ claim: input.claim, expectedTrustDomain: input.expectedTrustDomain, revokedDomains: (input.revocationRegistry ?? []).filter((r)=>r.revocation_type==="trust_domain").map((r)=>r.trust_domain ?? "") }); if (!local.ok) return { valid: false, reason: local.reason }; const key = input.keySet.find((k) => k.keyId === input.claim?.proof?.keyId && k.trustDomain === input.expectedTrustDomain); if (!key || key.status === "revoked") return { valid: false, reason: key ? "revoked_key" : "unknown_key" }; const claimHash = hashCapabilityClaim(input.claim); const revoked = (input.revocationRegistry ?? []).find((r)=> (r.revocation_type==="claim" && r.claim_hash===claimHash) || (r.revocation_type==="key" && r.key_id===key.keyId) || (r.revocation_type==="delegation" && r.delegation_id===input.claim?.lineage?.parentDelegationId)); if (revoked) return { valid:false, reason: revoked.revocation_type === "claim" ? "claim_revoked" : revoked.revocation_type === "delegation" ? "delegation_revoked" : "key_revoked" }; // normalized revocation reason const distrustEdge = (input.trustGraphEdges ?? []).find((e)=>e.source_domain===input.expectedTrustDomain && e.relationship==="distrusts" && e.status==="active"); if (distrustEdge) return { valid: false, reason: "issuer_distrusted" };
  if (input.claim?.proof?.algorithm !== "Ed25519") return { valid: false, reason: "server_mediated_only_hmac" }; const unsigned = { ...input.claim, proof: undefined }; const verifier = key.publicJwk ? createPublicKey({ key: key.publicJwk as JsonWebKeyInput["key"], format: "jwk" }) : key.publicPem ? createPublicKey(key.publicPem) : null; if (!verifier) return { valid: false, reason: "missing_public_key" }; const ok = verify(null, Buffer.from(`${input.claim.proof.keyId}.${JSON.stringify(unsigned)}`), verifier, Buffer.from(input.claim.proof.signature, "base64url")); const result = ok ? { valid: true, reason: "verified", claimHash } : { valid: false, reason: "signature_invalid" }; void logSecurityEvent(ok ? "independent_claim_verified" : "independent_claim_rejected", { metadata: { reason: result.reason, trustDomain: input.expectedTrustDomain } }); return result; }
export function importTrustEvents(input: { events: TrustEventRecord[]; trustedSources: string[] }) { return input.events.filter((event) => input.trustedSources.includes(event.source_verifier ?? "")); }
export function applyRevocationEvent(input: { event: TrustEventRecord; registry: RevocationRecord[] }) { const revocationType = input.event.event_type === "capability_claim_revoked" ? "claim" : input.event.event_type === "signing_key_revoked" ? "key" : input.event.event_type === "trust_domain_revoked" ? "trust_domain" : input.event.event_type === "delegation_revoked" ? "delegation" : input.event.event_type === "verifier_policy_revoked" ? "verifier_policy" : null; if (!revocationType) return input.registry; return [...input.registry, { revocation_type: revocationType, trust_domain: input.event.trust_domain, key_id: input.event.key_id ?? null, claim_hash: input.event.claim_hash ?? null, delegation_id: input.event.delegation_id ?? null, source_event_id: input.event.event_id }]; }
export function updateLocalTrustPolicyFromEvent(input: { event: TrustEventRecord; trustPolicy: LocalTrustPolicy }) { if (input.event.event_type === "issuer_distrusted") input.trustPolicy.distrustedIssuers = [...(input.trustPolicy.distrustedIssuers ?? []), input.event.issuer_app ?? ""]; if (input.event.event_type === "trust_domain_revoked") input.trustPolicy.revokedDomains = [...(input.trustPolicy.revokedDomains ?? []), input.event.trust_domain ?? ""]; void logSecurityEvent("verifier_trust_updated", { metadata: { eventId: input.event.event_id, eventType: input.event.event_type } }); return input.trustPolicy; }
export function explainTrustUpdate(input: { event: TrustEventRecord }) { return { eventId: input.event.event_id, applied: ["trust posture updated", "verification remains non-executable"] }; }
export function explainIndependentVerification() { return { independentlyVerifiable: true, limitations: ["independent verification does not imply execution authorization", "HMAC claims remain server-mediated", "not public federation", "not DID/blockchain", "not AOC Protocol yet"] }; }


export function validateImportedTrustEvent(input: { event: TrustEventRecord; anchors: TrustAnchorRecord[]; seenNonces: Set<string>; lastSequenceNumber?: number; now?: number; windowSeconds?: number }) {
  const now = input.now ?? Date.now();
  const windowMs = (input.windowSeconds ?? 300) * 1000;
  const anchor = input.anchors.find((a)=>a.trust_domain===input.event.trust_domain && a.status==='active');
  if (!anchor) return { ok: false, reason: 'anchor_missing' };
  if (input.seenNonces.has(input.event.nonce ?? "")) return { ok: false, reason: 'duplicate_nonce' };
  if (Math.abs(now - new Date(input.event.created_at ?? "").getTime()) > windowMs) return { ok: false, reason: 'stale_event_detected' };
  if (typeof input.lastSequenceNumber === 'number' && input.event.sequence_number !== input.lastSequenceNumber + 1) return { ok: false, reason: 'invalid_sequence_detected' };
  return { ok: true, reason: 'offline_event_valid' };
}
