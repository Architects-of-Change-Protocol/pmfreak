# Decision Support Shadow Mapping Evaluation (Sprint 20R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§20R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R), and
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R). This file is the
> standalone design/results document for the shadow evaluation produced by Sprint 20R.

## Executive summary

Sprint 19R built the Decision Support Candidate Handler as an isolated, pure, tested capability — but
left open exactly the ten questions this sprint answers: how much of the Sprint 18R architecture
corpus is eligible for it, how much of that the handler can process safely, where it collides with
each of the other eight conversation categories, which of today's live mappings are safe, which are
dangerous, and what should happen before Sprint 21R touches anything closer to production.

Sprint 20R creates a pure, offline **Decision Support Shadow Mapping Evaluation**
(`decisionSupportShadowMappingEvaluation.ts`) that reuses the Sprint 18R corpus and architecture
review, and the Sprint 19R candidate handler, without modifying either. Running it over the full
79-case Sprint 18R corpus gives:

| Metric | Value |
|---|---|
| `totalCases` | 79 |
| `decisionSupportDesiredCount` | 45 |
| `clarificationDesiredCount` | 24 |
| `existingRouteCount` | 10 |
| `candidateHandlerEligibleCount` | 45 |
| `candidateHandlerCoverageRate` | **100%** (45/45 decision_support-desired cases) |
| `candidateHandlerSafeCount` / `candidateHandlerSafeRate` | 45 / **100%** |
| `shadowRoutableCount` / `shadowRoutableRate` | 18 / **40%** |
| `currentMappingSafeRate` | 64.6% (unchanged from Sprint 18R — same corpus, same adapter) |
| `unsafeClassifierCollisionCount` | 21 |
| `playbookCollisionCount` | 3 |
| `generalPmCollisionCount` | 7 |
| `riskCollisionCount` | 5 |
| `closureCollisionCount` | 2 |
| `governanceCollisionCount` | 3 |
| `unsupportedMappingCount` | 5 |
| `handlerLowConfidenceCount` | 19 |
| `handlerMissingOptionsCount` / `handlerMissingEvidenceCount` / `handlerSafetyFailureCount` | 0 / 0 / 0 |
| `recommendedIntegrationMode` | **`do_not_integrate`** |
| `recommendedNextSprint` | **"Sprint 21R — Decision Support Classifier Boundary Calibration"** |

