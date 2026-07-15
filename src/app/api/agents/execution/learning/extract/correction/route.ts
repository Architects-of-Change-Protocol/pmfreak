import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { extractLearningSignalsFromCorrectionLoop } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    // Only pass categorical/enum fields — never correctionReason or payload
    const loop = {
      id: body.loopId,
      workspaceId,
      correctionType: body.correctionType ?? "retry_dispatch",
      status: body.status ?? "created",
      retryRecommended: body.retryRecommended ?? false,
      outcomeId: body.outcomeId ?? null,
      adapterKey: body.adapterKey ?? null,
    };
    const signals = await extractLearningSignalsFromCorrectionLoop(loop, user.id);
    return NextResponse.json({ ok: true, data: signals }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/extract/correction", err);
  }
}
