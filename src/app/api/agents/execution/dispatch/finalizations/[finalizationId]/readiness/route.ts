import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { runExecutionDispatchReadiness } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ finalizationId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { finalizationId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const finalization = await runExecutionDispatchReadiness({ workspaceId, finalizationId, actorId: user.id });
    return NextResponse.json({ ok: true, data: finalization });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dispatch/finalizations/[finalizationId]/readiness", err);
  }
}
