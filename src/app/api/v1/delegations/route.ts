import { getAuthUser } from "@/lib/auth";
import { denyResponse } from "@/lib/security/deny-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueDelegatedCapability } from "@/aoc/runtime-consumer";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations", message: "Unauthorized", reason: "unauthorized" });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return Response.json({ ok: false, error: { code: "workspace_required", message: "workspaceId required" } }, { status: 400 });
  // SCOPED_CLIENT: RLS policy added in 20260515100000_rls_governance_fixes.sql
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("governance_delegations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
  if (error) return Response.json({ ok: false, error: { code: "query_failed", message: error.message } }, { status: 500 });
  return Response.json({ ok: true, delegations: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const issued = await issueDelegatedCapability({ ...body, delegatorUserId: user.id }) as { delegation: unknown; delegationToken: string };
  return Response.json({ ok: true, delegation: issued.delegation, delegationToken: issued.delegationToken });
}
