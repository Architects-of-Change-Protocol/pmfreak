import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateGovernanceInsightCardStatus } from "@/lib/agents";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { user } = await requireAuthenticatedUser();
    void user;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId || !status) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId and status required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const card = await updateGovernanceInsightCardStatus(workspaceId, cardId, status);
    if (!card) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Card not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: card });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
