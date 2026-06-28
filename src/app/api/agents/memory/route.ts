// POST /api/agents/memory — create governed memory
// GET  /api/agents/memory — list memory records

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createGovernedAgentMemory,
  listAgentMemories,
} from "@/lib/agents";

const ROUTE = "/api/agents/memory";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, ...rest } = body ?? {};
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const memory = await createGovernedAgentMemory({ workspaceId, ...rest });
    return NextResponse.json({ ok: true, data: { memory } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("denied by policy")) {
      return NextResponse.json({ ok: false, error: { code: "POLICY_DENIED", message } }, { status: 422 });
    }
    console.error(`[${ROUTE}] POST error:`, error);
    return denyResponse(`Failed to create memory record: ${message}`);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const filters = {
      status: url.searchParams.get("status") ?? undefined,
      scopeType: url.searchParams.get("scope_type") ?? undefined,
      scopeId: url.searchParams.get("scope_id") ?? undefined,
      agentId: url.searchParams.get("agent_id") ?? undefined,
      agentType: url.searchParams.get("agent_type") ?? undefined,
      memoryKind: url.searchParams.get("memory_kind") ?? undefined,
      sensitivity: url.searchParams.get("sensitivity") ?? undefined,
      includeExpired: url.searchParams.get("include_expired") === "true",
      includeRevoked: url.searchParams.get("include_revoked") === "true",
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined,
    } as Parameters<typeof listAgentMemories>[1];

    const memories = await listAgentMemories(workspaceId, filters);
    return NextResponse.json({ ok: true, data: { memories } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    console.error(`[${ROUTE}] GET error:`, error);
    return denyResponse("Failed to list memory records.");
  }
}
