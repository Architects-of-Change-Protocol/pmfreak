# ADR-PMF-046: Resource-Oriented REST as the Primary API Style

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4's ADR-PMF-025 (API Implications) already anticipates that "REST would naturally map Commands to POST/PUT/PATCH/DELETE and Queries to GET," and `04-canonical-application-architecture.md` §55 explicitly left the API transport as an open decision for PR6. Twenty PR1/PR4-ratified concepts (Enterprise, Workspace, PMO, Portfolio, Program, Project, Recommendation, Decision, Action, Outcome, Evidence, Project Memory, Enterprise Knowledge, Workflow, Agent, Agent Run, Audit, Notification, Integration, plus cross-cutting Search) need a consistent, learnable shape at the wire boundary, and fifty-plus Commands and twenty-five-plus Queries (`04-command-query-event-catalog.md`) need a mapping that does not require inventing a new pattern per endpoint.

## Decision

**Resource-oriented REST is the primary API style. Every PR1/PR4-ratified aggregate and top-level domain concept is exposed as a named resource with stable identity; Commands are exposed as action-oriented endpoints on resources; Queries are exposed as `GET` reads with cursor/keyset pagination by default. Event-driven delivery (outbox-backed webhooks) is secondary, for asynchronous notification, not competing with REST for synchronous request/response. GraphQL remains a legitimate future option, adopted only on documented evidence of a specific unmet need — not adopted at this stage.**

## API Rules

1. Every resource name in `06-api-resource-catalog.md` corresponds to a PR1/PR4-ratified concept — no resource is invented for API convenience alone.
2. Resource identity uses the same canonical identifiers PR5 §6 already fixed — never a slug, name, or row number where a canonical ID exists.
3. Commands are exposed as action-oriented endpoints (`POST /resource/{id}:action`), never as an unbounded, ungoverned set of RPC-style endpoints disconnected from the resource model.
4. No resource is given a generic CRUD interface by default — the Command catalog for that resource is the sole source of truth for which mutating operations exist (e.g., Decision has no generic `PATCH`).
5. A URL never names a literal database table — it names the domain concept the resource represents, insulated from PR5's migration-phase internals (ADR-PMF-044 API Implications).
6. GraphQL adoption requires a documented need REST's existing composite Query endpoints cannot serve — it is not a default upgrade path.

## Alternatives Considered

- **GraphQL as the primary API style from the start.** Rejected: nothing in PMFreak's ratified domain requires a single flexible query language at the edge; REST's fixed shapes map more directly onto the already-ratified Command/Query separation and require no new client-side query runtime for PR7.
- **RPC-style APIs (one endpoint per operation, no resource model).** Rejected: with fifty-plus Commands and twenty-five-plus Queries, an RPC-only style would forfeit REST's cacheability and the learnability a consistent resource model provides, and risks re-accreting the same kind of unstructured surface PR5's current-state inspection found in persistence.
- **CRUD-first design (every table gets a generic REST interface).** Rejected: several aggregates deliberately restrict which mutations are legal (e.g., Decision's rationale is never destructively edited, ADR-PMF-036) — a generic CRUD template would either violate those invariants or require constant special-casing; the Command catalog is the correct source of truth instead.

## Positive Consequences

- Gives PR7 and any external integration a single, learnable pattern across twenty resource types instead of fifty-plus bespoke endpoint shapes.
- REST's native cacheability benefits `GET`-mapped Queries without additional design work.
- Leaves GraphQL available without having foreclosed it — adoption is evidence-gated, not permanently rejected.

## Negative Consequences

- Some legitimately complex, multi-resource screens (e.g., a Command Center) require either a dedicated composite Query endpoint or multiple round trips — REST does not solve this as elegantly as GraphQL would for a genuinely flexible client need.
- Action-oriented endpoints (`:action` suffix) are a mild deviation from pure REST orthodoxy, chosen deliberately to keep Commands visible and distinct from resource-shaped `PATCH`.

## Risks

- **CRUD-creep risk:** absent discipline, future implementation PRs may be tempted to add a generic `PATCH`/`PUT` to a resource "for convenience," bypassing the Command catalog's restrictions — this ADR's rule 4 exists specifically to prevent that.

## Security and Data Implications

- A stable, enumerable resource/action model makes authorization review tractable per resource (`06-api-resource-catalog.md`'s Permissions column), rather than an open-ended set of ad hoc handlers each needing individual review.

## Application Implications

- Application-layer Command/Query handlers are unaffected by this transport choice — REST is a rendering of the existing Command/Query API, not a new application-layer concept.

## Frontend Implications

- PR7's data-fetching layer can rely on REST's native caching semantics (`GET` cacheable, mutating verbs cache-invalidating) without a bespoke client-side cache-invalidation scheme.

## Migration Implications

- None executed by this ADR. Existing ad hoc Next.js route handlers (PR5 §24 current-state gap) are migrated to this resource model incrementally in PR9+, per migration unit, mirroring ADR-PMF-044's persistence migration discipline.

## Compatibility Implications

- Fully compatible with continued operation of existing routes during migration; this ADR governs the target shape, not an immediate cutover.

## Out of Scope

- gRPC, a public developer API, a Marketplace API — all remain open (`06-canonical-api-contracts.md` §33).
- Exact route-naming conventions beyond the illustrative examples in `06-api-resource-catalog.md`.

## Validation

Validation criteria: (1) every resource in `06-api-resource-catalog.md` maps to a PR1/PR4-ratified concept; (2) no resource exposes a mutating endpoint outside its documented Command set; (3) GraphQL is not adopted by any `06-*` document without a documented evidence trail.

## References

- `docs/product-architecture/06-canonical-api-contracts.md` §4, §6
- `docs/product-architecture/06-api-resource-catalog.md`
- `docs/adr/ADR-PMF-025-command-query-separation.md` (API Implications)
