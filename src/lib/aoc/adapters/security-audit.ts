// PMFreak adapter: SecurityAuditPort implementation.
// Maps GovernanceAuditEventType to PMFreak's SecurityEventType and delegates to logSecurityEvent.
import { logSecurityEvent, type SecurityEventType } from "@/lib/security/telemetry";
import type { SecurityAuditPort, GovernanceAuditEventType, GovernanceAuditEventPayload } from "@/lib/governance/authority/ports/security-audit";

const EVENT_MAP: Record<GovernanceAuditEventType, SecurityEventType> = {
  governance_action_allowed: "governance_action_allowed",
  governance_violation: "governance_violation",
  governance_approval_requested: "approval_requested",
  execution_grant_issued: "execution_grant_issued",
  execution_grant_consumed: "execution_grant_consumed",
  execution_grant_replay_attempt: "execution_grant_replay_attempt",
  delegated_capability_issued: "delegated_capability_issued",
  delegated_capability_revoked: "delegated_capability_revoked",
  capability_claim_issued: "capability_claim_issued",
  asymmetric_claim_issued: "asymmetric_claim_issued",
  privileged_client_used: "privileged_client_used",
  project_scope_violation: "project_scope_violation",
  denied_permission: "denied_permission",
  billing_governance_denied: "billing_governance_denied",
  unsafe_agent_attempt: "unsafe_agent_attempt",
  workspace_scope_violation: "workspace_scope_violation",
  suspicious_permission_escalation: "suspicious_permission_escalation",
  approval_requested: "approval_requested",
};

export class PmfreakSecurityAuditAdapter implements SecurityAuditPort {
  async logEvent(event: GovernanceAuditEventType, payload: GovernanceAuditEventPayload = {}): Promise<void> {
    await logSecurityEvent(EVENT_MAP[event], payload);
  }
}
