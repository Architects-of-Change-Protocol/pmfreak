import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { logSecurityEvent } from "@/lib/security/telemetry";

type SigningKeyRow = {
  key_id: string;
  algorithm: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  public_metadata: { public_key_jwk?: Record<string, unknown> | null; public_key_pem?: string | null } | null;
  capability_trust_domains: { domain_key: unknown; verification_mode: unknown }[] | null;
};

export async function GET() {
  const supabase = createPrivilegedSupabaseClient({ routeId: "api.governance.trust.keys", operation: "read_trust_keys", reason: "external_verifier_discovery" });
  const { data } = await supabase.from("capability_signing_keys").select("key_id,algorithm,status,valid_from,valid_until,public_metadata,capability_trust_domains(domain_key,verification_mode)");
  const keys = (data ?? []).map((k: SigningKeyRow) => { const td = k.capability_trust_domains?.[0] ?? null; return { trustDomain: td?.domain_key ?? null, keyId: k.key_id, algorithm: k.algorithm, status: k.status, validFrom: k.valid_from, validUntil: k.valid_until, verificationMode: td?.verification_mode ?? null, publicJwk: k.algorithm === "Ed25519" ? (k.public_metadata?.public_key_jwk ?? null) : null, publicPem: k.algorithm === "Ed25519" ? (k.public_metadata?.public_key_pem ?? null) : null }; });
  await logSecurityEvent("trust_keys_requested", { metadata: { keyCount: keys.length } });
  return Response.json({ note: "HMAC symmetric key material is never exposed.", asymmetricVerification: "enabled_for_ed25519", keys });
}
