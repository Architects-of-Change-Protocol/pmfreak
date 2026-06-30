import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoPolicyActivationExportById } from "@/lib/agents";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { exportId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const exportRecord = await getAgentPmoPolicyActivationExportById(exportId);
    if (!exportRecord) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 });
    const contentType = exportRecord.exportFormat === "json"
      ? "application/json"
      : exportRecord.exportFormat === "csv"
      ? "text/csv"
      : "text/markdown";
    const filename = `policy-activation-export-${exportRecord.id}.${exportRecord.exportFormat === "markdown" ? "md" : exportRecord.exportFormat}`;
    return new NextResponse(exportRecord.safeExportContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
