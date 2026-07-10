import { getAuthUser } from "@/lib/auth";
import { requireDelegationRevokeActor } from "@/lib/workspace-access";
import { revokeDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

// Only the original delegator, or an owner/admin of the delegation's own
// workspace, may revoke it — see requireDelegationRevokeActor.
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/delegations/revoke", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const delegationId = typeof body.delegationId === "string" ? body.delegationId : "";
  if (!delegationId) return Response.json({ error: "delegation_id_required" }, { status: 400 });
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireDelegationRevokeActor({ delegationId, userId: user.id }));
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const outcome = (await revokeDelegatedCapability({ ...body, delegationId, workspaceId, actorUserId: user.id })) as { ok: boolean; reason?: string; delegation: { id: string; status: string } };
  if (!outcome.ok) return Response.json({ error: outcome.reason }, { status: 404 });
  return Response.json({ ok: true, delegationId: outcome.delegation.id, status: outcome.delegation.status });
}
