# ADR-PMF-076: Project Command Center — Real Implementation of the Fixed Four-Zone Shape

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-070 fixed the four-zone Command Center shape (Attention Required, AI Recommendations, Pending Decisions, Execution Health) as documentary architecture, explicitly noting the existing `/command-center` route ("crowded, same-weight metric cards, no deterministic zone separation") is legacy debt the new shape supersedes. PR9 is the first PR to actually build a Command Center against that shape, for the Project entity level.

No `GetProjectHealth` or `GetProjectCommandCenter` aggregator existed prior to this PR. What did exist and work: `calculateProjectRaidHealth`/`buildRaidOverview` (`src/lib/raid`), `computeScheduleHealth` (`src/lib/schedule/health.ts`), and `computeProjectForecast` (`src/lib/critical-path/forecast.ts`) — three real, tested computations over real tables (`raid_items`, `execution_tasks`, `project_milestones`, `execution_task_dependencies`) that had never been composed into one Query.

## Decision

**`src/lib/projects/project-health.ts` composes the three existing computations into one `ProjectHealth` projection, exposed as `GET /api/projects/[id]/health`, and the Project Command Center (`src/modules/project/screens/ProjectCommandCenterScreen.tsx`) renders the four ADR-PMF-070 zones in fixed order, each independently data-fetched via SWR so one zone's failure never blanks the other three.**

Zone → data source mapping actually implemented:

| Zone | Source |
| --- | --- |
| Attention Required | `ProjectHealth.raid` (critical risk / open risk / dependency counts) + `ProjectHealth.schedule.signals` |
| AI Recommendations | `GET /api/recommended-actions?status=proposed` (existing, reused verbatim) |
| Pending Decisions | `GET /api/projects/[id]/decisions`, filtered to `pending_review` |
| Execution Health | `ProjectHealth.overallScore` + `ProjectHealth.schedule` breakdown |

## Frontend Rules

1. The four zones render in this fixed order in `ProjectCommandCenterScreen.tsx`, verified by `tests/command-center-integration.test.mjs`.
2. Each zone (`AttentionPanel`, `RecommendationPanel`, `DecisionPanel`, `ExecutionHealthCard`) is wrapped in the shared `ZoneFrame` Platform component, giving every zone independent Loading/Populated/Empty/Error states without duplicating that logic per zone.
3. Every zone item that has a canonical home screen links to it (Attention Required items link to the Project page; Recommendation cards live on both the Command Center and the Recommendation Register; Decision items link to the Decision detail screen).
4. The Command Center is Project-scoped only — it queries by `projectId`, never composes cross-Project or cross-Workspace data (restated from the existing ADR-PMF-070 Note, now actually enforceable/testable since the screen exists).
5. `overallScore`'s health-band thresholds (≥75 strong, ≥50 watch, else at-risk) are illustrative, chosen the same way `08-ai-interaction-patterns.md` §2.1 leaves confidence-band thresholds open — a future PR may recalibrate with real usage evidence.

## Alternatives Considered

- **Build a single `GetProjectCommandCenter` endpoint returning all four zones' data in one response.** Rejected: this would make one zone's underlying failure (e.g., a RAID query timeout) blank the whole Command Center, exactly the failure mode ADR-PMF-070 §4 (Degraded Composition) forbids. Four independent SWR-backed fetches (two of which are the existing `/api/recommended-actions` and the new `/api/projects/[id]/decisions`) achieve independent degradation for free.
- **Persist a `ProjectHealth` snapshot table.** Rejected: this would recreate the exact "projection that starts accumulating independent state" failure PR1 §12 C-3 already diagnosed and ADR-PMF-065 forbids — `ProjectHealth` is computed fresh on every request from the real RAID/schedule/task tables, never stored.
- **Build all six Command Center entity levels now.** Rejected — out of scope per ADR-PMF-075; the Project level alone proves the pattern.

## Positive Consequences

- The zone→Query mapping table above is directly checkable against a future PR's Workspace/PMO/Portfolio/Program Command Center, the same way ADR-PMF-070 already intended.
- `computeProjectHealth`'s three inputs were already unit-computable pure functions; composing them added one new pure function (`composeProjectHealth`), not three.

## Negative Consequences

- `ProjectHealth` is Eventually consistent by construction (computed from live queries with no snapshot/cache beyond SWR's client cache) — a very large project's Command Center could see higher per-request compute cost than a pre-aggregated table would. Acceptable for this slice; a future PR can add a materialized snapshot if evidenced.
- Health band thresholds (75/50) are a first guess, not derived from product usage data.

## Risks

- **Threshold risk:** an inappropriate 75/50 split could make most real projects read as "watch" or "at-risk" by default. Mitigated by keeping the thresholds in one named location (`composeProjectHealth`) for easy recalibration.

## Security and Data Implications

- `GET /api/projects/[id]/health` and `GET /api/projects/[id]/decisions` both call `requireProjectAccess(projectId, "read")` before any query — no data crosses a tenancy boundary (`05-tenancy-rls-and-data-security.md`).

## Application Implications

- No new Command or Query catalog entry — `GetProjectHealth` and the Decision/Recommendation Queries were already named in `06-query-catalog.md`; this PR is the first to implement them.

## Frontend Implications

- Realizes `08-command-center-experience.md` and ADR-PMF-070 in real, running code for the first time.

## Migration Implications

- The legacy `/command-center` route (`src/app/(protected)/command-center`) and `src/features/command-center/*` (the merged `NeedsYouQueue` pattern) are untouched by this PR — they remain the shipped experience until a future PR migrates users over and retires them, per `07-frontend-migration-strategy.md`'s strangler pattern (ADR-PMF-068).

## Compatibility Implications

- Additive; no existing endpoint or component changed shape.

## Out of Scope

- Workspace/PMO/Portfolio/Program/Enterprise Command Centers.
- Retiring the legacy `/command-center` route.
- A persisted health snapshot/materialized view.

## Validation

- `tests/project-health-composition.test.mjs`, `tests/command-center-integration.test.mjs`.

## References

- `docs/adr/ADR-PMF-070-command-center-experience.md`
- `docs/adr/ADR-PMF-065-command-centers-projection-compositions.md`
- `docs/product-architecture/08-command-center-experience.md`
- `docs/product-architecture/09-command-center-implementation.md`
