# Sprint 34R — Decision Support Response Draft Quality Evaluation

## Executive summary

Sprint 34R builds a **Response Draft Quality Evaluation**: an offline, deterministic, rule-based
evaluation that scores every synthetic draft the Sprint 33R response draft harness already generated and
validated across fourteen quality dimensions — clarity, usefulness, PM relevance, clarification quality,
assumption quality, safe-next-step quality, non-execution clarity, route/unsupported preservation
quality, tone, conciseness, overconfidence, leakage, and side effects — and consolidates a decision on
whether the corpus is ready for a Sprint 35R user-visible dry run evaluation harness. It never shows
anything to a real user, never persists anything real, never touches the router, composer, or endpoint,
and never calls an LLM — scoring is purely rule-based over already-generated draft content.

Result (computed against the real Sprint 18R corpus, 79 cases, via
`runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now })` +
`summarizeDecisionSupportResponseDraftQualityEvaluation()`):

- profile: `strict_response_draft_quality_evaluation`
- mode: `quality_evaluation_only`
- totalCases: `79`
- evaluatedDraftCount: `79`
- passCount: `79`
- warningCount: `0`
- failCount: `0`
- blockedCount: `0`
- excellentCount: `69`
- acceptableCount: `10`
- needsImprovementCount: `0`
- unacceptableCount: `0`
- blockedBandCount: `0`
- averageOverallScore: `91.88`
- averageSafetyScore: `100`
- averageClarificationScore: `93.3`
- minOverallScore: `88.43`
- minSafetyScore: `100`
- minClarificationScore: `92.33`
- safeForUserVisibleDryRunHarnessCount: `79`
- safeForUserVisibleOutputNowCount: `0`
- safeForProductionCount: `0`
- criticalIssueCount: `0`
- leakageIssueCount: `0`
- sideEffectIssueCount: `0`
- every attempted count (`userVisibleOutputAttemptedCount`, `productionWiringAttemptedCount`,
  `realPersistenceAttemptedCount`, `dbWriteAttemptedCount`, `supabaseWriteAttemptedCount`,
  `externalCallAttemptedCount`): `0`
- every dimension pass count (`clarityPassCount` ... `noSideEffectsPassCount`): `79`
- decision: `ready_for_user_visible_dry_run_evaluation_harness`
- recommendedNextSprint: `Sprint 35R — User-Visible Dry Run Evaluation Harness`

These are the *real* numbers, and they match Sprint 33R's own 69 `clarification_first_draft` / 10
`route_preservation_draft` breakdown exactly: every `clarification_first_draft` case lands in the
`excellent` score band, every `route_preservation_draft` case lands in the `acceptable` band — a clean
separation driven entirely by the scoring model, not by draft kind directly.

## Qué problema resuelve

Sprint 33R's own decision (`ready_for_response_draft_quality_evaluation`) named this evaluation directly.
Sprint 34R answers:

- ¿Los drafts son útiles para el usuario?
- ¿Los drafts son claros?
- ¿Los drafts son accionables sin ejecutar acciones?
- ¿Los drafts mantienen tono PM-friendly?
- ¿Los drafts evitan sonar como una decisión final cuando falta aclaración?
- ¿Los drafts hacen buenas preguntas de aclaración?
- ¿Los drafts declaran supuestos de forma segura?
- ¿Los drafts proponen un siguiente paso seguro?
- ¿Los drafts preservan rutas existentes cuando corresponde?
- ¿Los drafts preservan unsupported boundaries cuando corresponde?
- ¿Los drafts evitan sobreconfianza?
- ¿Los drafts evitan leakage?
- ¿Los drafts evitan tareas/emails/drafts/acciones reales?
- ¿Los drafts están listos para un user-visible dry run harness offline?
- ¿Cuál debe ser el siguiente sprint?

## Qué NO resuelve todavía

- No muestra drafts reales al usuario.
- No conecta `decision_support` al router.
- No conecta `decision_support` al composer.
- No cambia el endpoint.
- No activa un feature flag real.
- No crea DB, migrations, SQL files, tablas, Supabase, storage adapter real, o repository real.
- No crea emails/drafts/tasks reales.
- No ejecuta acciones reales.
- No persiste output real.
- No llama a ningún LLM — el scoring es 100% determinístico y basado en reglas.
- No implementa un user-visible dry run harness — eso es el trabajo de Sprint 35R.

