/**
 * PMFreak governance persistence projections.
 *
 * OWNERSHIP: PMFreak. These types describe rows and column vocabularies that
 * PMFreak stores in its own database. They are deliberately NOT named after the
 * canonical Soberania Protocol contracts, because they are not those contracts.
 *
 * Where a canonical concept of the same idea exists in `@aoc/protocol`, it is
 * recorded here as a NO_EQUIVALENCE note rather than silently aliased. See
 * `governance-ownership.lock.json` and
 * `docs/adr/ADR-PMF-075-pmfreak-governance-ownership.md` for the full
 * reasoning behind each decision.
 *
 * The identifier aliases below are the one place where PMFreak genuinely shares
 * the canonical contract, so they are imported from the packaged artifact rather
 * than redeclared.
 */
import type { WorkspaceId, ProjectId, AgentId } from "@aoc/protocol";

export type { WorkspaceId, ProjectId, AgentId };

/**
 * Persisted permission codes.
 *
 * NO_EQUIVALENCE with `@aoc/protocol`.`CapabilityPermission`, which is a
 * namespaced governance vocabulary (`resource:read`, `governance:approve`, …).
 * These bare codes are what PMFreak stores in `capability_requests`,
 * `capability_grants`, `ai_agent_scopes` and `delegations`. No total mapping
 * exists in either direction, so none is provided.
 */
export type CapabilityPermissionCode =
  | "read"
  | "write"
  | "approve"
  | "manage"
  | "execute"
  | "delegate"
  | "delete"
  | "write_memory"
  | "delete_memory"
  | "manage_members"
  | "manage_projects"
  | "manage_workspace"
  | "manage_ai"
  | "manage_billing"
  | "execute_ai_action"
  | "view_executive"
  | "upload_documents";

/**
 * Resource classes PMFreak governs.
 *
 * NO_EQUIVALENCE with `@aoc/protocol`.`CapabilityResourceType`. Only
 * `workspace` and `project` coincide; `operational_memory`, `ai_coprocess`,
 * `copilot` and `governance_object` are PMFreak product resources with no
 * canonical counterpart, and the canonical vocabulary carries members PMFreak
 * does not persist. Not added to Protocol; not coerced onto a canonical member.
 */
export type GovernedResourceType =
  | "workspace"
  | "project"
  | "operational_memory"
  | "governance_object"
  | "ai_coprocess"
  | "copilot";

/**
 * Outcome of a PMFreak policy evaluation.
 *
 * NO_EQUIVALENCE with `@aoc/protocol`.`PolicyDecision` (`allow` | `deny` |
 * `conditional`). `require_approval` is a PMFreak workflow state that routes
 * into `governance_approval_requests` and carries approval semantics the
 * canonical `conditional` does not; `expired` and `no_match` are evaluator
 * outcomes rather than policy verdicts and have no canonical member at all.
 * Collapsing five states onto three would lose those distinctions.
 */
export type PolicyEvaluationOutcome =
  | "allow"
  | "deny"
  | "require_approval"
  | "expired"
  | "no_match";

/** Persisted `capability_requests` row. */
export type CapabilityRequestRecord = {
  id: string;
  workspace_id: WorkspaceId;
  target_resource_type: GovernedResourceType;
  target_resource_id: string;
  requested_permission: CapabilityPermissionCode;
  status: "pending" | "approved" | "denied" | "revoked";
  requester_user_id: string;
  justification: string | null;
  created_at: string;
};

/** Persisted `capability_grants` row. Not a canonical `CapabilityToken`. */
export type CapabilityGrantRecord = {
  id: string;
  workspace_id: WorkspaceId;
  capability_request_id: string;
  permission: CapabilityPermissionCode;
  target_resource_type: GovernedResourceType;
  target_resource_id: string;
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
};

/** Persisted `ai_agent_scopes` row. Not a canonical `readonly string[]` scope. */
export type AgentScopeRecord = {
  id: string;
  agent_id: AgentId;
  workspace_id: WorkspaceId;
  resource_type: GovernedResourceType;
  resource_id: string;
  permission: CapabilityPermissionCode;
  status: "active" | "expired" | "revoked";
  expires_at: string | null;
};

/**
 * Persisted audit row as PMFreak stores and reads it (snake_case, open-ended).
 * Not the canonical camelCase readonly `AuditEventEnvelope`.
 */
export type AuditEventRecord = {
  id?: string;
  created_at: string;
  event_type: string;
  severity?: string | null;
  workspace_id?: string | null;
  actor_user_id?: string | null;
  actor_agent_id?: string | null;
  event_detail?: Record<string, unknown> | null;
  [key: string]: unknown;
};

/**
 * Persisted `delegations` lifecycle row. The canonical `Delegation` is a
 * four-field chain-policy descriptor embedded in a capability token; this is a
 * full delegation lifecycle record. Related layers, different concepts.
 */
export type DelegationRecord = {
  id: string;
  workspace_id: WorkspaceId;
  delegator_actor_type: "human" | "ai_agent";
  delegator_user_id: string | null;
  delegator_agent_id: string | null;
  delegate_actor_type: "human" | "ai_agent";
  delegatee_user_id: string | null;
  delegatee_agent_id: string | null;
  source_capability_grant_id: string | null;
  parent_delegation_id?: string | null;
  resource_type: GovernedResourceType | null;
  resource_id: string | null;
  permission: CapabilityPermissionCode;
  delegated_scope: Record<string, unknown>;
  status: "active" | "expired" | "revoked" | "consumed";
  delegation_depth: number;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  revoked_reason?: string | null;
  metadata?: Record<string, unknown> | null;
};
