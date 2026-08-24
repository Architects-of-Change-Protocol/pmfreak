import type { AgentId, WorkspaceId } from "@/lib/aoc/protocol/types";

export type {
  Agent,
  AgentScopeRecord,
  AuditTimelineItem,
  CapabilityGrantRecord,
  CapabilityPermissionCode,
  CapabilityRequestRecord,
  GovernedResourceType,
  DelegationRecord,
  Policy,
  PolicyEvaluationOutcome,
  ProjectId,
  WorkspaceId,
  AgentId,
} from "@/lib/aoc/protocol/types";

export type AocClientConfig = {
  baseUrl: string;
  token?: string;
  apiKey?: string;
  workspaceId?: WorkspaceId;
  agentId?: AgentId;
  delegationToken?: string;
  executionGrant?: string;
  agentToken?: string;
  fetch?: typeof globalThis.fetch;
};
