import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getGovernanceDashboardSnapshotById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  try {
    const { snapshotId } = await params;
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const snapshot = await getGovernanceDashboardSnapshotById(workspaceId, snapshotId);
    if (!snapshot) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Snapshot not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: snapshot });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/snapshots/[snapshotId]", err);
  }
}
