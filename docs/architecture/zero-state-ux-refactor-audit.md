# Zero State UX Refactor — Audit Report

Date: 2026-07-21
Branch: `claude/workspace-ux-refactor-k69t77`

## Product rule

Never render information that does not come from real user data. Every workspace view
supports exactly three states:

1. **Empty** — no data exists yet. A clean, professional invitation to begin. Never styled or
   worded as an error.
2. **Populated** — real, calculated data only.
3. **Error** — a technical failure ("Unable to load…"). Never used to represent absence of data.

## Architecture

- **API contract** — the dashboard API runtime keeps its existing status discriminator
  (`'ok' | 'partial' | 'empty' | 'error'`) and now enforces `data: null` for `empty` and
  `error`. Absence of data can no longer materialize as a fabricated DTO anywhere downstream.
- **View-model layer** — `adaptDashboardViewModel` short-circuits `empty` (like `error`) into a
  zeroed view model with no warnings-as-content, so counts, alerts, and "critical attention"
  flags can only originate from real data.
- **Intelligence engines** — `buildExecutionRiskSnapshot` and `buildInterventionSnapshot`
  carry an explicit `state: 'empty' | 'populated'` field. A null memory snapshot yields
  honest zero signals (no inferred silence collapse, no invented escalation).
- **UI layer** — a reusable empty-state family in `src/components/pmfreak/empty-states/`
  (`WorkspaceEmptyState` base + named variants) gives every view the same visual language:
  light card, eyebrow, headline, supporting copy, optional CTA.

## New components (`src/components/pmfreak/empty-states/workspace-empty-state.tsx`)

| Component | Copy |
|---|---|
| `WorkspaceEmptyState` | Base primitive (eyebrow / title / description / secondary / CTA) |
| `EmptyDashboard` | "No project data available yet." |
| `EmptyExecutiveDashboard` | "No executive insights yet" |
| `EmptyProjects` | "No projects yet" + create CTA |
| `EmptyExecution` | "No execution data yet" |
| `EmptyPortfolio` | "No projects yet" + create CTA |
| `EmptyOperationalCenter` | "No operational actions yet." |
| `EmptyChat` | "Start your first conversation." |
| `EmptyPMO` | "No PMOs yet" |
| `EmptyLens` | Generic per-lens empty state |

## Fabrication sources removed

### Backend / data layer

- `src/lib/dashboard/api-runtime/dashboard-api-response-builder.ts` — deleted
  `buildFallbackDTO()` (fabricated health score 0/critical, "Portfolio Health Unavailable",
  synthetic critical alert `alert-dashboard-source-unavailable`). Empty responses now return
  `data: null`.
- `src/lib/dashboard/api-runtime/dashboard-api-error-handler.ts` — error responses return
  `data: null` instead of the fabricated DTO.
- `src/lib/dashboard/api-runtime/source-data-resolver.ts` — warning copy no longer references
  a fallback DTO.
- `src/lib/dashboard/consumption/dashboard-view-model-adapter.ts` — `empty` responses no
  longer hydrate counts/alerts/warnings from fabricated data.
- `src/lib/dashboard/action-center/action-generator.ts` — dashboard warnings are no longer
  converted into "Acknowledge dashboard warning N" actions. On an empty workspace the action
  center now generates **zero** actions (previously: 1 fabricated critical escalation with
  owner "PMO Director", SLA "Resolution 24h", "Escalation required" + 4 warning actions).
- `src/lib/dashboard/action-center/action-center-runtime.ts` — empty summary is now
  "No operational actions yet. Operational recommendations will appear automatically as
  projects begin generating real execution data."
- `src/lib/dashboard/consumption/dashboard-honest-labels.ts` — empty/idle no longer disclaim
  "placeholder numbers" (none are rendered); error copy reads as a load failure.
- `src/lib/dashboard/source-hydration/recovery-engine.ts` — recovery plan no longer suggests
  serving a fallback DTO.
