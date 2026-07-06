import type { AuditEvent, AuditEventType, RecognitionRuntimeContext } from "../domain";
import { hashPayload } from "./deterministic-hash";

export type RecordAuditEventInput = {
  type: AuditEventType;
  trustDomainId: string;
  actorId?: string;
  actionRequestId?: string;
  recognitionDecisionId?: string;
  payload: Record<string, unknown>;
};

export type AuditLedger = {
  recordEvent(input: RecordAuditEventInput): AuditEvent;
  getEventsForTrustDomain(trustDomainId: string): AuditEvent[];
  getEventsForActionRequest(actionRequestId: string): AuditEvent[];
  getAllEvents(): AuditEvent[];
};

export function createAuditLedger(context: RecognitionRuntimeContext): AuditLedger {
  const events: AuditEvent[] = [];
  let previousHash: string | undefined;

  return {
    recordEvent(input) {
      const id = context.ids.nextId("audit-event");
      const timestamp = context.clock.now();

      const hashableBody = {
        id,
        type: input.type,
        trustDomainId: input.trustDomainId,
        actorId: input.actorId,
        actionRequestId: input.actionRequestId,
        recognitionDecisionId: input.recognitionDecisionId,
        timestamp,
        payload: input.payload,
        previousHash,
      };

      const event: AuditEvent = {
        ...hashableBody,
        eventHash: hashPayload(hashableBody),
      };

      events.push(event);
      previousHash = event.eventHash;
      return event;
    },

    getEventsForTrustDomain(trustDomainId) {
      return events.filter((event) => event.trustDomainId === trustDomainId);
    },

    getEventsForActionRequest(actionRequestId) {
      return events.filter((event) => event.actionRequestId === actionRequestId);
    },

    getAllEvents() {
      return [...events];
    },
  };
}
