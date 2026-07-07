# Decision Support Adapter Mapping Plan (Sprint 23R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R), and
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R). This file is the
> standalone design/results document for the adapter mapping plan produced by Sprint 23R.

## Executive summary

By Sprint 22R, three pieces were built, isolated, and hardened, but never connected to each other or
to production: a Decision Support Candidate Handler that is 100% safe against the Sprint 18R corpus
(Sprint 19R/20R/21R), a Clarification Response Strategy that is 100% acceptable and 100% safe against
its evaluated corpus (Sprint 22R), and an enriched classifier boundary for `decision_support` that
detects 88.9% of desired cases (Sprint 21R). None of that evidence had yet been used to decide *how*
`intentCompatibilityAdapter.ts` should eventually map `decision_support` in production — it still maps
to `unsupported`, the Sprint 10R safe fallback, exactly as it did before any of this work started.

Sprint 23R does not make that adapter change. It builds an offline planner —
`decisionSupportAdapterMappingPlan.ts` — that simulates eight candidate mapping strategies against the
Sprint 18R corpus (79 cases), reusing the Sprint 19R candidate handler, the Sprint 20R/21R shadow
evaluator, and the Sprint 22R clarification strategy, and scores each strategy on safety, existing-route
preservation, and how much production wiring it would require to realize. The result is evidence, not
opinion, for what Sprint 24R should build next.

| Metric | Value |
|---|---|
| `totalCases` | 79 |
| `strategiesEvaluated` | 8 |
| `bestStrategy` | **`hybrid_shadow_then_clarify`** |
| `worstStrategy` | `map_to_general_pm_advice` |
| `safestNonProductionStrategy` | `hybrid_shadow_then_clarify` |
| `safestFutureIntegrationStrategy` | `hybrid_shadow_then_clarify` |
| `recommendedSprint24Strategy` | **`hybrid_shadow_then_clarify`** |
| `recommendedNextSprint` | **"Sprint 24R — Decision Support Shadow Mode Prep"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no feature flag was activated, and every one of the 632 simulated
results (79 cases × 8 strategies) carries `shouldExecuteAction: false`.

## What problem this solves

Before this sprint, the project had three isolated, safe capabilities and no evidence-based answer to
"how should these eventually connect?" Sprint 20R's shadow evaluator already proved
`shadowRoutableRate` (40%) was too low to recommend a feature flag on its own, and Sprint 22R's own
evaluator flagged the adapter mapping as the dominant open gap
(`recommendedNextSprint: "Sprint 23R — Decision Support Adapter Mapping Plan"`). This sprint answers,
with simulated evidence: what happens under each of eight plausible strategies, which are safe, which
are not, and which one is most defensible to plan for next.

## What this does NOT solve yet

- **Does not change `intentCompatibilityAdapter.ts`.** Every `currentProductionMappedIntent` in every
  result comes from calling the existing, unmodified Sprint 20R/21R shadow evaluator — this module adds
  no new mapping table entry anywhere reachable from a real request.
- **Does not connect `decision_support` to the router.** No result is ever shown to a user; every
  strategy is a pure simulation over the Sprint 18R corpus.
- **Does not activate a feature flag.** `feature_flag_default_off` and `hybrid_shadow_then_clarify`
  both plan for a *future* flag; none is wired to anything today.
- **Does not implement a persistent, multi-turn clarification loop.** Where a strategy simulates
  "route to clarification", it calls the existing Sprint 22R `handleClarificationResponseCandidate()`
  exactly as-is — a single, stateless turn, same limitation as before.
- **Does not decide Sprint 24R's implementation for certain.** This is a planning/evaluation sprint;
  `recommendedSprint24Strategy` is evidence, not a commitment — Sprint 24R can still choose otherwise
  with justification.

## Baseline (Sprint 22R)

