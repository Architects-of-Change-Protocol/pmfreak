import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createExecutionRequestFromActionDraft } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE = "/api/agents/execution/action-conversions/[conversionId]/execution-request";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversionId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { conversionId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const updatedConversion = await createExecutionRequestFromActionDraft({ workspaceId, conversionId, actorId: user.id });
    return NextResponse.json({ ok: true, data: updatedConversion });
  } catch (err) {
    return safeInternalErrorResponse(ROUTE, err);
  }
}
