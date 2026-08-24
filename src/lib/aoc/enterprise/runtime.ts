import {
  enforceEnforcementPipeline,
  evaluateEnforcementPipeline,
  type GovernanceEvaluationInput,
} from "@pmfreak/aoc-enterprise-internal";
import { denyResponse } from "@/lib/security/deny-response";
import { ensurePmfreakAocAdaptersRegistered, getEnterpriseRuntimeComposeOptions } from "@/lib/aoc/bootstrap";
import type { SecurityEventType } from "@/lib/security/telemetry";

export type { GovernanceEvaluationInput } from "@pmfreak/aoc-enterprise-internal";

export async function evaluateRuntimeAuthorization(input: GovernanceEvaluationInput) {
  ensurePmfreakAocAdaptersRegistered();
  return evaluateEnforcementPipeline(input, getEnterpriseRuntimeComposeOptions());
}

export async function enforceRuntimeAuthorization(input: GovernanceEvaluationInput) {
  ensurePmfreakAocAdaptersRegistered();
  const { decision } = await enforceEnforcementPipeline(input, getEnterpriseRuntimeComposeOptions());
  if (!decision.allowed) {
    const response = denyResponse({
      status: 403,
      routeId: input.routeId,
      message: "Governance denied.",
      reason: decision.reason,
      eventType: decision.auditEventType as SecurityEventType,
      actorUserId: decision.actor.userId,
      actorAgentId: decision.actor.agentId,
      workspaceId: decision.scope.workspaceId,
      projectId: decision.scope.projectId,
    });
    return { decision, response };
  }
  return { decision, response: null };
}
