import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoControlledPolicyVersionById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ controlledPolicyVersionId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { controlledPolicyVersionId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await getAgentPmoControlledPolicyVersionById(controlledPolicyVersionId);
    if (!result) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Controlled policy version not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/controlled-versions/[controlledPolicyVersionId]", err);
  }
}
