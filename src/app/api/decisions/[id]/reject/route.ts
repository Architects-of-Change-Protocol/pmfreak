import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { getDecision, rejectDecision } from "@/lib/decision-governance/service";

const ROUTE_ID = "/api/decisions/[id]/reject";

/** RejectRecommendation / Decision rejection step (06-command-catalog.md) — governance-relevant, never optimistic. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: decisionId } = await context.params;

  const decisionResult = await getDecision(decisionId);
  if (!decisionResult.ok) {
    return Response.json({ error: decisionResult.error }, { status: decisionResult.failureClass === "not_found" ? 404 : 500 });
  }
  const decision = decisionResult.data;

  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(decision.project_id, "write");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: ROUTE_ID,
        message: "Invalid project context.",
        actorUserId: userId,
        projectId: decision.project_id,
        requestedPermission: "write",
        deniedPermission: "write",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as { rationale?: string };
  const result = await rejectDecision(decisionId, userId!, body.rationale ?? null);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.failureClass === "governance_violation" ? 409 : 422 });

  return Response.json({ decision: result.data });
}
