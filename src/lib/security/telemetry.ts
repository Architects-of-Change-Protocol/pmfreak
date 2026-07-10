import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";

export type SecurityEventType =
  | "governance_action_allowed"
  | "auth_denied"
  | "workspace_scope_violation"
  | "project_scope_violation"
  | "privileged_client_used"
  | "suspicious_cross_scope_attempt"
  | "revoked_membership_attempt"
  | "orphan_access_attempt"
  | "suspicious_permission_escalation"
  | "revoked_agent_access"
  | "governance_violation"
  | "denied_permission"
  | "invalid_attestation"
  | "expired_attestation"
  | "malformed_attestation"
  | "unsafe_agent_attempt"
  | "external_scope_violation"
  | "billing_governance_denied"
  | "approval_requested"
  | "approval_approved"
  | "approval_rejected"
  | "approval_expired"
  | "approval_execution_attempted"
  | "approval_execution_blocked"

  | "execution_grant_issued"
  | "execution_grant_consumed"
  | "execution_grant_expired"
  | "execution_grant_revoked"
  | "execution_grant_invalid"
  | "execution_grant_replay_attempt"
  | "execution_grant_scope_mismatch"
  | "delegated_capability_issued"
  | "delegated_capability_consumed"
  | "delegated_capability_revoked"
  | "delegated_capability_expired"
  | "delegated_capability_invalid"
  | "delegated_capability_replay_attempt"
  | "delegated_capability_scope_mismatch"
  | "delegated_capability_depth_exceeded"
  | "delegated_capability_broaden_attempt"
  | "capability_claim_issued"
  | "capability_claim_verified"
  | "capability_claim_invalid"
  | "capability_claim_expired"
  | "capability_claim_scope_mismatch"
  | "capability_claim_signature_invalid"
  | "capability_claim_lineage_invalid"
  | "trust_domain_registered"
  | "trust_domain_suspended"
  | "trust_domain_revoked"
  | "signing_key_rotated"
  | "signing_key_revoked"
  | "verifier_policy_created"
  | "verifier_policy_denied"
  | "federated_claim_verified"
  | "federated_claim_rejected"
  | "federated_claim_untrusted_issuer"
  | "federated_claim_revoked_key"
  | "federated_claim_expired_key"
  | "trust_metadata_requested"
  | "trust_keys_requested"
  | "trust_handshake_requested"
  | "trust_handshake_approved"
  | "trust_handshake_rejected"
  | "trust_handshake_revoked"
  | "trust_handshake_validated"
  | "trust_handshake_invalid"
  | "external_verifier_verified_claim"
  | "external_verifier_rejected_claim"
  | "asymmetric_key_registered"
  | "asymmetric_key_rotated"
  | "asymmetric_key_revoked"
  | "asymmetric_claim_issued"
  | "independent_claim_verified"
  | "independent_claim_rejected"
  | "independent_verifier_metadata_fetched"
  | "independent_verifier_keys_fetched"
  | "trust_event_created"
  | "trust_event_signed"
  | "trust_event_verified"
  | "trust_event_imported"
  | "trust_event_rejected"
  | "revocation_registered"
  | "revocation_applied"
  | "trust_graph_edge_created"
  | "trust_graph_edge_revoked"
  | "issuer_distrust_propagated"
  | "trust_anchor_created"
  | "trust_anchor_rotated"
  | "trust_anchor_revoked"
  | "verifier_handshake_started"
  | "verifier_handshake_succeeded"
  | "verifier_handshake_failed"
  | "replay_attack_detected"
  | "replay_detected"
  | "stale_event_detected"
  | "event_quarantined"
  | "quarantine_approved"
  | "quarantine_rejected"
  | "trust_policy_revoked"
  | "invalid_sequence_detected"
  | "verifier_trust_updated"
  | "verification_snapshot_created"
  | "verification_receipt_signed"
  | "verification_receipt_verified"
  | "deterministic_evaluation_completed"
  | "verifier_divergence_detected"
  | "forensic_replay_executed"
  | "canonicalization_failed"
  | "state_hash_generated"
  | "replay_diff_detected"

  // Perilla 9 — abuse protection (rate limit / cooldown denials).
  | "abuse_rate_limited"
;

type SecurityEventPayload = {
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

const scrubMetadata = (metadata: Record<string, unknown> = {}) => {
  const redactedKeys = ["token", "secret", "password", "authorization", "cookie", "rawDocument", "content"];
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !redactedKeys.some((blocked) => key.toLowerCase().includes(blocked))));
};

export async function logSecurityEvent(event: SecurityEventType, payload: SecurityEventPayload = {}) {
  const metadata = scrubMetadata(payload.metadata ?? {});
  console.warn("[security]", { event, timestamp: new Date().toISOString(), ...payload, metadata });

  try {
    // PRIVILEGED_ACCESS: Security events must be recorded even when the user session is invalid; RLS on security_events must not be bypassable by the actor being logged.
    // AUDIT_REF: service-role-risk-register.md
    const supabase = createPrivilegedSupabaseClient({ routeId: "security.telemetry", operation: "insert_security_event", reason: "persist_security_audit", systemActor: "security_telemetry", allowTelemetryRecursionBypass: true, workspaceId: payload.workspaceId ?? null, actorUserId: payload.actorUserId ?? null });
    await supabase.from("security_events").insert({
      workspace_id: payload.workspaceId ?? null,
      project_id: payload.projectId ?? null,
      actor_user_id: payload.actorUserId ?? null,
      actor_agent_id: payload.actorAgentId ?? null,
      actor_role: payload.actorRole ?? null,
      event_type: event,
      route_id: payload.routeId ?? null,
      requested_permission: payload.requested_permission ?? null,
      denied_permission: payload.denied_permission ?? null,
      resource_type: payload.resourceType ?? null,
      resource_id: payload.resourceId ?? null,
      metadata,
    });
  } catch (error) {
    console.error("[security] failed_to_persist_event", error);
  }
}