| Metric | Sprint 22R baseline |
|---|---|
| Golden corpus `compatibilityRate` | 72.5% |
| Sprint 17R `policyAlignedRate` / `currentSystemAcceptableRate` | 82.9% / 84.3% |
| Sprint 18R `currentSafeMappingRate` / `futureRouteAlreadySupportedRate` | 84.8% / 84.8% |
| Sprint 18R `requiresNewHandlerCount` / `requiresClarificationCount` | 45 / 24 |
| Sprint 19R fixture count / decision types / candidate handler safe behavior | 50 / 10 / 100% |
| Sprint 20R/21R `candidateHandlerSafeRate` | 100% |
| Sprint 20R/21R `shadowRoutableRate` | 40% |
| Sprint 21R `unsafeClassifierCollisionCount` | 5 (playbook 0 / general_pm 1 / risk 2 / closure 1 / governance 0) |
| Sprint 21R `enrichedDecisionSupportDetectionRate` | 88.9% |
| Sprint 21R `recommendedIntegrationMode` | `do_not_integrate` |
| Sprint 22R `evaluatedClarificationCases` | 34 |
| Sprint 22R `acceptableResponseRate` / `safetyPassRate` / `routeOptionsCoverageRate` | 100% / 100% / 100% |
| Sprint 22R `overQuestioningCount` | 0 |
| Sprint 22R `recommendedNextSprint` | "Sprint 23R — Decision Support Adapter Mapping Plan" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Current adapter behavior

Per the Sprint 20R/21R shadow evaluator, unmodified and re-run by this sprint:

> Today (Sprint 10R adapter, unchanged by this sprint): 45 decision_support-desired cases map to
> "unsupported"; 24 needs_clarification-desired cases map to "general_pm_advice"; 10
> existing_route_should_win cases already route correctly. No case in this corpus is answered with a
> real decision_support handler in production today.

## Strategies evaluated

| Strategy | What it simulates |
|---|---|
| `keep_unsupported` | Preserve today's Sprint 10R safe fallback unchanged. |
| `map_to_general_pm_advice` | Route `decision_support` to the existing `general_pm_advice` production intent. |
| `map_to_recommendation_request` | Route `decision_support` to the existing `recommendation_request`/`playbook_analysis` production intent. |
| `shadow_candidate_handler_only` | Run the Sprint 19R candidate handler offline for eligible cases; never shown to a user. |
| `feature_flag_default_off` | Plan a future integration behind a default-off flag; not activated this sprint. |
| `clarify_before_decision_support` | Ask a clarifying question first for low-confidence/unroutable `decision_support` cases and all `needs_clarification` cases; confident cases fall back to the safe parking. |
| `hybrid_shadow_then_clarify` | Shadow-route confident/safe candidates (`isShadowRoutable`); clarify everything else. |
| `do_not_map` | Defer every mapping decision; documentation only. |

## Strategy comparison table

| Strategy | safeOutcomeRate | riskyOutcomeRate | criticalRiskCount | preservesExistingRouteRate | candidateHandlerSafeCount | clarificationSafeCount | introducesProductionBehaviorCount | requiresRouterChangeCount | requiresAdapterChangeCount | requiresFeatureFlagCount | recommendedForSprint24 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `keep_unsupported` | 100% | 0% | 0 | 100% | 45 | 51 | 0 | 0 | 0 | 0 | true |
| `map_to_general_pm_advice` | 12.7% | 87.3% | 12 | 100% | 45 | 51 | 69 | 0 | 69 | 0 | **false** |
| `map_to_recommendation_request` | 12.7% | 87.3% | 0 | 100% | 45 | 51 | 69 | 0 | 69 | 0 | **false** |
| `shadow_candidate_handler_only` | 100% | 0% | 0 | 100% | 45 | 51 | 0 | 69 | 0 | 69 | true |
| `feature_flag_default_off` | 100% | 0% | 0 | 100% | 45 | 51 | 0 | 69 | 69 | 69 | true |
| `clarify_before_decision_support` | 100% | 0% | 0 | 100% | 45 | 51 | 69 | 69 | 69 | 0 | true |
| `hybrid_shadow_then_clarify` | 100% | 0% | 0 | 100% | 45 | 51 | 0 | 69 | 69 | 69 | **true** |
| `do_not_map` | 100% | 0% | 0 | 100% | 45 | 51 | 0 | 0 | 0 | 0 | false |

