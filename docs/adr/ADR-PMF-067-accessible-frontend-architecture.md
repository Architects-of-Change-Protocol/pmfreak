# ADR-PMF-067: Accessible Frontend Architecture

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

No prior PR (PR1–PR6) establishes an accessibility standard for PMFreak's product surface — PR3's screen catalog and navigation contracts specify what exists and how it connects, but not how it must be perceivable, operable, and understandable for users of assistive technology. Left unaddressed until an implementation PR is already underway, accessibility typically becomes a retrofit — audited and patched after screens ship, rather than verified as part of the same review that verifies functional correctness. PR7 is the first PR positioned to fix this before any of PR3's fifty canonical screens exist in code.

## Decision

**Accessibility is a structural property of every route, layout, component, state, and workflow — not a separate, optional pass — with WCAG 2.2 AA as the initial baseline.** Full specification: `07-canonical-frontend-architecture.md` §12.

## Frontend Rules

1. Every route manages focus on navigation (e.g., focus moves to the new screen's primary heading or landmark on client-side navigation) rather than leaving focus stranded on a now-unmounted control.
2. Every layout provides landmark regions and skip links consistent with its position in the layout hierarchy (`07-route-layout-and-navigation-architecture.md` §3).
3. Every Screen's heading hierarchy matches its position in the breadcrumb trail (`03-navigation-contracts.md` §2) — heading levels are never chosen for visual size alone.
4. Every Feature's Command trigger (a button, a form control, a floating action) is keyboard-operable and exposes its pending/success/error state (`07-command-query-and-error-experience.md` §3, §7) to assistive technology via appropriate ARIA live-region or state attributes, not through visual styling alone.
5. Every state transition this document's companions define (pending, confirmation, conflict, error, stale, degraded) is announced to assistive technology, not only rendered visually.
6. Platform-layer shared UI primitives (`07-frontend-module-boundaries.md` §8) are the primary place accessibility primitives (focus trapping for modals, accessible name computation for icons-only controls) are implemented once and reused — not re-implemented per module.

## Alternatives Considered

- **Treat accessibility as a post-implementation audit pass, addressed after PR9+ ships screens.** Rejected: this is the retrofit pattern this ADR exists to avoid — every prior retrofit in software generally costs more than building the requirement in from the same architectural pass that defines routes, layouts, and components (§12 of the parent document explicitly frames this as a structural, not aspirational, property).
- **Target WCAG 2.1 AA instead of 2.2 AA.** Rejected: 2.2 is the current published standard at the time of this ADR and includes success criteria (e.g., focus-appearance, consistent-help) directly relevant to PMFreak's dense, keyboard-navigable Command Center and form-heavy screens; there is no evidenced reason to target an older version.

## Positive Consequences

- Makes accessibility conformance checkable against the same route/layout/screen/state inventory this PR already produces (`07-canonical-frontend-architecture.md` §12, `07-command-query-and-error-experience.md`'s state tables), rather than requiring a separate audit inventory built from scratch later.
- Gives Platform-layer shared primitives a clear responsibility to centralize accessibility mechanics, reducing the chance of inconsistent per-module implementations.

## Negative Consequences

- Adds explicit design and implementation work (focus management, live-region announcements, heading-hierarchy discipline) to every screen rather than treating it as optional polish.

## Risks

- **Automation-gap risk:** automated accessibility tooling catches only a subset of WCAG 2.2 AA criteria (structural issues like missing labels, not all keyboard-operability or focus-management defects) — mitigated by treating automated tooling (exact tool open, §13 of the parent document) as a floor, not a substitute for the state-by-state and route-by-route rules above.

## Security and Data Implications

- None beyond ensuring assistive-technology-exposed state (ARIA live regions, announced errors) never leaks data above the viewer's authorized classification (`05-tenancy-rls-and-data-security.md` §10) — an announced error message follows the same user-safe-message rule as any other error presentation (`06-error-model.md` §2).

## Application Implications

- None — this ADR is scoped entirely to the frontend's presentation and interaction layer.

## Frontend Implications

- Establishes the accessibility baseline every module, route, and companion `07-*` document's state model is expected to satisfy.

## Migration Implications

- Existing screens are accessibility-classified during migration (`07-frontend-migration-strategy.md`) alongside their module/route reclassification — accessibility conformance is one of the gates a route must pass before being considered migrated, not a separate later project.

## Compatibility Implications

- Compatible with any component library/design-system implementation chosen later (§13 of the parent document, open) — this ADR fixes the standard and the structural placement of responsibility, not a specific library's accessibility feature set.

## Out of Scope

- The exact accessibility automation tooling (`07-canonical-frontend-architecture.md` §13, open).
- Conformance auditing of any currently-shipped screen (no code is inspected or modified by this documentary PR).

## Validation

Validation criteria: (1) every state table in `07-command-query-and-error-experience.md` documents an assistive-technology-facing presentation, not only a visual one; (2) `07-route-layout-and-navigation-architecture.md` §3's layout hierarchy names a landmark/skip-link responsibility per layout level.

## References

- `docs/product-architecture/07-canonical-frontend-architecture.md` §12
- `docs/product-architecture/07-route-layout-and-navigation-architecture.md` §3, §6
- `docs/product-architecture/07-command-query-and-error-experience.md`
