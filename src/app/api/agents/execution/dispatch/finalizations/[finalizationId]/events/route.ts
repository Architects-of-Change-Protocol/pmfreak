import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentExecutionDispatchEvents } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ finalizationId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const { finalizationId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const events = await listAgentExecutionDispatchEvents({
      workspaceId,
      finalizationId,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: events });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dispatch/finalizations/[finalizationId]/events", err);
  }
}
