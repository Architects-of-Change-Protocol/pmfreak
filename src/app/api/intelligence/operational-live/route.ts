import { AccessDeniedError, requireProjectPermission } from "@/aoc/runtime-consumer";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return denyResponse({ status: 401, routeId: "/api/intelligence/operational-live", message: "Unauthorized.", reason: "unauthorized" });
    }
    throw error;
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  if (projectId) {
    try { await requireProjectPermission(projectId, "read"); } catch (error) { if (error instanceof AccessDeniedError) return denyFromAccessError(error, { status: 403, routeId: "/api/intelligence/operational-live", message: "Invalid project context.", projectId, requestedPermission: "read", deniedPermission: "read", eventType: "project_scope_violation" }); throw error; }
  }

  // Live telemetry requires active integrations (Jira, Slack, Teams, GitHub).
  // Until integrations exist, this endpoint reports an explicit empty state —
  // it never returns simulated signals as if they were live data.
  return Response.json({
    state: "empty",
    generatedAt: new Date().toISOString(),
    projectId: projectId || null,
    data: null,
    note: "Live operational telemetry activates once external integrations are connected.",
  });
}
