import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listReportExports, generatePmoGovernanceReportExport } from "@/lib/agents";

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
    const exports = await listReportExports(workspaceId, {
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: exports });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, exportFormat, snapshotId, periodStart, periodEnd } = body;
    if (!workspaceId || !exportFormat) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId and exportFormat required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const now = new Date().toISOString();
    const record = await generatePmoGovernanceReportExport({
      workspaceId,
      exportFormat,
      snapshotId: snapshotId ?? null,
      periodStart: periodStart ?? now,
      periodEnd: periodEnd ?? now,
      generatedBy: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
