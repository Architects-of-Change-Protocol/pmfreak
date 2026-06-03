import { getAuthUser } from "@/lib/auth";
import { consumeDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/delegations/consume", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const outcome = await consumeDelegatedCapability({ ...body, actorUserId: user.id }) as { ok: boolean; reason?: string; delegation: { id: string; uses_count: number; status: string } };
  if (!outcome.ok) return denyResponse({ status: 403, routeId: "/api/governance/delegations/consume", message: "Invalid delegated capability.", reason: String(outcome.reason ?? "delegation_denied"), actorUserId: user.id, workspaceId: body.workspaceId ?? null, projectId: body.projectId ?? null, requestedPermission: body.requestedPermission ?? null, deniedPermission: body.requestedPermission ?? null, eventType: "delegated_capability_invalid" });
  return Response.json({ ok: true, delegationId: outcome.delegation.id, usesCount: outcome.delegation.uses_count, status: outcome.delegation.status });
}
