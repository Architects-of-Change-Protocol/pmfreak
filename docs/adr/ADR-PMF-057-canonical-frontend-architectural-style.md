# ADR-PMF-057: Canonical Frontend Architectural Style

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 through PR6 ratified PMFreak's domain, language, information architecture, application architecture, persistence model, and API contracts without reference to how the one caller every other caller exists to serve — the product's own browser client — is itself organized. `04-canonical-application-architecture.md` §7.2 already named "the UI is not the architecture" as a failure mode to avoid at the API layer; PR7 must decide whether the frontend is built against the same discipline (server-first, feature-oriented, contract-driven) or is left to accrete route-by-route the way PR1's current-state inspection found the persistence layer accreted (423 tables, three PMO representations). The current codebase already shows early signs of this: `src/app/(protected)/` holds 54 feature folders with no consistent screen-to-route discipline, and `src/lib/` holds 145 mixed technical/domain entries with no enforced layer boundary.

## Decision

**PMFreak's frontend is server-first, feature-oriented, and domain-aligned, built with Next.js, React, and TypeScript, consuming the platform exclusively through explicit API contract clients and controlled client-side boundaries.** Full specification: `07-canonical-frontend-architecture.md`.

## Frontend Rules

1. Every screen, module, and data call traces to a screen, Command, or Query already ratified in PR3/PR4/PR6 — no frontend concept is invented ahead of the domain and API layers it renders (`07-canonical-frontend-architecture.md` §3 principle 1).
2. Server Components and server-rendered data are the default rendering strategy; Client Components exist only where interactivity or browser APIs require them (ADR-PMF-062).
3. The frontend is organized by domain/feature, mirroring PR4's bounded contexts, never by technical file type alone (ADR-PMF-058).
4. No PR7 document reopens or redefines any PR1–PR6-ratified concept — every entity, screen, Command, Query, error category, and workflow referenced is taken verbatim from prior PRs.

## Alternatives Considered

- **A client-first, SPA-style architecture fetching everything from the browser.** Rejected: PMFreak's screens are read-heavy, tenant-scoped Command Centers and Registers (`03-canonical-information-architecture.md` §5, `05-canonical-persistence-architecture.md` §22) that benefit from server-side session/tenant resolution already being available; a client-first default would duplicate that resolution work in the browser and widen the surface for the tenant-authority leaks ADR-PMF-061 exists to prevent.
- **Organizing the frontend by technical layer only (`components/`, `hooks/`, `utils/`) with no domain alignment.** Rejected: this is the exact pattern the current codebase's `src/lib/` (145 mixed entries) already demonstrates the cost of — no way to answer "which module owns this" without reading every file.

## Positive Consequences

- Gives every future implementation PR a single test for any proposed frontend addition: does it correspond to an already-ratified screen, Command, or Query.
- Keeps the frontend's dependency on Next.js/React replaceable in principle at the domain-presentation level, mirroring ADR-PMF-031's ports-and-adapters discipline at the API layer.

## Negative Consequences

- Requires every new screen to have already passed through PR3/PR4/PR6 ratification before frontend work begins — slower than building a route ad hoc, by design.

## Risks

- **Catalog-lag risk:** if `03-screen-catalog.md` and `06-command-catalog.md`/`06-query-catalog.md` are not kept current, frontend work either stalls or someone bypasses this ADR under time pressure — the catalogs must remain living documents, not one-time artifacts.

## Security and Data Implications

- Server-first rendering keeps tenant-scoped data resolution on the server, reducing the surface where a client-side bug could leak cross-tenant data (ADR-PMF-061).

## Application Implications

- The application layer's Command/Query handlers (PR4 §15) remain the sole holders of business logic; this ADR does not change that boundary, only affirms the frontend consumes it rather than reimplementing it.

## Frontend Implications

- Establishes the baseline every other PR7 ADR (058–068) refines: module boundaries, state separation, contract-driven access, tenant context, rendering strategy, and the rest.

## Migration Implications

- Applies to all future frontend work; existing code is reclassified incrementally per `07-frontend-migration-strategy.md`, not replaced at once (ADR-PMF-068).

## Compatibility Implications

- Fully compatible with the current Next.js/React/TypeScript stack — this ADR governs organization and boundaries, not a framework change.

## Out of Scope

- The exact module folder names and exact state/data/form libraries (`07-canonical-frontend-architecture.md` §13).
- Any specific route or component's implementation.

## Validation

Validation criteria: (1) every `07-*` companion document's rules trace back to one of this ADR's Frontend Rules or a sibling ADR-PMF-058 through 068; (2) no `07-*` document redefines a PR1–PR6-ratified concept; (3) the Decision Matrix in `07-canonical-frontend-architecture.md` §14 is fully traceable to this ADR series.

## References

- `docs/product-architecture/07-canonical-frontend-architecture.md` §1–3
- `docs/product-architecture/04-canonical-application-architecture.md` §7.2, §7.3
- `docs/adr/ADR-PMF-031-application-ports-adapters.md`
