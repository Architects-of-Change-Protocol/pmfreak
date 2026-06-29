import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { markApprovalBridgeSatisfied, getAgentActionApprovalBridgeByConversionId } from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions/[conversionId]/approval-satisfied";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversionId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { conversionId } = await params;
    const body = await request.json();
    const { workspaceId, message } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const bridge = await getAgentActionApprovalBridgeByConversionId(workspaceId, conversionId);
    if (!bridge) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Approval bridge not found for this conversion" } }, { status: 404 });
    }

    const updatedBridge = await markApprovalBridgeSatisfied({ workspaceId, approvalBridgeId: bridge.id, actorId: user.id, message: message ?? null });
    return NextResponse.json({ ok: true, data: updatedBridge });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
