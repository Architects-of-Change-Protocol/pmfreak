import type { AuthorityGovernanceEventType } from "@/lib/platform-events/types";
import type {
  AuthorityType,
  AuthorityScope,
  AuthorityStatus,
  DelegationStatus,
  GovernanceViolationType,
  GovernanceViolationSeverity,
  GovernanceViolationStatus,
  EscalationTriggerType,
  EscalationTarget,
  EscalationStatus,
} from "@/lib/db/database-contract";

export type {
  AuthorityType,
  AuthorityScope,
  AuthorityStatus,
  DelegationStatus,
  GovernanceViolationType,
  GovernanceViolationSeverity,
  GovernanceViolationStatus,
  EscalationTriggerType,
  EscalationTarget,
  EscalationStatus,
};

export type AuthorityResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

// ─── Authority Registration ──────────────────────────────────────────────────

export type AuthorityRegistrationRecord = {
  id: string;
  workspace_id: string;
  actor_id: string;
  authority_type: AuthorityType;
  authority_scope: AuthorityScope;
  project_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: AuthorityStatus;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  granted_by: string;
  created_at: string;
  updated_at: string;
};

export type RegisterAuthorityInput = {
  workspaceId: string;
  actorId: string;
  authorityType: AuthorityType;
  authorityScope: AuthorityScope;
  projectId?: string | null;
  validFrom?: string;
  validUntil?: string | null;
  grantedBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type RevokeAuthorityInput = {
  workspaceId: string;
  registrationId: string;
  revokedBy: string;
  revocationReason?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type CheckAuthorityInput = {
  workspaceId: string;
  actorId: string;
  authorityType: AuthorityType;
  projectId?: string | null;
  atTime?: string;
};

// ─── Authority Delegation ────────────────────────────────────────────────────

export type AuthorityDelegationRecord = {
  id: string;
  workspace_id: string;
  delegator_id: string;
  delegator_authority: AuthorityType;
  delegate_id: string;
  delegate_authority: AuthorityType;
  project_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: DelegationStatus;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  delegation_depth: number;
  parent_delegation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateDelegationInput = {
  workspaceId: string;
  delegatorId: string;
  delegatorAuthority: AuthorityType;
  delegateId: string;
  delegateAuthority: AuthorityType;
  projectId?: string | null;
  validFrom?: string;
  validUntil?: string | null;
  parentDelegationId?: string | null;
  createdBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type RevokeDelegationInput = {
  workspaceId: string;
  delegationId: string;
  revokedBy: string;
  revocationReason?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

// ─── Accountability Chain ────────────────────────────────────────────────────

export type AccountabilityChainNode = {
  actorId: string;
  authorityType: AuthorityType;
  basis: "direct_registration" | "delegation";
  validFrom: string;
  validUntil: string | null;
  delegationId: string | null;
  delegatedBy: string | null;
  delegatedByAuthority: AuthorityType | null;
  depth: number;
};

export type AccountabilityChain = {
  decisionId: string;
  decisionTitle: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approverAuthority: AuthorityType | null;
  chain: AccountabilityChainNode[];
  rootAuthority: AuthorityType | null;
  builtAt: string;
};

export type BuildAccountabilityChainInput = {
  workspaceId: string;
  decisionId: string;
  actorId: string;
  claimedAuthority: AuthorityType;
  projectId?: string | null;
};

// ─── Governance Violations ───────────────────────────────────────────────────

export type GovernanceViolationRecord = {
  id: string;
  workspace_id: string;
  violation_type: GovernanceViolationType;
  action_type: string;
  action_entity_type: string;
  action_entity_id: string;
  actor_id: string;
  actor_authority: string | null;
  required_authority: string | null;
  authority_id: string | null;
  severity: GovernanceViolationSeverity;
  status: GovernanceViolationStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  detected_at: string;
  created_at: string;
  updated_at: string;
};

export type DetectViolationInput = {
  workspaceId: string;
  violationType: GovernanceViolationType;
  actionType: string;
  actionEntityType: string;
  actionEntityId: string;
  actorId: string;
  actorAuthority?: string | null;
  requiredAuthority?: string | null;
  authorityId?: string | null;
  severity?: GovernanceViolationSeverity;
  correlationId?: string | null;
  causationId?: string | null;
};

export type ResolveViolationInput = {
  workspaceId: string;
  violationId: string;
  resolvedBy: string;
  resolutionNotes?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type AuthorityCheckContext = {
  workspaceId: string;
  actorId: string;
  claimedAuthority: AuthorityType;
  actionType: string;
  actionEntityType: string;
  actionEntityId: string;
  projectId?: string | null;
  atTime?: string;
};

export type ViolationCheckResult = {
  authorized: boolean;
  violationType: GovernanceViolationType | null;
  reason: string;
  authorityRegistration: AuthorityRegistrationRecord | null;
};

// ─── Escalation ──────────────────────────────────────────────────────────────

export type AuthorityEscalationRecord = {
  id: string;
  workspace_id: string;
  trigger_type: EscalationTriggerType;
  action_entity_type: string;
  action_entity_id: string;
  action_type: string;
  required_authority: string;
  escalated_to: EscalationTarget;
  escalated_by: string;
  status: EscalationStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  violation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEscalationInput = {
  workspaceId: string;
  triggerType: EscalationTriggerType;
  actionEntityType: string;
  actionEntityId: string;
  actionType: string;
  requiredAuthority: string;
  escalatedTo?: EscalationTarget;
  escalatedBy: string;
  violationId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type ResolveEscalationInput = {
  workspaceId: string;
  escalationId: string;
  resolution: string;
  resolvedBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};

// ─── Explain ─────────────────────────────────────────────────────────────────

export type AuthorityGovernanceEventName = AuthorityGovernanceEventType;

export type AuthorityGovernanceExplanation = {
  overview: string;
  authorityTypes: AuthorityType[];
  authorityScopes: AuthorityScope[];
  delegationChain: string[];
  violationTypes: GovernanceViolationType[];
  escalationTargets: EscalationTarget[];
  governanceRules: string[];
  auditEvents: AuthorityGovernanceEventName[];
};
