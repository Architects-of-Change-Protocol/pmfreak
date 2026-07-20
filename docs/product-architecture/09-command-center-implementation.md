# PR9 Companion — Command Center Implementation

Status: Implemented (Project entity level only)
Parent: `08-command-center-experience.md`, ADR-PMF-070, ADR-PMF-076

Purpose: record the exact Query/Command wiring behind the Project Command Center, so it is checkable against ADR-PMF-070's fixed four-zone rule and reusable as a template for a future Workspace/PMO/Portfolio/Program/Enterprise Command Center.

## Zone → Implementation Mapping

| Zone | Component | Data source | Consistency |
| --- | --- | --- | --- |
| Attention Required | `src/modules/project/features/AttentionPanel.tsx` | `GET /api/projects/[id]/health` → `ProjectHealth.raid` (critical/open risk, dependency counts) + `ProjectHealth.schedule.signals` | Eventual |
| AI Recommendations | `src/modules/project/features/RecommendationPanel.tsx` → `@/modules/recommendations`' `RecommendationList` | `GET /api/recommended-actions?projectId=...&status=proposed` (existing, reused verbatim) | Strong (Recommendation approval status) |
| Pending Decisions | `src/modules/project/features/DecisionPanel.tsx` → `@/modules/decisions`' `DecisionList` | `GET /api/projects/[id]/decisions`, filtered client-side to `pending_review` | Strong (Decision status) |
| Execution Health | `src/modules/project/features/ExecutionHealthCard.tsx` | `GET /api/projects/[id]/health` → `ProjectHealth.overallScore`/`band`/`schedule` breakdown | Eventual |

## Composition Rules Actually Enforced

1. **Fixed order** — `ProjectCommandCenterScreen.tsx` renders `AttentionPanel → RecommendationPanel → DecisionPanel → ExecutionHealthCard` in that literal order; `tests/command-center-integration.test.mjs` asserts the source order.
2. **Independent zone state** — every zone is wrapped in `src/platform/components/ZoneFrame.tsx`, which independently renders Loading (skeleton)/Populated/Empty (stated positive)/Error (scoped retry) per zone. Attention Required and Execution Health share one SWR cache key (`/api/projects/[id]/health`) since both are literally the same computed projection; Recommendations and Decisions each have their own independent SWR key, so a failure in one never blanks another.
3. **Composition, not ownership** — the Command Center screen holds no state of its own; every item rendered is a Query result with a link to its own home screen (the Decision list links to `/decisions/[id]`; Attention items link to the Project page).
4. **Project-scoped only** — every underlying fetch is parameterized by `projectId`; no cross-Project or cross-Workspace aggregation occurs (ADR-PMF-070's Note, now enforced by construction since no such query exists in this module).

## What This Slice Does Not Implement

- The other five Command Centers' zone→Query mapping tables (Workspace/PMO/Portfolio/Program/Enterprise) — a future PR should follow this document's shape, substituting the entity-appropriate Queries per `08-command-center-experience.md` §2's table.
- A dedicated `GetProjectCommandCenter` composite endpoint — the four zones are composed client-side from three separate SWR-backed fetches, intentionally, to preserve independent zone degradation (ADR-PMF-076).
