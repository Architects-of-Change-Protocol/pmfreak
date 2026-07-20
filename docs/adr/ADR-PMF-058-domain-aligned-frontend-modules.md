# ADR-PMF-058: Domain-Aligned Frontend Modules

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`04-canonical-application-architecture.md` §10 ratified twenty-five bounded contexts as the application layer's ownership boundary specifically to prevent a recurrence of PR1's finding of three coexisting PMO representations and five objects sharing the "Command Center" label. The current frontend's top-level `src/` structure (`components/`, `features/`, `lib/`, `ui-core/`, `hooks/`) mixes technical-type folders with partially domain-named ones, and `src/lib/` alone holds 145 entries spanning framework utilities, domain logic for a dozen different concerns, and a persistence-adjacent `db/` subfolder — with no enforced rule for which module a given piece of frontend code belongs to. Left unresolved, the frontend risks re-deriving PR1's ownership ambiguity one more time, this time in component and hook form rather than table form.

## Decision

**Frontend modules are organized by capability/domain, one per PR4 bounded context with a user-facing surface (or a small cluster PR3's screen inventory already groups under one entity), never by technical file type and never by persisted table name.** Full specification and module catalog: `07-frontend-module-boundaries.md`.

## Frontend Rules

1. Every frontend module's ownership mirrors its corresponding PR4 §10 bounded context, and its PR4 §17 application service wherever one is named (`07-frontend-module-boundaries.md` §7) — no frontend module is invented that does not correspond to an already-ratified bounded context.
2. A module's internals (Features, Domain Presentation, Application Contracts) are never imported directly by another module — only its public entry point is (`07-frontend-module-boundaries.md` §3).
3. Shared UI (Platform) is domain-free by construction — the moment a "shared" component branches on entity type, it has become a Domain Presentation component and must move into its owning module (`07-frontend-module-boundaries.md` §8).
4. A module's screen ownership is exhaustive against `03-screen-catalog.md` — every one of the fifty canonical screens maps to exactly one module.

## Alternatives Considered

- **Continue technical-type organization (`components/`, `hooks/`, `lib/` as the primary structure).** Rejected: this is the current state, and it is exactly what makes `src/lib/`'s 145 entries unclassifiable without reading each one individually — the opposite of what PR4's bounded-context discipline was meant to achieve one layer up.
- **One frontend module per Next.js route folder.** Rejected: routes and modules answer different questions (`07-canonical-frontend-architecture.md` §2) — a route describes a URL; a module describes ownership. Conflating them would re-introduce "the UI is not the architecture" at the module-boundary level.

## Positive Consequences

- Gives every future component a single, unambiguous home, testable against the module catalog (`07-frontend-module-boundaries.md` §2) rather than judgment call.
- Makes the current `src/lib/`'s technical/domain mixing (§5 of `07-frontend-module-boundaries.md`) a named, trackable migration target instead of permanent ambiguity.

## Negative Consequences

- Requires reclassifying a large existing surface (145 `src/lib/` entries, 54 route folders) incrementally — slower than leaving the current structure alone.

## Risks

- **Misclassification risk:** a module boundary drawn incorrectly at migration time could split one bounded context's frontend across two modules — mitigated by requiring every module's ownership to trace to PR4 §17's application-service list (`07-frontend-module-boundaries.md` §7), not an independent frontend-only judgment.

## Security and Data Implications

- Domain-aligned modules make it easier to audit which module's code has access to which classification of data (`05-tenancy-rls-and-data-security.md` §10), since a module's Application Contracts layer is the sole point where a given bounded context's DTOs are consumed.

## Application Implications

- No change to PR4's application-service boundaries; this ADR only requires the frontend to mirror them, not the reverse.

## Frontend Implications

- Establishes the module catalog (`07-frontend-module-boundaries.md` §2) that every other `07-*` document's module references depend on.

## Migration Implications

- The current `src/` structure is classified, not renamed, by this PR (`07-frontend-module-boundaries.md` §5); the target tree (§6 of the same document) is a strangler-pattern destination, per `07-frontend-migration-strategy.md`.

## Compatibility Implications

- Fully compatible with continued operation of the current structure during migration — existing imports are not broken by this ADR.

## Out of Scope

- Exact folder names beyond the layer model (`07-canonical-frontend-architecture.md` §13).
- Per-file reclassification of every one of the 145 `src/lib/` entries (deferred to migration execution, not this documentary PR).

## Validation

Validation criteria: (1) every screen in `03-screen-catalog.md` maps to exactly one module in `07-frontend-module-boundaries.md` §2 — to be confirmed by the screen-coverage fitness function `07-frontend-module-boundaries.md` §4 defines but does not yet run; (2) every module's ownership traces to a PR4 §10 bounded context, and to a PR4 §17 application service wherever one is named; (3) the forbidden-dependency list (`07-frontend-module-boundaries.md` §3) has a corresponding fitness function (§4 of the same document).

## References

- `docs/product-architecture/07-frontend-module-boundaries.md`
- `docs/product-architecture/04-canonical-application-architecture.md` §10, §17
- `docs/adr/ADR-PMF-024-bounded-context-ownership.md`