## Baseline Sprint 33R

Sprint 33R's response draft harness, run against the same 79-case corpus with
`now: "2026-01-01T00:00:00.000Z"`:

- profile: `strict_response_draft_harness`
- totalCases: `79`
- draftGeneratedCount / draftAcceptedCount: `79` / `79`
- draftRejectedCount / draftBlockedCount: `0` / `0`
- clarificationFirstDraftCount: `69`
- routePreservationDraftCount: `10`
- unsupportedBoundaryDraftCount / shadowOnlyInternalDraftCount / blockedUnsafeDraftCount: `0` / `0` / `0`
- qaPassCount: `79`
- violationCount / criticalViolationCount: `0` / `0`
- every attempted/leak/payload count: `0`
- decision: `ready_for_response_draft_quality_evaluation`
- recommendedNextSprint: `Sprint 34R — Decision Support Response Draft Quality Evaluation`

`runDecisionSupportResponseDraftQualityEvaluation()` reuses this exact harness result (or builds one from
the same corpus when not supplied) via `runDecisionSupportResponseDraftHarness()` /
`summarizeDecisionSupportResponseDraftHarness()`, unchanged, and exposes it as `harness`/`harnessSummary`,
so this sprint's own test suite can assert the numbers above have not moved.

## Why Response Draft Quality Evaluation after Response Draft Harness

Sprint 33R proved every case in the corpus can be drafted into a synthetic, contract-matched,
non-leaking, side-effect-free response, and named this quality evaluation as its next step. Sprint 34R
stays entirely at the scoring layer: it takes each already-generated, already-validated draft and asks
*how good* it is along fourteen independent dimensions — it never re-derives a draft, never re-runs the
underlying harness, and never shows anything to a real user.

## Quality evaluation config

```ts
type DecisionSupportResponseDraftQualityEvaluationConfig = {
  profile: "strict_response_draft_quality_evaluation";
  mode: DecisionSupportResponseDraftQualityEvaluationMode;
  minOverallScore: number;       // default 85
  minDimensionScore: number;     // default 75
  minClarificationScore: number; // default 85
  minSafetyScore: number;        // default 100
  allowUserVisibleOutput: false;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowFeatureFlag: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireHarnessPass: true;
  requireNoCriticalIssues: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireClarificationFirstQuality: true;
  requireSafeNextStepQuality: true;
  requireNonExecutionClarity: true;
  now?: string;
  notes?: string[];
};
```

`createDecisionSupportResponseDraftQualityEvaluationConfig()` defaults to `mode: "quality_evaluation_only"`
and forces all thirteen `allow*` real-side-effect fields to `false` **regardless of what a caller's
overrides object claims** — mirroring how the Sprint 33R response draft harness's own config never
actually loosens its thirteen `allow*` real-side-effect flags from an override. The seven `require*`
fields are always `true`. This is tested explicitly for every one of the thirteen fields, individually and
all-at-once.

## Allowed actions

`listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions()`:

- Build a user-visible dry run evaluation harness (Sprint 35R).
- Run an offline response rendering review for every draft kind.
- Design a dry-run composer contract for a future, still non-production, review.
- Run a safe preview formatting review across every draft.
- Run a response acceptance criteria review against every draft.
- Run a route-preserving display simulation for every `route_preservation_draft`.

## Prohibited actions

`listDecisionSupportResponseDraftQualityEvaluationProhibitedActions()`:

- Show draft to real user.
- Wire router, composer, or endpoint.
- Enable production feature flag.
- Create DB, migration, or SQL file.
- Write Supabase.
- Implement real repository or real storage adapter.
- Execute actions, create tasks, create emails, create drafts, or call external services.
- Persist output real.

## Quality dimensions

Fourteen dimensions, each scored 0–100 by `scoreDecisionSupportResponseDraftQualityDimension()`:

