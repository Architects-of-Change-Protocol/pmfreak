// PMFreak port: governance audit emission.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// No public upstream export. GovernanceAuditEventType below is PMFreak's PERSISTED
// audit vocabulary — the member strings are written to the audit store and must not
// change.

export type GovernanceAuditEventType =
  | "governance_action_allowed"
  | "governance_violation"
  | "governance_approval_requested"
  | "execution_grant_issued"
  | "execution_grant_consumed"
  | "execution_grant_replay_attempt"
  | "delegated_capability_issued"
  | "delegated_capability_revoked"
  | "capability_claim_issued"
  | "asymmetric_claim_issued"
  | "privileged_client_used"
  // denial/scope events referenced by the governance policy registry
  | "project_scope_violation"
  | "denied_permission"
  | "billing_governance_denied"
  | "unsafe_agent_attempt"
  | "workspace_scope_violation"
  | "suspicious_permission_escalation"
  | "approval_requested";

export type GovernanceAuditEventPayload = {
  workspaceId?: string | null;
  projectId?: string | null;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  actorRole?: string | null;
  routeId?: string | null;
  requested_permission?: string | null;
  denied_permission?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface SecurityAuditPort {
  logEvent(event: GovernanceAuditEventType, payload?: GovernanceAuditEventPayload): Promise<void>;
}
