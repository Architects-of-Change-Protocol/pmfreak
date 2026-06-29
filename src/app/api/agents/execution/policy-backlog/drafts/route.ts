import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createVersionedGovernancePolicyDraft,
  listPolicyDrafts,
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
    const drafts = await listPolicyDrafts(workspaceId, { limit });
    return NextResponse.json({ ok: true, data: drafts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!changeRequestId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const draft = await createVersionedGovernancePolicyDraft({
      workspaceId,
      changeRequestId,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: draft }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
