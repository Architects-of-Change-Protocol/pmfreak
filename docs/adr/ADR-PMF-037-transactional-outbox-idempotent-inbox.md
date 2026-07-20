# ADR-PMF-037: Transactional Outbox and Idempotent Inbox

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4's command/query/event catalog identifies domain events with real cross-context consumers as integration event candidates (e.g., `ProjectCreated`, `DecisionRecorded`, `EnterpriseKnowledgeRatified`), and ADR-PMF-026 requires integration events to be versioned, cross-context contracts. Because PMFreak's canonical write model is relational (ADR-PMF-033), publishing an event "after" a transaction commits creates a dual-write problem: the database write and the event publication are two separate operations that can fail independently, risking a committed state change with no corresponding event (or an event with no corresponding committed state). PR5 must decide how durable event publication is guaranteed without introducing a full event-sourcing architecture, and how consumers avoid double-processing a redelivered event.

## Decision

**Durable event publication uses the transactional outbox pattern: an outbox record is written in the same database transaction as the aggregate state change it describes, and a separate publisher process reads and publishes outbox records at-least-once. Consumers protect against duplicate delivery using an inbox or idempotency record keyed by event identity and consumer/operation scope.** This applies to integration events and any domain event that must survive a process crash between the state change and its downstream effects; it does not apply to purely in-process, same-transaction domain events that never leave the originating command handler's unit of work.

## Persistence Rules

1. An outbox event row is written in the same transaction as the aggregate mutation that produces it — never as a separate, non-transactional write after commit.
2. Outbox events carry: `event_id`, `event_type`, `event_version`, `aggregate_type`, `aggregate_id`, `enterprise_id`, `workspace_id`, `project_id` (where applicable), `occurred_at`, `payload`, `correlation_id`, `causation_id`, `published_at` (nullable until published), `attempt_count`, `last_error`.
3. Publication is at-least-once: the publisher may redeliver an event more than once after a crash or retry; it must never silently drop an event.
4. Every event type is versioned (`event_version`); consumers must be able to handle at least the current and immediately prior version during a rollout window.
5. Event payloads carry the minimum information needed for consumers to act or to fetch full detail from the canonical record — they are not a dumping ground for the entire aggregate state, and they never include secrets or credentials.
6. Consumers deduplicate using an inbox or idempotency record keyed by `(source, message_id)` or `(idempotency_key, operation, scope)` — processing the same event twice must be a safe no-op, not a double-effect.
7. Idempotency keys are scoped per tenant and per operation; the same key with a different request payload is treated as a conflict, not silently accepted as a retry.
8. Outbox events are never used as a substitute for a generic activity-feed table (§35) — they are a durability mechanism for cross-context integration, not a queryable product surface by themselves.

## Alternatives Considered

- **Direct, synchronous publish-after-commit with no outbox.** Rejected: a crash or network failure between the database commit and the publish call would either lose the event entirely (if publish never happens) or require the caller to somehow re-derive that publication is needed — the outbox removes this window entirely by making the event durable in the same transaction as the state change.
- **Two-phase commit across the database and the message broker.** Rejected: two-phase commit across heterogeneous systems (PostgreSQL and whatever message transport is chosen) is operationally fragile and not well supported by most managed message brokers or by Supabase's transaction model; the outbox pattern achieves the same durability guarantee without requiring distributed transaction coordination.
- **No deduplication on the consumer side, relying on the publisher to guarantee exactly-once delivery.** Rejected: exactly-once delivery across a network is not achievable without idempotent consumers cooperating — at-least-once delivery plus idempotent consumption is the well-established, achievable alternative, and is what this ADR requires.

## Positive Consequences

- Removes the dual-write problem between aggregate state changes and event publication without requiring distributed transactions.
- Gives every integration event a durable, replayable record, which also supports debugging and reconciliation (§58 of the persistence architecture).
- Idempotent consumption makes the overall system resilient to network retries, publisher crashes, and consumer restarts without risking duplicate side effects (e.g., double-sending a notification, double-creating a downstream record).

## Negative Consequences

- Adds an asynchronous publication step and a background publisher process/job as new operational surface area that did not exist when events were purely synchronous or absent.
- Requires every consumer to implement deduplication logic, which is additional application-layer complexity versus assuming exactly-once, synchronous delivery.

## Risks

- **Publisher lag risk:** if the outbox publisher falls behind or fails silently, consumers relying on timely event delivery (e.g., Notification Management) could see delayed effects — publisher health must be observable (§57, §61 monitoring considerations), not assumed.
- **Idempotency key collision risk:** a poorly scoped idempotency key (missing tenant or operation qualifiers) could cause an unrelated request to be mistaken for a retry of a different one — rule 7's scoping requirement exists specifically to prevent this.
- **Payload bloat risk:** without discipline, an outbox payload could grow to include unnecessary aggregate detail "just in case," recreating the generic-metadata-dump anti-pattern this ADR's rule 5 forbids.

## Security and Data Implications

- Rule 5's prohibition on secrets/credentials in event payloads prevents a class of credential-leakage risk where an event bus, log, or downstream consumer with broader access than the originating aggregate could otherwise see sensitive material.
- Outbox and inbox tables carry `workspace_id`/`project_id` per ADR-PMF-034, so tenant isolation applies to event data the same way it applies to any other operational record.

## Application Implications

- Command handlers write the aggregate mutation and its outbox event(s) in one transaction (per PR4 §23's transaction boundary rules), never as two separate application-layer calls that could partially fail.
- Consumers (Notification Management, Search and Discovery, Enterprise Intelligence's aggregation input, etc.) implement inbox-based deduplication as part of their event-handling application service, not as an afterthought.

## API Implications

- Not directly API-facing; PR6 may expose a read-only "event history" or "integration log" endpoint for a given aggregate if a product need for it is identified, sourced from the outbox table.

## UX Implications

- None directly; may indirectly support features like "recent activity" or delivery-status indicators for notifications, which PR7/PR8 can design against the outbox/delivery-tracking data if needed.

## Migration Implications

- No outbox infrastructure exists in the current schema per the current-state inventory; this is new, additive infrastructure introduced in an expand phase (ADR-PMF-044), not a retrofit of any existing table.

## Operational Implications

- Requires a background publisher process (or Supabase-compatible equivalent — e.g., a scheduled function or external worker) with monitoring for publish lag, failed attempts, and dead-letter handling for events that repeatedly fail to publish or be consumed.

## Compatibility Implications

- The outbox pattern is a standard, well-documented pattern implementable entirely within PostgreSQL (an `outbox_events` table plus a polling or logical-replication-based publisher); it does not require adopting a specific message broker, and the broker choice is left open (§67, §71).

## Out of Scope

- The exact publisher mechanism (polling vs. PostgreSQL logical replication/CDC vs. a specific message broker) — left open pending implementation-time evaluation.
- Dead-letter queue design details and exact retry backoff parameters — deferred to implementation.

## Validation

Validation criteria: (1) every integration event candidate identified in PR4's command/query/event catalog has a documented outbox-based publication path in `05-event-workflow-persistence.md`; (2) every documented event consumer has a documented inbox/idempotency mechanism; (3) no document produced under PR5 describes event publication as happening outside the aggregate's own transaction.

## References

- `docs/adr/ADR-PMF-026-domain-integration-events.md`
- `docs/product-architecture/04-command-query-event-catalog.md` §7–8
- `docs/product-architecture/05-event-workflow-persistence.md`
- `docs/adr/ADR-PMF-033-relational-canonical-write-model.md`
