import test from "node:test";
import assert from "node:assert/strict";

import { createAuditLedger } from "../src/features/recognition-runtime/services/audit-ledger";
import { createDeterministicContext } from "../src/features/recognition-runtime/fixtures/deterministic-context";

test("recordEvent stamps a deterministic id, timestamp and hash", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  const event = ledger.recordEvent({ type: "trust_domain_created", trustDomainId: "td-1", payload: { name: "Datasys" } });
  assert.equal(event.id, "audit-event-0001");
  assert.equal(event.trustDomainId, "td-1");
  assert.equal(typeof event.eventHash, "string");
  assert.equal(event.eventHash.length, 64);
});

test("same logical inputs produce the same event hash", () => {
  const ledgerA = createAuditLedger(createDeterministicContext());
  const ledgerB = createAuditLedger(createDeterministicContext());
  const eventA = ledgerA.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: { actorType: "human" } });
  const eventB = ledgerB.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: { actorType: "human" } });
  assert.equal(eventA.eventHash, eventB.eventHash);
});

test("changing the payload changes the event hash", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  const event1 = ledger.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: { actorType: "human" } });
  const ledger2 = createAuditLedger(createDeterministicContext());
  const event2 = ledger2.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: { actorType: "agent" } });
  assert.notEqual(event1.eventHash, event2.eventHash);
});

test("ledger maintains a previousHash/eventHash chain", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  const first = ledger.recordEvent({ type: "trust_domain_created", trustDomainId: "td-1", payload: {} });
  const second = ledger.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: {} });
  assert.equal(first.previousHash, undefined);
  assert.equal(second.previousHash, first.eventHash);
});

test("getEventsForTrustDomain filters correctly", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  ledger.recordEvent({ type: "trust_domain_created", trustDomainId: "td-1", payload: {} });
  ledger.recordEvent({ type: "trust_domain_created", trustDomainId: "td-2", payload: {} });
  assert.equal(ledger.getEventsForTrustDomain("td-1").length, 1);
});

test("getEventsForActionRequest returns only events for that action request", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  ledger.recordEvent({ type: "action_request_verified", trustDomainId: "td-1", actionRequestId: "ar-1", payload: {} });
  ledger.recordEvent({ type: "action_request_verified", trustDomainId: "td-1", actionRequestId: "ar-2", payload: {} });
  const trail = ledger.getEventsForActionRequest("ar-1");
  assert.equal(trail.length, 1);
  assert.equal(trail[0].actionRequestId, "ar-1");
});

test("getAllEvents returns every recorded event in order", () => {
  const ledger = createAuditLedger(createDeterministicContext());
  ledger.recordEvent({ type: "trust_domain_created", trustDomainId: "td-1", payload: {} });
  ledger.recordEvent({ type: "actor_registered", trustDomainId: "td-1", actorId: "a1", payload: {} });
  assert.deepEqual(
    ledger.getAllEvents().map((e) => e.type),
    ["trust_domain_created", "actor_registered"]
  );
});
