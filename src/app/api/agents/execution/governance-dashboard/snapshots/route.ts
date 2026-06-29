import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  generatePmoGovernanceDashboardSnapshot,
  listGovernanceDashboardSnapshots,
} from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const snapshots = await listGovernanceDashboardSnapshots(workspaceId, { limit });
    return NextResponse.json({ ok: true, data: snapshots });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, periodStart, periodEnd } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const now = new Date().toISOString();
    const snapshot = await generatePmoGovernanceDashboardSnapshot({
      workspaceId,
      periodStart: periodStart ?? now,
      periodEnd: periodEnd ?? now,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: snapshot }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
