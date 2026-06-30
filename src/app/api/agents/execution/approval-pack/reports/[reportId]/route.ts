import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoSimulationReportById } from "@/lib/agents";

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
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
