import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoStakeholderReadinessStatus } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ readinessId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { readinessId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const acknowledgedBy = status === "acknowledged" ? (user.id ?? null) : null;
    const updated = await updateAgentPmoStakeholderReadinessStatus(workspaceId, readinessId, status, acknowledgedBy);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Stakeholder readiness record not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/stakeholder-readiness/[readinessId]/status", err);
  }
}
