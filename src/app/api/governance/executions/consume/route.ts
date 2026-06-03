import { getAuthUser } from "@/lib/auth";
import { consumeExecutionGrant } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";
import { logSecurityEvent } from "@/lib/security/telemetry";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/executions/consume", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const outcome = await consumeExecutionGrant({
    grantToken: body.grantToken,
    action: body.action,
    workspaceId: body.workspaceId,
    projectId: body.projectId ?? null,
    resourceType: body.resourceType ?? null,
    resourceId: body.resourceId ?? null,
    requestedPermission: body.requestedPermission,
    actorUserId: user.id,
    actorAgentId: request.headers.get("x-pmf-agent-id"),
  });
  const typedOutcome = outcome as { ok: boolean; reason?: string; grant?: { id: string } };
  if (!typedOutcome.ok) {
    await logSecurityEvent("execution_grant_invalid", { workspaceId: body.workspaceId ?? null, projectId: body.projectId ?? null, actorUserId: user.id, requested_permission: body.requestedPermission ?? null, metadata: { reason: typedOutcome.reason, action: body.action } });
    return Response.json({ ok: false, reason: typedOutcome.reason }, { status: 403 });
  }
  return Response.json({ ok: true, authorization: "granted", grantId: typedOutcome.grant?.id });
}
