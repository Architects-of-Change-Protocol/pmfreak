import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoPostActivationMonitoringHookStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ hookId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { hookId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await updateAgentPmoPostActivationMonitoringHookStatus(hookId, status);
    if (!result) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Monitoring hook not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
