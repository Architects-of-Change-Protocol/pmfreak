# ADR-PMF-074: Accessibility Standards — Component and Color-Encoding Extension

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-067 already made WCAG 2.2 AA a structural, binding requirement at the level of routes, layouts, Screens, Features, and state transitions. It does not — and, written before any PR8 component existed, could not — fix accessibility requirements for the seven Enterprise Components ADR-PMF-072 now names, or for the specific color-semantic encodings (Risk severity, Health bands, confidence values) `08-design-system.md` and `08-ai-interaction-patterns.md` introduce. Left unfixed, a future PR could satisfy ADR-PMF-067's route/layout-level rules while still shipping a `RiskBadge` that conveys severity through color alone, or a Command Center zone with no accessible name — technically within PR7's letter while violating its spirit at the component level PR7 did not yet have components to specify.

## Decision

**PR8's accessibility requirements extend ADR-PMF-067 to the Enterprise Component and color-encoding level, without superseding, reopening, or contradicting a single existing ADR-PMF-067 rule.** Full specification: `08-accessibility-guidelines.md` §1–§8.

## Frontend Rules

1. Every Enterprise Component (`08-design-system.md` §3) is keyboard-operable per ADR-PMF-067 Frontend Rule 4, with the specific keyboard interaction named per component (`08-accessibility-guidelines.md` §2).
2. Every semantic color use (`RiskBadge`, `HealthIndicator`, `ConfidenceScore`, AI-generated-content labeling) carries a redundant, non-color signal — icon and/or text label — per the table in `08-accessibility-guidelines.md` §4; no PR8 pattern conveys severity, status, or confidence through color alone.
3. State changes in an open view (a Command Center left open across a background refresh, an `ApprovalFlow` submission) are announced via ARIA live regions, not only re-rendered visually, per ADR-PMF-067 Frontend Rule 5 applied to each Enterprise Component (`08-accessibility-guidelines.md` §3).
4. Motion never carries state information alone — every transition co-occurs with a text/ARIA state change (`08-accessibility-guidelines.md` §3, `08-design-system.md` §2's Motion token requirement).
5. A screen a user can view but not fully act on states that limitation explicitly (e.g., "You can view this project but cannot approve decisions") rather than silently hiding or disabling a control with no explanation, whenever `06-error-model.md`'s `AuthorizationError` would otherwise apply to a visible action (`08-accessibility-guidelines.md` §6).
6. The Command Center's four zones (ADR-PMF-070) are landmark regions with accessible names matching their visible headings exactly — no visually-hidden text diverging from what a sighted user reads (`08-accessibility-guidelines.md` §5).

## Alternatives Considered

- **Defer component-level accessibility specification to PR9+ implementation, relying on ADR-PMF-067's structural rules alone.** Rejected: ADR-PMF-067 itself was written specifically to prevent accessibility from becoming a retrofit; deferring its application to the new components and color encodings PR8 introduces would reproduce that retrofit pattern one layer down, at the exact moment PR8 gives it a name (Enterprise Components) to attach requirements to.
- **Write a new, independent accessibility standard for PR8 rather than an extension of ADR-PMF-067.** Rejected: PMFreak already has one binding accessibility baseline; a second, parallel one risks contradiction and forces implementers to reconcile two sources of truth. Extension preserves ADR-PMF-067 as sole authority for the standard (WCAG 2.2 AA) while adding component-specific application.

## Positive Consequences

- Closes the specific gap ADR-PMF-067 could not close at the time it was written (no components existed yet) without touching or risking that ADR's existing, already-accepted rules.
- Gives `08-design-system.md`'s seven Enterprise Components a concrete, checkable accessibility requirement each, rather than a general "be accessible" instruction.

## Negative Consequences

- Adds explicit design and implementation work (redundant color signals, live-region wiring per component, permission-aware messaging) beyond what a route/layout-level accessibility pass alone would require.

## Risks

- **Redundant-signal fatigue risk:** requiring icon plus color plus text label for every severity/status encoding could visually crowd a dense Command Center — mitigated by `08-design-system.md`'s Enterprise Component catalog centralizing this encoding once per component (`RiskBadge`, `HealthIndicator`), rather than requiring each screen to reinvent the balance between density and redundancy.

## Security and Data Implications

- Restated from ADR-PMF-067: assistive-technology-exposed state (ARIA live regions, permission-aware messages) never leaks data above the viewer's authorized classification (`05-tenancy-rls-and-data-security.md` §10) — a permission-aware message (Frontend Rule 5) states that an action is unavailable, never why in terms that would leak information the viewer isn't authorized to see.

## Application Implications

- None — this ADR is scoped entirely to the frontend's presentation and interaction layer, extending ADR-PMF-067's equivalent scope.

## Frontend Implications

- Extends ADR-PMF-067's baseline to `08-design-system.md`'s seven Enterprise Components and `08-command-center-experience.md`'s four-zone landmark structure; does not modify ADR-PMF-067's own Frontend Rules.

## Migration Implications

- Existing screens are accessibility-classified during migration (`07-frontend-migration-strategy.md`) against both ADR-PMF-067's structural rules and this ADR's component/color-encoding rules together, as one combined gate — not two separate passes.

## Compatibility Implications

- Compatible with any component-library implementation or accessibility automation tooling chosen later (both remain open per ADR-PMF-067 and `08-design-system.md` §6) — this ADR fixes the requirement, not the tooling that verifies it.

## Out of Scope

- Exact accessibility automation tooling (still open, per ADR-PMF-067).
- Conformance auditing of any currently-shipped screen (no code is inspected or modified by this documentary PR).

## Validation

Validation criteria: (1) every Enterprise Component in `08-design-system.md` §3 has a documented keyboard interaction and ARIA live-region/state-announcement behavior (`08-accessibility-guidelines.md` §2–§3); (2) every semantic color use maps to a row in `08-accessibility-guidelines.md` §4's redundant-signal table; (3) this ADR's Frontend Rules are cross-checked against ADR-PMF-067's Frontend Rules and confirmed non-contradictory.

## References

- `docs/product-architecture/08-accessibility-guidelines.md`
- `docs/adr/ADR-PMF-067-accessible-frontend-architecture.md`
- `docs/product-architecture/08-design-system.md` §3
- `docs/product-architecture/08-command-center-experience.md` §1
