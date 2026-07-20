# ADR-PMF-045: Canonical API Philosophy

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 through PR5 ratified PMFreak's domain, language, information architecture, application architecture (Commands, Queries, Events, bounded contexts), and persistence model without reference to how any external caller — browser, mobile client, integration, autonomous agent — invokes any of it. `04-canonical-application-architecture.md` already names "Application before Interface" as a layering violation to avoid (§7.3) and lists API command/query ports as inbound ports whose only job is translation (ADR-PMF-031). Left unresolved, this PR's charge — defining the API contract — risks being designed backwards, from convenient endpoints toward the domain, which is exactly the accretion pattern PR5's current-state inspection documented for persistence (423 tables, duplicated concepts) and which this PR exists to avoid repeating at the API layer.

## Decision

**The API exposes the domain; it does not define it. Every endpoint corresponds to a Command, a Query, or a resource already ratified in PR1–PR4, and the transport (REST today) is treated as replaceable — nothing in the domain layer may depend on it, and nothing in this PR's contracts may reinterpret a Command, Query, Event, or aggregate PR1–PR5 already named.**

## API Rules

1. No endpoint is designed before the Command/Query/resource it exposes already exists in `04-command-query-event-catalog.md` or `04-canonical-application-architecture.md`'s aggregate catalog.
2. The API command/query port (ADR-PMF-031) contains no business logic — it authenticates, translates, invokes, and translates the result back.
3. A DTO is never a serialized aggregate or persistence row (`06-canonical-api-contracts.md` §9) — every DTO is purpose-built for its direction and consumer.
4. Swapping the transport (REST → GraphQL, gRPC, or any future protocol) must not require redesigning a single Command, Query, aggregate, or invariant.
5. No PR6 document reopens or redefines any PR1–PR5-ratified concept (Enterprise, Workspace, PMO, Portfolio, Program, Project, Recommendation, Decision, Action, Outcome, Evidence, Project Memory, Enterprise Intelligence, Agent Run) — the API references these names exactly as ratified.

## Alternatives Considered

- **Design the API first and back-fill the domain to match convenient endpoint shapes.** Rejected: this is the exact ordering violation PR4 §7.3 already named and prohibited; it would also risk re-litigating PR1.1's ratified invariants under the guise of "what the API needs."
- **Treat the API as a thin, ungoverned pass-through with no explicit philosophy document.** Rejected: PR5's persistence accretion (four independent Decision-record families, five Recommendation families) demonstrates what happens when a layer is left to accrete without a stated philosophy before implementation begins.

## Positive Consequences

- Gives every future implementation PR a single test for any proposed endpoint: does it already correspond to a ratified Command, Query, or resource — no guesswork about scope creep.
- Insulates PR7 (frontend) and any future integration consumer from persistence migration phases (PR5 §25), since the API contract is defined against the stable domain, not the current 423-table schema.

## Negative Consequences

- A genuine product need for a new capability requires updating the PR4 catalog before an endpoint can exist for it — slower than an ad hoc route handler, by design.

## Risks

- **Domain-catalog lag risk:** if `04-command-query-event-catalog.md` is not kept current as new Commands/Queries are identified during implementation, the API layer either stalls or someone is tempted to bypass this ADR — the catalog must remain a living, authoritative document, not a one-time PR4 artifact.

## Security and Data Implications

- Because every endpoint traces to an authorized Command/Query, authorization review has a fixed, enumerable surface (`06-command-catalog.md`, `06-query-catalog.md`) rather than an open-ended set of ad hoc routes.

## Application Implications

- Application-layer Command/Query handlers remain the sole holders of business logic; the API layer's translation responsibility (ADR-PMF-031) is unchanged by this ADR, only reaffirmed at the API-specific level.

## Frontend Implications

- PR7 consumes only Response/Summary/Projection/Search/Feed DTOs (`06-canonical-api-contracts.md` §9), never a raw table row — this ADR is what makes that guarantee possible.

## Migration Implications

- None executed by this ADR. Implementation begins in PR9+.

## Compatibility Implications

- Fully compatible with continued use of the current ad hoc route handlers during migration — this ADR governs the target contract, not an immediate cutover.

## Out of Scope

- Choosing the specific transport (REST vs. GraphQL vs. other) — see ADR-PMF-046.
- Any specific endpoint's implementation.

## Validation

Validation criteria: (1) every endpoint named across `06-*` companion documents traces to a Command, Query, or resource already present in PR1–PR5; (2) no `06-*` document redefines a PR1–PR5-ratified concept; (3) `06-canonical-api-contracts.md` §3's sixteen API Principles are each traceable to a rule in this ADR or a sibling ADR-PMF-046 through 056.

## References

- `docs/product-architecture/06-canonical-api-contracts.md` §1–3
- `docs/product-architecture/04-canonical-application-architecture.md` §7.3, §19 (ADR-PMF-031)
- `docs/adr/ADR-PMF-031-application-ports-adapters.md`
