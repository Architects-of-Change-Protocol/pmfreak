import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GENERIC_DB_UNAVAILABLE_MESSAGE, safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("governance_approval_requests").select("*").order("created_at", { ascending: false });
  if (error) return safeLegacyErrorResponse("/api/governance/approvals", error, GENERIC_DB_UNAVAILABLE_MESSAGE);
  return Response.json({ approvals: data ?? [] });
}
