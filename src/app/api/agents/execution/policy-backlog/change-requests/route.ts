import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createPolicyChangeRequestFromBacklogItem,
  listPolicyChangeRequests,
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
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const requests = await listPolicyChangeRequests(workspaceId, { status: status as never, limit });
    return NextResponse.json({ ok: true, data: requests });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, backlogItemId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!backlogItemId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_BACKLOG_ITEM", message: "backlogItemId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await createPolicyChangeRequestFromBacklogItem({
      workspaceId,
      backlogItemId,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
