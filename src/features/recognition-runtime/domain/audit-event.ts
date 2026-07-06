// AOC Recognition Runtime — deterministic AuditEvent domain model

export type AuditEventType =
  | "actor_registered"
  | "actor_suspended"
  | "actor_revoked"
  | "trust_domain_created"
  | "passport_issued"
  | "passport_suspended"
  | "passport_revoked"
  | "capability_token_issued"
  | "capability_token_revoked"
  | "action_request_verified";

export type AuditEvent = {
  id: string;

  type: AuditEventType;

  trustDomainId: string;

  actorId?: string;
  actionRequestId?: string;
  recognitionDecisionId?: string;

  timestamp: string;

  payload: Record<string, unknown>;

  previousHash?: string;
  eventHash: string;
};
