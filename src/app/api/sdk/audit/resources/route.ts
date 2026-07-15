import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeRuntimeAction } from "@/aoc/runtime-consumer";
import { buildEnterpriseRuntimeRequest } from "@/aoc/runtime-consumer";
import { SDK_GOVERNANCE_ACTIONS } from "@/lib/aoc/runtime/governance-actions";
import { GENERIC_DB_UNAVAILABLE_MESSAGE, safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const resourceId = searchParams.get("resourceId");
  if (!workspaceId || !resourceId) return Response.json({ error: "workspaceId and resourceId required" }, { status: 400 });

  const decision = await authorizeRuntimeAction(
    buildEnterpriseRuntimeRequest({ user, action: SDK_GOVERNANCE_ACTIONS.AUDIT_READ, routeId: "/api/sdk/audit/resources", workspaceId, resourceType: "workspace", resourceId: workspaceId, metadata: { targetResourceId: resourceId } }),
  );
  if (!decision.allowed) return Response.json({ error: "Forbidden", decisionId: decision.decisionId }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_audit_events").select("*").eq("workspace_id", workspaceId).contains("event_detail", { resourceId }).order("created_at", { ascending: false }).limit(200);
  if (error) return safeLegacyErrorResponse("/api/sdk/audit/resources", error, GENERIC_DB_UNAVAILABLE_MESSAGE);
  return Response.json({ timeline: data ?? [], decisionId: decision.decisionId });
}
