import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeRuntimeAction } from "@/aoc/runtime-consumer";
import { buildEnterpriseRuntimeRequest } from "@/aoc/runtime-consumer";
import { SDK_GOVERNANCE_ACTIONS } from "@/lib/aoc/runtime/governance-actions";
import { GENERIC_DB_UNAVAILABLE_MESSAGE, safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });

  const decision = await authorizeRuntimeAction(
    buildEnterpriseRuntimeRequest({ user, action: SDK_GOVERNANCE_ACTIONS.POLICIES_READ, routeId: "/api/sdk/policies", workspaceId, resourceType: "workspace", resourceId: workspaceId }),
  );
  if (!decision.allowed) return Response.json({ error: "Forbidden", decisionId: decision.decisionId }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_policies").select("*").eq("workspace_id", workspaceId).order("priority", { ascending: true });
  if (error) return safeLegacyErrorResponse("/api/sdk/policies", error, GENERIC_DB_UNAVAILABLE_MESSAGE);
  return Response.json({ policies: data ?? [], decisionId: decision.decisionId });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });

  const decision = await authorizeRuntimeAction(
    buildEnterpriseRuntimeRequest({ user, action: SDK_GOVERNANCE_ACTIONS.POLICIES_MANAGE, routeId: "/api/sdk/policies", workspaceId: body.workspaceId, resourceType: "workspace", resourceId: body.workspaceId }),
  );
  if (!decision.allowed) return Response.json({ error: "Forbidden", decisionId: decision.decisionId }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_policies").insert({ workspace_id: body.workspaceId, name: body.name, description: body.description ?? "", resource_type: body.resourceType, permission: body.permission, effect: body.effect ?? "require_approval", priority: body.priority ?? 100, conditions: body.conditions ?? {}, created_by_user_id: user.id }).select("*").single();
  if (error) return safeLegacyErrorResponse("/api/sdk/policies", error, GENERIC_DB_UNAVAILABLE_MESSAGE);
  return Response.json({ ok: true, policy: data, decisionId: decision.decisionId });
}
