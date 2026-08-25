// PMFreak adapter: PolicyEvaluatorPort implementation.
// Contains the full policy evaluation pipeline (formerly in src/aoc/enterprise/runtime/policy-engine.ts).
// This code depends on PMFreak's Supabase client, auth context, RBAC, and workspace membership —
// all of which are PMFreak vertical concerns that belong here, not in AOC protocol/enterprise code.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Permission } from "@/lib/security/rbac";
import { requireWorkspaceMembership } from "@/lib/security/access-guards";
import type { CapabilityFlowPermission, CapabilityFlowResourceType } from "@/lib/security/capability-flow";
import type {
  PolicyEvaluatorPort,
  PolicyEvaluationOutcome,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
} from "@/lib/governance/authority/ports/policy-evaluation";

type PolicyRow = { id: string; effect: "allow" | "deny" | "require_approval"; conditions: Record<string, unknown>; priority: number };
type GrantRow = { id: string; status: string; expires_at: string | null; target_resource_type: CapabilityFlowResourceType; target_resource_id: string; permission: CapabilityFlowPermission; scope: Record<string, unknown> | null };

function withinBusinessHours(now = new Date()) { const h = now.getUTCHours(); return h >= 13 && h <= 22; }

function validateScope(grant: GrantRow, input: PolicyEvaluationInput) {
  if (grant.target_resource_type !== input.resourceType || grant.target_resource_id !== input.resourceId || grant.permission !== input.permission) return false;
  const scope = grant.scope ?? {};
  if (scope.workspaceId && scope.workspaceId !== input.workspaceId) return false;
  if (scope.targetResourceId && scope.targetResourceId !== input.resourceId) return false;
  if (scope.permission && scope.permission !== input.permission) return false;
  return true;
}

function matchesConditions(policy: PolicyRow, input: PolicyEvaluationInput, role: string) {
  const c = policy.conditions ?? {};
  if (Array.isArray(c.allowedRoles) && c.allowedRoles.length > 0 && !c.allowedRoles.includes(role)) return false;
  if (Array.isArray(c.deniedResourceIds) && c.deniedResourceIds.includes(input.resourceId)) return false;
  if (Array.isArray(c.allowedResourceIds) && c.allowedResourceIds.length > 0 && !c.allowedResourceIds.includes(input.resourceId)) return false;
  if (c.justificationRequired === true && !input.justification?.trim()) return false;
  if (typeof c.maxDurationHours === "number" && typeof input.requestedDurationHours === "number" && input.requestedDurationHours > c.maxDurationHours) return false;
  if (c.businessHoursOnly === true && !withinBusinessHours()) return false;
  return true;
}

async function auditPolicy(result: PolicyEvaluationResult, eventType: "policy_evaluated" | "policy_allowed" | "policy_denied" | "policy_required_approval" | "policy_expired_grant" | "policy_scope_mismatch") {
  if (!result.workspaceId) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("capability_audit_events").insert({ workspace_id: result.workspaceId, actor_user_id: result.actorUserId, grant_id: result.matchedGrantId ?? null, event_type: eventType, event_detail: { decision: result.decision, reason: result.reason, resourceType: result.resourceType, resourceId: result.resourceId, permission: result.permission, matchedPolicyIds: result.matchedPolicyIds, actorType: result.actorType } });
}

export async function evaluatePolicyDecision(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
  const actorId = input.actor.actorId;
  const actorType = input.actor.actorType;
  const evaluatedAt = new Date().toISOString();

  if (!input.workspaceId) {
    return { decision: "deny", reason: "workspace_context_missing", matchedPolicyIds: [], actorUserId: actorId, actorType, workspaceId: null, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
  }

  let membershipRole = input.actor.roles?.[0] ?? "member";
  if (actorType === "user") {
    const membership = await requireWorkspaceMembership(input.workspaceId);
    membershipRole = membership.role;
  }

  const supabase = await createSupabaseServerClient();

  const { data: policiesData } = await supabase.from("capability_policies").select("id,effect,conditions,priority").eq("workspace_id", input.workspaceId).eq("resource_type", input.resourceType).eq("permission", input.permission).eq("enabled", true).order("priority", { ascending: true });
  const policies = (policiesData ?? []) as PolicyRow[];

  const grants: GrantRow[] = [];
  if (actorType === "user") {
    const { data: grantsData } = await supabase.from("capability_grants").select("id,status,expires_at,target_resource_type,target_resource_id,permission,scope").eq("workspace_id", input.workspaceId).eq("granted_user_id", actorId).eq("status", "active");
    grants.push(...((grantsData ?? []) as GrantRow[]));
  }

  const nowIso = new Date().toISOString();
  const expiredGrant = grants.find((g) => g.expires_at && g.expires_at <= nowIso);

  const denyPolicies = policies.filter((p) => p.effect === "deny" && matchesConditions(p, input, membershipRole));
  if (denyPolicies.length > 0) {
    const result: PolicyEvaluationResult = { decision: "deny", reason: "explicit_deny_policy", matchedPolicyIds: denyPolicies.map((p) => p.id), actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_denied");
    return result;
  }

  if (expiredGrant) {
    await supabase.from("capability_grants").update({ status: "expired" }).eq("id", expiredGrant.id).eq("status", "active");
    const result: PolicyEvaluationResult = { decision: "expired", reason: "expired_grant", matchedPolicyIds: [], matchedGrantId: expiredGrant.id, actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_expired_grant");
    return result;
  }

  if (input.rbacAllowed) {
    const result: PolicyEvaluationResult = { decision: "allow", reason: "rbac_allowed", matchedPolicyIds: [], actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_allowed");
    return result;
  }

  const scopedGrant = grants.find((g) => validateScope(g, input) && (!g.expires_at || g.expires_at > nowIso));
  if (scopedGrant) {
    const result: PolicyEvaluationResult = { decision: "allow", reason: "scoped_capability_grant", matchedPolicyIds: [], matchedGrantId: scopedGrant.id, actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_allowed");
    return result;
  }

  if (grants.length > 0 && !scopedGrant) {
    const result: PolicyEvaluationResult = { decision: "deny", reason: "grant_scope_mismatch", matchedPolicyIds: [], actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_scope_mismatch");
    return result;
  }

  const requireApproval = policies.filter((p) => p.effect === "require_approval" && matchesConditions(p, input, membershipRole));
  if (requireApproval.length > 0) {
    const result: PolicyEvaluationResult = { decision: "require_approval", reason: "policy_requires_approval", matchedPolicyIds: requireApproval.map((p) => p.id), actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_required_approval");
    return result;
  }

  const allowPolicies = policies.filter((p) => p.effect === "allow" && matchesConditions(p, input, membershipRole));
  if (allowPolicies.length > 0) {
    const result: PolicyEvaluationResult = { decision: "allow", reason: "explicit_allow_policy", matchedPolicyIds: allowPolicies.map((p) => p.id), actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
    await auditPolicy(result, "policy_allowed");
    return result;
  }

  const result: PolicyEvaluationResult = { decision: "deny", reason: "no_matching_policy", matchedPolicyIds: [], actorUserId: actorId, actorType, workspaceId: input.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, permission: input.permission, evaluatedAt };
  await auditPolicy(result, "policy_denied");
  await auditPolicy(result, "policy_evaluated");
  return result;
}

export class PmfreakPolicyEvaluatorAdapter implements PolicyEvaluatorPort {
  evaluatePolicyDecision(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
    return evaluatePolicyDecision(input);
  }
}