The golden corpus's `compatibilityRate` (72.5%), Sprint 17R's boundary metrics
(`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%), and Sprint 18R's architecture
metrics (`currentSafeMappingRate` 64.6%, `futureRouteAlreadySupportedRate` 49.4%,
`requiresNewHandlerCount` 45, `requiresClarificationCount` 24) are all unchanged by this sprint.
Sprint 19R's candidate handler behavior is unchanged (its own 54-test suite still passes unmodified).

## What problem this solves

Sprint 19R's own doc ended with an open question: "Criteria to pass to Sprint 20R" listed re-running
the existing test suites as a regression baseline, but did not measure — with real numbers — how the
candidate handler would actually perform against the corpus that motivated building it. This sprint
closes that gap: every one of the ten questions in the sprint brief is answered below with a specific,
reproducible metric, not an assumption.

## What this does NOT solve yet

- **Does not integrate the candidate handler into the router.** `isShadowRoutable` is a label on an
  evaluator result, not a routing decision — nothing reachable from `POST /api/command-center/chat`
  changed.
- **Does not change the classifier, the adapter mapping table, or general_pm_advice vocabulary.**
- **Does not implement DecisionDraft reuse.** The handler still uses deterministic templates with no
  real project context — this evaluation quantifies exactly how much that costs (see
  `handlerLowConfidenceCount` below) without fixing it.
- **Does not implement a clarification loop.** `needs_clarification` cases are reported (24 of them,
  all correctly excluded from candidate-handler eligibility) but not acted on.
- **`recommendedIntegrationMode: do_not_integrate` is not a verdict on the handler's quality.** The
  handler itself is 100% structurally/safety-sound on every eligible case
  (`candidateHandlerSafeRate` 100%, zero safety failures). The `do_not_integrate` result is driven by
  `shadowRoutableRate` (40%) falling under this evaluator's 50% floor — see "Why shadowRoutableRate is
  only 40%" below for the two separate, addressable causes.

## Inputs used

- `tests/fixtures/conversational-brain-decision-clarification-cases.ts` (Sprint 18R corpus, 79 cases)
  — unmodified, reused as-is.
- `runDecisionClarificationArchitectureReview()` (Sprint 18R) — for the live production/enriched/
  adapter shadow comparison per case.
- `handleDecisionSupportCandidate()` / `formatDecisionSupportCandidateResponse()` (Sprint 19R) — run
  only for candidate-handler-eligible cases, with no `availableContext` (the corpus carries none —
  this evaluator never fabricates context).

No new corpus was created. No classifier, adapter, router, composer, handler, or endpoint code was
read for the purpose of being changed — only imported, read-only, where explicitly listed above.

## How eligibility is calculated

A case is **candidate-handler eligible** only when all of: `desiredFutureRoute === "decision_support"`,
`requiresNewHandler === true`, `shouldExecuteAction === false`, `targetKind === "future_architecture"`,
and the input is non-empty. It is **never** eligible when `desiredFutureRoute === "needs_clarification"`,
`requiresClarification === true`, `targetKind === "clarification_strategy"`,
`architectureCategory` starts with `"clarification_"`, or `targetKind === "existing_production_route"`.

Result: **all 45 `decision_support_*` cases are eligible (100% coverage)** — the Sprint 19R candidate
handler's eligibility surface exactly matches the Sprint 18R architecture category boundary by
construction. All 24 `clarification_*` cases and all 10 `existing_route_should_win` cases are reported
in every result/summary but never run through the candidate handler by default.

## How collisionType is calculated

Priority order, most severe/specific first:

1. `existing_route_should_win` / `clarification_required` — reported categories, never overridden.
2. `handler_safety_failure` — a hard safety-gate violation on an otherwise-eligible case (checks the
   full structural + `safety.*` checklist below).
3. Named classifier-family collisions, keyed off the live `mappedIntent`:
   `collides_with_playbook_analysis` (`recommendation_request`), `collides_with_general_pm_advice`
   (`general_pm_advice`), `collides_with_risk_analysis` (`risk_analysis`),
   `collides_with_closure_billing` (`closure_question`/`billing_question`),
   `collides_with_governance_audit` (`governance_question`/`audit_question`). These take priority over
   handler-quality gaps, since a classifier collision is a more fundamental routing risk.
4. `handler_missing_options` / `handler_missing_evidence` / `handler_low_confidence` — only once no
   named classifier collision is present, for cases the candidate handler actually ran for.
5. `handler_not_applicable` — decision_support-desired cases the handler did not run for (e.g.
   `runCandidateHandler: false`).
6. The residual classifier bucket: `unsupported_mapping` (the documented Sprint 10R safe fallback
   held), `classifier_disagreement` (production and the adapter-mapped-enriched value differ, on some
   other production intent), or `mapping_gap` (both agree, but not on a representation of
   `decision_support`).

## How candidate handler safety is evaluated

`isCandidateHandlerSafe` requires every one of: `kind === "decision_support_candidate_result"`; a
non-empty `decisionStatement`; at least one option, tradeoff, risk, and evidence need; non-empty
`recommendation.recommendedPath` and `recommendation.suggestedNextStep`; a valid `confidence` value;
and every `safety.*` flag at its documented safe-candidate value (`shouldExecuteAction` /
`shouldCreateTask` / `shouldSendEmail` / `shouldWriteToDb` all `false`, `requiresHumanConfirmation`
`true`, `productionRoutingEnabled` `false`).

`isShadowRoutable` additionally requires `isCandidateHandlerEligible`, `confidence !== "low"`, no
handler-quality/safety `collisionType`, and no clarification desired. **`isShadowRoutable` never means
production routing** — it only means "viable candidate for a future shadow-mode/offline evaluation."

## Results obtained

### Candidate handler quality: excellent

- `candidateHandlerSafeRate`: **100%** (45/45). Every eligible case produced a well-formed result with
  at least one option/tradeoff/risk/evidence-need and every safety flag at its documented safe value.
  `handlerMissingOptionsCount`, `handlerMissingEvidenceCount`, and `handlerSafetyFailureCount` are all
  **0**. The handler is structurally sound.

### Why `shadowRoutableRate` is only 40%

Two separate, both-addressable causes, neither of which is a handler defect:

1. **`handlerLowConfidenceCount` = 19/45 (42%).** The analyzer's confidence rule
   (`estimateDecisionConfidence`) requires 2+ input-detected options **and** an `availableContext`
   signal for `"high"`, exactly one of those two for `"medium"`, and neither for `"low"`. This
   evaluation never supplies `availableContext` (the Sprint 18R corpus carries none), so every case
   whose decision type produces only one generic option (`general_decision_support`,
   `identify_missing_decision`, `prioritize_next_step` — 24 of the 45 eligible cases route to
   `general_decision_support` alone) lands on `"low"` confidence by design — the handler correctly
   asking a clarifying question instead of guessing, exactly as documented in Sprint 19R's "Human
   confirmation policy." This is **not a structural defect**; it is the single largest, already-
   documented Sprint 19R limitation (no `DecisionDraft` reuse) showing up quantitatively.
2. **`unsafeClassifierCollisionCount` = 21/45 (47%).** See "Top collisions" below.

### Top collisions

`playbookCollisionCount` (3), `generalPmCollisionCount` (7), `riskCollisionCount` (5),
`closureCollisionCount` (2), `governanceCollisionCount` (3) — 20 named-family collisions, plus 1
`mapping_gap`, for 21 total. `generalPmCollisionCount` is the single largest named bucket. Sample
(`topUnsafeCollisions`, capped at 10):

| id | architectureCategory | collisionType | live `mappedIntent` |
|---|---|---|---|
| dc-02 | decision_support_clear | collides_with_general_pm_advice | general_pm_advice |
| dc-16 | decision_support_vs_playbook | collides_with_playbook_analysis | recommendation_request |
| dc-18 | decision_support_vs_playbook | collides_with_playbook_analysis | recommendation_request |
| dc-21 | decision_support_vs_general_pm | collides_with_general_pm_advice | general_pm_advice |
| dc-22 | decision_support_vs_general_pm | collides_with_playbook_analysis | recommendation_request |
| dc-25 | decision_support_vs_general_pm | collides_with_general_pm_advice | general_pm_advice |
| dc-28 | decision_support_vs_general_pm | collides_with_general_pm_advice | general_pm_advice |
| dc-31 | decision_support_vs_risk | collides_with_general_pm_advice | general_pm_advice |
| dc-41 | decision_support_vs_governance | collides_with_general_pm_advice | general_pm_advice |
| dc-44 | decision_support_vs_governance | collides_with_general_pm_advice | general_pm_advice |

Notably, `general_pm_advice` collisions leak across every `decision_support_vs_*` category, not just
`decision_support_vs_general_pm` — confirming Sprint 18R's own finding that `general_pm_advice`'s
current pattern list is too eager against decision-shaped phrasing broadly, not only the phrasing the
category name suggests.

### Top handler gaps

All 19 are `handler_low_confidence` (0 `handler_missing_options`, 0 `handler_missing_evidence`, 0
`handler_safety_failure`). Sample (capped at 10): `dc-01`, `dc-04`, `dc-05`, `dc-07`, `dc-08` (all
`general_decision_support`), `dc-09`, `dc-10`, `dc-11` (`identify_missing_decision`), `dc-13`, `dc-14`
(`general_decision_support`, both also colliding with `playbook_analysis`/`general_pm_advice` live).

### Shadow routable cases

18/45 (40%). By architecture category: `decision_support_vs_closure` is the strongest slice at
**100%** (6/6 — the six binary-decision cases here all extract two named options and produce
`medium` confidence), `decision_support_vs_risk` **66.7%** (4/6), `decision_support_vs_governance`
**60%** (3/5), `decision_support_clear` and `decision_support_vs_general_pm` both **25%**,
`decision_support_vs_playbook` **0%** (every one of its 8 cases either collides with
`playbook_analysis`/`general_pm_advice` live or lands on low confidence). Sample
(`topShadowRoutableCases`, capped at 10, highest confidence first): `dc-03`, `dc-06`, `dc-12`, `dc-25`,
`dc-28`, `dc-29`, `dc-30`, `dc-32`, `dc-33`, `dc-35` — all `medium` confidence (no case in this corpus
reaches `"high"`, since no case supplies `availableContext`).

## Integration mode recommendation: `do_not_integrate`

Per this sprint's literal rules: `do_not_integrate` fires whenever `candidateHandlerSafeRate < 70%`,
`handlerSafetyFailureCount > 0`, **or** `shadowRoutableRate < 50%`. Here, only the third condition
holds (`shadowRoutableRate` 40% < 50%) — the handler itself is safe (100%) and has zero safety
failures. This is a stricter result than "acceptable" outcomes this sprint anticipated
(`route_after_classifier_calibration` / `offline_evaluation_only`), and it is reported honestly rather
than adjusted to fit — per the sprint's own instruction not to force a nicer answer than the data
supports.

Read alongside the two root causes above, this is not a discouraging result: it means "not yet, and
here specifically is what has to improve before shadow mode is even worth trying" — both causes are
already-tracked, addressable gaps (classifier boundary calibration; `DecisionDraft` context reuse), not
new problems this sprint discovered.

## Why this does not connect to the router yet

Per this sprint's explicit constraints, and because the measured `shadowRoutableRate` (40%) is well
under any threshold that would justify even a default-off shadow mode: connecting `decision_support`
to anything reachable from production would risk exactly what Sprints 17R-19R were built to avoid —
wiring a route whose live collision profile is not yet resolved. `general_pm_advice` alone accounts for
7 of 21 unsafe classifier collisions and appears across every `decision_support_vs_*` category; that
alone is reason enough to hold.

## Criteria to pass to Sprint 21R

Per `recommendedNextSprint`, the dominant gap bucket in this evaluation is the classifier boundary
(`playbookCollisionCount` + `generalPmCollisionCount` = 10) versus handler-structural-quality (0,
excluding low-confidence, which is designed behavior, not a defect), adapter/mapping (1), and
clarification-with-unsafe-mapping (7). **Sprint 21R — Decision Support Classifier Boundary
Calibration** should, in order:

1. Reuse this sprint's evaluator and the Sprint 18R corpus as its own entry/exit criteria — re-run
   `tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` and confirm the golden
   corpus (`compatibilityRate` 72.5%), Sprint 17R boundary review, and Sprint 18R architecture review
   all stay unchanged.
2. Resolve the `general_pm_advice` and `playbook_analysis` collisions with explicit tie-break logic in
   the classifier layer (not in the candidate handler) — starting with `general_pm_advice`, since it is
   both the largest single collision bucket here and the one Sprint 18R already flagged as the
   sharpest.
3. Only after the classifier boundary work, consider wiring real `DecisionDraft` context into the
   analyzer (raising confidence for the 19 currently-low-confidence cases) as a distinct, later step —
   not before, since a confident-but-miscategorized answer is worse than a low-confidence one.
4. Re-run this sprint's shadow mapping evaluation after both of the above to confirm
   `shadowRoutableRate` has actually risen before proposing any feature-flagged (default-off) router
   integration.

## Sprint 21R follow-up — Decision Support Classifier Boundary Calibration

Sprint 21R did exactly item 2 above — see `docs/conversational-brain-decision-support-classifier-boundary.md`
for the full before/after. In this evaluator's own terms: `unsafeClassifierCollisionCount` fell from
21 to 5 (`playbookCollisionCount` 3→0, `generalPmCollisionCount` 7→1, `riskCollisionCount` 5→2,
`closureCollisionCount` 2→1, `governanceCollisionCount` 3→0), and `currentMappingSafeRate` rose from
64.6% to 84.8%. `shadowRoutableRate` stayed at 40% and `candidateHandlerSafeRate` stayed at 100% —
untouched, since Sprint 21R deliberately did not touch the handler or `DecisionDraft` context reuse
(item 3 above). `recommendedIntegrationMode` is still `do_not_integrate` (the module's own,
unmodified threshold). New metrics this sprint added to the evaluator/types
(`enrichedDecisionSupportDetectedCount`, `unsupportedSafeParkingCount`,
`semanticBoundaryImprovementCount`, and the five `*CollisionReduction` fields) are documented in the
Sprint 21R doc above; none of them are treated as a production-routing success.

## Sprint 22R follow-up — Clarification Response Strategy

Sprint 22R built an isolated Clarification Response Strategy
(`src/lib/playbook-engine/conversation/clarification/`, see
`docs/conversational-brain-clarification-response-strategy.md`) that answers the *other* half of
this document's own scope — `needs_clarification` cases, which this evaluator reports but never runs
through the decision-support candidate handler. This sprint did not touch
`decisionSupportShadowMappingEvaluation.ts`, `decisionSupportShadowMappingTypes.ts`, or any file in
`decision-support/` — re-running `tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs`
confirms every metric above (`candidateHandlerCoverageRate`/`candidateHandlerSafeRate` 100%,
`shadowRoutableRate` 40%, `recommendedIntegrationMode` `do_not_integrate`) is unchanged. The new
strategy's own offline evaluator measured `acceptableResponseRate` 100% and `safetyPassRate` 100%
against the Sprint 18R/17R clarification corpora, with `recommendedNextSprint` **"Sprint 23R —
Decision Support Adapter Mapping Plan"** — i.e. this document's own `do_not_integrate` finding is now
the largest remaining gap in the series, not clarification response quality.

## Sprint 23R follow-up — Decision Support Adapter Mapping Plan

Sprint 23R built exactly that adapter mapping plan — see
`docs/conversational-brain-decision-support-adapter-mapping-plan.md` — reusing
`runDecisionSupportShadowMappingEvaluation()` from this file unmodified as one of its building
blocks. This sprint did not touch `decisionSupportShadowMappingEvaluation.ts` or
`decisionSupportShadowMappingTypes.ts` — re-running this file's own test suite confirms every metric
above is unchanged, including `recommendedIntegrationMode` `do_not_integrate`. The new plan simulates
eight mapping strategies against this evaluator's own `isShadowRoutable` signal and recommends
`hybrid_shadow_then_clarify` for Sprint 24R, with `recommendedNextSprint`: **"Sprint 24R — Decision
Support Shadow Mode Prep"**.

## Sprint 24R update

Sprint 24R's shadow mode prep contract reuses this evaluator's underlying signal indirectly (via the
Sprint 19R candidate handler and the Sprint 23R adapter mapping plan, which this evaluator itself
feeds) but does not import or modify `decisionSupportShadowMappingEvaluation.ts` or
`decisionSupportShadowMappingTypes.ts` directly. This file's own 52-test suite still passes unchanged:
`candidateHandlerSafeRate` 100%, `shadowRoutableRate` 40%, `recommendedIntegrationMode`
`do_not_integrate`. See `docs/conversational-brain-decision-support-shadow-mode-prep.md`.

## Sprint 25R update

Sprint 25R's shadow capture harness does not import or modify `decisionSupportShadowMappingEvaluation.ts`
or `decisionSupportShadowMappingTypes.ts` directly — it reuses this evaluator's signal only
transitively, through the Sprint 24R shadow mode prep contract. This file's own 52-test suite still
passes unchanged: `candidateHandlerSafeRate` 100%, `shadowRoutableRate` 40%,
`recommendedIntegrationMode` `do_not_integrate`. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md`.

## Sprint 26R note

Sprint 26R's storage policy does not import `decisionSupportShadowMappingEvaluation.ts` or
`decisionSupportShadowMappingTypes.ts` directly. This file's own 52-test suite still passes unchanged:
`candidateHandlerSafeRate` 100%, `shadowRoutableRate` 40%, `unsafeClassifierCollisionCount` 5,
`recommendedIntegrationMode` `do_not_integrate`. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan does not import `decisionSupportShadowMappingEvaluation.ts` or
`decisionSupportShadowMappingTypes.ts` directly. This file's own 52-test suite still passes unchanged:
`candidateHandlerSafeRate` 100%, `shadowRoutableRate` 40%, `unsafeClassifierCollisionCount` 5,
`recommendedIntegrationMode` `do_not_integrate`. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter does not import `decisionSupportShadowMappingEvaluation.ts` or
`decisionSupportShadowMappingTypes.ts` directly. This file's own 52-test suite still passes unchanged:
`candidateHandlerSafeRate` 100%, `shadowRoutableRate` 40%, `unsafeClassifierCollisionCount` 5,
`recommendedIntegrationMode` `do_not_integrate`. See
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md`.

---

## Nota — Sprint 29R

Sprint 29R creó una **Persistence Readiness Review**
(`docs/conversational-brain-decision-support-shadow-persistence-readiness.md`). No cambió producción.
No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó un loop de clarificación persistente. No
conectó `decision_support` al router. Decisión explícita: `do_not_build_real_persistence_yet`. Siguiente
sprint recomendado: **Sprint 30R — Controlled Shadow Replay Evaluation**.


---

## Nota — Sprint 30R

Sprint 30R creó una **Controlled Shadow Replay Evaluation**
(`docs/conversational-brain-decision-support-shadow-controlled-replay.md`), replayando el corpus del
Sprint 18R (79 casos) tres veces a través del pipeline shadow existente usando unicamente el fake
adapter del Sprint 28R. No cambió producción. No cambió routing. No activó ningún feature flag. No creó
DB/migrations/tables/SQL files. No creó storage adapter real. No creó repository real. No implementó un
loop de clarificación persistente. No conectó `decision_support` al router. Decisión explícita:
`ready_for_clarification_gated_integration_plan`. Siguiente sprint recomendado: **Sprint 31R —
Clarification-Gated Decision Support Integration Plan**.


---

## Nota — Sprint 31R

Sprint 31R creó un **Clarification-Gated Decision Support Integration Plan**
(`docs/conversational-brain-decision-support-clarification-gated-integration-plan.md`), clasificando
los 79 casos del corpus Sprint 18R (vía el replay del Sprint 30R) en cuatro tipos de ruta de integración
y construyendo un contrato de ruta y requisitos de clarification gate para cada uno. No cambió
producción. No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files.
No creó storage adapter real. No creó repository real. No implementó un loop de clarificación
persistente. No conectó `decision_support` al router. No mostró output de `decision_support` al
usuario. Decisión explícita: `ready_for_user_visible_dry_run_plan`. Siguiente sprint recomendado:
**Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan**.

## Nota Sprint 32R

Sprint 32R creó el Decision Support Response QA / User-Visible Dry Run Plan
(`docs/conversational-brain-decision-support-response-qa-dry-run-plan.md`). No cambió producción, no
cambió routing, no activó ningún feature flag, no creó DB/migrations/tables/SQL files, no creó storage
adapter real ni repository real, no implementó un persistent clarification loop, no conectó
`decision_support` al router, no mostró output de `decision_support` al usuario, no creó
emails/drafts/tasks, y no ejecutó acciones. Decisión explícita: `ready_for_response_draft_harness`.
Siguiente sprint recomendado: Sprint 33R — Decision Support Response Draft Harness.



## Nota — Sprint 33R

Sprint 33R creó el Decision Support Response Draft Harness
(`docs/conversational-brain-decision-support-response-draft-harness.md`). No cambió producción. No
cambió routing. No activó feature flag. No creó DB/migrations/tables/SQL files. No creó storage adapter
real. No creó repository real. No implementó persistent clarification loop. No conectó `decision_support`
al router. No mostró output `decision_support` al usuario. No creó emails/drafts/tasks. No ejecutó
acciones. Decisión explícita: `ready_for_response_draft_quality_evaluation`. Siguiente sprint
recomendado: Sprint 34R — Decision Support Response Draft Quality Evaluation.

## Nota — Sprint 34R

Sprint 34R creó Decision Support Response Draft Quality Evaluation
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts`),
una evaluación offline, determinística y basada en reglas de la calidad de los drafts sintéticos
generados por el Sprint 33R Response Draft Harness, a través de catorce dimensiones de calidad.

