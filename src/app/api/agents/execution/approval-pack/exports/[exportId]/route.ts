import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoApprovalPackExportById } from "@/lib/agents";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { exportId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const exportRecord = await getAgentPmoApprovalPackExportById(workspaceId, exportId);
    if (!exportRecord) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: exportRecord });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
