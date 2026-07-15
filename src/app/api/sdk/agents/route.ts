import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeRuntimeAction } from "@/aoc/runtime-consumer";
import { buildEnterpriseRuntimeRequest } from "@/aoc/runtime-consumer";
import { SDK_GOVERNANCE_ACTIONS } from "@/lib/aoc/runtime/governance-actions";
import { runtimeMetadata, sdkRuntimeError, sdkSuccess, withRuntime } from "@/lib/aoc/contracts/envelope-helpers";
import { sdkDatabaseErrorBody } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ ...sdkRuntimeError({ code: "authorization_denied", message: "Unauthorized" }), error: "Unauthorized" }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });

  const decision = await authorizeRuntimeAction(
    buildEnterpriseRuntimeRequest({ user, action: SDK_GOVERNANCE_ACTIONS.AGENTS_READ, routeId: "/api/sdk/agents", workspaceId, resourceType: "workspace", resourceId: workspaceId }),
  );
  if (!decision.allowed) return Response.json({ ...sdkRuntimeError({ code: "authorization_denied", message: "Forbidden", decisionId: decision.decisionId }), error: "Forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_agents").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) { const safe = sdkDatabaseErrorBody("/api/sdk/agents", error); return Response.json({ ...sdkRuntimeError({ code: "runtime_unavailable", message: safe.message }), error: safe.message }, { status: 500 }); }
  return Response.json(withRuntime(sdkSuccess({ agents: data ?? [] }, { lineage: { decisionId: decision.decisionId, runtimeDecisionId: decision.decisionId, timestamps: { decidedAt: new Date().toISOString() } } }), "/api/sdk/agents", { workspaceId }));
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ ...sdkRuntimeError({ code: "authorization_denied", message: "Unauthorized" }), error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });

  const decision = await authorizeRuntimeAction(
    buildEnterpriseRuntimeRequest({ user, action: SDK_GOVERNANCE_ACTIONS.AGENTS_MANAGE, routeId: "/api/sdk/agents", workspaceId: body.workspaceId, resourceType: "workspace", resourceId: body.workspaceId }),
  );
  if (!decision.allowed) return Response.json({ ...sdkRuntimeError({ code: "authorization_denied", message: "Forbidden", decisionId: decision.decisionId }), error: "Forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_agents").insert({ workspace_id: body.workspaceId, name: body.name, description: body.description ?? "", agent_type: body.agentType ?? "copilot", created_by_user_id: user.id, owner_user_id: user.id, purpose: body.purpose ?? "", risk_level: body.riskLevel ?? "medium", metadata: body.metadata ?? {} }).select("*").single();
  if (error) { const safe = sdkDatabaseErrorBody("/api/sdk/agents", error); return Response.json({ ...sdkRuntimeError({ code: "runtime_unavailable", message: safe.message }), error: safe.message }, { status: 500 }); }
  return Response.json(withRuntime(sdkSuccess({ agent: data }, { lineage: { decisionId: decision.decisionId, runtimeDecisionId: decision.decisionId, timestamps: { decidedAt: new Date().toISOString() } }, runtime: runtimeMetadata("/api/sdk/agents", { workspaceId: body.workspaceId }) }), "/api/sdk/agents", { workspaceId: body.workspaceId }));
}