- No cambió producción.
- No cambió routing.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_user_visible_dry_run_evaluation_harness`.
- Siguiente sprint recomendado: Sprint 35R — User-Visible Dry Run Evaluation Harness.

Ver `docs/conversational-brain-decision-support-response-draft-quality-evaluation.md` para el detalle
completo.

## Nota — Sprint 35R

Sprint 35R creó User-Visible Dry Run Evaluation Harness
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts`),
un harness offline y determinístico que renderiza previews sintéticos internos de cómo se verían los
drafts de `decision_support` si eventualmente fueran presentados al usuario, valida cada preview contra un
display contract por preview kind, y recomienda el siguiente sprint.

- No cambió producción.
- No cambió routing.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_default_off_route_composer_integration_adapter`.
- Siguiente sprint recomendado: Sprint 36R — Default-Off Route/Composer Integration Adapter.

Ver `docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md` para el
detalle completo.

## Nota — Sprint 36R

Sprint 36R creó Default-Off Route/Composer Integration Adapter
(`src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts`),
un adapter offline y determinístico, default-off, que conecta cada preview validado por Sprint 35R con un
route guard contract y un composer guard contract sintéticos, simulando cómo se comportaría un futuro
wiring de router/composer sin tocar nunca el router, composer o endpoint reales.

- No cambió producción.
- No cambió routing real.
- No cambió composer real.
- No cambió endpoint.
- No activó feature flag.
- No creó DB/migrations/tables/SQL files.
- No creó storage adapter real.
- No creó repository real.
- No implementó persistent clarification loop.
- No conectó `decision_support` al router real.
- No conectó `decision_support` al composer real.
- No mostró output de `decision_support` al usuario.
- No creó emails/drafts/tasks.
- No ejecutó acciones.
- Decisión explícita: `ready_for_production_wiring_readiness_feature_flag_gate`.
- Siguiente sprint recomendado: Sprint 37R — Production Wiring Readiness / Feature Flag Gate.

Ver `docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md` para el
detalle completo.
