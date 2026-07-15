import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordFinalDispatchConfirmation } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ finalizationId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { finalizationId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!rationale) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const confirmation = await recordFinalDispatchConfirmation({ workspaceId, finalizationId, rationale, actorId: user.id });
    return NextResponse.json({ ok: true, data: confirmation });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dispatch/finalizations/[finalizationId]/confirm", err);
  }
}
