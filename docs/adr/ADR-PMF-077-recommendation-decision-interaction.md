# ADR-PMF-077: Recommendation and Decision Experience — Adapting Real Services, Not Inventing New Persistence

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`01-canonical-domain-model.md` §9/§21 documents that PMFreak has **no single canonical Decision aggregate** (fragmented across 6+ tables: `project_decisions`, `decision_effectiveness`, `decision_outcomes`, and others) and that a **Recommendation is an ephemeral, non-persisted object** in the oldest engines (Cost/Quality Governance agents return typed assessments, not rows). PR9's reconnaissance found two real, working, previously-unwired services that do match PR8's disclosure shapes closely:

- `src/lib/recommended-actions/` (`generate-recommended-actions.ts`, `decision-workflow.ts`) over the real `recommended_actions` table, already exposed at `GET/POST /api/recommended-actions[/decision]`. Fields (`title`, `description`, `rationale`, `confidence_score`, `impact_level`, `evidence_summary`, `recommended_due_window`) map directly onto the Why/Evidence/Confidence/Expected-Impact shape `08-ai-interaction-patterns.md` §2 requires.
- `src/lib/decision-governance/service.ts` over `project_decisions`/`project_decision_evidence_links` — a full lifecycle (`createDecision → submitDecision → approveDecision | rejectDecision → implementDecision → recordDecisionOutcome`, plus `buildDecisionLineage`/`exportDecisionAuditPackage`) with real evidence-linking and platform-event emission, but **zero HTTP routes wrapping it** before this PR.

The `recommended_actions` table's own `decideRecommendedAction` explicitly refuses governed rows (`governance_event_id` set), directing them to "the evidence-backed operational decision flow" instead — i.e., the codebase itself already anticipated two tiers and pointed at `decision-governance` as the richer one.

## Decision

**The Recommendation Experience adapts the existing, already-wired `recommended_actions`/`decision-workflow.ts` path verbatim (no new route). The Decision Experience adapts the existing, previously-unwired `decision-governance/service.ts` via five new, thin Route Handlers** (`GET /api/projects/[id]/decisions`, `POST` to the same path, `GET /api/decisions/[id]`, `POST /api/decisions/[id]/approve`, `POST /api/decisions/[id]/reject`) that call the service's exported functions directly — no new table, no new persistence path, no bypass of the service's own validation/state-machine/event-emission logic.

**Approving a Recommendation and recording a Decision are treated as two related but distinct actions in this slice**: `decideRecommendation({decision:"accepted"})` transitions the `recommended_actions` row (ungoverned path); a Decision is a separate record, optionally created with `recommendationId` set to link back to the Recommendation that informed it (`POST /api/projects/[id]/decisions` accepts `recommendationId`). The new Decision is immediately submitted (`submitDecision`) so it appears in the Pending Decisions zone for approval, matching `06-command-catalog.md`'s `RecordDecision → ApproveRecommendation`-adjacent chain without requiring a new composite Command.

## Frontend Rules

1. `DecisionCard`'s "AI Analysis" section renders only when `recommendation_id` is set — an honest simplification given the real schema has no multi-option comparison table; documented here rather than fabricated in the UI.
2. `RecommendationCard`'s Evidence section reads `evidence_summary` (a JSON object) and best-effort formats it as a list — no new Evidence schema was invented for this.
3. Recommendation and Decision approvals are never merged into one control — a Recommendation's `ApprovalFlow` calls `decideRecommendation`; a Decision's `ApprovalFlow` (on its own detail screen) calls `approveDecision`/`rejectDecision`. These are two distinct governed Commands, matching `08-ai-interaction-patterns.md` §3's rule that no control performs more than one chain step.
4. No route or contract client queries `project_decisions`, `recommended_actions`, or any table directly from a Screen/Feature/Domain-Presentation component — every access goes through the service layer or the existing route (verified in `tests/decision-register-adapter.test.mjs`).

