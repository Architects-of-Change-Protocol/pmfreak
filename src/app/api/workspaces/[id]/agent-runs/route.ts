import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentExecutionRequests } from "@/lib/agents/agent-execution-registry";

const ROUTE_ID = "/api/workspaces/[id]/agent-runs";

/** ListAgentRuns (06-query-catalog.md) — Strong consistency, scoped to the caller's workspace. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const agentId = searchParams.get("agent_id")?.trim() || undefined;
  const scopeId = searchParams.get("scopeId")?.trim() || undefined;

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

  const runs = await listAgentExecutionRequests(workspaceId, { agentId, scopeId, limit: 50 });
  return Response.json({ runs });
}
