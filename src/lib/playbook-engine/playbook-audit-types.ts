/**
 * Audit Trail (Sprint 7) — pure event-mapping layer over every other Playbook Engine module.
 * A `PlaybookAuditEvent` is a governed, explainable *record of what the engine evaluated or
 * generated*, never a record of an action taken: nothing in this module persists, emits a real
 * platform event, or triggers a side effect. See `playbook-audit-engine.ts` for the pure
 * constructors and `playbook-audit-mappers.ts` for the (also pure) mapping toward
 * `platform-events`.
 */

/** Who/what an audit event attributes an evaluation/generation to. Distinct from
 * `PlatformEventActorType` (`../platform-events/types.ts`), which has its own `ai_agent` /
 * `integration` vocabulary — this type stays intentionally small since the Playbook Engine
 * itself only ever acts as the system or as the AI reasoning within it; a human actor is only
 * ever recorded when the caller explicitly attributes an event to one (e.g. a manually
 * triggered re-evaluation). */
export type PlaybookAuditActorType = "system" | "ai" | "user";

export type PlaybookAuditActor = {
  type: PlaybookAuditActorType;
  id?: string | null;
};

/** What kind of Playbook Engine artifact an audit event is about. */
export type PlaybookAuditRelatedEntityType =
  | "rules_evaluation"
  | "project_constitution_draft"
  | "recommendation"
  | "communication_draft"
  | "operational_draft"
  | "closure_billing_assessment"
  | "closure_billing_blocker"
  | "closure_billing_next_action"
  | "governance_snapshot";

/** Every event type the Audit Trail knows how to record. One entry per Playbook Engine module
 * (Sprints 1-6) plus the Sprint 7 governance snapshot itself — never invented for a module that
 * doesn't exist yet. */
export type PlaybookAuditEventType =
  | "playbook_rules_evaluated"
  | "project_constitution_draft_generated"
  | "recommendation_generated"
  | "recommendation_state_changed"
  | "communication_draft_generated"
  | "communication_draft_state_changed"
  | "operational_draft_generated"
  | "operational_draft_state_changed"
  | "closure_billing_assessment_generated"
  | "closure_billing_blocker_detected"
  | "closure_billing_next_action_recommended"
  | "governance_snapshot_generated";

/** Reuses the Rules Engine's severity scale (Sprint 1) plus a neutral `"info"` level for purely
 * informational events (e.g. a rules evaluation where nothing fired). */
export type PlaybookAuditSeverity = "info" | "low" | "medium" | "high" | "critical";

export type PlaybookAuditExplanation = {
  summary: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  approvalRequired: boolean;
  /** The governed sentence confirming this audit event only records an evaluation/generation,
   * never an executed action. */
  narrative: string;
};

export type PlaybookAuditEvent = {
  /** Deterministic sha256 of (workspaceId, projectId, eventType, relatedEntityType,
   * relatedEntityId) — identical inputs always yield the same id/fingerprint, mirroring every
   * other Playbook Engine fingerprint (Sprints 3-6). */
  id: string;
  fingerprint: string;
  workspaceId: string;
  projectId: string;
  eventType: PlaybookAuditEventType;
  actorType: PlaybookAuditActorType;
  actorId: string | null;
  relatedEntityType: PlaybookAuditRelatedEntityType;
  relatedEntityId: string;
  summary: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  approvalRequired: boolean;
  severity: PlaybookAuditSeverity;
  metadata: Record<string, unknown>;
  explanation: PlaybookAuditExplanation;
  createdAt: string;
};

export type CreatePlaybookAuditEventInput = {
  workspaceId: string;
  projectId: string;
  eventType: PlaybookAuditEventType;
  actorType: PlaybookAuditActorType;
  actorId?: string | null;
  relatedEntityType: PlaybookAuditRelatedEntityType;
  relatedEntityId: string;
  summary: string;
  evidenceUsed?: string[];
  missingEvidence?: string[];
  approvalRequired?: boolean;
  severity?: PlaybookAuditSeverity;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};
