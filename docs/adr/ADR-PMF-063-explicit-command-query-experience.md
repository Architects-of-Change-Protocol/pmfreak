# ADR-PMF-063: Explicit Command and Query Experience

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-025 (PR4) and ADR-PMF-047 (PR6) already ratify Command/Query separation at the application and API layers — a Query never mutates, a Command's only side effects are its documented ones. Neither ratifies what happens when a Command or Query's *result* — pending, success, or one of `06-error-model.md`'s fourteen error categories — reaches a screen. Without an explicit UI-layer contract, a future implementation could render every mutating action identically regardless of whether it requires confirmation, and could let a "harmless" read trigger an invisible write (e.g., marking something read as a side effect of rendering it) — exactly the failure mode ADR-PMF-025 already prohibits one layer down, recurring at the interaction layer.

## Decision

**Every screen's data need maps to one or more cataloged Queries and is rendered with defined loading/empty/stale/degraded states; every mutating action maps to exactly one cataloged Command and is executed with a defined pending state, confirmation policy, and error presentation for all fourteen canonical error categories.** Full specification: `07-command-query-and-error-experience.md`.

## Frontend Rules

1. A Screen's data-fetching declares, per Query it consumes: the Query name, its consistency expectation, and which loading/empty/error/stale state it renders (`07-command-query-and-error-experience.md` §1, §8).
2. A Feature that triggers a Command declares the Command name, its confirmation requirement, idempotency flag, and version-check requirement (`07-command-query-and-error-experience.md` §2).
3. No Feature performs a "helpful" read-triggered write as a side effect of rendering — every write is an explicit, named Command the user or system triggered deliberately (`07-canonical-frontend-architecture.md` §3 principle 11).
4. Every one of `06-error-model.md`'s fourteen error categories has a defined frontend presentation and recovery path — no category falls through to an unhandled generic error (`07-command-query-and-error-experience.md` §7).
5. A Command requiring human approval or classified destructive requires an explicit confirmation step, distinct from its trigger — never a single click that both expresses intent and executes (`07-command-query-and-error-experience.md` §4, restating ADR-PMF-030).

## Alternatives Considered

- **Leave error handling to a generic catch-all error boundary with no per-category presentation.** Rejected: this discards the precision `06-error-model.md` already built (fourteen categories, each with retry classification and HTTP mapping) — a generic boundary would make `AuthorizationError` and `UnexpectedError` visually indistinguishable to a user, undermining the recovery guidance each category is meant to carry.
- **Render every mutating action identically regardless of destructiveness.** Rejected: this would make `ArchiveProject` and a routine `CompleteTask` interactively indistinguishable, reintroducing the "one-click approve-and-execute" risk ADR-PMF-030 was written specifically to prevent.

## Positive Consequences

- Gives every screen a completeness checklist (loading/empty/stale/degraded, every error category) rather than leaving state coverage to be discovered by users hitting untested paths.
- Makes the frontend's Command/Query boundary directly auditable against `06-command-catalog.md`/`06-query-catalog.md`.

## Negative Consequences

- Requires explicit state-by-state design work per screen rather than a generic loading spinner and generic error toast.

## Risks

- **Category-drift risk:** if a Command/Query starts returning an error category `06-command-catalog.md`/`06-query-catalog.md` doesn't document for it, the frontend has no defined presentation for it — mitigated by treating that as an API-catalog documentation defect to fix upstream (`06-canonical-api-contracts.md` §19), not something the frontend silently absorbs with a guess.

## Security and Data Implications

- Authorization-before-validation ordering (`06-canonical-api-contracts.md` §15) is preserved in the frontend's error presentation — `AuthorizationError` and `NotFoundError` are never collapsed into an identical presentation that could leak existence information (`07-route-layout-and-navigation-architecture.md` §7).

## Application Implications

- No change to PR4's Command/Query handlers; this ADR requires the frontend to consume their documented contract fully, not partially.

## Frontend Implications

- Establishes the pending/confirmation/error model every module's Features layer (`07-frontend-module-boundaries.md` §1) is built against.

## Migration Implications

- Existing ad hoc mutation-handling code is brought into this model incrementally per route (`07-frontend-migration-strategy.md`), prioritized by which screens handle the most destructive/sensitive Commands first.

## Compatibility Implications

- Fully compatible with `06-canonical-api-contracts.md` and `06-error-model.md` as already ratified — this ADR adds a UI-layer contract on top, without modifying the API layer.

## Out of Scope

- The exact component library/design-system implementation of confirmation dialogs and error banners (`07-canonical-frontend-architecture.md` §13).

## Validation

Validation criteria: (1) `07-command-query-and-error-experience.md` §7's table covers all fourteen categories from `06-error-model.md` §1 with no omission; (2) every Command requiring confirmation per `04-canonical-application-architecture.md` §13 is documented with a confirmation step in `07-command-query-and-error-experience.md` §4.

## References

- `docs/product-architecture/07-command-query-and-error-experience.md`
- `docs/product-architecture/06-error-model.md`
- `docs/adr/ADR-PMF-025-command-query-separation.md`
- `docs/adr/ADR-PMF-047-command-query-separation-api.md`
