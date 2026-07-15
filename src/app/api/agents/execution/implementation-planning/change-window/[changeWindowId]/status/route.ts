import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoChangeWindowStatus } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ changeWindowId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { changeWindowId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const updated = await updateAgentPmoChangeWindowStatus(workspaceId, changeWindowId, status);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Change window plan not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/change-window/[changeWindowId]/status", err);
  }
}
