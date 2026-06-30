import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoSimulationReportStatus, validateAgentPmoSimulationReportStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { reportId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const updated = await updateAgentPmoSimulationReportStatus(workspaceId, reportId, validateAgentPmoSimulationReportStatus(status));
    if (!updated) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Report not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
