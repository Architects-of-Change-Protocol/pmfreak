import {
  evaluateAgentAccess as evaluateLegacyAgentAccess,
  grantAgentScope,
  requireAgentScope as requireLegacyAgentScope,
} from "@/lib/governance/authority/runtime/agent-access-bridge";

export { grantAgentScope };

export async function evaluateAgentAccess(input: Parameters<typeof evaluateLegacyAgentAccess>[0]) {
  try {
    return await evaluateLegacyAgentAccess(input);
  } catch (error) {
    return { decision: "deny" as const, reason: "runtime_dependency_unavailable", metadata: { authoritySource: "runtime-consumer", delegatedTo: "enterprise-runtime", failClosed: true, error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function requireAgentScope(input: Parameters<typeof requireLegacyAgentScope>[0]) {
  return requireLegacyAgentScope(input);
}
