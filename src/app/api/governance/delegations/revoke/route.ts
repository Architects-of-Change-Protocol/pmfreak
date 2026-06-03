import { getAuthUser } from "@/lib/auth";
import { revokeDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/delegations/revoke", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const outcome = await revokeDelegatedCapability({ ...body, actorUserId: user.id }) as { ok: boolean; reason?: string; delegation: { id: string; status: string } };
  if (!outcome.ok) return Response.json({ error: outcome.reason }, { status: 404 });
  return Response.json({ ok: true, delegationId: outcome.delegation.id, status: outcome.delegation.status });
}
