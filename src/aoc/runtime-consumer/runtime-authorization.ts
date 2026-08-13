import type { GovernanceEvaluationInput } from "@aoc-enterprise/runtime";
import { authorizeRuntimeAction as authorizeEnterpriseRuntimeAction } from "@/aoc/enterprise/runtime/authorization-bridge";
import { enforceRuntimeAuthorization as enforceEnterpriseRuntimeAuthorization } from "@/aoc/enterprise/runtime/authorization-bridge";
import { RuntimeDependencyUnavailableError } from "./runtime-errors";
import { bootstrapRuntimeConsumer } from "./runtime-bootstrap";

const failClosedResponse = (routeId: string) =>
  Response.json(
    {
      ok: false,
      error: {
        code: "runtime_dependency_unavailable",
        reason: "runtime_authority_unavailable",
        message: "Runtime authority unavailable. Request denied by fail-closed policy.",
      },
      runtime: { routeId, authoritySource: "runtime-consumer", failClosed: true },
    },
    { status: 503 },
  );

export async function enforceRuntimeAuthorization(input: GovernanceEvaluationInput) {
  bootstrapRuntimeConsumer();
  try {
    return await enforceEnterpriseRuntimeAuthorization(input);
  } catch (error) {
    const wrapped = new RuntimeDependencyUnavailableError(
      "Runtime authority dependency failed; request denied by fail-closed policy.",
      { routeId: input.routeId, error: error instanceof Error ? error.message : String(error) },
    );

    return {
      decision: {
        allowed: false,
        decisionId: `runtime_consumer_fail_closed_${input.routeId}`,
        reason: wrapped.code,
        auditEventType: "runtime_initialization_issue",
        actor: { type: input.actorType, userId: input.actorUserId ?? null, agentId: input.actorAgentId ?? null },
        scope: {
          workspaceId: input.workspaceId ?? null,
          projectId: input.projectId ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
        },
      },
      response: failClosedResponse(input.routeId),
    };
  }
}


export async function authorizeRuntimeAction(input: Parameters<typeof authorizeEnterpriseRuntimeAction>[0]) {
  bootstrapRuntimeConsumer();
  try {
    return await authorizeEnterpriseRuntimeAction(input);
  } catch (error) {
    return { allowed: false as const, reason: "runtime_dependency_unavailable", decisionId: `runtime_consumer_fail_closed_${input.routeId}`, runtimeMetadata: { authoritySource: "runtime-consumer", delegatedTo: "enterprise-runtime", failClosed: true, error: error instanceof Error ? error.message : String(error) } };
  }
}
