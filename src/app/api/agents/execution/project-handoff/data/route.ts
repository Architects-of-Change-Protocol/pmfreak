import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getProjectHandoffData } from "@/lib/agents";

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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