(`candidateHandlerSafeCount`/`clarificationSafeCount` are case-level facts from the Sprint 19R/20R/21R
handler and the Sprint 22R strategy respectively — they do not vary by strategy, since every strategy
is evaluated against the same underlying evidence. `requiresRouterChange`/`requiresAdapterChange`/
`requiresFeatureFlag` describe what a *future, real* integration of that strategy would require, not
anything this sprint touches — see "Why production is not changed" below.)

`introducesProductionBehavior` is true only when a strategy would change the adapter's mapping table
with no feature-flag gate (`requiresAdapterChange && !requiresFeatureFlag`) — which is exactly the two
unsafe strategies (`map_to_general_pm_advice`, `map_to_recommendation_request`) and
`clarify_before_decision_support` alone (safe, but would need an ungated adapter+router change to ship
as designed — see "Why hybrid is recommended over clarify-only" below).

## Safety analysis

Only two of the eight strategies ever produce an `unsafe_*` outcome: `map_to_general_pm_advice`
(`unsafe_generic_answer`, 69/79 cases, 12 of them at `critical` risk — the `decision_support_vs_risk`/
`decision_support_vs_closure` categories) and `map_to_recommendation_request` (`unsafe_playbook_answer`,
69/79 cases). Every other strategy's worst-case outcome is `requires_future_router` (a quality gap that
is never shown to a user — this never occurred in this run, since `candidateHandlerSafeRate` and
`clarificationSafeCount`/eligible ratio are both high) or `not_applicable`. No strategy in this plan
overrides an `existing_route_should_win` case.

## Existing route preservation

`preservesExistingRouteRate` is **100% for all eight strategies** — none of them ever touches the 10
`existing_route_should_win` cases (`redactame un correo`, `creá una tarea para Arturo`, `qué falta para
facturar`, etc.); every strategy's simulation short-circuits those cases to
`simulatedMappedIntent: "current_existing_route"` / `simulatedOutcome: "existing_route_preserved"`
before applying any strategy-specific logic. This is a structural guarantee of the simulator, not a
measured coincidence.

## Why not map to `general_pm_advice`

It answers a decision-shaped question with generic PM coaching that has no named options, tradeoffs,
risks, or evidence needs — exactly the collision Sprint 21R spent its whole budget reducing (playbook/
general_pm collisions fell from 10 to 1 combined). Adopting this strategy would reintroduce that risk
deliberately, at the adapter level, for all 45 `decision_support`-desired cases plus retroactively flag
the 24 `needs_clarification`-desired cases (already mapped here today) as unsafe too — `safeOutcomeRate`
drops to 12.7% and `criticalRiskCount` rises to 12 for the billing/risk/closure-framed decisions.

## Why not map to `recommendation_request`

It answers a decision the user must make with an answer framed as the playbook's own governed
recommendation — confusing "what should I decide" with "what does the playbook say", and reintroducing
the exact `decision_support`/`playbook_analysis` collision Sprint 18R documented for
dc-13/dc-15/dc-17/dc-19 (`decision_support_vs_playbook`). `safeOutcomeRate` is identical to
`map_to_general_pm_advice` (12.7%) with the same 69 unsafe cases, though without the critical-risk
elevation (playbook confusion is judged `high`, not `critical`).

## Why `keep_unsupported` is safe but insufficient

It is the only strategy that changes nothing — zero risk, zero wiring cost, `recommendedForSprint24:
true` as a baseline. But it also never uses the Sprint 19R candidate handler or the Sprint 22R
clarification strategy this program has spent three sprints building and hardening to a 100% safety
rate. Adopting it as the final answer would mean shipping nothing built since Sprint 18R.

## Why `shadow_candidate_handler_only` is safer

It never shows a candidate result to a user — every `isShadowRoutable`-eligible case is only evaluated
offline — so it carries the same zero risk as `keep_unsupported` while actually exercising the
candidate handler's 100% `candidateHandlerSafeRate`. That is exactly the evidence Sprint 24R needs
before proposing any real integration, and this plan confirms it produces zero unsafe outcomes and 100%
existing-route preservation.

## Why `clarify_before_decision_support` is needed

