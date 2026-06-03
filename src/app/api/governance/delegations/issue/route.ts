import { getAuthUser } from "@/lib/auth";
import { issueDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

const hasCapabilityClaim = (value: unknown): value is { capabilityClaim: unknown } =>
  Boolean(value && typeof value === "object" && "capabilityClaim" in value);

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/delegations/issue", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  try {
    const issued = await issueDelegatedCapability({ ...body, delegatorUserId: user.id }) as { delegation: unknown; delegationToken: string; lineage: unknown };
    return Response.json({ ok: true, delegation: issued.delegation, delegationToken: issued.delegationToken, lineage: issued.lineage, capabilityClaim: hasCapabilityClaim(issued) ? issued.capabilityClaim : undefined });
  } catch (error) {
    return denyResponse({ status: 403, routeId: "/api/governance/delegations/issue", message: "Delegation denied.", reason: error instanceof Error ? error.message : "delegation_denied", actorUserId: user.id, workspaceId: body.workspaceId ?? null, projectId: body.projectId ?? null, requestedPermission: body.requestedPermission ?? null, deniedPermission: body.requestedPermission ?? null, eventType: "delegated_capability_broaden_attempt" });
  }
}
