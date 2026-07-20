import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentExecutionRequestById } from "@/lib/agents/agent-execution-registry";

const ROUTE_ID = "/api/agent-runs/[id]";

/**
 * GetAgentRun (06-query-catalog.md) — adapts the real, existing
 * AgentExecutionRequestRecord (input/actions/approval/output already
 * present) into the Agent Run view 08-ai-interaction-patterns.md §4
 * specifies, rather than inventing a new run model.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: runId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim() ?? "";
  if (!workspaceId) return Response.json({ error: "workspaceId is required." }, { status: 400 });

  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: ROUTE_ID,
        message: "Invalid workspace context.",
        actorUserId: userId,
        workspaceId,
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const run = await getAgentExecutionRequestById(workspaceId, runId);
  if (!run) return Response.json({ error: "Agent run not found." }, { status: 404 });
  return Response.json({ run });
}
