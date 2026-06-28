// POST /api/agents/audit/exports — create an audit export
// GET  /api/agents/audit/exports — list audit exports

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { exportAgentAuditTrail, listAgentAuditExports } from "@/lib/agents";

const ROUTE = "/api/agents/audit/exports";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, exportFormat, filters, artifactTitle, createdBy } = body ?? {};
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const exportRecord = await exportAgentAuditTrail({
      workspaceId,
      exportFormat,
      filters,
      artifactTitle,
      createdBy: createdBy ?? null,
    });
    return NextResponse.json({ ok: true, data: { export: exportRecord } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${ROUTE}] POST error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const exports = await listAgentAuditExports(workspaceId, limit);
    return NextResponse.json({ ok: true, data: { exports } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to list exports." } }, { status: 500 });
  }
}
