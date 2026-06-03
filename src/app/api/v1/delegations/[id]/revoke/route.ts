import { getAuthUser } from "@/lib/auth";
import { revokeDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations/:id/revoke", message: "Unauthorized", reason: "unauthorized" });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const outcome = await revokeDelegatedCapability({ ...body, delegationId: id, actorUserId: user.id }) as { ok: boolean; reason?: string; delegation: { id: string; status: string }; propagatedRevocations?: unknown };
  if (!outcome.ok) return Response.json({ ok: false, error: { code: outcome.reason, message: "Delegation not found" } }, { status: 404 });
  return Response.json({ ok: true, delegationId: outcome.delegation.id, status: outcome.delegation.status, propagatedRevocations: outcome.propagatedRevocations });
}