- `src/lib/execution-risk.ts` — null snapshot previously fabricated: delivery confidence 55
  ("medium/watch"), stakeholder pressure 35, and a **silence risk of 100 → critical/immediate**
  ("Project momentum collapsed"). All null-snapshot signals are now honest zeros with
  `state: "empty"`.
- `src/lib/intervention-engine.ts` — null snapshot previously inferred 14 days of silence and
  drift triggers. It now returns an explicit empty snapshot (no triggers, no interventions,
  no escalations, probability 0).
- `src/app/api/intelligence/operational-live/route.ts` — no longer serves
  `buildMockOperationalIntelligence` (simulated Jira/Slack/Teams/GitHub signals labeled
  `live_telemetry_mock`); returns `{ state: "empty", data: null }` until real integrations exist.
- `src/lib/operational-intelligence.ts` — **deleted** (orphaned simulation library; only
  consumer was the mock route above).
- `src/lib/ai/mock-data.ts` — **deleted** (fabricated stakeholder/meetings/political-risk/
  escalation/message-nudge cards with invented owners "Program Manager", "Chief of Staff",
  "PMO Lead", severities, and confidence scores, plus 4 fake project-memory events).
- `src/lib/ai/gateway/registry.ts` — pre-production module handlers now return explicit empty
  envelopes (`data: []`, no summary) instead of fixture cards.

### Frontend

- `src/app/(protected)/dashboard/page.tsx` (Summary lens) — three-state rendering: empty →
  `EmptyDashboard` + `EmptyOperationalCenter`; error → rose error card; populated → real
  snapshot. KPI tiles, warnings list, and the action center no longer render on empty.
- `src/components/dashboard/action-center/executive-dashboard-action-center.tsx` — the
  zero-actions branch (previously unreachable) renders `EmptyOperationalCenter`.
- `src/app/(protected)/executive/page.tsx` (Executive lens) — zero operational-memory records
  now renders `EmptyExecutiveDashboard` instead of a health score computed over no data and a
  fabricated-looking "Operational state within normal thresholds … across 0 domains monitored"
  insight. The portfolio overview panel renders only when real projects exist. The thrown-error
  card is now clearly a technical failure ("Unable to load executive intelligence").
- `src/app/(protected)/portfolio/page.tsx` (Portfolio lens) — renders `EmptyPortfolio` with a
  create CTA on zero projects; fixed the response-shape mismatch (page consumed a
  `projectName/uploadDate/complexity` shape the API never returned — populated state was
  broken); aligned styling with the light lens chrome; error state remains distinct.
- `src/app/(protected)/projects/page.tsx` — removed all unconditional fabricated content:
  6 fake agents with invented metrics ("Critical Paths: 4", "Friction Nodes: 7",
  "Escalation: +12%", confidence 86/79/88/83/91/84…), the fake "Execution Sensing Feed"
  (5 invented live events with timestamps), "Live Execution Pulse" ("Portfolio Confidence 82%",
  "Escalation Pressure Medium", "Delivery Drift Contained"), "Decision-Ready Summaries"
  (3 invented executive summaries), and the "AI Agents Active / Operational Intelligence
  Online" status pills. The page is now a clean project list with `EmptyProjects` + CTA.
