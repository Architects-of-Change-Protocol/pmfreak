import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { reviewPmoPolicyProposal } from "@/lib/agents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await params;
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, decision, reviewRationale } = body;
    if (!workspaceId || !decision || !reviewRationale) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId, decision, and reviewRationale required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const proposal = await reviewPmoPolicyProposal({
      workspaceId,
      proposalId: proposalId,
      decision,
      reviewRationale,
      reviewedBy: user.id ?? null,
    });
    if (!proposal) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Proposal not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: proposal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
