import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { assignReviewItem } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE = "/api/agents/execution/review/items/[reviewItemId]/assign";

export async function POST(request: Request, { params }: { params: Promise<{ reviewItemId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { reviewItemId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    if (!body.assignedTo) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAM", message: "assignedTo required" } }, { status: 400 });
    }
    const assignment = await assignReviewItem({ workspaceId, reviewItemId, assignedTo: body.assignedTo, assignedBy: user.id, note: body.note });
    return NextResponse.json({ ok: true, data: { assignment } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    return safeInternalErrorResponse(ROUTE, error);
  }
}
