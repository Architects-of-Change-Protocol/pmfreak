import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { explainTrustHandshake } from "@/lib/security/trust-handshakes";

// Founder/internal-only: this is the cross-tenant admin review surface for
// trust handshakes (registry reason: "admin_review"), so it must actually
// gate on founder/internal identity — matching the approve/reject/revoke
// mutation routes it lists data for.
export async function GET() {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return Response.json({ error: "Founder access is required." }, { status: 403 });
  }
  // PRIVILEGED_ACCESS: Admin handshake listing is cross-tenant — all handshakes across all trust domains must be visible regardless of workspace ownership.
  // AUDIT_REF: service-role-risk-register.md
  const supabase = createPrivilegedSupabaseClient({ routeId: "api.governance.trust.handshakes", operation: "list_handshakes", reason: "admin_review" });
  const { data } = await supabase.from("capability_verifier_handshakes").select("*").order("created_at", { ascending: false }).limit(100);
  return Response.json({ handshakes: (data ?? []).map(explainTrustHandshake) });
}
