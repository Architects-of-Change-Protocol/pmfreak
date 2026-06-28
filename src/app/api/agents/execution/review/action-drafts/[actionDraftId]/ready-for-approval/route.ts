import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { markActionDraftReadyForApproval } from "@/lib/agents";

const ROUTE = "/api/agents/execution/review/action-drafts/[actionDraftId]/ready-for-approval";

export async function POST(request: Request, { params }: { params: Promise<{ actionDraftId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { actionDraftId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const draft = await markActionDraftReadyForApproval({ workspaceId, actionDraftId, actorId: user.id });
    return NextResponse.json({ ok: true, data: { draft } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
