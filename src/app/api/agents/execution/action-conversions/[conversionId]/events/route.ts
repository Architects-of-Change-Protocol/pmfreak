import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentActionConversionEvents } from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions/[conversionId]/events";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversionId: string }> },
) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const { conversionId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const events = await listAgentActionConversionEvents({
      workspaceId,
      conversionId,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: events });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
