/**
 * PMFreak protocol type bridge.
 *
 * Canonical source is @aoc/protocol/contracts.
 * Keep PMFreak imports pointed at this file while migration completes.
 */

export type {
  AgentId,
  AgentScope,
  AuditEventEnvelope as AuditTimelineItem,
  CapabilityGrant,
  CapabilityPermission,
  CapabilityRequest,
  CapabilityResourceType,
  Delegation,
  PolicyDecision,
  ProjectId,
  WorkspaceId,
} from "@pmfreak/aoc-protocol-internal/contracts";

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
