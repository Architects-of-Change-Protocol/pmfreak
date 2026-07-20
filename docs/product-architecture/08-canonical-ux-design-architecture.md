# PR8 — Canonical UX / Visual Design Architecture

Status: Documentary architecture (no implementation)
Authority order: `01-canonical-domain-model.md` → `01.1-domain-ratification.md` → `02-canonical-product-language.md` → `03-canonical-information-architecture.md` and its companions (`03-screen-catalog.md`, `03-navigation-contracts.md`, `03-user-journeys.md`) → `04-canonical-application-architecture.md` and its companions → `docs/adr/ADR-PMF-001` through `ADR-PMF-032` → `05-canonical-persistence-architecture.md` and its companions → `ADR-PMF-033` through `ADR-PMF-044` → `06-canonical-api-contracts.md` and its companions → `ADR-PMF-045` through `ADR-PMF-056` → `07-canonical-frontend-architecture.md` and its companions → `ADR-PMF-057` through `ADR-PMF-068` → this document and its companions (`08-*`) and `ADR-PMF-069` through `ADR-PMF-074`.

Companion documents:
- `08-ux-principles.md` — UX philosophy, binding principles, persona-differentiated experience, prioritization and rejection rules
- `08-design-system.md` — foundation tokens, the seven Enterprise Components, governance model, open design decisions
- `08-user-journeys.md` — per-persona screen sequences (PM, PMO Manager, Executive, Enterprise Administrator)
- `08-command-center-experience.md` — the four-zone Command Center shape, composition rules, per-zone states
- `08-ai-interaction-patterns.md` — Decision object, AI Recommendation disclosure, Agent Card/Run, Evidence Panel, approval flow
- `08-information-visualization.md` — question-first visualization standard, canonical question-to-visual map
- `08-accessibility-guidelines.md` — WCAG 2.2 AA extension of ADR-PMF-067 at the component level, permission-aware states
- `08-responsive-strategy.md` — desktop-first enterprise strategy, scoped mobile use cases (approval, tracking, alerts)

---

## 1. Executive Summary

PR1 through PR7 ratified what PMFreak *is* (domain), what it *says* (language), what a user *sees and does* (information architecture), how it is *built internally* (application architecture), how it is *stored* (persistence architecture), how an external caller *invokes* it (API contracts), and how its own frontend is *structured* (frontend architecture: layers, modules, routes, state, contract access). None of them says how PMFreak *feels* — how a Project Manager, a PMO Manager, an Executive, or an Enterprise Administrator experiences the screens `03-screen-catalog.md` already ratifies, the Commands and Queries `06-canonical-api-contracts.md` already exposes, and the AI surfaces `04-ai-agent-application-architecture.md` already governs. Left unspecified, that gap is filled the way every other unspecified gap in this codebase has been filled before it was named: one screen, one ad hoc layout, one inconsistent severity color at a time — until "enterprise PMO tool" and "generic admin dashboard" become visually indistinguishable. PR8 exists to close that gap before a single pixel of PR9+ implementation is drawn.

**PMFreak optimizes decisions, not tasks.** This is PR8's one load-bearing claim, and every other decision in this document and its companions is a consequence of it. A traditional PM tool answers "what tickets do I have"; PMFreak answers "what needs my attention for this project to succeed." The distinction is not tone — it is why `01-canonical-domain-model.md`'s Recommendation → Decision → Action → Outcome chain and `04-ai-agent-application-architecture.md`'s Agent Run → Proposal → Approval → Command chain are domain concepts PMFreak's UI exists to surface, not incidental features a dashboard happens to include.

**The interface prioritizes attention, not enumeration.** Risks, pending Decisions, blockers, and Recommendations are always shown before completed items and steady-state data; no canonical screen defaults to an unranked, undifferentiated list (`08-ux-principles.md` §4–§5).

