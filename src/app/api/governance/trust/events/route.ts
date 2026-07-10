import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";

// Founder/internal-only: this GET is a human-facing cross-tenant event
// browser, distinct from the machine-to-machine POST .../events/import
// route (which authenticates via a signed handshake token instead of a user
// session). It must gate on founder/internal identity, not sit open.
export async function GET(request: Request) {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return Response.json({ error: "Founder access is required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  // PRIVILEGED_ACCESS: Trust events span trust domains for cross-verifier synchronization and cannot be scoped to a single tenant's RLS context.
  // AUDIT_REF: service-role-risk-register.md
  const supabase = createPrivilegedSupabaseClient({ routeId: "api.governance.trust.events", operation: "list_trust_events", reason: "trusted_sync" });
  let query = supabase.from("capability_trust_events").select("*").order("created_at", { ascending: false }).limit(500);
  if (searchParams.get("trustDomain")) query = query.eq("trust_domain", searchParams.get("trustDomain"));
  if (searchParams.get("eventType")) query = query.eq("event_type", searchParams.get("eventType"));
  if (searchParams.get("severity")) query = query.eq("severity", searchParams.get("severity"));
  if (searchParams.get("since")) query = query.gte("created_at", searchParams.get("since"));
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data ?? [] });
}
