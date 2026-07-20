import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { getProjectHealth } from "@/lib/projects/project-health";
import { listProjectDecisions } from "@/lib/decision-governance/service";

/** GetProjectHealth (06-query-catalog.md) — Eventual consistency, composed from real RAID/schedule/critical-path data. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  let userId: string | null = null;

  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: "/api/projects/[id]/health", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: "/api/projects/[id]/health",
        message: "Invalid project context.",
        actorUserId: userId,
        projectId,
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const decisionsResult = await listProjectDecisions(projectId);
  const pendingDecisionsCount = decisionsResult.ok
    ? decisionsResult.data.filter((d) => d.decision_status === "pending_review").length
    : 0;

  const health = await getProjectHealth(projectId, pendingDecisionsCount);
  return Response.json({ health });
}
