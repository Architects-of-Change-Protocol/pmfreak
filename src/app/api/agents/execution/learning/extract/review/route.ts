import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { extractLearningSignalsFromHumanOutcomeReview } from "@/lib/agents";
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
    // Only pass categorical/enum fields — never rationale
    const review = {
      id: body.reviewId,
      workspaceId,
      decisionType: body.decisionType ?? null,
      reviewRequirement: body.reviewRequirement ?? "not_required",
      reviewStatus: body.reviewStatus ?? "not_required",
      priority: body.priority ?? null,
      riskLevel: body.riskLevel ?? null,
      assignedRole: body.assignedRole ?? null,
      outcomeId: body.outcomeId ?? null,
      adapterKey: body.adapterKey ?? null,
    };
    const signals = await extractLearningSignalsFromHumanOutcomeReview(review, user.id);
    return NextResponse.json({ ok: true, data: signals }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/extract/review", err);
  }
}
