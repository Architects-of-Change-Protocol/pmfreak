# PR8 Companion — Command Center Experience

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `03-canonical-information-architecture.md` §11 (Command Centers), `04-canonical-application-architecture.md` §9.5 (projection-is-not-a-source-of-truth), ADR-PMF-065, `07-canonical-frontend-architecture.md` §11, `08-ux-principles.md` §4

Purpose: fix the canonical visual and interaction shape of the six Command Centers (Enterprise, Workspace, PMO, Portfolio, Program, Project — `03-canonical-information-architecture.md` §11), the single most-viewed surface family in PMFreak and the clearest test of whether the product reads as a dashboard or as a decision system.

## 1. The Shape

Every Command Center — regardless of which of the six Aggregates it is entity-qualified to — is composed of the same four zones, in the same priority order, per `08-ux-principles.md` §4. A Command Center is never a grid of same-weight charts.

```
COMMAND CENTER — <Entity Name>

ATTENTION REQUIRED
  🔴 Project Alpha delayed
     Decision required today
  🟡 Resource conflict: 2 PMs over-allocated next sprint

AI RECOMMENDATIONS
  🤖 Schedule optimization available — 87% confidence
  🤖 Vendor risk pattern detected in Program Beta

PENDING DECISIONS
  2 approvals waiting
  1 Agent Proposal awaiting review

EXECUTION HEALTH
  Portfolio 87%   ▓▓▓▓▓▓▓▓▓░
  On track: 14   At risk: 3   Delayed: 1
```

- **Attention Required** — open Risks and Issues whose severity crosses the entity's governed threshold, and any blocking Dependency, ranked by severity then recency. Never empty-styled the same as a populated zone (§5, Empty state).
- **AI Recommendations** — reviewed Recommendations (not raw Agent Proposals — §2 below) not yet acted on, each rendered per `08-ai-interaction-patterns.md` §2's required disclosure shape, never a bare "AI says" line.
- **Pending Decisions** — a count and short list of Recommendations/Agent Proposals awaiting the human approval `04-ai-agent-application-architecture.md` requires, never merged into the Recommendations zone (a pending count is a call to action; a Recommendation card is content to evaluate).
- **Execution Health** — the entity's aggregate Health indicator (`08-design-system.md` §3's `HealthIndicator`) plus its immediate breakdown, always last, never the first or largest zone.

## 2. Zone Priority Is Fixed, Content Is Entity-Scoped

The four-zone order in §1 is identical across all six Command Centers; only the underlying Queries composed into each zone change per entity, per the composite-Query pattern `07-canonical-frontend-architecture.md` §11 already fixes:

| Command Center | Attention Required draws from | Execution Health draws from |
| --- | --- | --- |
| Project | Project-scoped Risks/Issues/Dependencies (`03-canonical-information-architecture.md` §5) | Single-project health |
| Program | Aggregated Risk/Issue state across constituent Projects | Program-level schedule/resource rollup |
| Portfolio | Cross-Program/cross-Project risk concentration | Portfolio investment/priority/capacity health |
| PMO | Governance exceptions across owned Portfolios/Programs | PMO-wide health, resource conflicts, schedule variance |
| Workspace | Cross-PMO/cross-direct-Project risk | Workspace-level rollup |
| Enterprise | Cross-Workspace strategic risk | Enterprise-level rollup |

A Command Center never fabricates a zone's content when its underlying Query returns nothing meaningful for that entity level — it renders that zone's Empty state (§5), never omits the zone outright (zone *presence* is structural; zone *population* is data-dependent).

## 3. Composition, Not Ownership

Per ADR-PMF-065 and `04-canonical-application-architecture.md` §9.5, a Command Center screen composes Query results into the four zones above; it never accumulates independent, durable state of its own, and no zone is ever the only place a piece of data lives. Every item in Attention Required, AI Recommendations, and Pending Decisions is a rendering of a Risk, Issue, Recommendation, or Agent Proposal record that also has its own canonical home screen (`03-canonical-information-architecture.md` §5, §9) — a Command Center is a lens on those records, not a second copy of them. This is the same rule PR1 §12 C-3 named for the persisted `pmo_command_center_snapshots` table (a projection that had started accumulating independent state) and PR4 §9.5 restated for the application layer; PR8 restates it a third time as a UX consequence: **nothing is ever editable only from a Command Center** — every action taken from a Command Center zone dispatches the same Command (`06-command-catalog.md`) the item's home screen would dispatch, and every item is a link to that home screen for full context.

## 4. Degraded Composition

Restated from `07-command-query-and-error-experience.md`'s Degraded state: because a Command Center composes multiple Queries, one failing source (a `DependencyUnavailable` on the Health rollup, for instance) degrades only its own zone — the other three zones render normally. A Command Center never blanks entirely because one composed Query failed; the failing zone shows its own Error state (`08-ux-principles.md`'s parent document §7 Error/Empty/Loading conventions, restated per-widget here) with its own retry affordance, scoped to that zone.

## 5. Required States, Per Zone

Each of the four zones independently supports the four states every Query-backed view requires (`07-command-query-and-error-experience.md`):

- **Loading** — a skeleton matching that zone's populated shape (a skeleton Attention Required list has the same row height and icon placement as a populated one), never a spinner replacing the whole Command Center.
- **Populated** — §1's shape.
- **Empty** — a stated positive (e.g., "No open risks — this project is on track" for Attention Required), never a bare "Nothing here"; an Empty AI Recommendations zone states that no Agent has produced an unreviewed Recommendation for this entity, not that the feature is broken.
- **Error / Degraded** — §4 above, scoped to the failed zone only.

## 6. What a Command Center Is Not

- Not a dashboard of same-weight charts (§1's zone hierarchy exists specifically to prevent this).
- Not a second source of truth for Risk, Decision, or Recommendation state (§3).
- Not reachable except entity-qualified — there is no "generic" Command Center; every instance names the Enterprise/Workspace/PMO/Portfolio/Program/Project it belongs to in its header, matching `03-navigation-contracts.md`'s breadcrumb rule that a Command Center is always the terminal node of its entity's trail.
- Not a place a user configures anything — configuration lives in that entity's Administration screens (`03-canonical-information-architecture.md` §7); a Command Center only surfaces attention, recommendation, decision, and health.

## Validation Notes

The four-zone shape, the entity list, and the Query-composition rule are drawn verbatim from `03-canonical-information-architecture.md` §11, `04-canonical-application-architecture.md` §9.5, ADR-PMF-065, and `07-canonical-frontend-architecture.md` §11. No new Query, Command, screen, or entity is introduced; this document fixes visual zone ordering and per-zone state handling only, consuming Queries and Commands already ratified in `06-query-catalog.md` and `06-command-catalog.md`. No code, route, or component was created or modified to produce it.
