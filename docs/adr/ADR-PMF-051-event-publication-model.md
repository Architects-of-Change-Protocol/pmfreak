# ADR-PMF-051: API-Facing Event Publication Model

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR5's ADR-PMF-037 already ratified the transactional outbox as the durable publication mechanism for domain and integration events, with an explicit API Implication: "Not directly API-facing; PR6 may expose a read-only 'event history' or 'integration log' endpoint... if a product need for it is identified." PR4's `04-command-query-event-catalog.md` §8 already names fourteen events as Integration Event candidates, distinct from the other twenty-two which are Domain-Event-only. PR6 needs to fix how these categories surface (or don't) at the API boundary without inventing new event names or changing which events PR4 already classified as integration-eligible.

## Decision

**All thirty-six PR4-catalogued events are published via the existing transactional outbox (ADR-PMF-037) to internal consumers. The fourteen events PR4 already flagged as Integration Event candidates are, additionally, the only events eligible for external delivery (webhooks, ADR-PMF-052). The API layer never publishes an event directly — it only triggers the Command whose handler writes the outbox record in the same transaction as the aggregate mutation.**

## API Rules

1. Every event's name, version, source Command, and aggregate in `06-event-catalog.md` is taken verbatim from `04-command-query-event-catalog.md` — no event is renamed, added, or reclassified from Domain to Integration (or vice versa) by this ADR.
2. No API endpoint writes to the outbox directly; publication only happens as a side effect of a Command handler's transaction (ADR-PMF-037 rule already in force).
3. Every event carries the same `correlationId` as its triggering Command and a `causationId` referencing that Command's ID, unchanged from PR4 §3 — the API layer does not alter or strip these fields.
4. A Notification Event (one consumed by the Notification Delivery workflow, PR4 workflow 14) is not a separate wire format — it is a consumption role on an already-published Domain Event, never duplicated as a second publication.
5. Every event type is versioned (`event_version`); a breaking payload change ships as a new version, never a silent reshape of an existing version already in flight to consumers.

## Alternatives Considered

- **Expose every Domain Event externally, not just the fourteen Integration Event candidates.** Rejected: PR4 §8 deliberately restricted which events are safe/intended for cross-boundary consumption; widening that set unilaterally at the API layer would contradict a decision already made with domain context this PR does not have standing to override.
- **Have the API layer publish events synchronously as part of the request/response cycle, bypassing the outbox.** Rejected: this would violate ADR-PMF-037's transactional guarantee (event write in the same transaction as the aggregate mutation) and reintroduce the dual-write consistency risk the outbox pattern exists to prevent.
- **Build a generic "subscribe to any event" API with no allowlist.** Rejected: an unrestricted subscription model would expose internal Domain Events never intended for external consumption and complicate future event-shape evolution; the fourteen-event allowlist keeps the external contract deliberately narrow.

## Positive Consequences

- Resolves ADR-PMF-037's explicitly deferred API Implication with a concrete, narrow answer instead of leaving it open indefinitely.
- Keeps the external event contract's surface area fixed at fourteen well-understood event types, simplifying both webhook delivery (ADR-PMF-052) and any future read-only event-history endpoint.

## Negative Consequences

- A future integration need for an event outside the fourteen-event set requires a PR4 catalog change (reclassifying or adding an event) before it can be exposed — not a unilateral PR6-layer decision.

## Risks

- **Allowlist-staleness risk:** as new Commands/Events are added to PR4's catalog over time, nothing in this ADR automatically re-evaluates whether a new event should join the Integration Event set — that judgment remains a PR4-catalog-maintenance decision, not automated by this ADR.

## Security and Data Implications

- Restricting external delivery to the fourteen-event allowlist bounds what an external subscriber can ever learn about internal domain activity — narrower than the full thirty-six-event internal set, consistent with PR5's data-classification discipline (never exposing more externally than a stated need requires).

## Application Implications

- No change to application-layer Command handlers — they already write outbox records per ADR-PMF-037; this ADR only fixes which of those records become externally routable.

## Frontend Implications

- PR7 may consume any of the thirty-six Domain Events for internal, first-party purposes (e.g., real-time UI updates) through whatever internal event-consumption mechanism PR7 designs — the fourteen-event restriction applies to external/webhook delivery only, not first-party internal consumption.

## Migration Implications

- None executed by this ADR. The outbox itself does not yet exist in the current schema (PR5 §24 current-state gap: "Outbox — Does not exist — New") — this ADR's model applies once PR5's persistence migration delivers it.

## Compatibility Implications

- Fully compatible with the current `platform_events` table as an interim internal event log during migration; this ADR does not mandate an immediate cutover.

## Out of Scope

- The read-only "event history"/"integration log" endpoint ADR-PMF-037 mentions as a possibility — evaluated on product need in PR9+, not designed here.
- Webhook delivery mechanics — see ADR-PMF-052.

## Validation

Validation criteria: (1) `06-event-catalog.md` §1's thirty-six events and their Integration Event flags match `04-command-query-event-catalog.md` exactly; (2) no event is published to an external subscriber outside the fourteen-event allowlist; (3) every event's `correlationId`/`causationId` propagation is documented as inherited from its triggering Command.

## References

- `docs/adr/ADR-PMF-037-transactional-outbox-idempotent-inbox.md`
- `docs/adr/ADR-PMF-026-domain-integration-events.md`
- `docs/product-architecture/04-command-query-event-catalog.md` §8
- `docs/product-architecture/06-event-catalog.md`
