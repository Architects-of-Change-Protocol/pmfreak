import { createHmac, createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { resolvePublicVerificationKey, resolveVerificationKey } from "@/lib/security/trust-domains";
import { logSecurityEvent } from "@/lib/security/telemetry";

export type TrustEventType = "trust_domain_suspended" | "trust_domain_revoked" | "signing_key_revoked" | "signing_key_rotated" | "capability_claim_revoked" | "delegation_revoked" | "issuer_distrusted" | "verifier_policy_revoked";
export type TrustSeverity = "info" | "warning" | "critical";
export type RevocationReason = "claim_revoked" | "key_revoked" | "trust_domain_revoked" | "delegation_revoked" | "grant_revoked" | "verifier_policy_revoked" | "issuer_distrusted" | null;

export type TrustEventRecord = {
  id?: string;
  event_id?: string;
  event_type: string;
  issuer_app?: string | null;
  trust_domain?: string;
  trust_domain_id?: string;
  key_id?: string | null;
  claim_hash?: string | null;
  delegation_id?: string | null;
  grant_id?: string | null;
  workspace_id?: string | null;
  source_verifier?: string | null;
  severity?: string;
  reason?: string | null;
  event_payload?: Record<string, unknown>;
  signature?: string | null;
  signature_key_id?: string;
  signature_algorithm?: string;
  public_key_pem?: string;
  created_at?: string;
  expires_at?: string | null;
  propagated_at?: string | null;
  sequence_number?: number | null;
  nonce?: string;
  previous_event_hash?: string | null;
};

export type TrustGraphEdgeRecord = {
  source_domain: string;
  target_domain: string;
  relationship: string;
  status: string;
  scope?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VerifierTrustPolicyRecord = {
  policy_id?: string;
  trust_domain?: string;
  target_domain?: string;
  policy_status?: string;
  minimum_trust_level?: string;
  max_event_age_seconds?: number;
  allowed_event_types?: string[];
  require_signed_events?: boolean;
  require_anchor_validation?: boolean;
  require_sequence_integrity?: boolean;
  [key: string]: unknown;
};

export type UpsertTrustGraphEdgeInput = {
  sourceDomain: string;
  targetDomain: string;
  relationship: string;
  scope?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
};

const TRUST_EVENT_WINDOW_SECONDS = 300;

const TRUST_LEVEL_RANK: Record<string, number> = { local: 1, approved_external: 2, critical: 3 };

export function verifyTrustEventSequence(input: { event: TrustEventRecord; previousEvent?: TrustEventRecord; seenNonces?: Set<string>; windowSeconds?: number }) {
  const ev = input.event;
  const windowMs = (input.windowSeconds ?? TRUST_EVENT_WINDOW_SECONDS) * 1000;
  const createdAt = new Date(ev.created_at ?? "").getTime();
  if (!Number.isFinite(createdAt) || Math.abs(Date.now() - createdAt) > windowMs) return { ok: false, reason: 'stale_event_detected' };
  if (input.seenNonces?.has(ev.nonce ?? "")) return { ok: false, reason: 'duplicate_nonce' };
  if (input.previousEvent) {
    if ((ev.sequence_number ?? 0) !== (input.previousEvent.sequence_number ?? 0) + 1) return { ok: false, reason: 'invalid_sequence_detected' };
    if (ev.previous_event_hash !== hashTrustEvent({ ...input.previousEvent, signature: undefined })) return { ok: false, reason: 'invalid_previous_event_hash' };
  }
  return { ok: true, reason: 'sequence_valid' };
}

export function hashTrustEvent(event: Record<string, unknown>) { const canonical = JSON.stringify(event, Object.keys(event).sort()); return createHash("sha256").update(canonical).digest("hex"); }

export function createTrustEvent(input: { eventId?: string; eventType: string; issuerApp?: string; trustDomain?: string; keyId?: string | null; claimHash?: string | null; delegationId?: string | null; grantId?: string | null; workspaceId?: string | null; sourceVerifier?: string | null; severity?: string; reason?: string | null; eventPayload?: Record<string, unknown>; createdAt?: string; expiresAt?: string | null; propagatedAt?: string | null; sequenceNumber?: number | null; nonce?: string; previousEventHash?: string | null }) {
  const event = { id: randomUUID(), event_id: input.eventId ?? `te_${Date.now()}`, event_type: input.eventType, issuer_app: input.issuerApp, trust_domain: input.trustDomain, key_id: input.keyId ?? null, claim_hash: input.claimHash ?? null, delegation_id: input.delegationId ?? null, grant_id: input.grantId ?? null, workspace_id: input.workspaceId ?? null, source_verifier: input.sourceVerifier ?? null, severity: input.severity ?? "warning", reason: input.reason ?? null, event_payload: input.eventPayload ?? {}, signature: null, created_at: input.createdAt ?? new Date().toISOString(), expires_at: input.expiresAt ?? null, propagated_at: input.propagatedAt ?? null, sequence_number: input.sequenceNumber ?? null, nonce: input.nonce ?? randomUUID(), previous_event_hash: input.previousEventHash ?? null };
  void logSecurityEvent("trust_event_created", { workspaceId: event.workspace_id, metadata: { eventId: event.event_id, eventType: event.event_type, trustDomain: event.trust_domain, severity: event.severity } });
  return event;
}

export function signTrustEvent(event: TrustEventRecord, input: { algorithm: "Ed25519" | "HMAC-SHA256"; keyId: string; secretRef?: string; hmacSecret?: string }) {
  const unsigned = { ...event, signature: undefined };
  const payload = `${input.keyId}.${hashTrustEvent(unsigned)}`;
  const signature = input.algorithm === "Ed25519"
    ? sign(null, Buffer.from(payload), createPrivateKey(process.env[input.secretRef ?? ""] ?? "")).toString("base64url")
    : createHmac("sha256", input.hmacSecret ?? process.env.PMFREAK_TRUST_EVENT_HMAC_SECRET ?? "").update(payload).digest("base64url");
  void logSecurityEvent("trust_event_signed", { workspaceId: event.workspace_id ?? null, metadata: { eventId: event.event_id, algorithm: input.algorithm, keyId: input.keyId } });
  return { ...event, signature, signature_key_id: input.keyId, signature_algorithm: input.algorithm };
}

export async function verifyTrustEvent(event: TrustEventRecord, options: { trustedSources?: string[]; allowHmacFallback?: boolean } = {}) {
  if (options.trustedSources?.length && event.source_verifier && !options.trustedSources.includes(event.source_verifier)) { await logSecurityEvent("trust_event_rejected", { workspaceId: event.workspace_id ?? null, metadata: { eventId: event.event_id, reason: "untrusted_source" } }); return { ok: false, reason: "untrusted_source" }; }
  const unsigned = { ...event, signature: undefined };
  const payload = `${event.signature_key_id}.${hashTrustEvent(unsigned)}`;
  let ok = false;
  if (event.signature_algorithm === "Ed25519") {
    const key = event.key_id ? await resolveVerificationKey({ trustDomainId: event.trust_domain_id ?? "", keyId: event.signature_key_id ?? "" }) : null;
    const verifier = key ? resolvePublicVerificationKey(key) : (event.public_key_pem ? createPublicKey(event.public_key_pem) : null);
    ok = verifier ? verify(null, Buffer.from(payload), verifier, Buffer.from(event.signature ?? "", "base64url")) : false;
  } else if (event.signature_algorithm === "HMAC-SHA256" && options.allowHmacFallback) {
    const expected = createHmac("sha256", process.env.PMFREAK_TRUST_EVENT_HMAC_SECRET ?? "").update(payload).digest("base64url");
    ok = expected === event.signature;
  }
  await logSecurityEvent(ok ? "trust_event_verified" : "trust_event_rejected", { workspaceId: event.workspace_id ?? null, metadata: { eventId: event.event_id, reason: ok ? "verified" : "signature_invalid" } });
  return { ok, reason: ok ? "verified" : "signature_invalid" };
}

export function explainTrustEvent(event: TrustEventRecord) { return { eventId: event.event_id, eventType: event.event_type, trustDomain: event.trust_domain, severity: event.severity, reason: event.reason ?? null, signed: !!event.signature, propagated: !!event.propagated_at }; }

// PRIVILEGED_ACCESS: Trust coordination (revocation registry, trust graph, trust anchors, policy lifecycle) is cross-tenant — revocation must be authoritative regardless of which tenant context initiates the query.
// AUDIT_REF: service-role-risk-register.md
export async function registerRevocationFromEvent(event: TrustEventRecord) {
  const revocationType = event.event_type === "capability_claim_revoked" ? "claim" : event.event_type === "signing_key_revoked" ? "key" : event.event_type === "trust_domain_revoked" ? "trust_domain" : event.event_type === "delegation_revoked" ? "delegation" : event.event_type === "verifier_policy_revoked" ? "verifier_policy" : event.event_type === "issuer_distrusted" ? "trust_domain" : null;
  if (!revocationType) return null;
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_coordination", operation: "register_revocation", reason: "trust_event_ingest" });
  const { data, error } = await supabase.from("capability_revocation_registry").insert({ revocation_type: revocationType, trust_domain: event.trust_domain, key_id: event.key_id ?? null, claim_hash: event.claim_hash ?? null, delegation_id: event.delegation_id ?? null, grant_id: event.grant_id ?? null, revoked_by: event.issuer_app ?? null, reason: event.reason ?? null, severity: event.severity, expires_at: event.expires_at ?? null, source_event_id: event.event_id }).select("*").single();
  if (error) throw error;
  await logSecurityEvent("revocation_registered", { workspaceId: event.workspace_id ?? null, metadata: { sourceEventId: event.event_id, revocationType } });
  return data;
}

export async function getRevocationReason(input: { trustDomain: string; keyId?: string; claimHash?: string; delegationId?: string; grantId?: string }) : Promise<RevocationReason> {
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_coordination", operation: "check_revocation", reason: "verify_capability_claim" });
  const { data } = await supabase.from("capability_revocation_registry").select("*").eq("trust_domain", input.trustDomain);
  type RevocationRow = { revocation_type: string; expires_at?: string | null; key_id?: string | null; claim_hash?: string | null; delegation_id?: string | null; grant_id?: string | null };
  const active = (data ?? [] as RevocationRow[]).filter((r: RevocationRow) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now());
  if (active.some((r: RevocationRow) => r.revocation_type === "trust_domain")) return "trust_domain_revoked";
  if (input.keyId && active.some((r: RevocationRow) => r.revocation_type === "key" && r.key_id === input.keyId)) return "key_revoked";
  if (input.claimHash && active.some((r: RevocationRow) => r.revocation_type === "claim" && r.claim_hash === input.claimHash)) return "claim_revoked";
  if (input.delegationId && active.some((r: RevocationRow) => r.revocation_type === "delegation" && r.delegation_id === input.delegationId)) return "delegation_revoked";
  if (input.grantId && active.some((r: RevocationRow) => r.revocation_type === "grant" && r.grant_id === input.grantId)) return "grant_revoked";
  if (active.some((r: RevocationRow) => r.revocation_type === "verifier_policy")) return "verifier_policy_revoked";
  return null;
}

export async function upsertTrustGraphEdge(input: UpsertTrustGraphEdgeInput) { const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_coordination", operation: "upsert_trust_graph_edge", reason: "trust_graph_update" }); const now = new Date().toISOString(); const { data, error } = await supabase.from("capability_trust_graph_edges").upsert({ source_domain: input.sourceDomain, target_domain: input.targetDomain, relationship: input.relationship, scope: input.scope ?? {}, status: input.status ?? "active", created_at: input.createdAt ?? now, updated_at: now }, { onConflict: "source_domain,target_domain,relationship" }).select("*").single(); if (error) throw error; await logSecurityEvent(input.status === "revoked" ? "trust_graph_edge_revoked" : "trust_graph_edge_created", { metadata: { sourceDomain: input.sourceDomain, targetDomain: input.targetDomain, relationship: input.relationship, status: input.status ?? "active" } }); return data; }
export async function getTrustGraphForDomain(domain: string) { const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_coordination", operation: "get_trust_graph", reason: "trust_graph_read" }); const { data } = await supabase.from("capability_trust_graph_edges").select("*").or(`source_domain.eq.${domain},target_domain.eq.${domain}`); return data ?? []; }
export async function explainTrustGraphPath(input: { sourceDomain: string; targetDomain: string }) { const edges = await getTrustGraphForDomain(input.sourceDomain); const direct = (edges as TrustGraphEdgeRecord[]).find((e) => e.target_domain === input.targetDomain); return direct ? { connected: true, relationship: direct.relationship, status: direct.status } : { connected: false, relationship: null, status: "unknown" }; }


export async function resolveTrustAnchor(input: { trustDomain: string; anchorId?: string; anchorType?: string; algorithm?: string }) {
  const supabase = createPrivilegedSupabaseClient({ routeId: 'security.trust_coordination', operation: 'resolve_trust_anchor', reason: 'trust_anchor_validation' });
  let q = supabase.from('capability_trust_anchors').select('*').eq('trust_domain', input.trustDomain);
  if (input.anchorId) q = q.eq('anchor_id', input.anchorId);
  if (input.anchorType) q = q.eq('anchor_type', input.anchorType);
  if (input.algorithm) q = q.eq('algorithm', input.algorithm);
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

export async function evaluateVerifierTrustPolicy(input: { trustDomain: string; targetDomain: string; eventType: string; eventAgeSeconds: number; trustLevel?: string; isSigned?: boolean; hasAnchor?: boolean; hasSequenceIntegrity?: boolean }) {
  const supabase = createPrivilegedSupabaseClient({ routeId: 'security.trust_coordination', operation: 'evaluate_policy', reason: 'policy_lifecycle' });
  const { data } = await supabase.from('verifier_trust_policies').select('*').eq('trust_domain', input.trustDomain).eq('target_domain', input.targetDomain).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return { ok: false, reason: 'missing_policy' };
  if (data.policy_status !== 'active') return { ok: false, reason: `policy_${data.policy_status}` };
  if (data.allowed_event_types?.length && !data.allowed_event_types.includes(input.eventType)) return { ok: false, reason: 'event_type_denied' };
  if (input.eventAgeSeconds > (data.max_event_age_seconds ?? 300)) return { ok: false, reason: 'stale_event_detected' };
  if (data.require_signed_events && !input.isSigned) return { ok: false, reason: 'unsigned_event' };
  if (data.require_anchor_validation && !input.hasAnchor) return { ok: false, reason: 'anchor_missing' };
  if (data.require_sequence_integrity && !input.hasSequenceIntegrity) return { ok: false, reason: 'invalid_sequence_detected' };
  if ((TRUST_LEVEL_RANK[input.trustLevel ?? 'local'] ?? 0) < (TRUST_LEVEL_RANK[data.minimum_trust_level] ?? 0)) return { ok: false, reason: 'insufficient_trust_level' };
  return { ok: true, reason: 'policy_allow', policy: data };
}

export async function revokeVerifierTrustPolicy(input: { policyId: string }) { const supabase = createPrivilegedSupabaseClient({ routeId: 'security.trust_coordination', operation: 'revoke_policy', reason: 'policy_lifecycle' }); const now = new Date().toISOString(); const { data, error } = await supabase.from('verifier_trust_policies').update({ policy_status: 'revoked', revoked_at: now, updated_at: now }).eq('policy_id', input.policyId).select('*').single(); if (error) throw error; await logSecurityEvent('trust_policy_revoked', { metadata: { policyId: input.policyId } }); return data; }
export function explainVerifierTrustPolicy(policy: VerifierTrustPolicyRecord) { return { policyId: policy.policy_id, trustDomain: policy.trust_domain, targetDomain: policy.target_domain, policyStatus: policy.policy_status, minimumTrustLevel: policy.minimum_trust_level, maxEventAgeSeconds: policy.max_event_age_seconds }; }

export async function quarantineTrustEvent(input: { eventId: string; reason: string; riskScore: number }) { const supabase = createPrivilegedSupabaseClient({ routeId: 'security.trust_coordination', operation: 'quarantine_event', reason: 'unsafe_import' }); const { data, error } = await supabase.from('capability_trust_event_quarantine').upsert({ event_id: input.eventId, reason: input.reason, risk_score: input.riskScore, quarantine_status: 'pending' }, { onConflict: 'event_id' }).select('*').single(); if (error) throw error; await logSecurityEvent('event_quarantined', { metadata: { eventId: input.eventId, reason: input.reason, riskScore: input.riskScore } }); return data; }

export async function evaluateTrustPath(input: { sourceDomain: string; targetDomain: string; minimumTrustLevel?: 'local'|'approved_external'|'critical' }) {
  const edges = await getTrustGraphForDomain(input.sourceDomain);
  const directDistrust = (edges as TrustGraphEdgeRecord[]).find((e)=>e.source_domain===input.sourceDomain && e.target_domain===input.targetDomain && e.relationship==='distrusts' && e.status==='active');
  if (directDistrust) return { trusted: false, reason: 'distrust_override' };
  const directTrust = (edges as TrustGraphEdgeRecord[]).find((e)=>e.source_domain===input.sourceDomain && e.target_domain===input.targetDomain && e.relationship==='trusts' && e.status==='active');
  if (!directTrust) return { trusted: false, reason: 'no_direct_trust' };
  const anchor = await resolveTrustAnchor({ trustDomain: input.targetDomain });
  if (!anchor || anchor.status !== 'active') return { trusted: false, reason: 'anchor_unavailable' };
  if (input.minimumTrustLevel && (TRUST_LEVEL_RANK[anchor.trust_level] ?? 0) < TRUST_LEVEL_RANK[input.minimumTrustLevel]) return { trusted: false, reason: 'insufficient_trust_level' };
  return { trusted: true, reason: 'direct_trust_with_anchor', anchorId: anchor.anchor_id };
}