| Dimension | Applies to | Base score (clean draft) |
| --- | --- | --- |
| `clarity` | every kind | 95 (cf) / 88 (rp) / 88 (ub) / 85 (internal) |
| `usefulness` | every kind | 92 / 85 / 85 / 80 |
| `pm_relevance` | cf / rp / ub only (trivial for internal-only drafts) | 93 / 87 / 87 |
| `clarification_quality` | `clarification_first_draft` only | 95 (100 elsewhere — n/a) |
| `assumption_quality` | `clarification_first_draft` only | 90 (100 elsewhere — n/a) |
| `safe_next_step_quality` | every kind | 92 / 87 / 87 / 85 |
| `non_execution_clarity` | every kind | 100 |
| `route_preservation_quality` | `route_preservation_draft` only | 95 (100 elsewhere — n/a) |
| `unsupported_boundary_quality` | `unsupported_boundary_draft` only | 95 (100 elsewhere — n/a) |
| `tone` | every kind | 92 / 87 / 87 / 85 |
| `conciseness` | every kind | 90 / 90 / 90 / 95 |
| `no_overconfidence` | every kind | 100 |
| `no_leakage` | every kind | 100 |
| `no_side_effects` | every kind | 100 |

"internal" covers `shadow_only_internal_draft` and `blocked_unsafe_draft` — draft kinds the real Sprint
18R corpus never produces (both counts stay `0`), included here for completeness and exercised only by
this sprint's own fixtures.

A dimension that does not apply to a draft's kind (e.g. `clarification_quality` for a
`route_preservation_draft`) trivially scores `100` with zero issues — mirroring how Sprint 33R's own
`clarificationFirstPassed`/`routePreservationPassed`/`unsupportedPreservationPassed` are trivially `true`
for non-applicable draft kinds.

## Scoring model

Each applicable dimension starts at its base score, then loses points for every detected **soft** issue
(`unclear_question`/`missing_question`/`weak_assumptions`/`missing_assumptions`/`weak_next_step`/
`missing_next_step`/`too_verbose`/`too_vague`/`not_pm_relevant`, each `-15` to `-35`, clamped to `[0,
100]`). A **critical**, **leakage**, or **side-effect** issue on a dimension instead forces that
dimension's score straight to `0` and its status to `blocked`, regardless of any soft issue:

- Critical: `missing_non_execution_notice`, `overconfident_language`, `sounds_like_final_decision`,
  `unsafe_tone`, `route_not_preserved`, `unsupported_not_preserved`.
- Leakage: `raw_input_leak`, `full_candidate_leak`, `pii_leak`, `project_name_leak` — read directly from
  the draft's own `safety.*` flags.
- Side effect: `side_effect_risk`, `execution_language`, `task_creation_language`,
  `email_creation_language`, `persistence_language` — read directly from the draft's own
  `userVisibleNow`/`persistedNow`/`executableNow`/`externalSideEffectsAllowed`/`safety.*` flags, plus a
  content-pattern scan for execution-sounding language.

Detection is purely rule-based over the draft's already-generated `sections`/`safety`/status flags — regex
pattern matches for PM vocabulary, unsafe tone, overconfident language, and execution language; presence/
length checks for questions, assumptions, and next steps. No LLM call anywhere in this module.

`overallScore` is the average of the *applicable, non-safety* dimensions for the draft's kind (`clarity`,
`usefulness`, `pm_relevance`, `safe_next_step_quality`, `tone`, `conciseness`, plus whichever of
`clarification_quality`/`assumption_quality`/`route_preservation_quality`/`unsupported_boundary_quality`
applies). `safetyScore` is the average of `non_execution_clarity`, `no_overconfidence`, `no_leakage`, and
`no_side_effects`. `clarificationScore` is the average of `clarification_quality`/`assumption_quality`/
`safe_next_step_quality` for a `clarification_first_draft`, else `100`.

## Case evaluation logic

`evaluateDecisionSupportResponseDraftQualityCase()`:

1. Refuses to evaluate (and returns a forced `blocked` result) when the source Sprint 33R case was not
   `draftAccepted` or did not pass Sprint 33R QA — a rejected/blocked draft has nothing valid to score.
   Even in this refused path, `no_leakage`/`no_side_effects` are still evaluated directly against the
   draft's own safety flags, so a real leak or side-effect risk is still surfaced as a specific issue
   rather than a generic reason.
