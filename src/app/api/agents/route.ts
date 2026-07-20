import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentExecutionRequests } from "@/lib/agents/agent-execution-registry";

const ROUTE_ID = "/api/agents";

/**
 * Known, real agent capabilities (src/lib/governance/cost, src/lib/governance/quality
 * — the two built, deterministic governance agents per
 * 01-canonical-domain-model.md §25). This is a thin, illustrative capability
 * mapping — not a persisted Agent Definition table, which does not exist yet
 * (documented in ADR-PMF-075).
 */
const KNOWN_AGENT_CAPABILITIES: Record<string, string[]> = {
  cost_governance: ["Cost Baseline Analysis", "Burn Rate Analysis", "Procurement Risk"],
  quality_governance: ["Quality Baseline Evaluation", "Defect Pressure Analysis", "Technical Debt Evaluation"],
};

function agentLabel(agentType: string): string {
  return agentType
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Agent Registry (03-screen-catalog.md's Agent Center, By-Agent view) — seeded from real Agent Run history. */
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim() ?? "";
  if (!workspaceId) return Response.json({ error: "workspaceId is required." }, { status: 400 });

  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: ROUTE_ID,
        message: "Invalid workspace context.",
        actorUserId: userId,
        workspaceId,
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const recentRuns = await listAgentExecutionRequests(workspaceId, { limit: 200 });
  const byType = new Map<string, (typeof recentRuns)[number]>();
  for (const run of recentRuns) {
    const type = run.agentType ?? "unknown_agent";
    const existing = byType.get(type);
    if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) byType.set(type, run);
  }

  const knownTypes = new Set([...Object.keys(KNOWN_AGENT_CAPABILITIES), ...byType.keys()]);
  const agents = Array.from(knownTypes).map((agentType) => {
    const lastRun = byType.get(agentType) ?? null;
    return {
      agentType,
      name: `${agentLabel(agentType)} Agent`,
      status: "active" as const,
      capabilities: KNOWN_AGENT_CAPABILITIES[agentType] ?? ["General agent execution"],
      lastRun: lastRun ? { runId: lastRun.id, createdAt: lastRun.createdAt } : null,
    };
  });

  return Response.json({ agents });
}
