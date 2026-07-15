import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentActionConversionEvents } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

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
    return safeInternalErrorResponse(ROUTE, err);
  }
}
