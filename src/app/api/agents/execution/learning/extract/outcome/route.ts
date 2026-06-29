import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { extractLearningSignalsFromOutcome } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    // Only pass categorical/enum fields — never payload or summary fields
    const outcome = {
      id: body.outcomeId,
      workspaceId,
      status: body.status ?? "created",
      outcomeType: body.outcomeType ?? "noop",
      matchStatus: body.matchStatus ?? "undetermined",
      confidenceLevel: body.confidenceLevel ?? "low",
      evidenceCompletenessLevel: body.evidenceCompletenessLevel ?? "none",
      reviewRequirement: body.reviewRequirement ?? "not_required",
      reviewStatus: body.reviewStatus ?? "not_required",
      adapterKey: body.adapterKey ?? null,
    };
    const signals = await extractLearningSignalsFromOutcome(outcome, user.id);
    return NextResponse.json({ ok: true, data: signals }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