`shadowRoutableRate` is only 40% (Sprint 20R/21R, unchanged) — most `decision_support` cases are not
confident/safe enough to shadow-route today. A clarify-first fallback for the other 60% (plus all 24
`needs_clarification`-desired cases) means no `decision_support` case is ever left with only the
generic `unsupported`/`general_pm_advice` non-answer; it either gets a safe shadow candidate (if
confident) or a safe clarifying question (if not). Standalone, though, it does not use the shadow
candidate handler at all for confident cases — it only decides whether to clarify, falling back to
`safe_parking` otherwise (see `simulateDecisionSupportCase()`'s `clarify_before_decision_support`
branch) — which is why it alone is not the recommended strategy.

## Why `hybrid_shadow_then_clarify` is recommended

It combines the previous two: confident/safe candidates (`isShadowRoutable`) go to shadow mode (never
shown to the user), everything else gets a real clarifying question instead of silence — covering both
the 40% `shadowRoutableRate` and the 60% gap, with **zero unsafe outcomes**, **zero critical risk**,
and **100% existing-route preservation**, while still requiring no live production change this sprint
(`introducesProductionBehaviorCount: 0`, since its real integration is planned behind a feature flag).
It clears every threshold `computeRecommendedSprint24Strategy()` checks: `safeOutcomeRate` (100%) ≥ 85%,
`criticalRiskCount` = 0, `preservesExistingRouteRate` = 100%, and both `candidateHandlerSafeCount` (45)
and `clarificationSafeCount` (51) are non-zero — the widest safe coverage of any strategy this plan can
recommend.

## `recommendedSprint24Strategy`: `hybrid_shadow_then_clarify`

## `recommendedNextSprint`: "Sprint 24R — Decision Support Shadow Mode Prep"

## Por qué no se cambió el adapter real

Cada estrategia se simula llamando a los módulos ya existentes y aislados de los Sprints 19R/20R/21R/22R
(`runDecisionSupportShadowMappingEvaluation`, `handleDecisionSupportCandidate`,
`handleClarificationResponseCandidate`) contra el corpus del Sprint 18R — ninguno de ellos es importado
por `intentCompatibilityAdapter.ts`, y este módulo no agrega ningún import nuevo a ese archivo. El
campo `currentProductionMappedIntent` de cada resultado viene de leer el comportamiento real del
adapter (vía el evaluador de sombra), nunca de modificarlo.

## Por qué no se conectó el router

Ninguna función de este sprint es importada por `router/brainRouter.ts`,
`composer/responseComposer.ts`, `handlers/*.ts`, `conversationalBrainGateway.ts`, ni por
`POST /api/command-center/chat`. `requiresRouterChange` describe lo que una integración *futura* real
de cada estrategia necesitaría, no algo que este sprint conecta.

## Por qué no se activó feature flag

`feature_flag_default_off` y `hybrid_shadow_then_clarify` documentan `requiresFeatureFlag: true` como
parte de su diseño de integración futura — ninguna bandera fue creada, leída, ni evaluada en tiempo de
ejecución por este sprint. `introducesProductionBehavior` es `false` para ambas exactamente porque están
gateadas detrás de una bandera que no existe todavía.

## Criterio para pasar a Sprint 24R

Sprint 24R puede proceder a preparar (no activar) `hybrid_shadow_then_clarify` en modo shadow si:
mantiene `candidateHandlerSafeRate` / `safetyPassRate` en 100%, no reduce
`preservesExistingRouteRate` por debajo de 100%, y no introduce ningún cambio real al router, adapter,
composer, endpoint, o feature flag — exactamente las mismas restricciones que gobernaron este sprint.

## Verification

Ran the following, all green, all metrics unchanged from Sprint 22R's baseline:

