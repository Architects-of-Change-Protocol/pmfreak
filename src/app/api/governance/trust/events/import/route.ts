import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { registerRevocationFromEvent, verifyTrustEvent } from "@/lib/security/trust-coordination";
import { consumeOrAssertHandshake } from "@/lib/security/trust-handshakes";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { GENERIC_DB_UNAVAILABLE_MESSAGE, safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.handshakeToken) return Response.json({ error: "handshake_required" }, { status: 401 });
  const handshake = await consumeOrAssertHandshake({ handshakeToken: body.handshakeToken, requestedTrustDomain: body?.event?.trust_domain, verifierName: body?.sourceVerifier, verifierDomain: body?.verifierDomain });
  if (!handshake.ok) return Response.json({ error: "handshake_invalid", reason: handshake.reason }, { status: 403 });
  const verifyResult = await verifyTrustEvent(body.event, { trustedSources: [body.sourceVerifier], allowHmacFallback: true });
  if (!verifyResult.ok) { await logSecurityEvent("trust_event_rejected", { metadata: { reason: verifyResult.reason, eventId: body?.event?.event_id ?? null } }); return Response.json({ imported: false, reason: verifyResult.reason }, { status: 400 }); }
  // PRIVILEGED_ACCESS: Cross-verifier trust event ingestion is external in origin; after handshake + signature validation, persisting the event and updating the revocation registry requires service role.
  // AUDIT_REF: service-role-risk-register.md
  const supabase = createPrivilegedSupabaseClient({ routeId: "api.governance.trust.events.import", operation: "import_trust_event", reason: "trusted_sync_import" });
  const { data, error } = await supabase.from("capability_trust_events").insert({ ...body.event, propagated_at: new Date().toISOString(), source_verifier: body.sourceVerifier ?? null }).select("*").single();
  if (error) return safeLegacyErrorResponse("/api/governance/trust/events/import", error, GENERIC_DB_UNAVAILABLE_MESSAGE);
  await registerRevocationFromEvent(data);
  await logSecurityEvent("trust_event_imported", { workspaceId: data.workspace_id ?? null, metadata: { eventId: data.event_id, eventType: data.event_type } });
  return Response.json({ imported: true, event: data });
}
