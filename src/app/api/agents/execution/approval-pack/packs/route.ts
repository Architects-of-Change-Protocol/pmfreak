import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentPmoApprovalPacks } from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const changeRequestId = url.searchParams.get("changeRequestId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const packs = await listAgentPmoApprovalPacks(workspaceId, { changeRequestId, limit });
    return NextResponse.json({ ok: true, data: packs });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
