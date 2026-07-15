import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { buildActionConversionSummary } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE = "/api/agents/execution/action-conversions/summary";

export async function GET(request: Request) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const summary = await buildActionConversionSummary({
      workspaceId,
      ownerId: url.searchParams.get("ownerId") ?? undefined,
      ownerRole: url.searchParams.get("ownerRole") ?? undefined,
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return safeInternalErrorResponse(ROUTE, err);
  }
}
