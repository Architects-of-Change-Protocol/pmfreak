import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { createVerifierPolicy, getTrustDomain } from "@/lib/security/trust-domains";
import { resolveTrustAnchor } from "@/lib/security/trust-coordination";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const scopeAllowed = (allowed: string[] | null | undefined, requested?: string) => !allowed?.length || !requested || allowed.includes(requested);

// PRIVILEGED_ACCESS: Verifier handshakes are cross-tenant by design — a verifier from one domain establishing trust with another cannot be scoped to either tenant's RLS context.
// AUDIT_REF: service-role-risk-register.md
export async function requestTrustHandshake(input: { verifierName: string; verifierWorkspaceId?: string | null; verifierDomain?: string | null; requestedTrustDomain: string; requestedActions?: string[]; requestedResourceTypes?: string[]; expiresAt?: string; metadata?: Record<string, unknown> }) {
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_handshakes", operation: "request_handshake", reason: "external_verifier_interop" });
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const { data, error } = await supabase.from("capability_verifier_handshakes").insert({ verifier_name: input.verifierName, verifier_workspace_id: input.verifierWorkspaceId ?? null, verifier_domain: input.verifierDomain ?? null, requested_trust_domain: input.requestedTrustDomain, requested_actions: input.requestedActions ?? null, requested_resource_types: input.requestedResourceTypes ?? null, status: "requested", handshake_token_hash: hashToken(token), expires_at: expiresAt, metadata: input.metadata ?? {}, created_at: now, updated_at: now }).select("*").single();
  if (error) throw error;
  await logSecurityEvent("trust_handshake_requested", { workspaceId: input.verifierWorkspaceId ?? null, metadata: { verifierName: input.verifierName, verifierDomain: input.verifierDomain ?? null, trustDomain: input.requestedTrustDomain, requestedActions: input.requestedActions ?? null, requestedResourceTypes: input.requestedResourceTypes ?? null } });
  return { handshake: data, token };
}

export async function approveTrustHandshake(input: { id: string; approverUserId?: string | null }) {
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_handshakes", operation: "approve_handshake", reason: "external_verifier_interop" });
  const { data } = await supabase.from("capability_verifier_handshakes").select("*").eq("id", input.id).single();
  const trust = await getTrustDomain(data.requested_trust_domain);
  if (data.verifier_workspace_id && trust) await createVerifierPolicy({ workspaceId: data.verifier_workspace_id, allowedTrustDomainId: trust.id, allowedIssuerApp: trust.issuer_app, allowedActions: data.requested_actions ?? undefined, allowedResourceTypes: data.requested_resource_types ?? undefined });
  const now = new Date().toISOString();
  const { data: updated } = await supabase.from("capability_verifier_handshakes").update({ status: "approved", approved_by_user_id: input.approverUserId ?? null, approved_at: now, updated_at: now }).eq("id", input.id).select("*").single();
  await logSecurityEvent("trust_handshake_approved", { workspaceId: updated.verifier_workspace_id ?? null, actorUserId: input.approverUserId ?? null, metadata: { verifierName: updated.verifier_name, verifierDomain: updated.verifier_domain, trustDomain: updated.requested_trust_domain, requestedActions: updated.requested_actions, requestedResourceTypes: updated.requested_resource_types } });
  return updated;
}

export async function rejectTrustHandshake(input: { id: string; rejectorUserId?: string | null; reason?: string }) { return mutateStatus(input, "rejected", "trust_handshake_rejected"); }
export async function revokeTrustHandshake(input: { id: string; revokerUserId?: string | null; reason?: string }) { return mutateStatus(input, "revoked", "trust_handshake_revoked"); }

