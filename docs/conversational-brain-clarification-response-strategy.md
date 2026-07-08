# Clarification Response Strategy (Sprint 22R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R), and
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R). This file is the
> standalone design/results document for the clarification response strategy produced by Sprint 22R.

## Executive summary

Sprint 21R calibrated the enriched classifier's `decision_support` boundary and left
`needs_clarification` as the largest remaining gap bucket (`recommendedNextSprint`: "Sprint 22R —
Clarification Response Strategy"). Sprint 18R had already found that ambiguity *detection* was
mostly solved (`clarification_clear`/`clarification_vs_general_pm` both near 90-100%
`currentSafeMappingRate`) but that the system had no real way to *respond* to it beyond a canned
`general_pm_advice` answer or a bare `unsupported` fallback — never an actual clarifying question.

Sprint 22R builds that missing response capability as an isolated, pure, tested module:
`src/lib/playbook-engine/conversation/clarification/`. Given an ambiguous message ("ayuda", "revisá
esto", "dale seguimiento", "esto está bloqueado"), it deterministically classifies the message into
one of eleven clarification strategy types, infers which of eleven possible slots (project, intent,
source context, desired output, owner, recipient, evidence, decision options, urgency, timeframe,
action authorization) are missing, suggests plausible production-shaped routes, and renders a
structured clarifying response — all with zero LLM calls, zero network access, and zero database
access.

Running the new offline evaluator against the Sprint 18R (`clarification_*`, 24 cases) and Sprint
17R (`ambiguous_clarification_candidate`, 10 cases) corpora gives:

| Metric | Value |
|---|---|
| `totalCases` (full corpora, both sources) | 149 |
| `evaluatedClarificationCases` | 34 |
| `strategyCoverageRate` | **100%** |
| `acceptableResponseRate` | **100%** |
| `safetyPassRate` | **100%** |
| `routeOptionsCoverageRate` | **100%** |
| `overQuestioningCount` | **0** |
| `missingProjectQuestionCount` / `missingIntentQuestionCount` / `missingSourceContextQuestionCount` | 0 / 0 / 0 |
| `recommendedNextSprint` | **"Sprint 23R — Decision Support Adapter Mapping Plan"** |

None of this touches production: the router/composer/handlers/endpoint are untouched, no feature
flag was activated, the production classifier and adapter mapping table are unmodified, and no
persistent, multi-turn clarification loop was implemented — every call is a single, stateless turn.

## What problem this solves

Before this sprint, an ambiguous message like "qué hacemos" or "dale seguimiento" had exactly two
possible outcomes: a confident-but-generic `general_pm_advice` answer (the Sprint 10R documented
`needs_clarification -> general_pm_advice` fallback), or — worse, for a handful of confirmed cases
(`dc-62` "esto no avanza", `dc-65` "esto está bloqueado") — a *wrong*, confident answer from a
different production intent entirely (`project_status_question`). Neither outcome asks the user what
they actually meant. This sprint gives the system a third, safer option: acknowledge the message,
name the one or two things genuinely missing, offer a short menu of plausible next routes, and wait
for a reply — without inventing context, giving overly generic advice, or executing anything.

## What this does NOT solve yet

- **Does not implement a persistent, multi-turn clarification loop.** Every call to
  `handleClarificationResponseCandidate()` is a single, stateless turn — it does not remember the
  previous question it asked, does not store conversational state between calls, and does not
  automatically re-route once the user replies. `ClarificationAvailableContext.previousIntent` /
  `previousRoute` / `previousClarificationQuestion` are present in the type as forward-looking hooks
  a *future* loop could populate, but nothing in this sprint populates or reads them from real
  conversation state.
- **Does not connect to the router, composer, or endpoint.** `POST /api/command-center/chat` is
  unaffected; there is no reachable path from a real user request to this module.
- **Does not change the production classifier or the adapter mapping.** `decision_support` still maps
  to `"unsupported"` and `needs_clarification` still maps to `"general_pm_advice"`, exactly as
  documented since Sprint 10R.
- **Does not calibrate `general_pm_advice` vocabulary.** Out of this sprint's scope, per the project's
  own explicit restriction.
- **Does not resolve every phrase perfectly.** The analyzer is ordered keyword/connector matching, not
  full NLP — a phrase using different wording than the documented signal list falls through to the
  `generic_ambiguous` fallback rather than a more specific category. This is a known, documented
  limitation (see "Limitations" below), not silently hidden.

## Baseline (Sprint 21R)

| Metric | Sprint 21R baseline |
|---|---|
| Golden corpus `compatibilityRate` | 72.5% |
| Sprint 17R `policyAlignedRate` | 82.9% |
| Sprint 17R `currentSystemAcceptableRate` | 84.3% |
| Sprint 18R `currentSafeMappingRate` / `futureRouteAlreadySupportedRate` | 84.8% / 84.8% |
| Sprint 18R `requiresNewHandlerCount` / `requiresClarificationCount` | 45 / 24 |
| Sprint 19R fixture count | 50 |
| Sprint 20R/21R `decisionSupportDesiredCount` | 45 |
| Sprint 20R/21R `candidateHandlerSafeRate` | 100% |
| Sprint 20R/21R `shadowRoutableRate` | 40% |
| Sprint 21R `unsafeClassifierCollisionCount` | 5 (playbook 0 / general_pm 1 / risk 2 / closure 1 / governance 0) |
| Sprint 21R `enrichedDecisionSupportDetectionRate` | 88.9% |
| Sprint 21R `recommendedIntegrationMode` | `do_not_integrate` |
| Sprint 21R `recommendedNextSprint` | "Sprint 22R — Clarification Response Strategy" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification"
below).

## Definition of `needs_clarification`

Unchanged from Sprint 18R's policy (`docs/conversational-brain-decision-support-clarification-architecture.md`):
messages too ambiguous to route safely — no named topic, project, or object — where none of the
eight operational categories has enough signal to act on. This sprint does not redefine that
boundary; it builds the *response* for messages already in (or candidates for) that bucket.

## Clarification strategy types

Eleven `ClarificationStrategyType` values, detected via ordered keyword/connector rules (most
domain-specific first, falling back to `generic_ambiguous`):

| Type | Example | What distinguishes it |
|---|---|---|
| A `generic_ambiguous` | "ayuda", "qué hacemos", "qué opinas" | No domain signal at all — the true bare-ambiguity fallback. |
| B `review_without_context` | "revisá esto", "dale una revisada" | A review/inspect verb with a vague pronoun object. |
| C `follow_up_ambiguous` | "dale seguimiento", "hay que mover esto" | A follow-up/momentum verb with a vague pronoun object. |
| D `concern_without_domain` | "me preocupa esto", "esto está raro" | A stated concern with no named domain. |
| E `stalled_progress_ambiguous` | "esto no avanza", "nadie responde" | Stalled/blocked-progress phrasing with no named domain. |
| F `communication_hint_ambiguous` | "habría que decirle algo", "hay que avisarle" | An implied communication with no recipient/content. |
| G `task_hint_ambiguous` | "alguien tiene que ver esto", "eso está pendiente" | An implied task/action with no owner/description. |
| H `risk_hint_ambiguous` | "esto puede ser un problema", "podría complicarse" | An implied risk with no named domain. |
| I `status_hint_ambiguous` | "cómo va esto", "en qué va esto" | An implied status check with no named project. |
| J `decision_hint_ambiguous` | "hay que decidir algo", "tenemos que decidir" | An implied pending decision with no named options. |
| K `context_missing_for_known_route` | "redactame eso", "facturamos eso" | A known domain verb (redactar/crear-tarea/facturar/cerrar/escalar) with a vague pronoun object — the route is known, only the content is missing. |

One deliberate ordering decision: `concern_without_domain` (D) is checked before
`status_hint_ambiguous` (I), because "no me gusta cómo va esto" contains the bare substring "cómo va
esto" that would otherwise fire I's pattern first. This is documented inline in
`clarificationResponseAnalyzer.ts`'s `CLARIFICATION_TYPE_RULES` ordering comment, and covered by
fixture case `ccd-06`.

## Missing slots

Eleven `ClarificationMissingSlot` values. `project` and `source_context` are inferred dynamically
from the caller-supplied `ClarificationAvailableContext` and whether the input references a vague
pronoun object (`esto`/`eso`/`esta`/`ese`/`esa`); the rest (`intent`, `desired_output`, `urgency`,
`owner`, `recipient`, `decision_options`, `evidence`, `action_authorization`, `timeframe`) are
inferred per `strategyType` from a fixed, documented table in `inferMissingSlots()`. No slot is ever
guessed from an external source — only from the input text and whatever context the caller already
has.

## Route options

Each `strategyType` maps to a fixed, priority-ordered list of plausible production-shaped
`ClarificationRouteOptionIntent` values (e.g. `generic_ambiguous` suggests
`project_status_question`/`risk_analysis`/`decision_support`/`communication_draft`/
`task_or_action_request`/`closure_question`), except `context_missing_for_known_route`, which
special-cases on the specific matched domain-verb signal instead of a fixed list, since that
category's whole premise is "the domain is already known, only the content is missing."

## Response format

```
Te ayudo. Para ubicarlo bien, necesito una pista rápida:

[primary question]

Podés responder con una de estas rutas:
1. [route label] — [route description]
2. ...

También ayuda si me decís:
- [secondary question 1]
- ...

También podés pegar el correo, nota o contexto que querés que revise.

Nota: no ejecuté ninguna acción, no creé ninguna tarea, no envié ningún correo y no escribí nada en
la base de datos — solo estoy pidiendo aclaración para rutearlo bien. Quedo a la espera de tu
respuesta.
```

`formatClarificationResponseCandidate()` renders this independent of the production Response
Composer — it is not a template registered anywhere reachable from a real request.

## Safety guarantees

Every result's `safety` field is the same fixed object:

```ts
{
  shouldExecuteAction: false,
  shouldCreateTask: false,
  shouldSendEmail: false,
  shouldWriteToDb: false,
  requiresUserReply: true,
  productionRoutingEnabled: false,
  maxQuestionsRecommended: 3,
}
```

Additionally: the analyzer, strategy, and evaluator never call `fetch`, a database, Supabase, Gmail,
or an LLM; none of the four modules import the router, composer, any production handler, or the
gateway; every analyzer function is a pure function of its arguments; and
`formatClarificationResponseCandidate()` always states explicitly that nothing was executed, no task
was created, and no email was sent.

## Human reply policy

`safety.requiresUserReply` is always `true` — there is no code path that produces `false`. The
strategy never guesses a route on the user's behalf; it always returns a primary question plus up to
three secondary questions (never more, per `maxQuestionsRecommended: 3`) and waits for the next turn.
`ClarificationAvailableContext` carries `previousIntent`/`previousRoute`/`previousClarificationQuestion`
as forward-looking fields a future stateful loop could use to route the *next* turn correctly once
the user replies — but populating and consuming those fields across turns is explicitly out of this
sprint's scope.

## Evaluation metrics

`clarificationResponseEvaluation.ts` reuses the Sprint 18R architecture corpus's `clarification_*`
cases and the Sprint 17R boundary corpus's `ambiguous_clarification_candidate` cases (via
`toDecisionClarificationEvaluationCases()`/`toGeneralPmBoundaryEvaluationCases()`), plus this sprint's
own 67-case fixture as a `custom_fixture` source. `expectedClarification` is computed per source
corpus (see `explainClarificationResponseEvaluation()`); `isAcceptableClarificationResponse` requires
non-empty `responseText`, a non-empty primary question, at least one route option, every safety check
passing, no phrase affirming an executed action, and no more than three secondary questions.
`strategyCoverageRate`/`routeOptionsCoverageRate` measure whether the strategy actually produced
useful route options (not an empty list); `safetyPassRate` is checked over every case regardless of
whether clarification was expected, since safety must hold universally.