- `src/features/follow-up/follow-up-dashboard-client.tsx` — removed fabricated fallbacks
  (`?? "PM"`, `?? "PMO Director"`, `?? "Define action plan"`, `?? "next cadence"`,
  `?? "Run targeted intervention with decision owner."`), the invented commentary ("This
  project is not red yet, but it is starting to smell like smoke."), the fabricated
  "Confidence: NN%" badges, and the unconditional "You need a decision before another status
  meeting happens." Each card now has an honest per-section empty line, and the whole
  dashboard renders `EmptyExecution` when no execution memory exists.
- AI module pages (`stakeholder-intel`, `project-memory`, `political-risk`, `meetings`,
  `message-nudges`, `escalation-guide`) — removed all hardcoded KPI headers ("At-risk
  stakeholders 2", "Events indexed 148", "Critical 1", "Escalation likelihood 68%",
  "Transcripts processed 12", "Drafts generated 34", "Readiness score 79/100", …).
- `src/components/pmfreak/intelligence/module-intelligence-client.tsx` and
  `project-memory-client.tsx` — dedicated empty states when the module returns no items.
- `src/components/pmfreak/chat/context-chat-panel.tsx` — empty conversation now leads with
  "Start your first conversation." (no preloaded messages existed; verified).
- `src/components/pmfreak/pmos/pmo-admin-client.tsx` — zero PMOs renders `EmptyPMO`.
- Deleted orphaned fake-data components (zero importers): `src/components/pmfreak/agent-card.tsx`,
  `src/components/pmfreak/interactive-demo.tsx`, `src/components/pmfreak/OperationalEventFeed.tsx`.

## Verified as already correct (no change needed)

- `/command-center` (Execution lens) — `CommandCenterEmptyState` is a clean activation
  invitation; demo fixtures in `src/modules/workspace/presentation/command-center/demo-data.ts`
  are explicitly quarantined from the production render path (header forbids import; verified
  zero production importers).
- Workspace chat — no seeded conversations; suggestion chips are prompts, not messages.
- `src/components/pmfreak/operational-shell.tsx` — recommended actions correctly gated on real
  API data.
- `src/lib/founder-program/dashboard.ts` — already models the target pattern
  (`{ available: false, value: null, reason }`).

## Tests and checks updated

- `tests/dashboard-api-runtime.test.mjs` — empty/error responses assert `data === null`;
  removed `buildFallbackDTO` determinism tests.
- `tests/dashboard-consumption-runtime.test.mjs` — empty view model asserts zero alerts, no
  critical attention, no warnings-as-content.
- `tests/dashboard-action-center-runtime.test.mjs` — new test: empty-workspace view model
  yields zero actions; empty summary copy updated.
- `tests/dashboard-honest-labels.test.ts` — rewritten for the new contract (empty/idle carry
  no fallback notice; error notice must read as a load failure; page must render `EmptyDashboard`).
- `scripts/check-dashboard-api-runtime.mjs`, `scripts/check-dashboard-consumption-runtime.mjs`
  — governance checks updated to enforce `data: null` and empty view-model purity.
- `docs/architecture/dashboard-api-runtime.md` — contract documentation updated.

## Known remaining places with static/simulated content (documented, out of this refactor's scope)

- `src/modules/workspace/presentation/command-center/demo-data.ts` — intentional test-only
  fixtures, explicitly forbidden from production imports (enforced by
  `tests/legacy-shell-quarantine.test.mjs`).
- `src/features/enterprise-ux/demo-runtime/*` — demo scenario builders tagged
  `SYNTHETIC_DEMO`; not wired to any production render path.
- `src/features/enterprise-ux/empty-states/empty-state-intelligence.ts` — an earlier
  empty-state copy registry, still not wired to components; superseded in practice by the new
  component family. Candidate for consolidation.
- `src/lib/constitutional-recommendations/generation-engine.ts` and
  `src/lib/constitutional-learning/recommendation-engine.ts` — canned recommendation templates
  keyed to *real detected patterns* (not absence-of-data fallbacks); confidence is capped and
  they never fire on an empty workspace.
- `src/app/(protected)/operational-memory/page.tsx` and `input-hub/page.tsx` — static product
  descriptors ("Domains 7", "Routing Live"); these describe product capability, not workspace
  data. Review copy if they read as metrics.
- `src/lib/dashboard/consumption/dashboard-state-machine.ts` — `isDashboardActionRequired`
  still returns `true` for `empty` status; it has no UI consumers today, but should be revisited
  if it gains one (empty must not imply "action required" visually).
- The interactive marketing/demo surfaces under `/playground` and founder/demo flows use
  explicitly labeled demo scopes.
