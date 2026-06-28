import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listAgentTools,
  registerAgentTool,
} from "@/lib/agents";
import { normalizeRegisterAgentToolInput } from "@/lib/agents";

const ROUTE = "/api/agents/tools";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const filter = {
      category: url.searchParams.get("category") ?? undefined,
      riskLevel: url.searchParams.get("riskLevel") ?? undefined,
      executionMode: url.searchParams.get("executionMode") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      includeDisabled: url.searchParams.get("includeDisabled") === "true",
    } as Parameters<typeof listAgentTools>[1];

    const tools = await listAgentTools(workspaceId, filter);
    return NextResponse.json({ ok: true, data: { tools } });
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
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const { value: input, error: validationError } = normalizeRegisterAgentToolInput(body);
    if (validationError) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: validationError } }, { status: 422 });
    }

    const tool = await registerAgentTool(input);
    return NextResponse.json({ ok: true, data: { tool } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ ok: false, error: { code: "DUPLICATE_TOOL_KEY", message: "A tool with this key already exists in this workspace." } }, { status: 409 });
    }
    throw error;
  }
}
