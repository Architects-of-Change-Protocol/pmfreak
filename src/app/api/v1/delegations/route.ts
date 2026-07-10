import { getAuthUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/workspace-access";
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

// delegatorRole is never trusted from the request body — a delegation's
// allowed actions (assertDelegationRules in delegated-capabilities.ts) are
// gated on the delegator's role, so an attacker-supplied "owner"/"admin"
// would let a low-privilege member self-escalate what they can delegate to
// someone else. It is always resolved server-side from workspace_memberships
// for the exact workspaceId being delegated against, which also confirms the
// caller actually belongs to that workspace (never taken on faith from the
// body) before any privileged insert runs.
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return Response.json({ ok: false, error: { code: "workspace_required", message: "workspaceId required" } }, { status: 400 });
  let access: { role: "owner" | "admin" | "pm" | "viewer" };
  try {
    access = await requireWorkspaceRole(workspaceId, "pm");
  } catch {
    return denyResponse({ status: 403, routeId: "/api/v1/delegations", message: "Forbidden", reason: "workspace_membership_required", actorUserId: user.id, workspaceId });
  }
  const issued = (await issueDelegatedCapability({ ...body, workspaceId, delegatorUserId: user.id, delegatorRole: access.role })) as { delegation: unknown; delegationToken: string };
  return Response.json({ ok: true, delegation: issued.delegation, delegationToken: issued.delegationToken });
}
