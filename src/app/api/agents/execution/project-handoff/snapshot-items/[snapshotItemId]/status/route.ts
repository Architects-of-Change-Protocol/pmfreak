import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoProjectHandoffSnapshotItemStatus, validateAgentPmoProjectHandoffSnapshotItemStatus } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ snapshotItemId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { snapshotItemId } = await params;
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    if (!validateAgentPmoProjectHandoffSnapshotItemStatus(body.itemStatus)) return NextResponse.json({ ok: false, error: { code: "INVALID_STATUS", message: "Invalid itemStatus" } }, { status: 400 });
    const record = await updateAgentPmoProjectHandoffSnapshotItemStatus(snapshotItemId, body.itemStatus);
    if (!record) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/project-handoff/snapshot-items/[snapshotItemId]/status", err);
  }
}
