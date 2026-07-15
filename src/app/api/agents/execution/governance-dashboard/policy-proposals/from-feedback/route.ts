import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createPmoPolicyProposalFromFeedback } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, feedbackId, feedbackType, recommendation, proposalCategory } = body;
    if (!workspaceId || !feedbackId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId and feedbackId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const proposal = await createPmoPolicyProposalFromFeedback({
      workspaceId,
      feedbackId,
      feedbackType: feedbackType ?? undefined,
      recommendation: recommendation ?? undefined,
      proposalCategory: proposalCategory ?? undefined,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: proposal }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/policy-proposals/from-feedback", err);
  }
}