**Every Command Center is the same four-zone shape, entity-parameterized.** Attention Required → AI Recommendations → Pending Decisions → Execution Health, identically ordered whether the entity is a Project or the Enterprise itself (`08-command-center-experience.md` §1–§2). This is what lets PMFreak scale from a single Independent PM's Workspace to a multi-Workspace Enterprise without re-inventing its primary surface at every level.

**AI never speaks with a human's authority.** Every Recommendation, Agent Proposal, and confidence value carries its basis, its provenance, and an explicit, prominent human-approval control — never a bare directive, never a percentage with no context (`08-ai-interaction-patterns.md` §2–§4). This is PR8's answer to the sprint brief's central differentiation question: PMFreak earns trust in its Agents by showing its work, not by asking the user to take a black box's word for it.

**Design is a governed system, not a per-screen restyle.** Seven Enterprise Components (`HealthIndicator`, `RiskBadge`, `ConfidenceScore`, `DecisionCard`, `EvidenceViewer`, `AgentStatus`, `ApprovalFlow`) carry every recurring pattern this PR8 series defines; no future screen invents a parallel, differently-styled version of any of them (`08-design-system.md` §3, §5).

**Accessibility is structural, extended, not reopened.** ADR-PMF-067 already made accessibility binding at the route/layout/state level; PR8 extends it to the component and color-encoding level the seven Enterprise Components introduce, without contradicting a single PR7 rule (`08-accessibility-guidelines.md`).

**Desktop-first enterprise, mobile scoped to what actually benefits from mobility.** PMFreak's primary surfaces are built for the density a PMO/operations tool requires; mobile access is deliberately scoped to approval, tracking, and alerts — not a reflow of every canonical screen (`08-responsive-strategy.md`).

What this PR does not do: it does not build a single screen, migrate a single component, touch the backend, create a database table, or invent a new API contract, Command, Query, entity, or screen. Every entity, screen, Command, Query, error category, and architectural rule this document and its companions reference is taken verbatim from PR1–PR7; PR8 fixes how already-ratified information is felt, prioritized, and interacted with — nothing more.

## 2. Purpose

This document exists to make several distinctions explicit, following the same pattern PR4 (§7.2) and PR7 (§2) already used to prevent their own layer from being retrofitted ad hoc:

- **A dashboard is not a Command Center, and PR8 does not build the former under the latter's name.** `02-canonical-product-language.md` already forbids using "Dashboard" and "Command Center" as synonyms; PR8 makes the *experiential* consequence of that distinction explicit — a Dashboard may exist inside a Command Center (a chart, a metric card), but the reverse never happens, and no Command Center is designed as though enumerating charts were its purpose (`08-command-center-experience.md` §1, §6).
- **A Recommendation is not a Decision, visually or interactively, anywhere.** Restated a fourth time across this codebase (domain invariant in PR1, application rule in PR4, frontend rule in PR7 ADR-PMF-030, and now UX law in `08-ux-principles.md` §2 Principle 4) because it is the single rule most likely to be silently violated by a well-intentioned "streamlined" approval UI in a future PR.
- **A visualization is not decoration.** `08-information-visualization.md` §1 makes "every visualization answers a named question, for a named persona" a checkable requirement, not a design aspiration — a future PR adding a chart with no entry in that document's question map has violated this PR.
- **Accessibility is not a v2 concern.** PR8 does not treat WCAG conformance as separable from the seven Enterprise Components' definition — `08-accessibility-guidelines.md` is written as an extension of those components' specification, not a checklist applied after the fact.
- **Mobile is not "responsive by default."** `08-responsive-strategy.md` names exactly three mobile use cases as in scope; a future PR building a full mobile port of the Command Center has exceeded this PR's ratified scope, not merely gone further than necessary.

## 3. Relationship to PR1–PR7