- `npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs` (new, 45 tests)
- `npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs` (77 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` (99 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` (52 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` (54 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` (51 tests)
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` (45 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` (21 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` (21 tests)
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` (32 tests)
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (46 tests)
- `npm run lint:aoc-boundaries` — passed.
- Repo-wide `npx tsc --noEmit` could not be evaluated in this environment (`node_modules` is not
  installed at all — pre-existing, unrelated to this sprint's files). This sprint's two new files
  (`decisionSupportAdapterMappingPlanTypes.ts`, `decisionSupportAdapterMappingPlan.ts`) were checked in
  isolation and produce zero type errors.

Confirmed untouched: `POST /api/command-center/chat`, the router, the composer, every production
handler, every feature flag, the DB/Supabase/Gmail integrations, `intentClassifier.rules.ts`,
`intentCompatibilityAdapter.ts`, and `intent-patterns.ts`. `src/lib/playbook-engine/conversation/decision-support/index.ts`
was updated to export the new module (an isolated barrel, not re-exported from
`src/lib/playbook-engine/conversation/index.ts` — the production barrel is unmodified).

## Sprint 24R update

Sprint 24R built `decisionSupportShadowModePrep.ts`, the technical contract for running
`hybrid_shadow_then_clarify` in a future shadow mode, reusing this plan's evidence and cross-checking
each shadow-mode-prep run against `runDecisionSupportAdapterMappingPlan()`'s own
`hybrid_shadow_then_clarify` simulation for the same case (an informational check only — see
`docs/conversational-brain-decision-support-shadow-mode-prep.md`). This document's own 45-test suite
still passes unchanged: `bestStrategy`/`recommendedSprint24Strategy` remain
`hybrid_shadow_then_clarify`, and every strategy summary (including `hybrid_shadow_then_clarify`'s
100% safe-outcome rate, 0 critical risk, 100% existing-route preservation) is identical. Sprint 24R did
not modify this file, `decisionSupportAdapterMappingPlanTypes.ts`, the router, the adapter, or any
feature flag.

## Sprint 25R update

Sprint 25R built an offline/test-only shadow capture harness on top of the Sprint 24R shadow mode prep
contract, which itself reuses this plan's evidence — this file was not imported directly by the new
harness, only transitively through `decisionSupportShadowModePrep.ts`. This document's own 45-test
suite still passes unchanged: `bestStrategy`/`recommendedSprint24Strategy` remain
`hybrid_shadow_then_clarify`, and `hybrid_shadow_then_clarify`'s strategy summary is identical. Sprint
25R did not modify this file, `decisionSupportAdapterMappingPlanTypes.ts`, the router, the adapter, or
any feature flag. See `docs/conversational-brain-decision-support-shadow-capture-harness.md`.

## Sprint 26R note

Sprint 26R's storage policy does not import this file directly. This document's own 45-test suite
still passes unchanged: `recommendedSprint24Strategy` remains `hybrid_shadow_then_clarify`, and its
strategy summary (`safeOutcomeRate` 100%, `riskyOutcomeCount` 0, `criticalRiskCount` 0) is identical.
Sprint 26R did not modify this file, `decisionSupportAdapterMappingPlanTypes.ts`, the router, the
adapter, or any feature flag. See `docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan does not import this file directly. This document's own 45-test
suite still passes unchanged: `recommendedSprint24Strategy` remains `hybrid_shadow_then_clarify`, and
its strategy summary (`safeOutcomeRate` 100%, `riskyOutcomeCount` 0, `criticalRiskCount` 0) is
identical. Sprint 27R did not modify this file, `decisionSupportAdapterMappingPlanTypes.ts`, the
router, the adapter, or any feature flag. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter does not import this file directly. This document's own 45-test
suite still passes unchanged: `recommendedSprint24Strategy` remains `hybrid_shadow_then_clarify`, and
its strategy summary (`safeOutcomeRate` 100%, `riskyOutcomeCount` 0, `criticalRiskCount` 0) is
identical. Sprint 28R did not modify this file, `decisionSupportAdapterMappingPlanTypes.ts`, the
router, the adapter, or any feature flag. See
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md`.

---

## Nota — Sprint 29R

Sprint 29R creó una **Persistence Readiness Review**
(`docs/conversational-brain-decision-support-shadow-persistence-readiness.md`). No cambió producción.
No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó un loop de clarificación persistente. No
conectó `decision_support` al router. Decisión explícita: `do_not_build_real_persistence_yet`. Siguiente
sprint recomendado: **Sprint 30R — Controlled Shadow Replay Evaluation**.

