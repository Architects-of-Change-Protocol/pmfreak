import { AccessDeniedError, requireProjectPermission } from "@/aoc/runtime-consumer";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { buildExecutionRiskSnapshot } from "@/lib/execution-risk";
import { readProjectMemorySnapshot } from "@/lib/memory/organization-memory";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return denyResponse({ status: 401, routeId: "/api/intelligence/execution-risk", message: "Unauthorized.", reason: "unauthorized" });
    }
    throw error;
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  if (projectId) {
    try { await requireProjectPermission(projectId, "read"); } catch (error) { if (error instanceof AccessDeniedError) return denyFromAccessError(error, { status: 403, routeId: "/api/intelligence/execution-risk", message: "Invalid project context.", projectId, requestedPermission: "read", deniedPermission: "read", eventType: "project_scope_violation" }); throw error; }
  }

  // Operational scope resolution stays deterministic so future PMO-level agents
  // can reuse the same snapshot shape across project, workspace, and portfolio views.
  const snapshot = projectId.length > 0 ? await readProjectMemorySnapshot(projectId) : null;

  if (projectId.length > 0 && !snapshot) {
    return denyResponse({ status: 403, routeId: "/api/intelligence/execution-risk", message: "Invalid project context.", reason: "project_not_found_or_out_of_scope", projectId, requestedPermission: "read", deniedPermission: "read", eventType: "project_scope_violation" });
  }

  const riskSnapshot = buildExecutionRiskSnapshot(projectId || null, snapshot);
  return Response.json(riskSnapshot);
}
