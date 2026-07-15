import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoSimulationReportById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { reportId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const report = await getAgentPmoSimulationReportById(workspaceId, reportId);
    if (!report) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Report not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: report });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/reports/[reportId]", err);
  }
}
