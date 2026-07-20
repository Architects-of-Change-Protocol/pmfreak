# PR8 Companion — User Journeys

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `03-user-journeys.md`, `03-screen-catalog.md`, `03-navigation-contracts.md`, `08-ux-principles.md` §3, `08-command-center-experience.md`, `08-ai-interaction-patterns.md`

Purpose: fix, for each of the four persona experiences named in `08-ux-principles.md` §3, the concrete sequence of canonical screens (`03-screen-catalog.md`) and interaction points a session actually walks through. `03-user-journeys.md` (PR3) already ratifies entry flows and default landings per persona at the information-architecture level; this document is the UX-layer restatement — what the persona *sees and does at each step*, not merely which route they land on.

## 1. Journey Notation

Each journey is a named sequence of canonical screens, with the governing question (`08-ux-principles.md` §3) restated at the point in the journey it gets answered, and the Command(s)/Query(ies) involved named where a step is a mutation. No journey step introduces a screen, Command, or Query absent from `03-screen-catalog.md` / `06-command-catalog.md` / `06-query-catalog.md`.

## 2. Project Manager — "What needs my attention today?"

Default landing per `03-user-journeys.md`: Workspace Home (Independent PM) or Project Command Center (PM as team member, entering via a specific Project).

```
Sign-in
  → Workspace Home / My Execution Center
      Today's priorities: 🔴 critical risks, 🟡 pending decisions, 🟢 completed actions
      AI recommendations (summarized, `08-ai-interaction-patterns.md` §2)
      Upcoming milestones
  → Project Command Center (selecting a flagged project)
      Attention Required zone → Risk detail (`03-canonical-information-architecture.md` §5 Risks register)
  → Recommendation review (`08-ai-interaction-patterns.md` §2)
      ApproveRecommendation → Decision recorded (`08-ai-interaction-patterns.md` §1)
  → CreateActionFromDecision → Action tracked in Tasks register
  → RecordOutcome (once Action completes)
```

My Execution Center is not a new screen — it is the PM's entry composition of Workspace Home / Project Command Center zones already ratified in `03-screen-catalog.md`, presented per `08-ux-principles.md` §4's priority order (Risks → Decisions → Blockers → Recommendations → Actions in flight). The journey's terminal state on any given visit is either a cleared attention list (Empty state, `08-command-center-experience.md` §5) or a set of Decisions still pending — never an unbounded backlog with no visible end.

## 3. PMO Manager — "What is the health of my portfolio?"

Default landing: PMO Home, immediately followed by PMO Command Center for any owned Portfolio/Program showing degraded health.

```
Sign-in
  → PMO Home
  → PMO Command Center
      Execution Health zone: Portfolio health rollup (`08-command-center-experience.md` §1)
      Attention Required zone: Projects at risk, resource conflicts, schedule variance
  → Resource conflict view (`08-information-visualization.md` §3) — drilling into an over-allocation flagged in Attention Required
  → Portfolio Command Center or Program Command Center (drilling into a specific degraded entity)
  → AI Insights (Recommendations scoped to that Portfolio/Program, `08-ai-interaction-patterns.md` §2)
  → ApprovalFlow (approve/reject a scheduling or resourcing Recommendation)
```

The PMO Manager's journey is distinguished from the PM's by scope, not by pattern — the same four-zone Command Center shape (`08-command-center-experience.md` §1), the same Recommendation disclosure shape (`08-ai-interaction-patterns.md` §2), composed over PMO/Portfolio/Program-scoped Queries instead of a single Project's. No PMO-specific screen shape is invented; `03-canonical-information-architecture.md`'s "one screen, one purpose, entity-parameterized" pattern is why the two journeys share this much structure.

## 4. Executive — "Do I need to intervene?"

Default landing per `03-user-journeys.md`: Enterprise or PMO Command Center, read-weighted (an Executive's authorization typically does not extend to `RecordDecision` at the Project level — see §6 Permission-Aware States below).

```
Sign-in
  → Executive Brief (Enterprise/PMO Command Center composition)
      Business outcomes (Outcome records rolled up, `01-canonical-domain-model.md`)
      Strategic risks (highest-severity RAID items across Portfolios)
      Investment status (Portfolio-level)
      Major decisions needed (Pending Decisions zone, filtered to Executive-authority items)
  → Decision detail (`08-ai-interaction-patterns.md` §1) — only for Decisions requiring Executive-level approval
  → ApprovalFlow (`08-ai-interaction-patterns.md` §6) — the one mutation an Executive journey typically includes
```

The Executive Brief is the same Command Center shape as §2–§3, scoped to Enterprise/PMO level and weighted toward the Execution Health and Attention Required zones over granular register drill-down — an Executive's journey is intentionally short: the governing question ("do I need to intervene") is answerable from the Command Center's top-level state alone in the common case, with drill-down reserved for the Decisions that actually need Executive judgment.

## 5. Enterprise Administrator — "Is the system operating correctly?"

Default landing: Governance Center (`03-canonical-information-architecture.md` §7 Administration screens).

```
Sign-in
  → Governance Center
      Users — membership/role state across Workspaces
      Permissions — authorization policy state
      Agents — Agent Definition/Configuration catalog (`08-ai-interaction-patterns.md` §4)
      Policies — governance policy state
      Audit — append-only authority/audit history (`01-canonical-domain-model.md`, ADR-PMF-036)
  → Agent Card detail (`08-ai-interaction-patterns.md` §4) — reviewing a specific Agent's status/capabilities
  → Audit trail detail — investigating a specific Decision/Action's provenance
```

The Administrator's journey is the one persona journey with no Recommendation/Decision approval step by default — its governing question is about system correctness, not project execution, and its primary interaction is inspection (Users, Permissions, Agents, Policies, Audit) rather than approval. Where an Administrator does act (disabling an Agent's Configuration, revoking a permission), that action is a Command against the Governance Center's own screens, out of this document's scope (`03-screen-catalog.md`'s Administration screen catalog is authoritative for that surface).

## 6. Cross-Journey Rule: Permission-Aware Continuity

Any journey step reaching a screen or a `08-ai-interaction-patterns.md` §6 `ApprovalFlow` the current user cannot act on renders the permission-aware state `08-accessibility-guidelines.md` §6 fixes ("You can view this project but cannot approve decisions") rather than hiding the step outright — a journey never silently truncates; it explains the boundary the user has hit.

## Validation Notes

Every screen, zone, Command, and Query named in this document traces to `03-screen-catalog.md`, `03-user-journeys.md`, `06-command-catalog.md`, `06-query-catalog.md`, `08-command-center-experience.md`, and `08-ai-interaction-patterns.md` — no new screen or entry flow is introduced; this document sequences already-ratified screens into persona journeys and states which zone/pattern answers each persona's governing question at each step. No code, route, or component was created or modified to produce it.
