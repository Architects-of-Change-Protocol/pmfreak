import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentPmoApprovalPackEvents } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const approvalPackId = url.searchParams.get("approvalPackId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const events = await listAgentPmoApprovalPackEvents(workspaceId, { approvalPackId, limit });
    return NextResponse.json({ ok: true, data: events });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/events", err);
  }
}
