import { verifyCapabilityClaim, explainCapabilityClaim, hashCapabilityClaim, claimToAuditMetadata } from "@/lib/security/capability-claims";
import { logSecurityEvent } from "@/lib/security/telemetry";
import type { SecurityEventType } from "@/lib/security/telemetry";
import { consumeOrAssertHandshake } from "@/lib/security/trust-handshakes";

const getOptionalVerificationField = <K extends string>(verification: unknown, key: K): string | null => {
  if (verification && typeof verification === "object" && key in verification) {
    const value = (verification as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
};

export async function POST(request: Request) {
  const body = await request.json();
  const claim = body.capabilityClaim;
  const verification = await verifyCapabilityClaim(claim, {
    expectedAction: body.expectedAction,
    expectedWorkspaceId: body.expectedWorkspaceId,
    expectedProjectId: body.expectedProjectId,
    expectedSubject: body.expectedSubject,
    expectedResource: body.expectedResource,
    expectedPermission: body.expectedPermission,
    expectedTrustDomain: body.expectedTrustDomain,
    verifierWorkspaceId: body.verifierWorkspaceId,
    enforceVerifierPolicy: body.enforceVerifierPolicy ?? false,
  });
  const claimHash = hashCapabilityClaim(claim);
  let handshakeValidation: { ok: boolean; reason: string } | null = null;
  if (!verification.valid && body.enforceVerifierPolicy && body.handshakeToken) {
    handshakeValidation = await consumeOrAssertHandshake({ handshakeToken: body.handshakeToken, requestedTrustDomain: claim?.proof?.trustDomain ?? claim?.issuer?.trustDomain ?? "pmfreak-local", action: claim?.authority?.action, resourceType: claim?.authority?.resourceType, verifierName: body.verifierName, verifierDomain: body.verifierDomain });
    if (handshakeValidation.ok && verification.reason === "issuer_policy_denied") {
      verification.valid = true;
      verification.reason = "verified_via_handshake";
    }
  }
  const verificationReason = verification.reason ?? "";
  const explanation = explainCapabilityClaim(claim);
  const trustMetadata = { ...claimToAuditMetadata(claim, verificationReason), trustDomain: verification.trustDomain ?? claim?.issuer?.trustDomain ?? null, keyId: verification.keyId ?? claim?.proof?.keyId ?? null, verifierWorkspaceId: body.verifierWorkspaceId ?? null, issuerStatus: getOptionalVerificationField(verification, "issuerStatus"), keyStatus: getOptionalVerificationField(verification, "keyStatus"), federationMode: getOptionalVerificationField(verification, "federationMode"), reason: verificationReason };

  if (!verification.valid) {
    const ev = verification.reason === "revoked_key" ? "federated_claim_revoked_key" : verification.reason === "expired_key" ? "federated_claim_expired_key" : verificationReason.includes("untrusted") || verificationReason.includes("issuer") ? "federated_claim_untrusted_issuer" : "federated_claim_rejected";
    await logSecurityEvent(ev as SecurityEventType, { workspaceId: claim?.authority?.workspaceId ?? null, projectId: claim?.authority?.projectId ?? null, requested_permission: claim?.authority?.requestedPermission ?? null, metadata: trustMetadata });
    await logSecurityEvent("external_verifier_rejected_claim", { workspaceId: claim?.authority?.workspaceId ?? null, metadata: { verifierName: body.verifierName ?? null, verifierDomain: body.verifierDomain ?? null, trustDomain: trustMetadata.trustDomain, claimHash, reason: verificationReason } });
  } else {
    await logSecurityEvent("capability_claim_verified", { workspaceId: claim.authority.workspaceId, projectId: claim.authority.projectId ?? null, requested_permission: claim.authority.requestedPermission, metadata: trustMetadata });
    await logSecurityEvent("federated_claim_verified", { workspaceId: claim.authority.workspaceId, projectId: claim.authority.projectId ?? null, requested_permission: claim.authority.requestedPermission, metadata: trustMetadata });
    await logSecurityEvent("external_verifier_verified_claim", { workspaceId: claim.authority.workspaceId, metadata: { verifierName: body.verifierName ?? null, verifierDomain: body.verifierDomain ?? null, trustDomain: trustMetadata.trustDomain, claimHash, reason: verificationReason } });
  }

  return Response.json({ valid: verification.valid, reason: verificationReason, claimHash, verificationMode: verification.verificationMode ?? "server_mediated", independentlyVerifiable: verification.independentlyVerifiable ?? false, publicKeyAvailable: verification.algorithm === "Ed25519", algorithm: verification.algorithm ?? claim?.proof?.algorithm ?? null, trustDomain: verification.trustDomain ?? claim?.proof?.trustDomain ?? null, keyId: verification.keyId ?? claim?.proof?.keyId ?? null, trustResult: verification, handshake: handshakeValidation, explanation, authority: explanation.authority, lineage: explanation.lineage, constraints: explanation.constraints });
}
