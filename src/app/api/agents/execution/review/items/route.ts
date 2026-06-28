import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listReviewItems,
  createAgentReviewItem,
  normalizeCreateAgentReviewItemInput,
} from "@/lib/agents";

const ROUTE = "/api/agents/execution/review/items";

export async function GET(request: Request) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(_user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const filters = {
      queueId: url.searchParams.get("queueId") ?? undefined,
      itemStatus: url.searchParams.get("itemStatus") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      riskLevel: url.searchParams.get("riskLevel") ?? undefined,
      sourceType: url.searchParams.get("sourceType") ?? undefined,
      assignedTo: url.searchParams.get("assignedTo") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    } as Parameters<typeof listReviewItems>[1];
    const items = await listReviewItems(workspaceId, filters);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    let normalized;
    try {
      normalized = normalizeCreateAgentReviewItemInput({ ...body, createdBy: body.createdBy ?? user.id });
    } catch (err) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 422 });
    }
    const item = await createAgentReviewItem(normalized);
    return NextResponse.json({ ok: true, data: { item } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
