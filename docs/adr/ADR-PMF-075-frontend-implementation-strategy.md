# ADR-PMF-075: PR9 Frontend Implementation Strategy — Modules, Platform, and a Thin Vertical Slice

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR7 and PR8 are documentary architecture — they fix a target `src/modules/*` + `src/platform/*` tree (`07-frontend-module-boundaries.md` §6), a six-layer dependency model, a seven-component design system, and the four-zone Command Center shape, but wrote no code. PR9 is the sprint's first implementation PR, scoped by the sprint brief to a working, demonstrable core — not a full rebuild of all fifty catalogued screens, all twenty-one modules, or all thirteen envisioned Agents.

Two concrete choices had to be made before writing any code:

1. **Folder naming.** The sprint brief's own illustrative example tree uses `src/domains/*`; the already-ratified `07-frontend-module-boundaries.md` §6 and ADR-PMF-058 use `src/modules/*` + `src/platform/*`. These conflict literally.
2. **Scope depth.** The sprint brief lists seven capabilities (Shell, Command Center, Project Health, Decision Experience, Recommendation Experience, Evidence Viewer, Agent Foundation) plus docs, five ADRs, tests, and feature flags — building all of it at full depth in one PR is explicitly out of scope ("no construir todos los módulos PMFreak").

## Decision

**PR9 uses `src/modules/<name>/{screens,features,presentation,contracts}/` + `index.ts` and `src/platform/{components,shell,feature-flags.ts,permissions.ts}` verbatim, per `07-frontend-module-boundaries.md` §6 — not the sprint brief's illustrative `domains/` example.** The brief's tree is prose illustration for a Spanish-language sprint document; the ADR-ratified name is the one PR7 explicitly built as the target for "a future implementation PR," which is this one.

**PR9 implements a thin vertical slice: all seven capabilities, scoped to the Project entity level only, wired to real (not mocked) data, deep enough that the Fase 14 demo scenario is genuinely drivable end-to-end.** Five of twenty-one PR7 modules are built (`project`, `decisions`, `recommendations`, `evidence`, `agents`); the other sixteen (Enterprise, Workspace, PMO, Portfolio, Program, Project Execution, Actions/Outcomes, Project Memory, Enterprise Intelligence, Integrations, Notifications, Reporting, Audit, Billing, Search, Identity beyond what already exists) are not touched. Five of six Command Centers (Enterprise/Workspace/PMO/Portfolio/Program) are not built — only Project.

## Frontend Rules

1. Every new module has exactly the four sub-layers PR7 §6 specifies plus a public `index.ts`; cross-module imports go through `index.ts` only (verified: no file outside a module imports another module's `contracts/features/presentation/screens` internals directly).
1a. **A module's `index.ts` re-exports Features/Contracts/Domain-Presentation, never Screens.** Discovered during this PR's build validation: a Screen performs server-only permission checks (`can()` → `next/headers`); when another module's `"use client"` Feature imports the barrel to reuse a Feature (e.g., `modules/project`'s `RecommendationPanel` reusing `modules/recommendations`'s `RecommendationList`), Next's bundler resolves the *entire* barrel module graph for the client bundle, dragging the sibling Screen's server-only code along and failing the build (`next/headers` used outside a Server Component). Since a Screen is, by definition (Frontend Rule 5 of ADR-PMF-058/07-frontend-module-boundaries.md §3), consumed only by its own module's Route — never by another module — Screens are imported by `page.tsx` from their concrete file path instead of the barrel. This is a refinement of, not an exception to, "depend on the public entry point only": a Screen was never meant to be part of what other modules consume.
2. Platform components are domain-free (`ZoneFrame`, the seven Enterprise Components, feature-flags, permissions); anything domain-aware lives in a module's `presentation/` layer instead (e.g., `RecommendationCard`, `AgentRunTimeline` are module-scoped, not Platform).
3. Server state uses `swr` (already a dependency) — no new state-management package was added, consistent with `07-frontend-state-and-data-architecture.md` §2's Server State rules (cache-keyed by Query name + resolved params, invalidated narrowly on Command success).

## Alternatives Considered

- **Use `src/domains/*` per the sprint brief's literal example.** Rejected: it would create a second, competing name for the exact same target tree PR7 already ratified, which the sprint brief itself instructs to respect ("Aplicar PR7").
- **Build all seven capabilities across all six Command Center entity levels.** Rejected by the sprint brief itself ("no construir todos los módulos PMFreak"); a single entity level, done for real, demonstrates the product thesis better than six entity levels of placeholder data.
- **Build the full `src/modules/*` catalog (21 modules) with this PR's five as a subset.** Rejected: creates twenty empty module shells with no real screens, which does not serve the sprint's actual question ("¿puede un usuario entender en 2 minutos...?") and invites drift from unused scaffolding.

## Positive Consequences

- The five modules built here are immediately reviewable against PR7's fitness functions (§4): layer placement, dependency direction, and public-entry-point discipline are all checkable today, not deferred.
- A future PR extending to Workspace/PMO/Portfolio/Program Command Centers has a working, correct precedent to copy (the Project Command Center's zone composition, contract pattern, and permission wiring).

## Negative Consequences

- Sixteen of twenty-one catalogued modules remain unbuilt; any screen not in {Command Center, Health, Decisions, Recommendations, Evidence, Agents} for the Project scope does not exist yet under the new routes.
- The five built modules' contracts wrap real but partially fragmented backend services (see ADR-PMF-077) rather than a single canonical Decision/Recommendation aggregate — a future backend consolidation could require a contract-layer update.

## Risks

- **Naming drift risk:** a future PR could reintroduce `src/domains/*` from re-reading the sprint brief without checking this ADR. Mitigated by this ADR being the explicit, searchable record of the resolution.

## Security and Data Implications

- None beyond what ADR-PMF-076/077 introduce — this ADR is structural only.

## Application Implications

- None — no new Command, Query, or backend aggregate is introduced by this ADR; see ADR-PMF-077 for the Decision/Recommendation adapter decision.

## Frontend Implications

- Establishes the concrete `src/modules/*` + `src/platform/*` tree as real, existing code for the first time, matching `07-frontend-module-boundaries.md` §6.

## Migration Implications

- Additive only. No existing route, component, or `src/features/command-center/*` file was modified or deleted by this PR (verified in `tests/command-center-integration.test.mjs`).

## Compatibility Implications

- Fully backward compatible — the new routes sit at `/w/[workspaceId]/p/[projectId]/*`, distinct from every existing route.

## Out of Scope

- The remaining sixteen PR7 modules.
- Migrating any existing `src/app/(protected)/*` route into the new module structure.
- A `src/domains/*` alias or re-export layer — the decision is final for this PR, not a temporary bridge.

## Validation

- `npm run typecheck`, `npm run lint`, `npm test` all pass with the new modules present (see `docs/product-architecture/09-product-implementation.md`).
- No cross-module deep import exists (grepped and asserted in this PR's review).

## References

- `docs/product-architecture/07-frontend-module-boundaries.md` §6
- `docs/adr/ADR-PMF-058-domain-aligned-frontend-modules.md`
- `docs/product-architecture/09-product-implementation.md`
