import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { downloadPmoGovernanceReportExport } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    const { exportId } = await params;
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const record = await downloadPmoGovernanceReportExport({ workspaceId, exportId: exportId, actorId: user.id ?? null });
    if (!record) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/exports/[exportId]/download", err);
  }
}
