import type { PmoAgentId } from "./pmo-tenant-types";

/**
 * Maps wizard PmoAgentId values to the operational domain strings used
 * by the copilot and continuity retrieval systems. This is a stable
 * adapter — do not rename existing domains, add entries here instead.
 */
export const AGENT_TO_DOMAIN: Record<PmoAgentId, string> = {
  scope: "governance",
  timeline: "timeline",
  cost: "financial",
  quality: "governance",
  resource: "delivery",
  stakeholder: "stakeholder",
  "delivery-intelligence": "delivery",
  "executive-synthesis": "general",
  "portfolio-arbitration": "governance",
};

export function resolveAgentDomain(agentId: PmoAgentId): string {
  return AGENT_TO_DOMAIN[agentId] ?? "general";
}

export function resolveEnabledDomains(
  agents: Array<{ agentId: PmoAgentId; enabled: boolean }>
): string[] {
  return Array.from(
    new Set(agents.filter((a) => a.enabled).map((a) => resolveAgentDomain(a.agentId)))
  );
}
