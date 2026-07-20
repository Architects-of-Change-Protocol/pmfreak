# PR8 Companion — Design System

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `02-canonical-product-language.md` (canonical vocabulary), `07-frontend-module-boundaries.md` §8 (Platform layer), `08-ux-principles.md`, `08-command-center-experience.md`, `08-ai-interaction-patterns.md`, ADR-PMF-072

Purpose: fix the foundation tokens and the enterprise component catalog PMFreak's visual language is built from, and the governance model that keeps them from drifting. This document fixes *what exists and what it must do*; it does not fix hex values, exact type scales, or a specific component-library implementation — those are open, per §6, exactly as `07-canonical-frontend-architecture.md` §13 leaves the equivalent frontend-tooling choices open.

## 1. Visual Language

PMFreak must read as: **trustworthy, intelligent, clear, in control.** It must not read as: a game (no badges-for-badges'-sake, no gamified progress bars unrelated to real execution health), a chatbot (no bubble-and-avatar conversational chrome as the primary interaction model — Project Memory and Enterprise Intelligence are record stores, not transcripts, `07-ai-memory-and-intelligence-experience.md` §3), or a financial dashboard (no wall of undifferentiated sparklines competing for equal attention). Reference points for tone, not for literal reuse: Palantir (density with hierarchy), ServiceNow (governed enterprise workflow), Datadog (health/severity at a glance), Linear (restraint, speed, typographic clarity), Notion (calm information density). None of these is PMFreak's visual identity; each is evidence that "enterprise" and "calm" are not in tension.

## 2. Foundation Tokens

Named as a governed token set (`07-frontend-module-boundaries.md` §8 Platform layer owns the implementation); exact values are an open decision (§6) but every token category below is required to exist before any PR9+ component consumes it:

| Category | Governs | Binding requirement |
| --- | --- | --- |
| Color | Brand, semantic (success/warning/critical/info), neutral scale, Health/Risk severity scale | Every semantic color has a non-color-dependent redundant signal (icon, label, pattern) — `08-accessibility-guidelines.md` §4 |
| Typography | Type scale, weight scale, line-height | Heading levels map to `03-navigation-contracts.md` §2 breadcrumb depth, never chosen for visual size alone (restated from ADR-PMF-067) |
| Spacing | A single spacing scale (4/8px-family or equivalent) | Consumed by every Enterprise Component in §3 — no component defines ad hoc spacing outside the scale |
| Grid | Responsive breakpoints, container widths | Aligned to `08-responsive-strategy.md`'s desktop-first breakpoints |
| Icons | A single icon set, semantic mapping (risk, decision, agent, evidence) | Every icon used for a semantic meaning (severity, status) is documented once, reused everywhere — never redrawn per screen |
| Motion | Transition durations/easing, reduced-motion behavior | Every motion respects `prefers-reduced-motion`; motion never carries meaning alone (a state change is never *only* an animation — `08-accessibility-guidelines.md` §3) |

## 3. Enterprise Components (Catalog)

These are the components PMFreak's UX cannot be assembled correctly without — each traces to a pattern already fixed by a PR8 companion, none is invented by this section, only cataloged and given a governance boundary:

| Component | Purpose | Specified in |
| --- | --- | --- |
| `HealthIndicator` | Renders an entity's aggregate health (percentage + qualitative band) | `08-command-center-experience.md` §1 Execution Health zone |
| `RiskBadge` | Renders a Risk/Issue's severity with redundant non-color signal | `08-command-center-experience.md` §1 Attention Required zone, `08-accessibility-guidelines.md` §4 |
| `ConfidenceScore` | Renders an AI confidence value adjacent to its basis, never in isolation | `08-ai-interaction-patterns.md` §2.1 |
| `DecisionCard` | Renders the five-part Decision composition | `08-ai-interaction-patterns.md` §1 |
| `EvidenceViewer` (Evidence Panel) | Renders the five-section evidence disclosure, links into Document/Evidence screen | `08-ai-interaction-patterns.md` §5 |
| `AgentStatus` | Renders an Agent Card's status/capabilities/last-run summary | `08-ai-interaction-patterns.md` §4 |
| `ApprovalFlow` | Renders the two-action (approve/reject) governed-approval interaction | `08-ai-interaction-patterns.md` §6 |

Each component's props/API shape is left to PR9+ implementation; this catalog fixes only that these seven concepts must exist as named, reusable Platform-layer or Domain-Presentation-layer components (`07-canonical-frontend-architecture.md` §5's layer model) — no future PR reinvents `RiskBadge` as a one-off per screen, and no screen renders a Health value, a confidence score, a Decision, an Evidence disclosure, an Agent's status, or an approval interaction without going through the corresponding component.

## 4. Component Layer Placement

Per `07-canonical-frontend-architecture.md` §5's six-layer model, every Enterprise Component in §3 is Domain Presentation (domain-aware, framework-agnostic, receives already-fetched view models as props) — never Platform (Platform is domain-free) and never a Feature (a Feature composes these components with a Command trigger; the component itself does not dispatch Commands). `ApprovalFlow` is the one partial exception worth naming explicitly: it renders the approve/reject controls, but the actual Command dispatch (`ApproveRecommendation`, `RejectRecommendation`, etc.) is wired by the Feature that composes it, consistent with `07-frontend-module-boundaries.md`'s prohibition on Domain Presentation performing data access.

## 5. Governance Model

A design system that drifts screen-by-screen is indistinguishable from having none. Binding governance rules:

1. **One component, one meaning.** `RiskBadge` renders Risk/Issue severity and nothing else; a screen inventing a second, differently-styled "severity chip" for the same concept is a defect, not a variant.
2. **Tokens before values.** No component or screen hardcodes a color, spacing value, or type size outside the token set in §2 — restated from `02-canonical-product-language.md`'s "one concept, one name" principle, applied to visual tokens instead of words.
3. **New enterprise components require a named gap.** A future PR adding an eighth Enterprise Component states which of `08-ux-principles.md`'s principles or which PR8 companion's pattern it renders — a component invented without a traceable pattern re-introduces the ad hoc accretion `07-canonical-frontend-architecture.md` §1 already diagnosed as PMFreak's default failure mode.
4. **The design system is reviewed at the same cadence as the API contract.** Per ADR-PMF-072 (`docs/adr/ADR-PMF-072-design-system-governance.md`): a breaking change to a foundation token or an Enterprise Component's meaning is a governed decision, not a silent restyle.

## 6. Open Design System Decisions

Deliberately left open — resolved with evidence during PR9+ implementation, not guessed here (mirroring `07-canonical-frontend-architecture.md` §13's open-decisions pattern):

- Exact color palette (hex values, semantic-to-brand mapping).
- Exact type scale and font family.
- Exact spacing scale numeric values.
- Exact icon set/library.
- Exact motion durations/easing curves.
- Component-library implementation (build on a headless primitive library vs. fully custom).
- Design token tooling/format (e.g., a token pipeline, CSS custom properties, a themed component library).
- Dark-mode support and its token mapping.
- Exact confidence-band thresholds referenced in `08-ai-interaction-patterns.md` §2.1.
- Storybook or an equivalent visual component workshop (also left open by `07-canonical-frontend-architecture.md` §13).

## Validation Notes

The seven Enterprise Components and their required behavior are drawn directly from the patterns `08-command-center-experience.md`, `08-ai-interaction-patterns.md`, and `08-accessibility-guidelines.md` already fix; this document adds no new interaction rule, only names the components those rules require and places them in `07-canonical-frontend-architecture.md`'s existing layer model. No color value, token value, or component implementation was created. No code, route, or component was created or modified to produce it.
