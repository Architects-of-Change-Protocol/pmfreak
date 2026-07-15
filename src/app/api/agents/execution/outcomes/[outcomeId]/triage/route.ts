import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createFailedDispatchTriage } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ outcomeId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const { outcomeId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await createFailedDispatchTriage({
      workspaceId,
      outcomeId,
      failureCategory: body.failureCategory,
      failureMessage: body.failureMessage ?? null,
      blockingReasons: body.blockingReasons ?? [],
      triageNotes: body.triageNotes ?? [],
      recommendedCorrectionType: body.recommendedCorrectionType ?? null,
      triagePayload: body.triagePayload ?? null,
    });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/outcomes/[outcomeId]/triage", err);
  }
}