2. Scores all fourteen dimensions.
3. Computes `overallScore`/`safetyScore`/`clarificationScore`.
4. Consolidates `issues` (deduped), `criticalIssueCount`, `leakageIssueCount`, `sideEffectIssueCount`.
5. `qualityStatus`: `blocked` if any leakage/side-effect/critical issue is present, else `pass` if
   `overallScore >= 85` and `safetyScore === 100`, else `warning` if `overallScore >= 75`, else `fail`.
6. `scoreBand`: `blocked` if `qualityStatus` is `blocked`, else `excellent` if `overallScore >= 90` with
   zero issues, else `acceptable` if `overallScore >= 85` with zero critical issues, else
   `needs_improvement` if `overallScore >= 75`, else `unacceptable`.
7. A `blocked` case reports `overallScore`/`safetyScore`/`clarificationScore` as `0` — mirroring how a
   blocking dimension's own score is forced to `0` — rather than a possibly-high `overallScore` that would
   understate how severe the block is.
8. `safeForUserVisibleDryRunHarness` mirrors `pass`. `safeForUserVisibleOutputNow` and `safeForProduction`
   are always `false`.

## Summary metrics

See the Executive Summary above for the real Sprint 18R corpus numbers. `excellentCount` (`69`) matches
`clarificationFirstDraftCount` exactly, and `acceptableCount` (`10`) matches `routePreservationDraftCount`
exactly — every `clarification_first_draft` scores `overallScore >= 90` with zero issues, every
`route_preservation_draft` scores `overallScore` in `[85, 90)`, purely as an emergent property of the
scoring model, not a hardcoded per-kind band assignment.

## Decisión

```
any leakage/side-effect issue                    -> blocked_by_leakage_or_side_effect_risk
any case carries unsafe_tone                     -> blocked_by_unsafe_tone
any case missing/weak safe next step             -> blocked_by_missing_safe_next_step
averageClarificationScore < minClarificationScore -> blocked_by_clarification_quality_gap
averageOverallScore < minOverallScore             -> blocked_by_low_quality_score

allClean =
  totalCases > 0 &&
  evaluatedDraftCount === totalCases && passCount === totalCases &&
  warningCount === 0 && failCount === 0 && blockedCount === 0 &&
  averageOverallScore >= 90 && averageSafetyScore === 100 && averageClarificationScore >= 85 &&
  every minimum score at or above its floor &&
  every safety/leak/side-effect/attempted count at zero (as applicable) &&
  Sprint 33R response draft harness decision === ready_for_response_draft_quality_evaluation

if (allClean) -> ready_for_user_visible_dry_run_evaluation_harness
else           -> continue_quality_evaluation_only
```

Against the Sprint 18R corpus: `decision: ready_for_user_visible_dry_run_evaluation_harness`.

## Siguiente sprint recomendado

`Sprint 35R — User-Visible Dry Run Evaluation Harness`.

## Por qué no se mostró output al usuario

Every case evaluation carries `safeForUserVisibleOutputNow: false` — a future user-visible dry run must
review this evaluation's output before it could ever reach a real user.

## Por qué no se cambió router

`brainRouter.ts` is production code. This evaluation only scores synthetic harness-only drafts offline —
it never imports or modifies the router.

## Por qué no se cambió composer

`responseComposer.ts` is production code. This evaluation never imports or modifies the composer.

## Por qué no se cambió endpoint

`POST /api/command-center/chat` is production code. This evaluation never imports or modifies the
endpoint or any of its handlers.

## Por qué no se creó feature flag

No production feature flag exists for `decision_support`, and none is created by this evaluation —
flipping one on is a production activation decision, not an evaluation decision. `allowFeatureFlag` stays
`false` regardless of any override.

## Por qué no se creó DB

The Sprint 29R persistence readiness review (reused transitively via the Sprint 33R/32R/31R plans) still
resolves to `do_not_build_real_persistence_yet` when recomputed against the same corpus — tenant
isolation, access control, retention, audit, observability, rollback, security review, and DSR policy
remain missing. Nothing about scoring synthetic draft quality changes that.

## Por qué no se creó migration

No migration precondition documented in Sprint 27R/29R has newly become satisfied by scoring synthetic
drafts.

## Por qué no se creó SQL file

No migration, table, or real storage adapter exists yet to generate SQL against.

## Por qué no se creó Supabase storage

