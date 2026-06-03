import { getAuthUser } from "@/lib/auth";
import { requireGovernancePermission } from "@/aoc/runtime-consumer";
import { issueExecutionGrant } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(); if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: req } = await supabase.from("governance_approval_requests").select("*").eq("id", id).maybeSingle();
  if (!req) return Response.json({ error: "Not found" }, { status: 404 });
  await requireGovernancePermission(req.workspace_id, "manage_workspace");
  if (req.status !== "pending_approval") return Response.json({ error: "Already resolved" }, { status: 409 });
  if (req.expires_at && new Date(req.expires_at).getTime() < Date.now()) return Response.json({ error: "Expired" }, { status: 409 });
  await supabase.from("governance_approval_requests").update({ status: "approved", resolved_at: new Date().toISOString(), resolved_by_user_id: user.id }).eq("id", id);
  const issuance = await issueExecutionGrant({ approvalRequestId: req.id, decisionId: req.decision_id, workspaceId: req.workspace_id, projectId: req.project_id, actorUserId: req.actor_user_id, actorAgentId: req.actor_agent_id, action: req.action, requestedPermission: req.requested_permission, issuedByUserId: user.id, resourceType: req.resource_type, resourceId: req.resource_id }) as { grant: { id: string; expires_at: string | null }; grantToken: string; capabilityClaim: unknown };
  await logSecurityEvent("approval_approved", { workspaceId: req.workspace_id, projectId: req.project_id, actorUserId: req.actor_user_id, actorAgentId: req.actor_agent_id, requested_permission: req.requested_permission, metadata: { decisionId: req.decision_id, approvalRequestId: req.id, reviewerUserId: user.id, action: req.action, status: "approved", grantId: issuance.grant.id } });
  return Response.json({ ok: true, grant: { id: issuance.grant.id, expiresAt: issuance.grant.expires_at }, grantToken: issuance.grantToken, capabilityClaim: issuance.capabilityClaim });
}
