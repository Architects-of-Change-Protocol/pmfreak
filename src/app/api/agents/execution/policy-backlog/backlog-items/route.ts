import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createPolicyBacklogItemFromProposal,
  listPolicyBacklogItems,
} from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const items = await listPolicyBacklogItems(workspaceId, { status: status as never, limit });
    return NextResponse.json({ ok: true, data: items });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-backlog/backlog-items", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, proposalId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!proposalId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PROPOSAL", message: "proposalId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const item = await createPolicyBacklogItemFromProposal({
      workspaceId,
      proposalId,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-backlog/backlog-items", err);
  }
}
