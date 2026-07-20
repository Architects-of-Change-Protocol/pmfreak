# PR8 Companion — Responsive Strategy

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `08-ux-principles.md` §3 (persona table), `08-command-center-experience.md`, `08-ai-interaction-patterns.md` §6 (approval), ADR-PMF-070 (Command Center Experience — desktop-density implications)

Purpose: fix PMFreak's device strategy as a deliberate scope decision per surface, not a uniform "make everything responsive" mandate. PMFreak is an enterprise PMO/operations tool first; its primary surfaces are built for the density that role requires, and mobile is scoped to the specific interactions that genuinely benefit from being available away from a desk.

## 1. Desktop-First Enterprise, Not Desktop-Only

PMFreak's primary user (`08-ux-principles.md` §3: PM, PMO Manager, Executive, Enterprise Administrator) does the bulk of their PMFreak work at a desk, composing multiple Command Center zones (`08-command-center-experience.md` §1), reviewing Evidence Panels (`08-ai-interaction-patterns.md` §5), and working through registers (`03-canonical-information-architecture.md` §5) that benefit from screen width — a Dependency graph (`08-information-visualization.md` §3) does not compress meaningfully to a phone screen without losing the exact information it exists to show. This is a considered scope decision, not an oversight: PMFreak is a PMO and operations tool, not a consumer app, and its primary surfaces are designed for desktop density first, with tablet/mobile as a *reduced, deliberately scoped* second surface — never a naive reflow of the desktop layout.

## 2. What Mobile Is For

Per the founding brief and `08-ux-principles.md` §3's persona table, mobile access exists for exactly three interaction classes — not a mobile port of every canonical screen:

| Mobile use case | Screens/patterns in scope | Rationale |
| --- | --- | --- |
| **Approval** | `ApprovalFlow` (`08-ai-interaction-patterns.md` §6) — approving/rejecting a Recommendation or Agent Proposal | A Decision often cannot wait for the approver to be at a desk; the disclosure shape (`08-ai-interaction-patterns.md` §2) is designed to remain legible at reduced width because it is already a short, structured five-part card, not a dense table |
| **Tracking** | Command Center's Attention Required and Execution Health zones, read-only (`08-command-center-experience.md` §1) | A PM or Executive checking status away from a desk needs the prioritized summary, not the full composition surface |
| **Alerts** | Notification of new Risks, pending Decisions, Agent Proposals awaiting review | Time-sensitive attention items (`08-ux-principles.md` §2 Principle 2) benefit from reaching the user wherever they are |

Everything outside these three — full Command Center composition and configuration, the Dependency graph and other detailed visualizations (`08-information-visualization.md` §3), Administration/Governance Center screens (`03-canonical-information-architecture.md` §7), and any multi-field creation form — is explicitly **out of mobile scope** for the surfaces this PR8 series defines. A future PR may extend mobile scope; PR8 does not guess that extension in advance (§4).

## 3. Breakpoint Strategy

Named as a strategy, not exact pixel values (left to `08-design-system.md` §2's Grid token, resolved during PR9+ implementation):

- **Desktop (primary)** — full Command Center four-zone layout (`08-command-center-experience.md` §1), full register tables, full Evidence Panel and Dependency graph detail.
- **Tablet (reduced)** — Command Center zones stack vertically but remain fully present; registers remain usable but denser visualizations (Dependency graph) may require horizontal scroll rather than further compression, per `08-information-visualization.md` §3's "the visual is the subject" rule — a graph is never compressed to illegibility to fit a breakpoint.
- **Mobile (scoped)** — §2's three use cases only; a canonical screen not in that scope either renders a reduced, tracking-only view (Command Center) or is not optimized for mobile at all (Administration, detailed visualizations, multi-field forms) — the latter case degrading gracefully to a usable-but-not-optimized desktop-layout view (never a broken one), consistent with `07-canonical-frontend-architecture.md`'s server-first rendering model rather than a separate mobile codebase.

## 4. What This Document Does Not Decide

- Exact breakpoint pixel values (`08-design-system.md` §6, open).
- A native mobile application (`07-canonical-frontend-architecture.md` §13 already lists native mobile as explicitly open/out of scope for the frontend architecture; PR8 does not reopen it).
- Push notification delivery mechanics for the Alerts use case (§2) — a future PR's concern, not a UX-architecture one.
- Offline behavior.
- Whether tablet is treated as its own breakpoint tier or folded into desktop/mobile at implementation time.

## Validation Notes

The three mobile use cases (Approval, Tracking, Alerts) and the "desktop-first enterprise" framing are taken directly from the PR8 sprint brief and cross-checked against `08-ux-principles.md`'s persona table and `08-command-center-experience.md`'s zone model — no new screen, entity, Command, or Query is introduced. This document fixes device-scope strategy only; exact breakpoints and any native-mobile decision remain open, consistent with `07-canonical-frontend-architecture.md` §13's precedent for leaving implementation-specific choices open at the architecture stage. No code, route, or component was created or modified to produce it.
