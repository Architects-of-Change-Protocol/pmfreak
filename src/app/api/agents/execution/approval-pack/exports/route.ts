import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generateApprovalPackExport, listAgentPmoApprovalPackExports } from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const approvalPackId = url.searchParams.get("approvalPackId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const exports = await listAgentPmoApprovalPackExports(workspaceId, { approvalPackId, limit });
    return NextResponse.json({ ok: true, data: exports });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, approvalPackId, exportFormat } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!approvalPackId) return NextResponse.json({ ok: false, error: { code: "MISSING_PACK", message: "approvalPackId required" } }, { status: 400 });
    if (!exportFormat) return NextResponse.json({ ok: false, error: { code: "MISSING_FORMAT", message: "exportFormat required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const exportRecord = await generateApprovalPackExport({ workspaceId, approvalPackId, exportFormat, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: exportRecord }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
