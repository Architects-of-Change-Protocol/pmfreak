import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createFinalizationFromExecutionRequest } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, executionRequestId, actionConversionId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!executionRequestId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_EXECUTION_REQUEST", message: "executionRequestId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const finalization = await createFinalizationFromExecutionRequest({
      workspaceId,
      executionRequestId,
      actionConversionId: actionConversionId ?? null,
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, data: finalization }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dispatch/finalizations/from-execution-request", err);
  }
}
