import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { reviewPmoGovernanceFeedbackQueueItem } from "@/lib/agents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ queueItemId: string }> },
) {
  try {
    const { queueItemId } = await params;
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, status, reviewRationale } = body;
    if (!workspaceId || !status || !reviewRationale) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId, status, and reviewRationale required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const item = await reviewPmoGovernanceFeedbackQueueItem({
      workspaceId,
      queueItemId: queueItemId,
      status,
      reviewRationale,
      actorId: user.id ?? null,
    });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Queue item not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
