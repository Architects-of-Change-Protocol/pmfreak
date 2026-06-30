import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoControlledPolicyVersionStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ controlledPolicyVersionId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { controlledPolicyVersionId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await updateAgentPmoControlledPolicyVersionStatus(controlledPolicyVersionId, status);
    if (!result) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Controlled policy version not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
