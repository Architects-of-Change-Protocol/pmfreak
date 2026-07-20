# ADR-PMF-068: Incremental Frontend Migration

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

The current frontend (`src/app/(protected)/` with 54 feature folders, `src/lib/` with 145 mixed technical/domain entries, partial `src/features/`/`src/ui-core/`/`src/hooks/` seams, and a working `src/sdk/`/`src/aoc/` contract-client precedent) is a functioning, in-production surface — it is not a blank slate PR7's target architecture (`07-canonical-frontend-architecture.md` through `07-ai-memory-and-intelligence-experience.md`) can simply replace outright. PR4 §7.3 principle 30 already established, for the application layer, that "this document is a target contract for incremental, PR-by-PR convergence" — not license for a rewrite. PR7 must decide whether that same discipline governs the frontend, or whether the scale of the gap between current and target state (documented in `07-frontend-module-boundaries.md` §5 and `07-route-layout-and-navigation-architecture.md` §9) justifies a from-scratch rebuild.

## Decision

**The frontend migrates to its target architecture incrementally, module by module and route by route, using a strangler-pattern approach where the target and current implementations coexist until a given unit is verified and cut over; a big-bang rewrite is rejected explicitly.** Full specification: `07-frontend-migration-strategy.md`.

## Frontend Rules

1. A route migrates to the canonical route map (`07-route-layout-and-navigation-architecture.md` §2) only when its target screen, module, and data contract are all simultaneously ready — never moved ahead of its data layer being ready to serve it (`07-route-layout-and-navigation-architecture.md` §8).
2. The old route continues to function until its replacement is verified — no route is deleted as the first step of its own migration.
3. Migration units are prioritized by evidenced risk and value (e.g., routes with no canonical screen counterpart, `07-route-layout-and-navigation-architecture.md` §9's "no canonical counterpart yet" classification, are resolved — mapped or deprecated — before lower-risk direct-match routes are merely reorganized).
4. No migration unit skips its accessibility (ADR-PMF-067) or state-taxonomy (ADR-PMF-059) conformance check before being considered migrated — "migrated but inaccessible" is not a valid intermediate state.
5. Every migration phase is independently revertible — a phase that introduces a regression can be rolled back without requiring the reversal of a later phase.

## Alternatives Considered

- **A big-bang rewrite of the entire frontend against the target architecture.** Rejected explicitly, per the governing brief's binding decision matrix (`07-canonical-frontend-architecture.md` §14: "Big-bang rewrite — Rejected") and consistent with PR4 §7.3 principle 30's precedent — a simultaneous rewrite of 54 route folders and 145 `src/lib/` entries would halt feature delivery for an unbounded period and re-introduce exactly the "designed under time pressure" risk PR1 originally documented for the current codebase's own history.
- **No formal migration strategy — let each future PR decide its own approach to reconciling old and new structure.** Rejected: this is how the current codebase's own inconsistency (three folder-organization styles coexisting today, `07-frontend-module-boundaries.md` §5) arose in the first place; leaving it unformalized a second time would repeat the pattern at the module-boundary level instead of fixing it.

## Positive Consequences

- Keeps the product shippable and the current ~fifty routes functioning throughout migration — no feature-delivery freeze.
- Gives every migration unit (module or route) an independent, revertible cutover point, bounding the blast radius of any single migration step's defect.

## Negative Consequences

- Requires the current and target structures to coexist for an extended period, during which two patterns are simultaneously present in the codebase — more cognitive overhead than a clean-slate rewrite would have, by design, in exchange for continuous shippability.

## Risks

- **Stalled-migration risk:** an incremental strategy with no forcing function can stall indefinitely, leaving the coexistence period permanent — mitigated by `07-frontend-migration-strategy.md`'s explicit phase sequencing, legacy-freeze policy, and removal criteria, rather than an open-ended "migrate when convenient" posture.
- **Drift risk:** new feature work landing in the legacy structure during migration could widen the gap faster than migration closes it — mitigated by `07-frontend-migration-strategy.md`'s legacy-freeze section, which restricts new work in already-classified legacy areas once their migration phase has begun.

## Security and Data Implications

- None beyond ensuring migrated and not-yet-migrated routes are each independently held to the same tenant-context (ADR-PMF-061) and data-access (ADR-PMF-060) rules — migration status is never a reason to relax either.

## Application Implications

- No change to PR4's own incremental-convergence principle (§7.3 principle 30); this ADR extends the same discipline to the frontend layer explicitly.

## Frontend Implications

- Establishes the phased, revertible migration model every module and route classification in `07-frontend-module-boundaries.md` §5 and `07-route-layout-and-navigation-architecture.md` §9 feeds into.

## Migration Implications

- This ADR *is* the migration-strategy ADR; its implications are the entirety of `07-frontend-migration-strategy.md`.

## Compatibility Implications

- Fully compatible with continued operation of every current route and module throughout migration — no route or component is broken by this ADR's adoption alone.

## Out of Scope

- The exact route migration order within a phase and exact deprecation windows (`07-canonical-frontend-architecture.md` §13, open).

## Validation

Validation criteria: (1) `07-frontend-migration-strategy.md` documents a phased plan with explicit phase gates, rollback approach, and removal criteria; (2) no phase requires simultaneous migration of more than one module's routes; (3) the current-state inventory in `07-frontend-migration-strategy.md` is methodologically reproducible (commands shown, not estimated).

## References

- `docs/product-architecture/07-frontend-migration-strategy.md`
- `docs/product-architecture/04-canonical-application-architecture.md` §7.3 principle 30
- `docs/adr/ADR-PMF-044-incremental-expand-contract-migration.md`
