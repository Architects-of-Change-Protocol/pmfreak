import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoImplementationGatePrerequisiteStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ prerequisiteId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { prerequisiteId } = await params;
    const body = await request.json();
    const { workspaceId, status, rationale } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const updated = await updateAgentPmoImplementationGatePrerequisiteStatus(workspaceId, prerequisiteId, status, rationale ?? null);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Gate prerequisite not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
