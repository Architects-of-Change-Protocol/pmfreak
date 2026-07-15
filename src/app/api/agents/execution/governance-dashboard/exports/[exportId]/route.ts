import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getReportExportById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    const { exportId } = await params;
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const record = await getReportExportById(workspaceId, exportId);
    if (!record) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/exports/[exportId]", err);
  }
}
