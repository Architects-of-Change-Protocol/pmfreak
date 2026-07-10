import { getAuthUser } from "@/lib/auth";
import { requireDelegationRevokeActor } from "@/lib/workspace-access";
import { revokeDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

// Only the original delegator, or an owner/admin of the delegation's own
// workspace, may revoke it — see requireDelegationRevokeActor for the
// server-side lookup that resolves workspace/delegator from the delegation
// record itself, never from the request body.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations/:id/revoke", message: "Unauthorized", reason: "unauthorized" });
  const { id } = await params;
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireDelegationRevokeActor({ delegationId: id, userId: user.id }));
  } catch {
    return Response.json({ ok: false, error: { code: "not_found", message: "Delegation not found" } }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const outcome = (await revokeDelegatedCapability({ ...body, delegationId: id, workspaceId, actorUserId: user.id })) as { ok: boolean; reason?: string; delegation: { id: string; status: string }; propagatedRevocations?: unknown };
  if (!outcome.ok) return Response.json({ ok: false, error: { code: outcome.reason, message: "Delegation not found" } }, { status: 404 });
  return Response.json({ ok: true, delegationId: outcome.delegation.id, status: outcome.delegation.status, propagatedRevocations: outcome.propagatedRevocations });
}
