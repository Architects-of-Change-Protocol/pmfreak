import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { completeProjectHandoff } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    const result = await completeProjectHandoff(body);
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/project-handoff/complete", err);
  }
}
