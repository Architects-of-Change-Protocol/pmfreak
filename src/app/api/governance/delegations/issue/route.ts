import { getAuthUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/workspace-access";
import { issueDelegatedCapability } from "@/aoc/runtime-consumer";
import { denyResponse } from "@/lib/security/deny-response";

const hasCapabilityClaim = (value: unknown): value is { capabilityClaim: unknown } =>
  Boolean(value && typeof value === "object" && "capabilityClaim" in value);

// delegatorRole is always resolved server-side from workspace_memberships for
// the exact workspaceId being delegated against — never trusted from the
// request body. See src/app/api/v1/delegations/route.ts POST for the same
// pattern and rationale.
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: "/api/governance/delegations/issue", message: "Unauthorized", reason: "unauthorized" });
  const body = await request.json();
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return Response.json({ ok: false, error: { code: "workspace_required", message: "workspaceId required" } }, { status: 400 });
  let access: { role: "owner" | "admin" | "pm" | "viewer" };
  try {
    access = await requireWorkspaceRole(workspaceId, "pm");
  } catch {
    return denyResponse({ status: 403, routeId: "/api/governance/delegations/issue", message: "Forbidden", reason: "workspace_membership_required", actorUserId: user.id, workspaceId });
  }
  try {
    const issued = (await issueDelegatedCapability({ ...body, workspaceId, delegatorUserId: user.id, delegatorRole: access.role })) as { delegation: unknown; delegationToken: string; lineage: unknown };
    return Response.json({ ok: true, delegation: issued.delegation, delegationToken: issued.delegationToken, lineage: issued.lineage, capabilityClaim: hasCapabilityClaim(issued) ? issued.capabilityClaim : undefined });
  } catch (error) {
    return denyResponse({ status: 403, routeId: "/api/governance/delegations/issue", message: "Delegation denied.", reason: error instanceof Error ? error.message : "delegation_denied", actorUserId: user.id, workspaceId, projectId: body.projectId ?? null, requestedPermission: body.requestedPermission ?? null, deniedPermission: body.requestedPermission ?? null, eventType: "delegated_capability_broaden_attempt" });
  }
}
