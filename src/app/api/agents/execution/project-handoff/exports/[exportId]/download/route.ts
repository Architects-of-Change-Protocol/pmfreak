import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoProjectHandoffExportById } from "@/lib/agents";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { exportId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const record = await getAgentPmoProjectHandoffExportById(exportId);
    if (!record || record.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    const mimeMap: Record<string, string> = { json: "application/json", csv: "text/csv", markdown: "text/markdown" };
    const mime = mimeMap[record.exportFormat] ?? "text/plain";
    const ext = record.exportFormat === "markdown" ? "md" : record.exportFormat;
    return new Response(record.safeExportContent, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="handoff-export-${record.id}.${ext}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
