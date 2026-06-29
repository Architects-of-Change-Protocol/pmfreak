import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createFailedDispatchTriage } from "@/lib/agents";

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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