| Prior PR | What it fixed | What PR8 does with it |
| --- | --- | --- |
| PR1 — Domain Model | Enterprise, Workspace, PMO, Portfolio, Program, Project, Decision, Action, Outcome, Recommendation, Agent, RAID items, and the no-auto-promotion invariant chain | Represents these objects visually (`08-ai-interaction-patterns.md` §1, `08-design-system.md` §3), never adds or renames one |
| PR3 — Information Architecture | The 50-screen catalog, 6 Command Centers, navigation edges, breadcrumb model, 9 personas, 10 IA Principles | Decides visual hierarchy, priority, grouping, and interaction atop this navigation (`08-ux-principles.md`, `08-command-center-experience.md`, `08-user-journeys.md`) |
| PR6 — API Contracts | Command/Query naming, the 14 error categories, idempotency, optimistic concurrency, the four-Command approval chain, the four-Command Agent surface | Decides how each error category, pending state, and Command outcome is shown and confirmed (`08-accessibility-guidelines.md` §7, `08-ai-interaction-patterns.md` §6) |
| PR7 — Frontend Architecture | Layer model, module boundaries, routes, state taxonomy, Command/Query experience states, Recommendation→Decision→Action→Outcome and Agent Run→Proposal→Approval→Command frontend rules, ADR-PMF-067 accessibility baseline | Fixes the exact visual/interaction shape those already-ratified rules take (`08-ai-interaction-patterns.md`, `08-accessibility-guidelines.md`) |

## 4. UX Philosophy (Summary)

Full principles, persona table, and prioritization/rejection rules: `08-ux-principles.md`.

PMFreak optimizes decisions, not tasks (§1 above). Ten binding UX Principles govern every screen: optimize decisions over tasks; attention is finite and designed; evidence precedes inference precedes recommendation precedes decision; Recommendation/Decision/Action/Outcome are never conflated; reduce cognitive load through hierarchy, not omission; confidence is qualified, never bare; human approval is first-class; one screen answers one question; the interface never asks the user to interpret what it could already have interpreted; vocabulary is fixed to `02-canonical-product-language.md`.

## 5. Persona Experience (Summary)

Full journeys: `08-user-journeys.md`. Full persona table: `08-ux-principles.md` §3.

| Persona | Governing question | Primary surface |
| --- | --- | --- |
| Project Manager | What needs my attention today? | My Execution Center |
| PMO Manager | What is the health of my portfolio? | PMO Command Center |
| Executive | Do I need to intervene? | Executive Brief |
| Enterprise Administrator | Is the system operating correctly? | Governance Center |

## 6. Command Center Experience (Summary)

Full zone model, composition rules, and per-zone states: `08-command-center-experience.md`.

Every Command Center — Enterprise, Workspace, PMO, Portfolio, Program, Project — shares one four-zone shape (Attention Required, AI Recommendations, Pending Decisions, Execution Health), composes Query results without accumulating independent state (ADR-PMF-065, restated at UX layer), and degrades per-zone rather than as a whole when one composed source fails.

## 7. AI Interaction Patterns (Summary)

Full Decision, Recommendation, Agent, and Evidence specifications: `08-ai-interaction-patterns.md`.

A Decision is a five-part composed object (Problem, AI Analysis, Recommendation, Impact, Evidence, Approval), never a table row. Every AI Recommendation discloses Why, Evidence, Confidence, and Expected Impact before offering an approval control. Every Agent is presented as a governed capability (Agent Card) whose executions are auditable traces (Agent Run), never a chat persona. Every claim's basis is reachable within one interaction via the Evidence Panel.

## 8. Design System (Summary)

Full token catalog, Enterprise Component catalog, and governance model: `08-design-system.md`.

Foundation tokens (color, typography, spacing, grid, icons, motion) and seven Enterprise Components (`HealthIndicator`, `RiskBadge`, `ConfidenceScore`, `DecisionCard`, `EvidenceViewer`, `AgentStatus`, `ApprovalFlow`) are the complete visual vocabulary this PR8 series requires; exact values (palette, type scale, component-library choice) remain open, resolved with evidence during PR9+.

## 9. Information Visualization, Accessibility, and Responsive Strategy (Summary)

Full specifications: `08-information-visualization.md`, `08-accessibility-guidelines.md`, `08-responsive-strategy.md`.

