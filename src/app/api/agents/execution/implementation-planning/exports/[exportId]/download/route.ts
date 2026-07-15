import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoImplementationPlanningExportById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { exportId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const exportRecord = await getAgentPmoImplementationPlanningExportById(workspaceId, exportId);
    if (!exportRecord) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 });
    }
    if (exportRecord.status === "failed" || !exportRecord.contentText) {
      return NextResponse.json({ ok: false, error: { code: "EXPORT_FAILED", message: "Export content not available" } }, { status: 422 });
    }
    return new Response(exportRecord.contentText, {
      headers: {
        "Content-Type": exportRecord.contentType,
        "Content-Disposition": `attachment; filename="${exportRecord.fileName}"`,
      },
    });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/exports/[exportId]/download", err);
  }
}