## Results obtained

| Metric | Value |
|---|---|
| `evaluatedClarificationCases` | 34 (24 Sprint 18R `clarification_*` + 10 Sprint 17R `ambiguous_clarification_candidate`) |
| `strategyCoverageRate` | 100% |
| `acceptableResponseRate` | 100% |
| `safetyPassRate` | 100% |
| `routeOptionsCoverageRate` | 100% |
| `overQuestioningCount` | 0 |
| `byAmbiguityLevel` | low 21, medium 8, high 5 |
| `byMissingSlot` (top) | project 34, desired_output 31, intent 26, source_context 11, urgency 8 |
| `byStrategyType` (top) | generic_ambiguous 18, concern_without_domain 5, follow_up_ambiguous 3, stalled_progress_ambiguous 3 |
| `topClarificationResponses` (sample) | dc-46, dc-47, dc-48, dc-49, dc-50 |
| `weakClarificationResponses` | none — every evaluated case passed |
| `recommendedNextSprint` | **"Sprint 23R — Decision Support Adapter Mapping Plan"** |

`recommendedNextSprint` reads as "Decision Support Adapter Mapping Plan" rather than a clarification
hardening sprint precisely because both quality gates (`acceptableResponseRate >= 85%`,
`safetyPassRate === 100%`) already pass on the first run against real corpora — the remaining gap
this evaluator's own heuristic sees is the still-pending `decision_support -> unsupported` adapter
mapping (Sprint 21R's `recommendedIntegrationMode: do_not_integrate`), not a clarification defect.

The 67-case fixture corpus (`tests/fixtures/conversational-brain-clarification-response-cases.ts`)
covers all eleven strategy types with 5-8 cases each; every `expected*` field in it was captured by
running the actual implementation at authoring time (the same discipline as the golden intent
corpus, Sprint 11R) — not guessed — so it is a regression baseline as much as a coverage corpus.

## Examples of response

Input: `"qué hacemos"`

```
Te ayudo. Para ubicarlo bien, necesito una pista rápida:

¿De qué proyecto o contexto estamos hablando?

Podés responder con una de estas rutas:
1. Estado / avance del proyecto — Revisar el estado, avance o salud general del proyecto.
2. Riesgos, issues o bloqueos — Identificar riesgos, issues o dependencias que puedan estar bloqueando el avance.
3. Decisión entre alternativas — Ayudarte a decidir entre dos o más caminos posibles.
4. Comunicación / correo / minuta — Redactar un correo, minuta o seguimiento para un stakeholder o cliente.
5. Tarea o seguimiento — Crear, asignar o dar seguimiento a una tarea o acción concreta.
6. Cierre del proyecto — Revisar qué falta para cerrar formalmente el proyecto.

También ayuda si me decís:
- ¿Querés que revise estado, riesgos, decisión, comunicación, tareas o cierre/facturación?
- ¿Querés que lo convierta en correo, tarea, análisis de riesgo o recomendación?

También podés pegar el correo, nota o contexto que querés que revise.

Nota: no ejecuté ninguna acción, no creé ninguna tarea, no envié ningún correo y no escribí nada en
la base de datos — solo estoy pidiendo aclaración para rutearlo bien. Quedo a la espera de tu
respuesta.
```

Input: `"redactame eso"` (with `availableContext.knownProjectName` supplied)

```
Te ayudo. Para ubicarlo bien, necesito una pista rápida:

¿Qué contexto específico querés que revise?

Podés responder con una de estas rutas:
1. Comunicación / correo / minuta — Redactar un correo, minuta o seguimiento para un stakeholder o cliente.

También podés pegar el correo, nota o contexto que querés que revise.

Nota: no ejecuté ninguna acción, no creé ninguna tarea, no envié ningún correo y no escribí nada en
la base de datos — solo estoy pidiendo aclaración para rutearlo bien. Quedo a la espera de tu
respuesta.
```

## Why this does not connect to the router

Per this sprint's explicit constraints, and because a clarification *response* is only half of a
real clarification *loop* — this module has no way to remember which question it just asked or to
route the user's next reply once they answer it. Wiring it into the router today would produce a
one-shot question with no mechanism to act on the answer, which is arguably worse than today's
canned `general_pm_advice` fallback (at least that one doesn't imply follow-up is coming).
`recommendedIntegrationMode`-style gating (as used by the Sprint 20R/21R shadow mapping evaluator)
was deliberately not built for this module yet — the missing piece isn't classifier boundary
calibration, it's the stateful loop itself.

## Why this does not implement a persistent clarification loop yet

Building a real loop requires deciding how conversational state is stored and threaded across turns
(session storage, a `DecisionDraft`-style reuse pattern, or something new), which of the existing
route handlers gets called once the user replies, and how a reply like "la 3" or "riesgos" maps back
onto a `ClarificationRouteOptionIntent`. None of that is a response-strategy design question — it is
a Context Resolver/Router integration question, explicitly out of this sprint's allowed scope (no new
Context Resolver, Router, or Composer). This sprint deliberately stops at "ask a good question," not
"remember the answer."

## Recommendation

Per this evaluator's own (unmodified) heuristic, the next sprint should be **Sprint 23R — Decision
Support Adapter Mapping Plan**: with clarification response quality and safety both already solid on
their first real run, the largest remaining architectural gap this series has open is that
`decision_support` still has no real production route (Sprint 21R's `recommendedIntegrationMode:
do_not_integrate`, driven by `shadowRoutableRate` at 40%). A future sprint should scope how — and
whether — to wire a feature-flagged, default-off `decision_support` route, informed by the Sprint
19R/20R/21R candidate handler work, before returning to build a real persistent clarification loop on
top of this sprint's response strategy.

## Sprint 23R follow-up — Decision Support Adapter Mapping Plan

Sprint 23R built exactly that adapter mapping plan — see
`docs/conversational-brain-decision-support-adapter-mapping-plan.md` — calling
`handleClarificationResponseCandidate()` from this strategy unmodified as one of its eight simulated
strategies' building blocks (`clarify_before_decision_support` and `hybrid_shadow_then_clarify`). It
did not touch `clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts` — this document's own
77-test suite continues to pass, and `acceptableResponseRate`/`safetyPassRate`/
`routeOptionsCoverageRate` all remain 100%. The new plan's recommended strategy,
`hybrid_shadow_then_clarify`, uses this strategy for every `needs_clarification`-desired case and every
low-confidence `decision_support` case, with `recommendedNextSprint`: **"Sprint 24R — Decision Support
Shadow Mode Prep"**.

## Sprint 24R update

Sprint 24R's shadow mode prep contract (`decisionSupportShadowModePrep.ts`) calls
`handleClarificationResponseCandidate()` exactly as-is — for every `needs_clarification`-desired input,
and as the fallback whenever a `decision_support`-desired input's candidate result is low-confidence or
fails a safety check — and requires it to pass the same safety/acceptability checks documented here
before a run is considered "acceptable." This file's own 77-test suite still passes unchanged; this
sprint did not modify `clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts`. See
`docs/conversational-brain-decision-support-shadow-mode-prep.md` for the full contract.

## Sprint 25R update

Sprint 25R's shadow capture harness summarizes a clarification candidate produced by this strategy
into structural fields only (`clarificationStrategyType`, `clarificationAmbiguityLevel`,
`clarificationMissingSlots`, `clarificationRouteOptionIntents`, `clarificationQuestionCount`) — never
the full `responseText` or question text — and requires it to pass this file's own safety check
before a capture is considered acceptable. This file's own 77-test suite still passes unchanged; this
sprint did not modify `clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts`. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md`.

## Sprint 26R note

Sprint 26R's storage policy classifies `responseText`-named fields (and any field name containing
`responseText`) as permanently prohibited — consistent with this strategy never retaining full
response text. This file's own 77-test suite still passes unchanged: `acceptableResponseRate`
100%, `safetyPassRate` 100%, `routeOptionsCoverageRate` 100%, `overQuestioningCount` 0. Sprint 26R did
not modify `clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan's draft mapper never includes `responseText`/`recommendationText`
in a mapped `candidateSummary` — consistent with this strategy never producing full response text in
the first place. This file's own 77-test suite still passes unchanged: `acceptableResponseRate` 100%,
`safetyPassRate` 100%, `routeOptionsCoverageRate` 100%, `overQuestioningCount` 0. Sprint 27R did not
modify `clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter rejects (`rejected_by_validation`) any draft carrying a
`responseText` field — one of the 11 synthetic invalid drafts every evaluation run writes and expects
rejected — consistent with this strategy never producing full response text in the first place. This
file's own 77-test suite still passes unchanged: `acceptableResponseRate` 100%, `safetyPassRate`
100%, `routeOptionsCoverageRate` 100%, `overQuestioningCount` 0. Sprint 28R did not modify
`clarificationResponseStrategy.ts`, `clarificationResponseAnalyzer.ts`,
`clarificationResponseTypes.ts`, or `clarificationResponseEvaluation.ts`. See
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
