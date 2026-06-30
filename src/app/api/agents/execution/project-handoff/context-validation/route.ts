import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { validateProjectHandoffContext, listAgentPmoProjectContextValidations } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    if (!body.handoffRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "handoffRequestId required" } }, { status: 400 });
    const records = await validateProjectHandoffContext(body.workspaceId, body.handoffRequestId);
    return NextResponse.json({ ok: true, data: records }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const handoffRequestId = searchParams.get("handoffRequestId") ?? undefined;
    const records = await listAgentPmoProjectContextValidations(workspaceId, handoffRequestId);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