Every visualization answers a named question for a named persona — never added because a screen "should have a chart." WCAG 2.2 AA (ADR-PMF-067) is extended, not reopened, to the component and color-encoding level. PMFreak is desktop-first enterprise software; mobile scope is fixed to approval, tracking, and alerts.

## 10. Decision Matrix

| Topic | Decision |
| --- | --- |
| UX philosophy | Optimize decisions, not tasks |
| Attention model | Risks → Pending Decisions → Blockers → Recommendations → Actions in flight |
| Command Center shape | Four zones, fixed order, entity-parameterized |
| Command Center state model | Composition, never independent state; per-zone degradation |
| Recommendation/Decision/Action/Outcome | Four distinct visual/interactive states, never conflated |
| AI disclosure | Why, Evidence, Confidence, Expected Impact, always, before approval |
| Agent presentation | Governed capability card + auditable run trace, never a chat persona |
| Evidence | Reachable within one interaction from any claim |
| Design system | Governed token set + 7 named Enterprise Components |
| Visualization | Question-first; no decorative charts |
| Accessibility | WCAG 2.2 AA, extending ADR-PMF-067 to component/color level |
| Device strategy | Desktop-first enterprise; mobile scoped to approval/tracking/alerts |
| Visual tone | Trustworthy, intelligent, clear, in control — not gamified, not chat-first, not a financial-dashboard chart wall |

## 11. Open UX/Design Decisions

Deliberately left open, mirroring `07-canonical-frontend-architecture.md` §13's precedent — resolved with evidence during PR9+ implementation, not guessed here:

- Exact color palette, type scale, spacing scale, icon set, motion values (`08-design-system.md` §6).
- Component-library implementation and design-token tooling (`08-design-system.md` §6).
- Exact confidence-band thresholds (`08-ai-interaction-patterns.md` §2.1).
- Exact breakpoint pixel values and tablet-tier treatment (`08-responsive-strategy.md` §4).
- Native mobile application (explicitly out of scope, restated from `07-canonical-frontend-architecture.md` §13).
- Accessibility automation tooling (restated as still-open from ADR-PMF-067).
- Dark-mode token mapping.
- Bulk-approval interaction (no composite Command exists in `06-command-catalog.md` for it; not designed here).
- Any screen, entity, Command, or Query not already ratified in PR1–PR7 — PR8 introduces none.

## 12. Validation

This PR is validated against the following, restating the sprint brief's own checklist:

- `npm run typecheck` and `npm test` pass unchanged — PR8 modifies no source file, so both must be a no-op relative to `main`.
- Boundary checks: no PR8 document references a screen, entity, Command, Query, or error category not already ratified in `03-screen-catalog.md`, `01-canonical-domain-model.md`, `06-command-catalog.md`, `06-query-catalog.md`, or `06-error-model.md`.
- Documentation consistency: every companion's Authority line names only documents/ADRs that exist at or before PR8 in the authority order above; no forward reference to an unratified future PR.
- No contradiction of PR1–PR7: every restated rule (Recommendation≠Decision, WCAG 2.2 AA, projection-composition, contract-client-only data access) is checked against its source ADR/document and not altered.
- No new contract introduced: PR8 adds zero Commands, Queries, entities, or API endpoints — every interaction named in `08-ai-interaction-patterns.md` and `08-command-center-experience.md` dispatches a Command or reads a Query `06-canonical-api-contracts.md` already exposes.

## Validation Notes

This document, its eight companions, and ADR-PMF-069 through ADR-PMF-074 are the complete PR8 deliverable. No route, component, hook, style, dependency, database table, or application/persistence/API artifact was created or modified to produce them. Every entity, screen, Command, Query, error category, chain, and prior ADR referenced was taken verbatim from `01-canonical-domain-model.md` and its companions, `02-canonical-product-language.md`, `03-canonical-information-architecture.md` and its companions, `04-canonical-application-architecture.md` and its companions, `06-canonical-api-contracts.md` and its companions, `07-canonical-frontend-architecture.md` and its companions, and their respective ADRs — none was renamed, reinterpreted, or redefined.
