# ADR-PMF-025: Commands, Queries and Side-Effect Separation

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1's inspection of the current codebase found page-level Supabase queries mixed directly with UI data-fetching, and mutations performed inline in route handlers and server actions without a named, catalogued operation behind them (`04-canonical-application-architecture.md` §52). This makes it structurally impossible to answer, from the code alone, two questions PR6 (API Contracts) and PR7 (Frontend Architecture) both need answered cheaply: "what are all the ways this data can change," and "does reading this data ever change something else." Without an explicit separation, a "read" endpoint that quietly writes an audit row, refreshes a cache with observable side effects, or triggers a notification becomes invisible technical debt exactly like the Command Center naming collisions became invisible domain debt (PR1 §22).

## Decision

**Every state-changing operation is a named Command; every read operation is a named Query; a Query never produces a side effect, and a Command's only legitimate side effects are the ones documented in its own catalog entry.** The full catalogs are `04-canonical-application-architecture.md` §13–§14 and `04-command-query-event-catalog.md` §5–§6.

## Domain Rules

1. A Command has: an actor, a target aggregate, prerequisites, an authorization rule, an idempotency key, a transaction boundary, a set of resulting events, documented failure modes, and an explicit human-approval requirement (yes/no).
2. A Query has: a consumer, a scope, an authorization rule, a source read model, a consistency expectation, and no write path of any kind — not to the aggregate it reads, not to an audit log as a side effect of being called, not to a cache in a way visible to other actors.
3. A Command Handler and a Query Handler are distinct code paths (§15 of the parent document) — no single handler serves both roles.
4. A Query may read from a read model (§9.5, §42) that is eventually consistent; a Command always operates against the current, strongly consistent state of its target aggregate.
5. Any operation that cannot be cleanly classified as one or the other (e.g., "get-or-create") must be split into an explicit Query followed by a conditional Command — never implemented as a single ambiguous handler.

## Alternatives Considered

- **No formal CQS discipline — let each endpoint do what's convenient.** Rejected: this is the status quo (§52 of the parent document), and it is precisely what makes it impossible to answer "what can mutate this" without reading every call site.
- **Full CQRS with physically separate read/write databases from day one.** Rejected: `04-canonical-application-architecture.md` §54 explicitly chooses "logical separation, no infrastructure mandate" — physical read/write database separation is an infrastructure decision this PR deliberately leaves open (§55), not a prerequisite for the Command/Query naming discipline itself.
- **Treat GraphQL-style single-endpoint resolvers as an exception to CQS**, allowing a resolver to both read and conditionally write. Rejected: API transport (REST/GraphQL/RPC) is explicitly left open (§55 of the parent document), but whichever transport PR6 chooses must still route through named Commands and Queries underneath — the transport is not a license to blur the separation this ADR requires.

## Positive Consequences

- Gives PR6 a direct, near-mechanical mapping from this catalog to endpoints: each Command becomes a mutation endpoint, each Query a read endpoint, with no guesswork about what an endpoint is allowed to do.
- Makes idempotency (§37 of the parent document) tractable, since idempotency keys are defined per-Command, not retrofitted onto whatever a route handler happens to do.
- Makes read-model eventual consistency (§24) a safe, intentional design choice instead of an accidental one, since Commands never depend on a Query's freshness to be correct.

## Negative Consequences

- Requires every future use case to be explicitly classified before implementation — slower up-front than writing an ad hoc handler, particularly for simple CRUD-shaped screens.
- Some legitimately simple operations (e.g., toggling a boolean preference) will feel over-formalized as a named Command with a full catalog entry.

## Risks

- **Silent side-effect risk:** without a fitness function (§53 of the parent document) checking for it, a Query Handler could still be implemented to write a "harmless" side effect (e.g., updating a `last_viewed_at` timestamp) that technically violates this ADR; this document names the rule but does not build the enforcement.
- **Catalog drift risk:** as PR5/PR6 implementation proceeds, new Commands/Queries will be needed that aren't yet in `04-command-query-event-catalog.md`; a future PR must keep the catalog authoritative rather than letting implementation outrun documentation.

## Security and Data Implications

- Authorization is always evaluated as part of a Command or Query's own contract (§15, §34 of the parent document) — never bolted on generically at a router level with no awareness of which specific operation is being authorized.
- Because Queries cannot mutate, a compromised or over-permissioned read path cannot itself become a privilege-escalation vector for writing data — it can only leak reads, which is a narrower, more auditable class of risk.

## Application Implications

- Application services (§17 of the parent document) expose their Commands and Queries as two clearly distinct method groups, never a single generic `execute(operation)` entry point that hides which kind of operation is running.

## Persistence Implications

- Command Handlers write through owning-context repositories inside a transaction boundary (§18, §23); Query Handlers read from projections (§9.5, §42) and never acquire a write transaction.

## API Implications

- PR6 must preserve this separation regardless of transport: REST would naturally map Commands to POST/PUT/PATCH/DELETE and Queries to GET; any other transport PR6 chooses must preserve the same semantic guarantee (no read-shaped call may mutate).

## UX Implications

- PR7's data-fetching layer can safely treat every Query as cache-safe and every Command as cache-invalidating, without per-call-site special-casing.

## Migration Implications

None executed by this ADR. Reclassifying existing page-level Supabase queries and inline mutations into this Command/Query shape is future-PR work (§52 of the parent document, "Commands: Implicit... Application gap... Future PR"; "Queries: Mixed with UI... Read model gap... PR6/PR7").

## Compatibility Implications

The current codebase's mixed read/write handlers are not compliant with this ADR; this is recorded as a current-state gap, not retroactively endorsed.

## Out of Scope

Choosing the API transport (§55 of the parent document); implementing the Command/Query catalogs; building the fitness function that would detect a Query Handler with a side effect.

## Validation

Validation criteria: (1) every entry in `04-command-query-event-catalog.md` §5 is unambiguously a Command (has a target aggregate and resulting events/failure modes); (2) every entry in §6 is unambiguously a Query (has a source read model, no resulting events); (3) no name appears in both catalogs.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §13–§15, §24, §52, §54
- `docs/product-architecture/04-command-query-event-catalog.md`