async function mutateStatus(input: { id: string; rejectorUserId?: string | null; revokerUserId?: string | null; reason?: string }, status: "rejected" | "revoked", event: "trust_handshake_rejected" | "trust_handshake_revoked") {
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_handshakes", operation: `${status}_handshake`, reason: "external_verifier_interop" });
  const now = new Date().toISOString();
  const field = status === "rejected" ? { rejected_by_user_id: input.rejectorUserId ?? null, rejected_at: now } : { revoked_by_user_id: input.revokerUserId ?? null, revoked_at: now };
  const { data } = await supabase.from("capability_verifier_handshakes").update({ status, ...field, updated_at: now }).eq("id", input.id).select("*").single();
  await logSecurityEvent(event, { workspaceId: data.verifier_workspace_id ?? null, actorUserId: input.rejectorUserId ?? input.revokerUserId ?? null, metadata: { verifierName: data.verifier_name, verifierDomain: data.verifier_domain, trustDomain: data.requested_trust_domain, reason: input.reason ?? status } });
  return data;
}

export async function validateHandshakeToken(input: { handshakeToken: string; requestedTrustDomain: string; action?: string; resourceType?: string; verifierName?: string; verifierDomain?: string }) {
  const supabase = createPrivilegedSupabaseClient({ routeId: "security.trust_handshakes", operation: "validate_handshake_token", reason: "external_verifier_interop" });
  const { data } = await supabase.from("capability_verifier_handshakes").select("*").eq("handshake_token_hash", hashToken(input.handshakeToken)).maybeSingle();
  const invalid = (reason: string) => ({ ok: false, reason, handshake: data ?? null });
  if (!data) return invalid("unknown_handshake");
  if (data.status !== "approved") return invalid(`handshake_${data.status}`);
  if (new Date(data.expires_at).getTime() <= Date.now()) return invalid("handshake_expired");
  if (data.requested_trust_domain !== input.requestedTrustDomain) return invalid("handshake_trust_domain_mismatch");
  if (!scopeAllowed(data.requested_actions as string[] | null, input.action)) return invalid("handshake_action_denied");
  if (!scopeAllowed(data.requested_resource_types as string[] | null, input.resourceType)) return invalid("handshake_resource_type_denied");
  if (input.verifierName && data.verifier_name !== input.verifierName) return invalid("handshake_verifier_name_mismatch");
  if (input.verifierDomain && data.verifier_domain && data.verifier_domain !== input.verifierDomain) return invalid("handshake_verifier_domain_mismatch");
  const digestA = Buffer.from(hashToken(input.handshakeToken));
  const digestB = Buffer.from(data.handshake_token_hash);
  if (digestA.length !== digestB.length || !timingSafeEqual(digestA, digestB)) return invalid("handshake_hash_mismatch");
  return { ok: true, reason: "handshake_valid", handshake: data };
}

export async function consumeOrAssertHandshake(input: Parameters<typeof validateHandshakeToken>[0]) {
  const result = await validateHandshakeToken(input);
  await logSecurityEvent(result.ok ? "trust_handshake_validated" : "trust_handshake_invalid", { workspaceId: result.handshake?.verifier_workspace_id ?? null, metadata: { verifierName: input.verifierName ?? result.handshake?.verifier_name ?? null, verifierDomain: input.verifierDomain ?? result.handshake?.verifier_domain ?? null, trustDomain: input.requestedTrustDomain, requestedActions: input.action ? [input.action] : null, requestedResourceTypes: input.resourceType ? [input.resourceType] : null, reason: result.reason } });
  return result;
}

export function explainTrustHandshake(handshake: { id: string; verifier_name: string; verifier_domain: string | null; requested_trust_domain: string; requested_actions: string[] | null; requested_resource_types: string[] | null; status: string; expires_at: string }) { return { id: handshake.id, verifierName: handshake.verifier_name, verifierDomain: handshake.verifier_domain, requestedTrustDomain: handshake.requested_trust_domain, requestedActions: handshake.requested_actions, requestedResourceTypes: handshake.requested_resource_types, status: handshake.status, expiresAt: handshake.expires_at }; }


