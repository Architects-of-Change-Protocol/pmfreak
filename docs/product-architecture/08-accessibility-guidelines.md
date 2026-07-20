# PR8 Companion — Accessibility Guidelines

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `docs/adr/ADR-PMF-067-accessible-frontend-architecture.md` (binding, not superseded), `07-canonical-frontend-architecture.md` §12, `07-command-query-and-error-experience.md`, ADR-PMF-074

Purpose: PR7 already made accessibility a structural, binding requirement (ADR-PMF-067) at the level of routes, layouts, Screens, Features, and state transitions. PR8 does not reopen or restate that decision — it extends it to the visual and component level PR7 deliberately left open, so that the Enterprise Components (`08-design-system.md` §3) and the specific patterns (`08-command-center-experience.md`, `08-ai-interaction-patterns.md`) this sprint defines are accessible by construction, not by later retrofit.

## 1. Standard

WCAG 2.2 AA, as fixed by ADR-PMF-067, is the baseline for every screen, component, and interaction pattern this PR8 series defines. PR8 introduces no new standard and no exception to it.

## 2. Keyboard Navigation

Every interactive element PR8 defines is keyboard-operable, restating ADR-PMF-067 Frontend Rule 4 at the component level:

- **`ApprovalFlow`** (`08-ai-interaction-patterns.md` §6): both approve and reject controls are reachable by Tab, activatable by Enter/Space, and the confirmation dialog `07-command-query-and-error-experience.md` §4 requires traps focus until resolved or explicitly dismissed with Escape.
- **Command Center zones** (`08-command-center-experience.md` §1): each zone's items are a keyboard-navigable list (arrow-key or Tab traversal, consistent with the platform's chosen list-widget pattern), not a set of divs requiring a mouse.
- **Evidence Panel** (`08-ai-interaction-patterns.md` §5): opens without stealing focus unexpectedly, and its dismissal returns focus to the control that opened it (restating ADR-PMF-067 Frontend Rule 1's route-level focus-management rule at the component level).
- **Dependency graph and visualization views** (`08-information-visualization.md` §3): every visualization has a keyboard- and screen-reader-accessible equivalent (a structured list/table of the same underlying data) — a graph or chart is never the *only* way to access the information it encodes.

## 3. Focus States and State Announcement

Every Enterprise Component in `08-design-system.md` §3 has a visible, non-color-only focus indicator (WCAG 2.2's focus-appearance criterion, the reason ADR-PMF-067 chose 2.2 over 2.1). Restating ADR-PMF-067 Frontend Rule 5 per component:

- `RiskBadge` and `HealthIndicator` severity changes are announced via ARIA live regions when they update in a currently-open view (e.g., a Command Center left open across a background refresh), not only re-rendered visually.
- `ApprovalFlow`'s pending/success/error states (submitting `ApproveRecommendation`, `RejectAgentProposal`, etc.) are announced, not only shown via a disabled-button style — restating `07-command-query-and-error-experience.md`'s pending-state rule with ADR-PMF-067's assistive-technology requirement.
- Motion (`08-design-system.md` §2) never carries state information alone — every transition has a corresponding text/ARIA state change; an item fading out to indicate "approved" also updates an accessible status message.

## 4. Color Independence

Every semantic color use PR8 defines carries a redundant, non-color signal, restating `08-design-system.md` §2's token requirement as an explicit accessibility rule:

| Element | Color signal | Redundant signal |
| --- | --- | --- |
| `RiskBadge` severity | Red/yellow/green family | Icon (🔴/🟡/🟢 equivalents) + text label ("Critical", "At Risk", "On Track") |
| `HealthIndicator` | Color-banded percentage | Numeric percentage + qualitative band text, always co-rendered |
| `ConfidenceScore` | None (never color-coded alone per `08-ai-interaction-patterns.md` §2.1) | Numeric percentage + basis text |
| AI-generated content label | Optional accent color | Always accompanied by literal "AI-generated" text, never color alone |

No PR8 pattern relies on color as the *only* signal for severity, status, or confidence — this is checkable directly against the table above.

## 5. Screen Readers

Restating ADR-PMF-067 Frontend Rules 2–3 as applied to PR8's specific screens: the Command Center's four zones (`08-command-center-experience.md` §1) are landmark regions with accessible names ("Attention Required," "AI Recommendations," "Pending Decisions," "Execution Health") matching their visible headings exactly (no visually-hidden text diverging from the visible label — `02-canonical-product-language.md`'s one-name-one-meaning rule applied to accessible names). The Decision card (`08-ai-interaction-patterns.md` §1) and Recommendation disclosure (`08-ai-interaction-patterns.md` §2) expose their five parts in reading order matching visual order — a screen-reader user encounters Problem before Recommendation before Approval, identically to a sighted user's visual scan order.

## 6. Permission-Aware States

A screen a user can view but not fully act on states that limitation explicitly, never by simply hiding or silently disabling a control with no explanation:

```
You can view this project but cannot approve decisions.
```

This presentation is required wherever `06-error-model.md`'s `AuthorizationError` would otherwise be returned for an action the user can see but not perform (e.g., a Guest or read-only Consultant viewing a Project Command Center's Pending Decisions zone, `03-canonical-information-architecture.md`'s Guest/read-only screen state) — restating `03-screen-catalog.md` §1's universal Read-only (Guest) state with the explicit, named messaging pattern this document fixes. A disabled `ApprovalFlow` control without this message is a defect: a user must always understand *why* a control is unavailable, not just that it is.

## 7. Required Non-Permission States

Restating the loading/empty/error state model `07-command-query-and-error-experience.md` and `08-command-center-experience.md` §5 already fix, with the accessibility-specific requirement that each is announced (§3):

- **Loading** — a skeleton matching the populated shape, never a bare "Loading…" string with no structural placeholder (`08-command-center-experience.md` §5).
- **Empty** — a stated positive or a call to action (e.g., "No decisions yet. Create your first decision workflow."), never a bare "Nothing here" with no next step.
- **Error** — a stated failure plus a named recovery action (e.g., "Unable to load project health. Retry."), never a generic, unhandled fallback — restating `06-error-model.md`'s fourteen-category requirement that no error category falls through undefined.
- **Permission** — §6 above.

## 8. Verification

Per `08-canonical-ux-design-architecture.md` §10 (Validation), a future implementation PR verifies this document against: (1) every Enterprise Component in `08-design-system.md` §3 has a documented keyboard interaction and a documented ARIA live-region/state-announcement behavior; (2) every semantic color use maps to a row in §4's table; (3) automated tooling (exact tool remains open per ADR-PMF-067) is a floor, not a substitute, for the state-by-state and component-by-component rules above.

## Validation Notes

This document extends, and does not contradict or reopen, ADR-PMF-067. Every rule stated here is either a direct restatement of an existing ADR-PMF-067 Frontend Rule applied to a PR8-specific component/pattern, or a new, narrower rule (§4's color-independence table, §6's permission-state message) that is additive to, not in tension with, PR7's structural accessibility requirement. No code, route, or component was created or modified to produce it.
