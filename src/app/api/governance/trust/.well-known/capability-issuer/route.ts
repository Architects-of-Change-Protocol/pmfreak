import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { logSecurityEvent } from "@/lib/security/telemetry";

type SigningKeyRow = { key_id: string; status: string };
type TrustDomainRow = { domain_key: string; issuer_app: string; status: string; verification_mode: string; capability_signing_keys: SigningKeyRow[] | null };

export async function GET() {
  const supabase = createPrivilegedSupabaseClient({ routeId: "api.governance.trust.metadata", operation: "read_trust_metadata", reason: "external_verifier_discovery" });
  const { data: trustDomains } = await supabase.from("capability_trust_domains").select("domain_key, issuer_app, status, verification_mode, capability_signing_keys(key_id,status)");
  const metadata = {
    issuerApp: "pmfreak",
    supportedClaimVersions: ["pmfreak-capability-claim-v1", "pmfreak-capability-claim-v1.1", "pmfreak-capability-claim-v1.2"],
    supportedAlgorithms: ["HMAC-SHA256", "Ed25519"],
    verificationModes: ["local", "trusted_external", "federation_ready"],
    trustDomains: (trustDomains ?? []).map((td: TrustDomainRow) => ({ domainKey: td.domain_key, issuerApp: td.issuer_app, status: td.status, verificationMode: td.verification_mode, activeKeyIds: (td.capability_signing_keys ?? []).filter((k: SigningKeyRow) => k.status === "active").map((k: SigningKeyRow) => k.key_id), rotatedKeyIds: (td.capability_signing_keys ?? []).filter((k: SigningKeyRow) => k.status === "rotated").map((k: SigningKeyRow) => k.key_id) })),
    claimVerificationEndpoint: "/api/governance/capabilities/verify",
    handshakeEndpoint: "/api/governance/trust/handshakes/request",
    issuedAt: new Date().toISOString(),
  };
  await logSecurityEvent("trust_metadata_requested", { metadata: { trustDomainCount: metadata.trustDomains.length } });
  return Response.json(metadata);
}
