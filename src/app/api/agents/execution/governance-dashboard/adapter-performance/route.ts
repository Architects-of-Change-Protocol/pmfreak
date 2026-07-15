import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAdapterPerformanceInsights, generatePmoAdapterPerformanceInsights } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const insights = await listAdapterPerformanceInsights(workspaceId, {
      adapterKey: url.searchParams.get("adapterKey") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: insights });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/adapter-performance", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const body = await request.json();
    const { workspaceId, snapshotId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const insights = await generatePmoAdapterPerformanceInsights({ workspaceId, snapshotId: snapshotId ?? null });
    return NextResponse.json({ ok: true, data: insights }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/adapter-performance", err);
  }
}