export function negotiateVerifierCapabilities(input: { localCapabilities: string[]; remoteCapabilities: string[]; minimumProtocolVersion: number; remoteProtocolVersion: number }) {
  if (input.remoteProtocolVersion < input.minimumProtocolVersion) return { ok: false, reason: 'protocol_too_old', capabilities: [] as string[] };
  const capabilities = input.localCapabilities.filter((c) => input.remoteCapabilities.includes(c));
  return { ok: true, reason: 'capabilities_negotiated', capabilities };
}

export function createVerifierHandshake(input: { verifierId: string; trustDomain: string; targetDomain: string; protocolVersion: number; capabilities: string[]; challengeTtlSeconds?: number }) {
  const challenge = randomBytes(32).toString('base64url');
  return { verifierId: input.verifierId, trustDomain: input.trustDomain, targetDomain: input.targetDomain, protocolVersion: input.protocolVersion, capabilities: input.capabilities, challenge, challengeExpiresAt: new Date(Date.now() + 1000 * (input.challengeTtlSeconds ?? 120)).toISOString(), createdAt: new Date().toISOString() };
}

export async function verifyVerifierHandshake(input: { handshake: { verifierId: string; trustDomain: string; targetDomain: string; protocolVersion: number; capabilities: string[]; challenge: string; challengeExpiresAt: string; createdAt: string }; signedChallenge?: string; trustAnchorId?: string; localDomain: string; minimumProtocolVersion: number; localCapabilities: string[] }) {
  await logSecurityEvent('verifier_handshake_started', { metadata: { verifierId: input.handshake?.verifierId ?? null, trustDomain: input.handshake?.trustDomain ?? null } });
  if (input.handshake.protocolVersion < input.minimumProtocolVersion) { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: 'protocol_too_old' } }); return { ok: false, reason: 'protocol_too_old' }; }
  if (new Date(input.handshake.challengeExpiresAt).getTime() <= Date.now()) { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: 'challenge_expired' } }); return { ok: false, reason: 'challenge_expired' }; }
  if (input.handshake.targetDomain !== input.localDomain) { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: 'trust_domain_mismatch' } }); return { ok: false, reason: 'trust_domain_mismatch' }; }
  const anchor = await resolveTrustAnchor({ trustDomain: input.handshake.trustDomain, anchorId: input.trustAnchorId ?? undefined, anchorType: 'verifier_key' });
  if (!anchor || anchor.status !== 'active') { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: 'invalid_anchor' } }); return { ok: false, reason: 'invalid_anchor' }; }
  const negotiated = negotiateVerifierCapabilities({ localCapabilities: input.localCapabilities, remoteCapabilities: input.handshake.capabilities ?? [], minimumProtocolVersion: input.minimumProtocolVersion, remoteProtocolVersion: input.handshake.protocolVersion });
  if (!negotiated.ok) { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: negotiated.reason } }); return { ok: false, reason: negotiated.reason }; }
  if (!input.signedChallenge) { await logSecurityEvent('verifier_handshake_failed', { metadata: { reason: 'missing_signed_challenge' } }); return { ok: false, reason: 'missing_signed_challenge' }; }
  await logSecurityEvent('verifier_handshake_succeeded', { metadata: { verifierId: input.handshake.verifierId, capabilities: negotiated.capabilities } });
  return { ok: true, reason: 'handshake_valid', negotiatedCapabilities: negotiated.capabilities, anchorId: anchor.anchor_id };
}

export function explainVerifierHandshake(input: { verification: { reason: string }; handshake: { verifierId: string; trustDomain: string; targetDomain: string; protocolVersion: number } }) { return { verifierId: input.handshake.verifierId, trustDomain: input.handshake.trustDomain, targetDomain: input.handshake.targetDomain, protocolVersion: input.handshake.protocolVersion, result: input.verification.reason, controlledInteroperabilityOnly: true }; }
