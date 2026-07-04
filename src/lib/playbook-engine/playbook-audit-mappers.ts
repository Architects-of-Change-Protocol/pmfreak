import type { CreatePlatformEventInput, PlatformEventActorType, PlatformEventCategory, PlatformEventSource } from "../platform-events/types";
import type { PlaybookAuditActorType, PlaybookAuditEvent, PlaybookAuditEventType } from "./playbook-audit-types";

/**
 * Maps a `PlaybookAuditEventType` to the `platform_events` category it fits best under.
 * `platform-events/types.ts` (Sprint... pre-existing) has no dedicated "playbook"/"communication"
 * category, so this mirrors the closest existing semantics: recommendation lifecycle events use
 * the existing `"recommendation"` category, everything else — rule evaluations, drafts,
 * closure/billing assessments, the governance snapshot itself — is recorded as `"governance"`,
 * consistent with how `domain-events.ts` already records constitution/decision lifecycle events.
 */
const EVENT_TYPE_TO_CATEGORY: Record<PlaybookAuditEventType, PlatformEventCategory> = {
  playbook_rules_evaluated: "governance",
  project_constitution_draft_generated: "governance",
  recommendation_generated: "recommendation",
  recommendation_state_changed: "recommendation",
  communication_draft_generated: "governance",
  communication_draft_state_changed: "governance",
  operational_draft_generated: "governance",
  operational_draft_state_changed: "governance",
  closure_billing_assessment_generated: "governance",
  closure_billing_blocker_detected: "governance",
  closure_billing_next_action_recommended: "governance",
  governance_snapshot_generated: "governance",
};

const ACTOR_TYPE_TO_PLATFORM_ACTOR_TYPE: Record<PlaybookAuditActorType, PlatformEventActorType> = {
  system: "system",
  ai: "ai_agent",
  user: "user",
};

const ACTOR_TYPE_TO_PLATFORM_SOURCE: Record<PlaybookAuditActorType, PlatformEventSource> = {
  system: "system",
  ai: "ai_agent",
  user: "user_action",
};

function platformEventTypeFor(eventType: PlaybookAuditEventType): string {
  const upper = eventType.toUpperCase();
  return upper.startsWith("PLAYBOOK_") ? upper : `PLAYBOOK_${upper}`;
}

/**
 * Maps a `PlaybookAuditEvent` to the input shape `createPlatformEvent` (`../platform-events`)
 * would need to actually record it as a real governance event. Pure — never calls
 * `createPlatformEvent`, never touches Supabase, never persists anything. The caller decides
 * if/when to actually materialize this into `platform_events` (not yet wired up for the MVP —
 * see `docs/playbook-engine-foundation.md`, "Future work").
 *
 * `learningEligible` is always `false`: nothing here has gone through human decision/outcome
 * yet, so it is not (yet) eligible input for the organizational learning loop.
 * `rawReferenceTable`/`rawReferenceId` stay `null`: no real `playbook_audit_events` table backs
 * this event, only the in-memory `PlaybookAuditEvent` itself.
 */
export function playbookAuditEventToPlatformEventInput(event: PlaybookAuditEvent): CreatePlatformEventInput {
  return {
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    actorId: event.actorId,
    actorType: ACTOR_TYPE_TO_PLATFORM_ACTOR_TYPE[event.actorType],
    eventType: platformEventTypeFor(event.eventType),
    eventCategory: EVENT_TYPE_TO_CATEGORY[event.eventType],
    eventPayload: {
      related_entity_type: event.relatedEntityType,
      related_entity_id: event.relatedEntityId,
      summary: event.summary,
      evidence_used_count: event.evidenceUsed.length,
      missing_evidence_count: event.missingEvidence.length,
      approval_required: event.approvalRequired,
      severity: event.severity,
    },
    source: ACTOR_TYPE_TO_PLATFORM_SOURCE[event.actorType],
    visibility: "workspace",
    sensitivityLevel: "internal",
    learningEligible: false,
    rawReferenceTable: null,
    rawReferenceId: null,
    metadata: { playbookAuditEventFingerprint: event.fingerprint, ...event.metadata },
    occurredAt: event.createdAt,
  };
}
