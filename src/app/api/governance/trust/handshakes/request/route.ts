import { requestTrustHandshake } from "@/lib/security/trust-handshakes";
import { abuseDenyResponse, buildAbuseKey, enforceAbuseLimit, getClientIp } from "@/lib/security/abuse-protection";

// This is a public, unauthenticated, state-creating route (external verifier
// self-registration) — exactly the shape of endpoint most exposed to flood
// abuse. See docs/security/abuse-protection-boundary.md
// ("governance.trust.handshake_request").
export async function POST(request: Request) {
  const body = await request.json();
  const clientIp = getClientIp(request);
  const abuseDecision = await enforceAbuseLimit({
    scope: "governance.trust.handshake_request",
    identifier: buildAbuseKey([clientIp, typeof body.verifierName === "string" ? body.verifierName : ""]),
    limit: 20,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  const { handshake, token } = await requestTrustHandshake({ verifierName: body.verifierName, verifierWorkspaceId: body.verifierWorkspaceId ?? null, verifierDomain: body.verifierDomain ?? null, requestedTrustDomain: body.requestedTrustDomain, requestedActions: body.requestedActions ?? null, requestedResourceTypes: body.requestedResourceTypes ?? null, expiresAt: body.expiresAt, metadata: body.metadata ?? {} });
  return Response.json({ handshakeId: handshake.id, status: handshake.status, expiresAt: handshake.expires_at, handshakeToken: token });
}