## Alternatives Considered

- **Build a brand-new unified `decisions`/`recommendations` table pair from scratch.** Rejected: this ignores two real, working, tested services already in the codebase and would violate Fase 9's explicit "no inventar APIs, crear adapters" instruction. It would also duplicate `decision-governance`'s already-correct evidence-linking, state machine, and platform-event emission.
- **Route the Recommendation approval through `decision-governance` exclusively, retiring `recommended_actions`.** Rejected for this slice: `recommended_actions` is already live-wired elsewhere in the product (its existing `GET/POST` routes); retiring it is a larger migration than this PR's scope, and the code's own governance-event-id branch shows the two tiers are an intentional, existing distinction, not an accident to collapse today.
- **Skip building real Decision routes and mock the Decision Register with fixture data.** Rejected: the user explicitly chose the thin-vertical-slice option specifically so the Fase 14 demo is real, not mocked.

## Positive Consequences

- Zero new tables. Zero new persistence logic. `decision-governance/service.ts`'s existing validation, state-machine (`validateDecisionTransition`), and `platform_events` emission are exercised for the first time via a real HTTP path, immediately increasing this previously-dead code's test/production surface.
- The Recommendation→Decision link (`recommendation_id`) makes the demo's "approve recommendation → decision created" step a genuine, traceable relationship, not two independent, unlinked records.

## Negative Consequences

- Two different tables (`recommended_actions`, `project_decisions`) now both have live UI surfaces with related but not identical lifecycles — a future PR should decide whether to consolidate them (tracked as an open question, not resolved here).
- "AI Analysis: 1 option considered" is a simplification; the real system does not track multiple named options per Decision today.

## Risks

- **Two-tier confusion risk:** a PM could be confused why some "decisions" (ungoverned `recommended_actions` transitions) don't appear in the Decision Register while true `project_decisions` rows do. Mitigated by keeping the Recommendation Register and Decision Register as visually and functionally distinct screens (never merged, per `08-ux-principles.md` §2 Principle 4), and documented here for a future consolidation decision.

## Security and Data Implications

- Every new Decision route re-authorizes via `requireAuthenticatedUser` + `requireProjectAccess`, never trusting a client-supplied `project_id`/`workspace_id` (ADR-PMF-061). Evidence links reference `evidence_id`/`evidence_type` only, never inlining classified content into the Decision projection.

## Application Implications

- No new Command or Query name — `RecordDecision`, `ApproveRecommendation`, `RejectRecommendation` (`06-command-catalog.md`) are implemented against existing services for the first time.

## Frontend Implications

- Realizes `08-ai-interaction-patterns.md` §1–§3 and §6 in real, running code.

## Migration Implications

- A future PR may choose to consolidate `recommended_actions` and `project_decisions` into the single canonical aggregate `01-canonical-domain-model.md` calls for — this ADR does not resolve that, only unblocks a real UI on top of what exists today.

## Compatibility Implications

- The existing `/api/recommended-actions*` routes are unchanged; the five new `/api/decisions*` and `/api/projects/[id]/decisions` routes are additive.

## Out of Scope

- Consolidating `recommended_actions` and `project_decisions` into one aggregate.
- Multi-option AI Analysis comparison (`OptionComparison` from the sprint brief's Fase 5 component list) — not built; `DecisionCard`'s AI Analysis section shows only option count.
- Bulk approval of Recommendations or Decisions (explicitly out of scope per `08-ai-interaction-patterns.md` §6, unchanged here).

## Validation

- `tests/decision-register-adapter.test.mjs`, `tests/command-center-integration.test.mjs`.

## References

- `docs/product-architecture/01-canonical-domain-model.md` §9, §21, §25
- `docs/product-architecture/06-command-catalog.md`
- `docs/product-architecture/08-ai-interaction-patterns.md`
- `src/lib/decision-governance/service.ts`
- `src/lib/recommended-actions/decision-workflow.ts`
