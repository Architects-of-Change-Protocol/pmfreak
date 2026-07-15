import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listGovernanceInsightCards, generatePmoGovernanceInsightCards } from "@/lib/agents";
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
    const cards = await listGovernanceInsightCards(workspaceId, {
      cardType: url.searchParams.get("cardType") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: cards });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/cards", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const body = await request.json();
    const { workspaceId, snapshotId } = body;
    if (!workspaceId || !snapshotId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "workspaceId and snapshotId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const cards = await generatePmoGovernanceInsightCards({ workspaceId, snapshotId: snapshotId ?? null });
    return NextResponse.json({ ok: true, data: cards }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/governance-dashboard/cards", err);
  }
}
