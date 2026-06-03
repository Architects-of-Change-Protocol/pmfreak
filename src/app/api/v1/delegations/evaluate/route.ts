import { getAuthUser } from "@/lib/auth";
import { evaluateDelegatedAccess } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/v1/delegations/evaluate", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const result = await evaluateDelegatedAccess({ ...body, actorUserId: user.id }) as { allowed: boolean; decision: unknown; delegation: unknown; chain?: unknown[] };
  return Response.json({ ok: result.allowed, decision: result.decision, delegation: result.delegation, chain: result.chain ?? [] }, { status: result.allowed ? 200 : 403 });
}
