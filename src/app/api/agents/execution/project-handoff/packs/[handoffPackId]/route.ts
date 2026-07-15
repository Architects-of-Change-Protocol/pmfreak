import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoProjectHandoffPackById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ handoffPackId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { handoffPackId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const record = await getAgentPmoProjectHandoffPackById(handoffPackId);
    if (!record || record.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/project-handoff/packs/[handoffPackId]", err);
  }
}
