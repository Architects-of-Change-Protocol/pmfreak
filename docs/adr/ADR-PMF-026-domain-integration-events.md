# ADR-PMF-026: Domain and Integration Events

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 §33 proposed a conceptual set of domain events consistent with the canonical model but explicitly noted "no event infrastructure exists in the codebase today" and that "this section proposes events consistent with the canonical model; it does not describe anything implemented." PR4 must decide how those proposed events relate to each other — specifically, whether every fact in the system should be treated as an equally-weighted, always-published event (risking exactly the kind of premature cross-boundary coupling PR1 §27 warns against for Enterprise Intelligence), or whether a fact's *internal* significance to one bounded context should be distinguished from its *external* significance to other contexts or systems.

## Decision

**A Domain Event is internal to the bounded context that emits it and may participate in the same unit of work as the command that caused it. An Integration Event is a Domain Event promoted to a versioned, cross-context or cross-system contract, used only where a genuine consumer outside the emitting context exists.** The full classification is `04-canonical-application-architecture.md` §20–§21 and `04-command-query-event-catalog.md` §7–§8.

## Domain Rules

1. Every event is named as a past-tense fact (e.g., `ProjectCreated`), never an intention or request.
2. A Domain Event carries identifiers, scope, and a version; it is immutable once published; it preserves correlation and causation identifiers (§3 of `04-command-query-event-catalog.md`).
3. An event is classified as an Integration Event only once it has an actual, named consumer in a different bounded context or external system — speculative "might need it later" promotion is prohibited.
4. An Integration Event's contract is versioned explicitly; a consumer must tolerate unknown fields and reject payloads whose major version it does not support.
5. Publishing an Integration Event that would cross a Workspace boundary is permitted only for the specific events flagged as conditional in §20 of the parent document (chiefly the Enterprise Intelligence elevation events), and only through the governed elevation gate (§30) — never as an unconditional publish/subscribe fan-out.
6. Not every event is asynchronous by virtue of being an event; synchronicity is governed separately by §22 of the parent document, not implied by this ADR.

## Alternatives Considered

- **Treat every proposed event in PR1 §33 as an Integration Event immediately.** Rejected: most of PR1's proposed events (e.g., `TaskCreated`, `RiskRecorded`) have no consumer outside their own bounded context today; publishing them as versioned cross-system contracts before a real consumer exists creates speculative coupling with no corresponding benefit, and versioning overhead with no payoff.
- **Event sourcing as the storage model for every aggregate.** Rejected: `04-canonical-application-architecture.md` §54 explicitly records "Event sourcing: Not required initially" — this ADR's Domain/Integration distinction is about event *communication*, not event *storage*, and does not require or imply event sourcing for any aggregate.
- **No distinction at all — a single flat event bus for everything.** Rejected: this reproduces the exact problem PR1 §27 identifies for Enterprise Intelligence at the level of event delivery — anything published to a shared bus is one misconfigured subscription away from crossing a Workspace boundary it should never cross.

## Positive Consequences

- Lets most events stay cheap and internal (in-process, unversioned, evolvable with their owning context) while reserving the overhead of versioning and cross-context contracts for the handful that actually need it (§8 of `04-command-query-event-catalog.md` lists the current candidates).
- Makes the Workspace-boundary-crossing question explicit per event, rather than implicit in whatever happens to subscribe to a shared bus.
- Gives PR5/PR6 a clear signal for which events need a durable outbox versus which can be handled as an in-process side effect within the same transaction.

## Negative Consequences

- Requires an explicit judgment call, per event, about whether it is "Domain" or "Integration" — this can be wrong in either direction (promoting too early wastes effort; promoting too late means a retrofit when a real second consumer appears).
- Two categories of event, with different guarantees, add conceptual overhead versus a single uniform event model.

## Risks

- **Late-promotion risk:** an event kept internal that later needs a real cross-context consumer requires a retrofit (adding versioning, an outbox, a consumer contract) — this ADR accepts that risk deliberately rather than pre-paying it for every event.
- **Workspace-boundary risk:** the single highest-consequence failure mode for this ADR is an Integration Event inadvertently reaching a subscriber in a different Workspace; §21's table and rule 5 above exist specifically to make that fail loudly (a subscriber must be explicitly, individually wired) rather than silently (a shared topic anyone can subscribe to).

## Security and Data Implications

- Integration Events crossing a Workspace boundary are restricted to the Enterprise Intelligence elevation pipeline specifically (`04-canonical-application-architecture.md` §30, §35) — this is the same isolation guarantee PR1 §16/§35 already enforces at the database layer, restated at the event layer.
- Every Integration Event must avoid carrying unnecessary secrets or PII beyond what its documented consumer needs (§20 of the parent document).

## Application Implications

- Command Handlers write Domain Events to the outbox as part of their own transaction (§15, §23 of the parent document) regardless of whether that event is ever promoted to Integration status; promotion changes delivery/versioning treatment, not whether the event is recorded.

## Persistence Implications

- PR5 must design an outbox table (or equivalent) sufficient for at-least-once delivery of Integration Events (§19 of the parent document, Event Publisher/Outbox port); Domain-only events may not require durable storage beyond the aggregate's own transaction log, at PR5's discretion.

## API Implications

- PR6 is not required to expose events as an API surface directly; webhooks or subscriptions built on Integration Events are a PR6+ decision, informed by which events this ADR's catalog already marks as Integration candidates.

## UX Implications

None directly.

## Migration Implications

None executed by this ADR. Building actual event infrastructure is explicitly future-PR work (§52 of the parent document: "Events: Partial... Event gap... Future PR").

## Compatibility Implications

No existing event infrastructure exists to be compatible or incompatible with; this ADR establishes the target for whenever event infrastructure is built.

## Out of Scope

Choosing an event bus or message broker technology (§55 of the parent document); choosing whether any specific aggregate eventually adopts event sourcing.

## Validation

Validation criteria: (1) every event in `04-command-query-event-catalog.md` §7 is named as a past-tense fact; (2) §21's classification table assigns every listed event to exactly one of "stays internal" or "integration candidate"; (3) every event flagged as crossing a Workspace boundary in §7's "Crosses Workspace?" column is also referenced by the Enterprise Intelligence elevation workflow in `04-application-workflows.md`.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §20–§22, §30, §35, §54
- `docs/product-architecture/04-command-query-event-catalog.md` §1–§3, §7–§8
- `docs/product-architecture/01-canonical-domain-model.md` §33 (original proposed event set, "conceptual only")
