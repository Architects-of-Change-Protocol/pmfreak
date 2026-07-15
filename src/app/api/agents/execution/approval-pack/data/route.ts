import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getApprovalPackData } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const approvalPackId = url.searchParams.get("approvalPackId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!approvalPackId) return NextResponse.json({ ok: false, error: { code: "MISSING_PACK", message: "approvalPackId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const data = await getApprovalPackData(workspaceId, approvalPackId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/data", err);
  }
}
