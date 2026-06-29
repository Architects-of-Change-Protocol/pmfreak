import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createOutcomeFromDispatchAttempt } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const outcome = await createOutcomeFromDispatchAttempt({
      workspaceId,
      executionRequestId: body.executionRequestId,
      finalizationId: body.finalizationId ?? null,
      dispatchAttemptId: body.dispatchAttemptId ?? null,
      dispatchGateId: body.dispatchGateId ?? null,
      adapterExecutionId: body.adapterExecutionId ?? null,
      resultId: body.resultId ?? null,
      outcomeType: body.outcomeType ?? undefined,
      intendedOutcomeSummary: body.intendedOutcomeSummary ?? null,
      actualOutcomeSummary: body.actualOutcomeSummary ?? null,
      outcomePayload: body.outcomePayload ?? null,
      createdBy: user.id,
    });
    return NextResponse.json({ ok: true, data: outcome }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
