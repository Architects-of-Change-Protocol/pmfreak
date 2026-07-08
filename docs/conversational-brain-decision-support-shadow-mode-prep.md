# Decision Support Shadow Mode Prep (Sprint 24R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R),
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R), and
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md` (Sprint 23R). This file is the
> standalone design/results document for the shadow mode prep contract produced by Sprint 24R.

## Executive summary

Sprint 23R simulated eight candidate strategies for mapping `decision_support` in production and
recommended `hybrid_shadow_then_clarify` as both the safest non-production strategy and the safest
future integration strategy — 100% safe-outcome rate, zero critical risk, 100% existing-route
preservation, using both the Sprint 19R candidate handler (45 safe cases) and the Sprint 22R
clarification strategy (51 safe cases). What Sprint 23R did not produce was a concrete technical
contract for *how* that strategy would actually run in a shadow mode: what inputs it takes, which
gates it applies, when each downstream module runs, what metadata is captured, and what is returned
to a caller.

Sprint 24R builds that contract — `decisionSupportShadowModePrep.ts` — as a pure, offline,
deterministic module that implements `hybrid_shadow_then_clarify` exactly: existing routes are always
preserved untouched; a `decision_support`-desired input runs the Sprint 19R candidate handler and
shadow-routes to it only when the result is safe and confidence is medium/high, falling back to the
Sprint 22R clarification strategy otherwise; a `needs_clarification`-desired input always uses the
clarification strategy; everything else is `not_applicable`. Twelve safety gates are evaluated on
every run, eight of them blocking. Every side-effect field
(`shouldReturnCandidateToUser`/`shouldPersistShadowResult`/`shouldExecuteAction`/`shouldSendEmail`/
`shouldCreateTask`/`shouldWriteToDb`) is a literal `false` on every run — not computed from caller
input — so even a caller who forces `featureFlagEnabled`, `allowUserVisibleOutput`,
`allowPersistence`, `allowExecution`, or `allowProductionRouteChange` to `true` cannot activate
anything: the corresponding blocking gate fails and the run becomes `"blocked_by_safety_gate"`.

| Metric | Value |
|---|---|
| `totalCases` (Sprint 18R corpus) | 79 |
| `shadowEligibleCount` | 69 |
| `decisionCandidateGeneratedCount` | 18 |
| `clarificationCandidateGeneratedCount` | 51 |
| `existingRoutePreservedCount` | 10 |
| `blockedBySafetyGateCount` | 0 |
| `notApplicableCount` | 0 |
| `acceptableShadowPrepRunRate` | **100%** |
| `allBlockingGatesPassedRate` | **100%** |
| `shouldReturnCandidateToUserCount` / `shouldPersistShadowResultCount` | 0 / 0 |
| `shouldExecuteActionCount` / `shouldSendEmailCount` / `shouldCreateTaskCount` / `shouldWriteToDbCount` | 0 / 0 / 0 / 0 |
| `recommendedNextSprint` | **"Sprint 25R — Decision Support Shadow Capture Harness"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no feature flag was created or activated, and every run carries
`shouldExecuteAction: false`.

## What problem this solves

Sprint 23R's own criterion for Sprint 24R was: "puede proceder a preparar (no activar)
`hybrid_shadow_then_clarify` en modo shadow si mantiene `candidateHandlerSafeRate`/`safetyPassRate` en
100%, no reduce `preservesExistingRouteRate` por debajo de 100%, y no introduce ningún cambio real al
router, adapter, composer, endpoint, o feature flag." This sprint answers that: it defines the exact
contract a real shadow mode would need — inputs, eligibility gates, safety gates, captured metadata,
and the offline return shape — and proves the contract holds against the full Sprint 18R corpus
without touching any of the forbidden surfaces.

## What this does NOT solve yet

- **Does not activate shadow mode in the request path.** No router, composer, handler, or endpoint
  file imports this module.
- **Does not connect `decision_support` to the router.** Every result is a pure, offline computation
  over caller-supplied input; nothing is ever shown to a user.
- **Does not implement a real feature flag.** `DecisionSupportShadowModeContext.featureFlagEnabled` is
  a typed field this module *reads defensively* (to prove forcing it does nothing) — no config file,
  environment variable, or feature-flag service is created, read, or evaluated.
- **Does not persist any shadow output.** `shouldPersistShadowResult` is a literal `false`; no shadow
  capture harness (storage, retention policy, redaction) exists yet — that is the explicit Sprint 25R
  candidate this sprint's evaluator recommends.
- **Does not harden the Sprint 19R candidate handler or Sprint 22R clarification strategy.** Both are
  reused exactly as-is; their `shadowRoutableRate` (40%) and vocabulary coverage are unchanged.

## Baseline (Sprint 23R)

| Metric | Sprint 23R baseline |
|---|---|
| Golden corpus `compatibilityRate` | 72.5% |
| Sprint 17R `policyAlignedRate` / `currentSystemAcceptableRate` | 82.9% / 84.3% |
| Sprint 18R `currentSafeMappingRate` / `futureRouteAlreadySupportedRate` | 84.8% / 84.8% |
| Sprint 18R `requiresNewHandlerCount` / `requiresClarificationCount` | 45 / 24 |
| Sprint 19R/20R/21R `candidateHandlerSafeRate` | 100% |
| Sprint 20R/21R `shadowRoutableRate` | 40% |
| Sprint 21R `enrichedDecisionSupportDetectionRate` | 88.9% |
| Sprint 21R `unsafeClassifierCollisionCount` | 5 (playbook 0 / general_pm 1 / risk 2 / closure 1 / governance 0) |
| Sprint 22R `acceptableResponseRate` / `safetyPassRate` / `routeOptionsCoverageRate` | 100% / 100% / 100% |
| Sprint 22R `overQuestioningCount` | 0 |
| Sprint 23R `bestStrategy` / `recommendedSprint24Strategy` | `hybrid_shadow_then_clarify` / `hybrid_shadow_then_clarify` |
| Sprint 23R `hybrid_shadow_then_clarify` safeOutcomeRate / criticalRiskCount / preservesExistingRouteRate | 100% / 0 / 100% |
| Sprint 23R `recommendedNextSprint` | "Sprint 24R — Decision Support Shadow Mode Prep" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Why `hybrid_shadow_then_clarify`

Sprint 23R's plan already established this is the only strategy that clears every safety threshold
(`safeOutcomeRate` ≥ 85%, `criticalRiskCount` = 0, `preservesExistingRouteRate` = 100%) while actually
using both the candidate handler and the clarification strategy — the widest safe coverage of any
strategy simulated. This sprint does not re-litigate that choice; it takes it as given and builds the
contract for what running it in shadow mode would concretely mean.

## Shadow mode prep contract

### Inputs

`DecisionSupportShadowModeInput`: `input` (required), optional `id`, `projectId`, `projectName`,
`conversationId`, `availableContext` (passed straight through to the Sprint 19R candidate handler to
raise its confidence estimate), `architectureCategory`, `desiredFutureRoute`, `targetKind`,
`currentProductionMappedIntent`, `source` (`"manual_test" | "architecture_review" |
"adapter_mapping_plan" | "future_shadow"`), and `now` (an injected ISO timestamp — this module never
reads the system clock).

`DecisionSupportShadowModeContext`: `availableProjectContext`, `adapterMappingStrategy` (always
`"hybrid_shadow_then_clarify"` today), and five `boolean` toggles that all default to
`false`/`undefined` and are meant to be forced to `true` only to prove they do nothing:
`featureFlagEnabled`, `allowUserVisibleOutput`, `allowPersistence`, `allowExecution`,
`allowProductionRouteChange`.

### Eligibility gates / routing (hybrid_shadow_then_clarify)

1. **Existing route preservation** — `targetKind === "existing_production_route"` or
   `architectureCategory === "existing_route_should_win"` short-circuits to
   `"existing_route_preserved"` / `candidateKind: "existing_route_preserved"`, with no decision or
   clarification candidate ever computed. This check runs *first*, before any other branch — even a
   case whose `desiredFutureRoute` is `"decision_support"` is preserved if `targetKind` says so (see
   fixture `sm-17`).
2. **Decision support desired** (`desiredFutureRoute === "decision_support"`) — runs
   `handleDecisionSupportCandidate()`. If the result passes every Sprint 19R/20R safety/structural
   check and confidence is `"medium"` or `"high"`, status becomes `"shadow_candidate_generated"` /
   `candidateKind: "decision_support_candidate"`. Otherwise (confidence `"low"`, or a safety/structural
   check fails) it runs `handleClarificationResponseCandidate()` instead and status becomes
   `"clarification_candidate_generated"`.
3. **Clarification desired** (`desiredFutureRoute === "needs_clarification"` or `architectureCategory`
   starting with `"clarification_"`) — always runs `handleClarificationResponseCandidate()`.
4. **Not applicable** — anything else (no decision/clarification/existing-route signal) —
   `status: "not_applicable"`, `candidateKind: "none"`.

### When each handler runs

The Sprint 19R Decision Support Candidate Handler runs only for a `decision_support`-desired,
non-existing-route input. The Sprint 22R Clarification Response Strategy runs for every
clarification-desired input, and as the fallback for a `decision_support`-desired input whose
candidate result is low-confidence or fails a safety/structural check. Neither ever runs for an
existing-route case.

### Metadata captured

Every run's `auditMetadata` records `shadowModeVersion`, `generatedAt` (from the caller's `now`),
`strategySource: "sprint_23_adapter_mapping_plan"`, and three always-`false` flags
(`adapterMappingRealChanged`, `routerChanged`, `composerChanged`, `endpointChanged`) plus a
`limitations` list. Every `gateResults` entry records the gate name, whether it passed, a
human-readable reason, and a severity (`"info" | "warning" | "blocking"`).

### What is returned to an offline caller

`DecisionSupportShadowModeRun`: the full run, including whichever candidate (if any) was generated,
every gate result, `allBlockingGatesPassed`, `preservesExistingRoute`, `warnings`, and the
`auditMetadata` above. `evaluateDecisionSupportShadowModeRun()` reduces this to an
evaluation-ready record; `runDecisionSupportShadowModePrepEvaluation()` runs both across a
`DecisionClarificationCase[]` corpus and cross-checks each run against the Sprint 23R Adapter Mapping
Plan's own `hybrid_shadow_then_clarify` simulation for the same case (an informational warning on
mismatch only — it never changes status or gates).

## Safety gates

| Gate | Severity | Passes when |
|---|---|---|
| `default_off` | blocking | `context.featureFlagEnabled !== true` |
| `no_production_route` | blocking | `context.allowProductionRouteChange !== true` |
| `no_user_visible_output` | blocking | `context.allowUserVisibleOutput !== true` |
| `no_persistence` | blocking | `context.allowPersistence !== true` |
| `no_execution` | blocking | `context.allowExecution !== true` |
| `existing_route_preservation` | blocking | an existing-route case never produced a decision/clarification candidate |
| `candidate_handler_safety` | blocking | no decision candidate was generated, or it passed every Sprint 19R/20R safety/structural check |
| `clarification_safety` | blocking | no clarification candidate was generated, or it passed every Sprint 22R safety/acceptability check |
| `confidence_gate` | warning | medium/high confidence routed to a shadow decision candidate; low confidence routed to a shadow clarification candidate |
| `missing_context_gate` | warning | no candidate is ever shown to the user regardless of confidence/missing context (always true this sprint) |
| `adapter_unchanged` | info | this module does not import `intentCompatibilityAdapter.ts` (always true) |
| `router_unchanged` | info | this module does not import any router/composer/handler file (always true) |

If any **blocking** gate fails, the run's `status` is forced to `"blocked_by_safety_gate"`,
`candidateKind` to `"none"`, and both `decisionCandidate`/`clarificationCandidate` are cleared —
regardless of what the underlying routing decision would otherwise have been.

## Default-off policy

`isDefaultOff`, `userVisibleOutputAllowed`, `persistenceAllowed`, `executionAllowed`, and
`productionRouteChangeAllowed` are literal constants on every `DecisionSupportShadowModeRun` — `true`
for the first, `false` for the rest — never computed from caller input. The five `allow*`/
`featureFlagEnabled` context fields exist specifically so a caller *can* try to force them to `true`;
doing so trips the corresponding blocking gate rather than enabling anything. This is verified directly
by five dedicated fixture cases (`sm-22`-`sm-26`, one per flag) in
`tests/fixtures/conversational-brain-decision-support-shadow-mode-prep-cases.ts`.

## No user-visible output policy

`shouldReturnCandidateToUser` is a literal `false` on every run. Sprint 24R has not yet validated the
candidate handler or clarification strategy's output quality against a live user — that validation is
explicitly out of scope until a future sprint makes a deliberate, separate integration decision.

## No persistence policy

`shouldPersistShadowResult` is a literal `false` on every run. No shadow capture harness (storage
schema, retention policy, redaction rules) exists yet — persisting shadow output today would create
data with no governance around it. Designing that harness is the explicit Sprint 25R candidate this
sprint's evaluator recommends when its own metrics are clean.

## Existing route preservation

`existing_route_should_win` cases (10 in the Sprint 18R corpus) always short-circuit to
`"existing_route_preserved"` before any other branch is evaluated — this is a structural property of
`decideCandidates()`, not a measured coincidence, and is checked even when `desiredFutureRoute` is
`"decision_support"` (fixture `sm-17`).

## Evaluation metrics

Running `runDecisionSupportShadowModePrepEvaluation()` +
`summarizeDecisionSupportShadowModePrepEvaluation()` over the unmodified Sprint 18R corpus (79 cases):

| Metric | Value |
|---|---|
| `totalCases` / `evaluatedCases` | 79 / 79 |
| `shadowEligibleCount` | 69 |
| `decisionCandidateGeneratedCount` | 18 |
| `clarificationCandidateGeneratedCount` | 51 |
| `existingRoutePreservedCount` | 10 |
| `blockedBySafetyGateCount` | 0 |
| `notApplicableCount` | 0 |
| `acceptableShadowPrepRunRate` | 100% |
| `allBlockingGatesPassedRate` | 100% |
| `shouldReturnCandidateToUserCount` / `shouldPersistShadowResultCount` | 0 / 0 |
| `shouldExecuteActionCount` / `shouldSendEmailCount` / `shouldCreateTaskCount` / `shouldWriteToDbCount` | 0 / 0 / 0 / 0 |

`decisionCandidateGeneratedCount` (18) plus the low-confidence decision_support fallback cases
(45 − 18 = 27) plus the 24 `needs_clarification`-desired cases sum to `clarificationCandidateGeneratedCount`
(27 + 24 = 51) — matching Sprint 20R/21R's unchanged `shadowRoutableRate` of 40% (18/45).

## Results

- `representativeDecisionCandidates`: `dc-03`, `dc-06`, `dc-12`, `dc-25`, `dc-28`.
- `representativeClarificationCandidates`: `dc-01`, `dc-02`, `dc-04`, `dc-05`, `dc-07`.
- `weakShadowPrepRuns`: none — every one of the 79 corpus cases is an acceptable shadow prep run.
- `recommendedNextSprint`: **"Sprint 25R — Decision Support Shadow Capture Harness"**.

The separate `tests/fixtures/conversational-brain-decision-support-shadow-mode-prep-cases.ts` corpus
(28 hand-authored cases) additionally exercises: high/medium/low-confidence `decision_support`
branches, `needs_clarification` branches (via both `desiredFutureRoute` and a bare
`architectureCategory` prefix), existing-route preservation (including two "same input, different
metadata" pairs — `"redactame un correo"` and `"creá una tarea"` each appear once as an existing-route
case and once as a `not_applicable` case, proving the outcome depends on fixture metadata, not the raw
text), `not_applicable` cases, and all five forced safety-gate failures. Summarizing that fixture
corpus on its own reports `blockedBySafetyGateCount: 5` and
`recommendedNextSprint: "Sprint 25R — Shadow Mode Safety Hardening"` — expected, since it deliberately
includes unsafe-context cases the Sprint 18R corpus does not.

## Por qué no se cambió el adapter real

Este módulo llama directamente a `handleDecisionSupportCandidate()` (Sprint 19R) y
`handleClarificationResponseCandidate()` (Sprint 22R) sin pasar por `intentCompatibilityAdapter.ts` en
ningún punto — `desiredFutureRoute`/`architectureCategory`/`targetKind` son campos de entrada que el
caller provee (o el corpus del Sprint 18R ya trae), nunca calculados llamando al adapter real. El
único punto donde este módulo toca la evidencia del Sprint 23R es un cross-check informativo contra
`runDecisionSupportAdapterMappingPlan()` (que a su vez tampoco modifica el adapter — ver
`docs/conversational-brain-decision-support-adapter-mapping-plan.md`).

## Por qué no se conectó el router

Ninguna función de este módulo es importada por `router/brainRouter.ts`,
`composer/responseComposer.ts`, `handlers/*.ts`, `conversationalBrainGateway.ts`, ni por
`POST /api/command-center/chat` — verificado directamente por un test que lee el código fuente del
archivo y falla si aparece cualquiera de esos imports.

## Por qué no se activó feature flag

`DecisionSupportShadowModeContext.featureFlagEnabled` es un campo tipado que este módulo *nunca lee de
`process.env`, un archivo de config, ni un servicio de feature flags* — el único lugar donde se lee es
dentro de `computeGateResults()`, para decidir si el gate `default_off` pasa. Forzarlo a `true` no
activa nada: bloquea el run. Ningún archivo de configuración productiva fue creado, leído, ni
modificado.

## Criterio para pasar a Sprint 25R

Sprint 25R (**Decision Support Shadow Capture Harness**) puede proceder si: `acceptableShadowPrepRunRate`
y `allBlockingGatesPassedRate` se mantienen en 100% contra el corpus del Sprint 18R, todos los conteos
de side-effect (`shouldReturnCandidateToUser`/`shouldPersistShadowResult`/`shouldExecuteAction`/
`shouldSendEmail`/`shouldCreateTask`/`shouldWriteToDb`) se mantienen en 0, `existingRoutePreservedCount`
sigue en 10, y no se introduce ningún cambio real al router, adapter, composer, endpoint, o feature
flag — exactamente las mismas restricciones que gobernaron este sprint. Sprint 25R diseñaría el
esquema de persistencia/retención para un shadow output real; seguiría sin activar shadow mode en el
request path.

## Verification

Ran the following, all green, all prior-sprint metrics unchanged:

- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mode-prep.test.mjs` (new, 51 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs` (45 tests)
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
- Repo-wide `npx tsc --noEmit` (`npm run typecheck`) fails only on pre-existing, unrelated errors
  (`node_modules` is not fully installed — missing `react`/`@types/node`, same condition Sprint 23R
  documented). None of this sprint's four new/modified files appear in that error output.

Confirmed untouched: `POST /api/command-center/chat`, the router, the composer, every production
handler, every feature flag, the DB/Supabase/Gmail integrations, `intentClassifier.rules.ts`,
`intentCompatibilityAdapter.ts`, and `intent-patterns.ts`.
`src/lib/playbook-engine/conversation/decision-support/index.ts` was updated to export the new module
(an isolated barrel, not re-exported from `src/lib/playbook-engine/conversation/index.ts` — the
production barrel is unmodified).

## Sprint 25R update

Sprint 25R built `decisionSupportShadowCaptureHarness.ts`, an offline/test-only capture harness that
turns a `DecisionSupportShadowModeRun` from this module into a minimized, redacted capture record —
still never persisted for real, still never shown to a user, still never executed. This file's own
51-test suite still passes unchanged: `acceptableShadowPrepRunRate`/`allBlockingGatesPassedRate` stay
at 100%, `existingRoutePreservedCount` stays at 10, and `recommendedNextSprint` still reads "Sprint
25R — Decision Support Shadow Capture Harness". Sprint 25R did not modify
`decisionSupportShadowModePrep.ts` or `decisionSupportShadowModePrepTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md` for the full capture contract.

## Sprint 26R note

Sprint 26R's storage policy reuses this module only transitively, through the Sprint 25R capture
harness — it does not import `decisionSupportShadowModePrep.ts` directly. This document's own 51-test
suite still passes unchanged: `shadowEligibleCount` 69, `decisionCandidateGeneratedCount` 18,
`clarificationCandidateGeneratedCount` 51, `existingRoutePreservedCount` 10,
`blockedBySafetyGateCount` 0. Sprint 26R did not modify `decisionSupportShadowModePrep.ts` or
`decisionSupportShadowModePrepTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan reuses this module only transitively, through the Sprint 25R
capture harness and Sprint 26R storage policy — it does not import `decisionSupportShadowModePrep.ts`
directly. This document's own 51-test suite still passes unchanged: `shadowEligibleCount` 69,
`decisionCandidateGeneratedCount` 18, `clarificationCandidateGeneratedCount` 51,
`existingRoutePreservedCount` 10, `blockedBySafetyGateCount` 0. Sprint 27R did not modify
`decisionSupportShadowModePrep.ts` or `decisionSupportShadowModePrepTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter imports `prepareDecisionSupportShadowModeRun()` directly (to build
one real base draft its synthetic invalid/expired-purge fixtures clone from), the same reuse pattern
Sprint 25R itself uses. This document's own 51-test suite still passes unchanged:
`shadowEligibleCount` 69, `decisionCandidateGeneratedCount` 18,
`clarificationCandidateGeneratedCount` 51, `existingRoutePreservedCount` 10,
`blockedBySafetyGateCount` 0. Sprint 28R did not modify `decisionSupportShadowModePrep.ts` or
`decisionSupportShadowModePrepTypes.ts`. See
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

