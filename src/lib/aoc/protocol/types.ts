/**
 * PMFreak governance type bridge for product and API code.
 *
 * OWNERSHIP: PMFreak. Everything re-exported here is a PMFreak-owned
 * persistence projection defined in
 * `@/lib/governance/authority/persistence/records`, except the three
 * identifier aliases, which are the canonical `@aoc/protocol` contracts.
 *
 * This file deliberately does NOT re-export any PMFreak type under a canonical
 * Protocol name. Where PMFreak's concept differs from the canonical one, the
 * difference is recorded as NO_EQUIVALENCE at the definition site.
 */

// Canonical upstream contracts — identical on both sides (`= string`).
export type { WorkspaceId, ProjectId, AgentId } from "@aoc/protocol";

// PMFreak-owned persistence projections.
export type {
  AgentScopeRecord,
  AuditEventRecord,
  CapabilityGrantRecord,
  CapabilityPermissionCode,
  CapabilityRequestRecord,
  GovernedResourceType,
  DelegationRecord,
  PolicyEvaluationOutcome,
} from "@/lib/governance/authority/persistence/records";

/**
 * API-layer name for a persisted audit row rendered into a timeline.
 * Retained because it is PMFreak's own long-standing presentation vocabulary.
 */
export type { AuditEventRecord as AuditTimelineItem } from "@/lib/governance/authority/persistence/records";

// TODO(aoc-migration): replace compatibility consumers that still expect policy entity shape.
export type Policy = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  resource_type: string;
  permission: string;
  effect: "allow" | "deny" | "require_approval";
  enabled: boolean;
  priority: number;
  conditions: Record<string, unknown> | null;
};

// TODO(aoc-migration): replace compatibility consumers that still expect agent entity shape.
export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  status: "active" | "disabled" | "revoked";
  agent_type: string;
  risk_level: "low" | "medium" | "high";
  created_at?: string;
};