No Supabase client is imported anywhere in this module tree, and every case evaluation stays
`safeForUserVisibleOutputNow: false`, `safeForProduction: false` — nothing this sprint produces is ever
written anywhere real.

## Por qué no se creó storage adapter real

This evaluation reuses the Sprint 28R fake adapter's evaluation summary (via the Sprint 33R/32R/31R plans)
as evidence that the underlying layer is still clean — it does not build a new or real adapter.

## Por qué no se creó repository real

A repository presumes a real storage adapter exists underneath it, which this evaluation does not build.

## Criterio para pasar a Sprint 35R

Every case must stay `qualityStatus: pass`, `safeForUserVisibleDryRunHarness: true`, every leakage/side-
effect/critical count must stay at zero, `averageOverallScore` must stay `>= 90`, `averageSafetyScore`
must stay `100`, and the Sprint 33R response draft harness must stay
`ready_for_response_draft_quality_evaluation` — which is exactly what this sprint measured against the
Sprint 18R corpus. Sprint 35R can then build a User-Visible Dry Run Evaluation Harness: still without
wiring the router, without wiring the composer, without activating a production feature flag, and without
showing anything to a real user until that future harness explicitly reviews it. The Sprint 29R
prerequisites for *real persistence* specifically remain untouched and still block any real persistence —
Sprint 34R's scope is explicitly *quality scoring*, not persistence or user-visible activation.

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


## Nota Sprint 37R

Sprint 37R creó el **Production Wiring Readiness / Feature Flag Gate**
(`docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md`). No cambió
producción. No cambió routing real. No cambió composer real. No cambió endpoint. No implementó feature flag
real. No activó feature flag. No leyó `process.env`. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó persistent clarification loop. No conectó
`decision_support` al router real. No conectó `decision_support` al composer real. No mostró output de
`decision_support` al usuario. No creó emails/drafts/tasks. No ejecutó acciones. No reclamó aprobación real.
Decisión explícita: `ready_for_default_off_feature_flag_implementation_shell`. Siguiente sprint
recomendado: Sprint 38R — Default-Off Feature Flag Implementation Shell.


## Sprint 38R note

- Sprint 38R (`docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md`) built a **Default-Off Feature Flag Implementation Shell** directly on top of Sprint 37R's production wiring readiness / feature flag gate.
- It builds a formal, no-op feature flag shell (types, resolver, handoff, rollback-reference functions) — never a real production feature flag, never activated, never reading `process.env` or any runtime configuration source.
- It never wires the router, composer, or endpoint to `decision_support`, never shows output to a real user, and never persists anything real.
- Running it against the real Sprint 18R corpus (79 cases) reused this module's own evaluation transitively and stayed clean: `shellAcceptedCount: 79`, `violationCount: 0`, decision `ready_for_default_off_router_guard_shell`.
- Recommended next sprint: **Sprint 39R — Default-Off Router Guard Shell**.
- This module and its findings do not change anything documented in this file — this note exists only to point forward to Sprint 38R's own doc for readers following the sprint chain.

## Sprint 39R note

- Sprint 39R (`docs/conversational-brain-decision-support-default-off-router-guard-shell.md`) built a **Default-Off Router Guard Shell** directly on top of Sprint 38R's default-off feature flag implementation shell.
- It did not change production, real routing, the real router, or a real route; it did not import the real router or mutate a real route. It did not change the real composer or the endpoint, did not activate the feature flag, and did not read `process.env`. It did not implement a real production router guard.
- It did not create a DB, migrations, tables, or SQL files, a real storage adapter, or a real repository, and it did not implement a persistent clarification loop. It did not connect `decision_support` to the real router or the real composer, and it did not show `decision_support` output to the user.
- It did not create emails, drafts, or tasks, did not execute actions, and did not claim real approval.
- Running it against the real Sprint 18R corpus (79 cases) reused this module's own evaluation transitively and stayed clean: `routerGuardAcceptedCount: 79`, `violationCount: 0`, decision `ready_for_default_off_composer_guard_shell`.
- Recommended next sprint: **Sprint 40R — Default-Off Composer Guard Shell**.
- This module and its findings do not change anything documented in this file — this note exists only to point forward to Sprint 39R's own doc for readers following the sprint chain.
