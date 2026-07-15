import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getProjectHandoffData } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const handoffRequestId = searchParams.get("handoffRequestId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!handoffRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "handoffRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const data = await getProjectHandoffData(workspaceId, handoffRequestId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/project-handoff/data", err);
  }
}
