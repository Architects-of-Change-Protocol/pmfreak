import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { buildDecisionLineage, getDecision } from "@/lib/decision-governance/service";

const ROUTE_ID = "/api/decisions/[id]";

/** GetDecisionDetails (06-query-catalog.md) — Strong consistency. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    await requireProjectAccess(decision.project_id, "read");
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
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const lineage = await buildDecisionLineage(decisionId);
  if (!lineage.ok) return Response.json({ error: lineage.error }, { status: 500 });

  return Response.json({ decision, lineage: lineage.data });
}
