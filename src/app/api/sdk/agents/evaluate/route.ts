import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { evaluateAgentAccess } from "@/aoc/runtime-consumer";

// Mirrors the guard the sibling GET /api/sdk/agents route already enforces
// (AGENTS_READ via authorizeRuntimeAction) — previously this route had no
// application-layer guard at all and relied solely on RLS to keep
// non-members from resolving an agent/scope by id.
export async function POST(request: Request) {
  const body = await request.json();
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });
  try {
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return Response.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  const result = await evaluateAgentAccess(body);
  return Response.json(result);
}
