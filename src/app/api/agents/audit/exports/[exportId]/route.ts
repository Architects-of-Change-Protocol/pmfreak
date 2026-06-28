// GET /api/agents/audit/exports/[exportId]

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { getAgentAuditExportById } from "@/lib/agents";

const ROUTE = "/api/agents/audit/exports/[exportId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { exportId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const exportRecord = await getAgentAuditExportById(workspaceId, exportId);
    if (!exportRecord) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Audit export not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { export: exportRecord } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to get export." } }, { status: 500 });
  }
}
