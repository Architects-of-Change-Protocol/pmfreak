import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoDryRunExportById } from "@/lib/agents";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { exportId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const record = await getAgentPmoDryRunExportById(exportId);
    if (!record || record.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    if (!record.safetyValidationPassed) return NextResponse.json({ ok: false, error: { code: "SAFETY_NOT_VALIDATED", message: "Export safety not validated" } }, { status: 403 });
    const contentTypeMap: Record<string, string> = { markdown: "text/markdown", json: "application/json", csv: "text/csv" };
    const contentType = contentTypeMap[record.exportFormat] ?? "text/plain";
    return new Response(record.safeExportContent, {
      headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="dry-run-export-${exportId}.${record.exportFormat}"` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
