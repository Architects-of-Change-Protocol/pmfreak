import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getBetaReadinessPlanData } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const planId = searchParams.get("planId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!planId) return NextResponse.json({ ok: false, error: { code: "MISSING_PLAN", message: "planId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const data = await getBetaReadinessPlanData(workspaceId, planId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/beta-readiness/data", err);
  }
}
