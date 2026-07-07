# Decision Support + Clarification Architecture Review (Sprint 18R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§18R),
> `docs/conversational-brain-golden-intent-evaluation.md`, and
> `docs/conversational-brain-general-pm-advice-boundary.md`. This file is the standalone
> architecture document produced by Sprint 18R.

## Executive summary

Sprint 17R's boundary review proved that `general_pm_advice` should not absorb two of its nine
competing boundaries — `decision_support` and `ambiguous_or_unknown`/`needs_clarification` — because
neither has a production home yet: `decision_support` has no `ConversationIntent`, route, or handler,
and `needs_clarification` has no real clarification loop (it currently resolves straight through to
`general_pm_advisor`). Calibrating `general_pm_advice` vocabulary before defining these two
boundaries would either leave them unaddressed or risk baking `general_pm_advice` in as a silent
default for decision- and clarification-shaped messages.

`decision_support` and `needs_clarification` are two **distinct architectural gaps**, not one. Each
needs its own policy, its own corpus, and its own evaluator, because they fail in different ways:
`decision_support` messages get pattern-matched into the wrong *specific* category (playbook,
general advice, risk, closure, governance) far more often than they get correctly detected; ambiguous
messages mostly do fall through to a safe, neutral fallback already, but that fallback is a canned
answer, not a real clarifying question.

This sprint does not build a handler, does not implement a clarification loop, and does not touch
production. It produces three artifacts instead:

1. An explicit **policy** for what `decision_support` and `needs_clarification` are, what they are
   not, and a full precedence order across all ten categories (this document).
2. A **dedicated corpus** of 79 realistic PMFreak PM phrases
   (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`), each labeled with its
   intended future route, its current safe mapping, and whether it requires a new handler or a
   clarification strategy.
3. A pure **architecture evaluator**
   (`src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts`)
   that measures how today's production classifier, enriched classifier, and Sprint 10R adapter
   mapping behave against that policy.

Running the evaluator over the corpus today gives:

| Metric | Value |
|---|---|
| `totalCases` | 79 |
| `currentSafeMappingRate` | **64.6%** (51/79) |
| `futureRouteAlreadySupportedRate` | **49.4%** (39/79) |
| `requiresNewHandlerCount` | 45 (all `decision_support_*` cases) |
| `requiresClarificationCount` | 24 (all `clarification_*` cases) |
| `shouldExecuteActionCount` | 0 |
| `unsafeMappings` | 28/79 (35.4%) |
| `existingRouteRegressions` | 0/10 |
| `recommendedImplementationOrder` | Decision Support Candidate Handler → Clarification Response Strategy → General PM Advice Calibration → Controlled Shadow Capture Prep |
| `recommendedNextSprint` | **"Sprint 19R — Decision Support Candidate Handler"** |

The golden corpus's own `compatibilityRate` (72.5%) and its per-category results, and the Sprint 17R
boundary review's own metrics (`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%,
`architectureGapCount` 10, `clarificationGapCount` 10), are all unchanged by this sprint — see the
"Regression awareness" section of `docs/conversational-brain-golden-intent-evaluation.md`.

## Problem statement

`decision_support` and `needs_clarification` are the two remaining categories with no production
home. Building either without first knowing where each collides with the other eight risks the same
mistake this sprint's predecessor avoided: silently swallowing another category's territory, or
silently being swallowed by one. This sprint measures both directions for both gaps before Sprint 19R
commits to building anything.

## Definition of `decision_support`

`decision_support` is for messages asking the assistant to help **resolve a pending decision** —
choosing between options, evaluating alternatives, comparing paths, unblocking a decision, naming who
should decide or what decision is missing, explaining tradeoffs, or deciding whether to
escalate/wait/close/ask for more evidence/change approach.

Examples:

- "qué opción debería escoger"
- "cuál alternativa conviene"
- "deberíamos hacer A o B"
- "quién debería decidir esto"
- "qué decisión falta"
- "qué decisión está bloqueando el avance"
- "qué camino recomiendas tomar"
- "cuál opción es menos riesgosa"
- "conviene escalar o esperar"
- "deberíamos cerrar ya o pedir más evidencia"
- "deberíamos aceptar este riesgo o mitigarlo"
- "conviene facturar ya o esperar recepción formal"
- "deberíamos cambiar de proveedor o presionar al actual"
- "qué decisión debo llevar al comité"
- "qué alternativa defiendo ante el cliente"

## What is NOT `decision_support`

`decision_support` does not win when there is a clearer operational signal:

1. **`playbook_analysis` wins** if the message asks for the playbook's own recommendation or
   governed next action ("qué recomienda el playbook", "cuál es la siguiente mejor acción", "analizá
   esto según el playbook") — the request is for what PMFreak's governance already says, not to
   resolve a choice.
2. **`project_status` wins** if the message asks about status, progress, or health ("cómo va el
   proyecto", "qué avance tenemos", "estamos atrasados").
3. **`risk_issue_dependency` wins** if the message asks about risks/issues/dependencies without
   framing a choice between them ("qué riesgos hay", "qué issues tenemos abiertos", "qué dependencias
   nos bloquean").
4. **`closure_billing` wins** if the message asks about closure/billing readiness without a decision
   frame ("qué falta para facturar", "estamos listos para cobrar", "ya puedo cerrar el proyecto").
5. **`communication_draft` wins** if the message asks to draft something ("redactame un correo
   defendiendo esta decisión", "ayudame a explicar la alternativa al cliente").
6. **`task_action` wins** if the message asks to create/assign/close a task or action ("creá una
   tarea para evaluar opciones", "asignale esta decisión a Arturo").
7. **`governance_audit` wins** if the message asks for the evidence/rule behind a decision already
   made ("qué evidencia usaste para recomendar esto", "por qué recomendaste esta opción").

## Definition of `needs_clarification`

`needs_clarification` is for messages too ambiguous to route safely — no named topic, project, or
object — where none of the eight operational categories has enough signal to act on.

Examples:

- "ayuda"
- "revisá esto"
- "qué hacemos"
- "me preocupa esto"
- "dale seguimiento"
- "esto está raro"
- "no sé qué hacer"
- "cómo seguimos"
- "qué opinas"
- "ves algo raro"
- "estoy trabado"
- "no me gusta cómo va esto"
- "esto no avanza"
- "estoy perdido"

## What is NOT `needs_clarification`

`needs_clarification` does not win when there is a clear signal:

- "qué riesgos hay" → `risk_issue_dependency`
- "redactame un correo" → `communication_draft`
- "qué falta para facturar" → `closure_billing`
- "creá una tarea" → `task_action`
- "mostrame el audit trail" → `governance_audit`
- "qué recomienda el playbook" → `playbook_analysis`
- "cómo va el proyecto" → `project_status`

## Desired response for `needs_clarification` (not implemented)

> Te ayudo. Para ubicarlo bien, necesito una de estas pistas:
> 1. ¿Querés revisar estado, riesgos, facturación, comunicación, tareas o una decisión?
> 2. ¿De qué proyecto estamos hablando?
> 3. ¿Hay un correo, documento o contexto específico que deba usar?

This is the target response *shape* for a future clarification loop. No code in this sprint produces
this text — it does not exist anywhere in the codebase yet.

## Architecture recommended

- Introduce `decision_support` as an intent/family in the enriched classifier the same way it exists
  today (already does — `@/lib/conversational-brain`'s `ConversationIntentFamily` already has
  `decision_support`). Production has no equivalent yet.
- Keep the Sprint 10R safe temporary mapping (`decision_support -> unsupported`,
  `needs_clarification -> general_pm_advice`) until a real handler/strategy exists — this sprint
  measures how often that mapping actually holds live (`isCurrentSafeMapping`, 64.6% overall) rather
  than assuming it always does.
- Build a **Decision Support Candidate Handler** in a future PR that:
  - never executes an action — read-only analysis only;
  - reuses the `DecisionDraft` data that already exists in `operational-intelligence-engine.ts`
    (Sprint 5), rather than inventing a new data source;
  - compares named options, identifies tradeoffs, and recommends a next step;
  - can ask for missing evidence/context instead of guessing when data is incomplete;
  - always requires human approval before anything it discusses is acted on.
- Introduce **`needs_clarification` as a routing result or response strategy** (not a domain
  handler) that:
  - never executes a domain handler;
  - returns a clarifying question, not a canned `general_pm_advice` answer;
  - preserves conversational context so the next turn can route correctly once clarified;
  - lets the user pick a category, a project, or supply missing context (see the response shape
    above).

## Precedence rules

1. `communication_draft` if there is an explicit drafting/responding/communicating verb.
2. `task_action` if there is create/assign/convert/mark/close a task or action.
3. `closure_billing` if there is billing/closure/reception readiness framing.
4. `governance_audit` if there is evidence/rule/audit-trail/justification framing.
5. `risk_issue_dependency` if there are explicit risks/issues/dependencies/blockers.
6. `project_status` if there is status/progress/health framing.
7. `playbook_analysis` if it asks for the playbook/PMFreak's own recommendation.
8. `decision_support` if it asks to choose/evaluate options/unblock a decision.
9. `needs_clarification` if none of the above has enough signal.
10. `general_pm_advice` as the general PM-advice fallback when no operational intent is more
    specific.

## Non-goals

This sprint does not:

- Create a `decision_support` production handler.
- Implement a real clarification loop.
- Activate new routes, change the router, composer, any handler, or the endpoint.
- Activate a feature flag, or the enriched classifier in production.
- Read/write a database, call Supabase, send email, create tasks, or execute any action.
- Calibrate `general_pm_advice` vocabulary.
- Create a new Context Resolver, Router, or Composer.
- Delete code.

## Corpus

`tests/fixtures/conversational-brain-decision-clarification-cases.ts` — 79 cases across 13
`architectureCategory` values (minimums from the sprint spec in parentheses):

| `architectureCategory` | Cases | `currentSafeMappingRate` | `futureRouteAlreadySupportedRate` |
|---|---|---|---|
| `decision_support_clear` (≥12) | 12 | 91.7% | 33.3% |
| `decision_support_vs_playbook` (≥8) | 8 | 75% | 62.5% |
| `decision_support_vs_general_pm` (≥8) | 8 | 37.5% | 25% |
| `decision_support_vs_risk` (≥6) | 6 | 16.7% | 0% |
| `decision_support_vs_closure` (≥6) | 6 | 16.7% | 0% |
| `decision_support_vs_governance` (≥5) | 5 | 40% | 20% |
| `clarification_clear` (≥10) | 10 | 90% | 90% |
| `clarification_vs_general_pm` (≥6) | 6 | 100% | 100% |
| `clarification_vs_status` | 2 | 50% | 50% |
| `clarification_vs_risk` | 2 | 0% | 0% |
| `clarification_vs_task` | 2 | 0% | 0% |
| `clarification_vs_communication` | 2 | 50% | 50% |
| `existing_route_should_win` (≥10) | 10 | 100% | 100% |

## Architecture gaps (`decision_support`, 45 cases)

- **`currentSafeMappingRate` is far from 100% (24/45 = 53.3% within the `decision_support` slice)** —
  the documented "safe" mapping (`decision_support -> unsupported`) only holds when the enriched
  classifier itself correctly detects `decision_support`. When it misdetects the message as another
  family instead (which happens on roughly half of these cases), the adapter confidently produces a
  *different, specific, often-wrong* production intent instead of the neutral `unsupported` fallback.
  This is a materially worse failure mode than a plain miss.
- **`decision_support_vs_playbook` is the sharpest live collision**: 7/8 cases resolve to
  `recommendation_request` today (both classifiers), because production's bare `playbook` pattern
  (Sprint 12R) and the enriched classifier's `playbook_analysis` patterns both fire on any message
  that names "el playbook"/"PMFreak", even when the actual ask is to choose between named options.
  `dc-79` ("qué recomienda el playbook", `existing_route_should_win`) is the deliberate control case
  showing this is not simply "the word playbook always wins" — it is a real boundary that a future
  handler needs to adjudicate using more than a bare keyword match.
- **`decision_support_vs_general_pm` is the second-sharpest collision** (5/8 unsafe): `qué harías en
  mi lugar` and `qué hago si el cliente no responde, escalo o espero` both resolve to
  `general_pm_advice` on both classifiers today — the same collision Sprint 17R's own boundary corpus
  flagged (`gpa-02`), now confirmed with decision-shaped phrasing specifically.
- **`decision_support_vs_risk` and `decision_support_vs_closure` are the two worst slices**
  (`currentSafeMappingRate` 16.7% each) — risk vocabulary ("riesgo") and closure/billing/governance
  vocabulary ("evidencia", "facturar", "cerrar", "recepción") both dominate decision-framing language
  on nearly every case. `dc-36` ("deberíamos cerrar ya o pedir más evidencia") reproduces the exact
  `governance_audit`/`decision_support` overlap documented since Sprint 11R's golden case `ga-09`.
- **`decision_support_clear`'s `futureRouteAlreadySupportedRate` of only 33.3%** shows the enriched
  classifier itself — the best available signal, since production has no equivalent at all — misses
  two-thirds of even the "clean", non-colliding decision_support phrasing. This is a real vocabulary
  gap in the enriched classifier's own `decision_support` pattern list, independent of the missing
  production handler.

**Conclusion: `decision_support` needs both (a) a production handler and (b) enriched-classifier
vocabulary work before it can be calibrated like the other eight categories — and the handler must be
built with explicit tie-break rules against `playbook_analysis`, `general_pm_advice`,
`risk_issue_dependency`, `closure_billing`, and `governance_audit`, not just a bare intent mapping.**

## Clarification gaps (`needs_clarification`, 24 cases)

- **`clarification_clear`'s `currentSafeMappingRate`/`futureRouteAlreadySupportedRate` are both 90%**
  — production's own `clarification` intent and the enriched classifier's `needs_clarification`
  family already catch 9/10 of the cleanest ambiguous phrasing. `dc-52` ("no sé qué hacer") is the one
  miss, matching the identical finding in Sprint 17R's boundary corpus for the same phrase.
- **`clarification_vs_general_pm` is at 100% on both metrics** — every case in this slice safely maps
  to `general_pm_advice` today (the documented Sprint 10R fallback), even though production's own
  literal intent for some of them (`qué hago`, `qué harías`) is genuinely `clarification` rather than
  a `general_pm_advice` pattern match. The safe mapping holds; a real clarification loop would still
  improve the *response quality*, not the routing safety.
- **`clarification_vs_status` is the one confirmed live regression risk**: `dc-62` ("esto no avanza")
  and `dc-65` ("esto está bloqueado") both confidently resolve to `project_status_question` today
  (production's Sprint 12R/14R "no avanza"/"bloqueado" patterns), rather than falling through to a
  safe clarification fallback. This is the sharpest evidence that a clarification strategy has real
  value beyond the already-working `clarification`/`needs_clarification` detection: today's system
  gives a confident status answer to a message that was never clearly about status.
- **`clarification_vs_risk`, `clarification_vs_task`, `clarification_vs_communication`** (0-50%
  `currentSafeMappingRate`) mostly fail by falling to `unsupported`/`unknown` rather than the
  documented `general_pm_advice` fallback — a milder gap (still a neutral non-answer) but still not
  the target clarification-loop behavior.

**Conclusion: `needs_clarification`'s detection is mostly already solved (`clarification_clear` and
`clarification_vs_general_pm` both at or near 90-100%); the real gap is that detecting ambiguity today
still ends in either a canned `general_pm_advice` answer or a bare `unsupported` fallback, never an
actual clarifying question. A Clarification Response Strategy would improve response quality broadly,
and would fix a small number of confirmed live misroutes (`clarification_vs_status`) where an
ambiguous message currently gets a wrong, confident answer instead of a safe non-answer.**

## Recommendation for Sprint 19R

`requiresNewHandlerCount` (45) is nearly double `requiresClarificationCount` (24), and within the two
gap groups `decision_support` cases are 65.2% of the combined total (45/69) — above this evaluator's
60% dominance threshold. `decision_support` also has the more severe failure mode: unsafe mappings
there don't just fail to detect ambiguity (as most clarification misses do), they actively produce a
different, wrong, confident operational answer close to half the time. `needs_clarification`'s
detection, by contrast, is already close to solved for its two largest slices.

**Recommendation: Sprint 19R — Decision Support Candidate Handler**, followed by a
`general_pm_advice` vocabulary calibration sprint once the handler exists, and a Clarification
Response Strategy sprint after that (per `recommendedImplementationOrder`: Decision Support Candidate
Handler → Clarification Response Strategy → General PM Advice Calibration → Controlled Shadow Capture
Prep).

Before either future PR starts, it should:

1. Reuse this sprint's corpus and evaluator (`decisionClarificationArchitectureReview.ts`) as its own
   entry/exit criteria — a Decision Support Candidate Handler PR should re-run this exact corpus and
   confirm `decisionSupportCases`' `currentSafeMappingRate` and `futureRouteAlreadySupportedRate` both
   rise without regressing `existingRouteShouldWinCases` (still 100%/100%, 0 regressions) or the
   golden corpus's `compatibilityRate` (still 72.5%).
2. Resolve the five documented `decision_support_vs_*` collisions with explicit tie-break logic (not
   bare keyword weight), starting with `decision_support_vs_playbook` (the sharpest, 7/8 unsafe) and
   `decision_support_vs_general_pm` (5/8 unsafe).
3. Only after the handler exists should `general_pm_advice` vocabulary calibration proceed, re-running
   this review and the Sprint 17R boundary review to confirm neither regresses.

## Sprint 20R follow-up — Decision Support Shadow Mapping Evaluation

Sprint 20R measured, offline, how the Sprint 19R candidate handler behaves against this sprint's own
79-case corpus, reusing `runDecisionClarificationArchitectureReview()` unmodified — see
`docs/conversational-brain-decision-support-shadow-mapping.md`. It confirms this sprint's own numbers
above (`currentSafeMappingRate` 64.6%, `futureRouteAlreadySupportedRate` 49.4%,
`requiresNewHandlerCount` 45, `requiresClarificationCount` 24, `existingRouteRegressions` 0) are all
unchanged, and adds: of the 45 `requiresNewHandler` cases, the candidate handler is structurally/safety
sound on 100% of them, but live classifier collisions (`general_pm_advice` and `playbook_analysis`
dominant) and low-confidence results (from the still-missing `DecisionDraft` context reuse) together
keep only 40% "shadow routable." `recommendedNextSprint` is **"Sprint 21R — Decision Support Classifier
Boundary Calibration"**, directly confirming item 2 above with live measurements.

## Sprint 21R follow-up — Decision Support Classifier Boundary Calibration

Sprint 21R resolved item 2 above — see `docs/conversational-brain-decision-support-classifier-boundary.md`.
Re-running this review's own evaluator (`decisionClarificationArchitectureReview.ts`, unmodified)
against this same 79-case corpus now shows `currentSafeMappingRate` 84.8% (was 64.6%) and
`futureRouteAlreadySupportedRate` 84.8% (was 49.4%) — `requiresNewHandlerCount` (45),
`requiresClarificationCount` (24), and `existingRouteShouldWinCases`' regression count (still 0) are
unchanged, confirming this sprint only moved decision_support-boundary detection, not the corpus's own
structure or the existing-route safety net. Per this document's own `recommendedImplementationOrder`,
`general_pm_advice` vocabulary calibration and a Clarification Response Strategy remain the two steps
still ahead — Sprint 21R deliberately did not touch either.

## Sprint 22R follow-up — Clarification Response Strategy

Sprint 22R built the Clarification Response Strategy this document's own `futureClarificationStrategyRequirements`
described but did not implement — see
`docs/conversational-brain-clarification-response-strategy.md`. It satisfies all four listed
requirements: it never executes a domain handler, it returns a real clarifying question instead of a
canned `general_pm_advice` answer, its types carry forward-looking hooks
(`previousIntent`/`previousRoute`/`previousClarificationQuestion`) for a *future* stateful loop to
preserve context across turns, and it lets the user pick an operational category, a project, or
supply missing context — matching the `desiredClarificationResponse` shape documented above. This
sprint did not touch `decisionClarificationArchitectureReview.ts` or this document's 79-case corpus —
re-running `tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` confirms
`currentSafeMappingRate` 84.8%, `futureRouteAlreadySupportedRate` 84.8%, `requiresNewHandlerCount` 45,
and `requiresClarificationCount` 24 are all unchanged. It also did **not** implement a persistent,
multi-turn clarification loop — that remains a distinct, still-unbuilt Context Resolver/Router
integration question, explicitly out of this sprint's scope.

## Sprint 23R follow-up — Decision Support Adapter Mapping Plan

Sprint 23R built an offline plan — see
`docs/conversational-brain-decision-support-adapter-mapping-plan.md` — that simulates eight
strategies for how this document's `decision_support`/`needs_clarification` policy could eventually
be realized by the adapter, reusing `runDecisionClarificationArchitectureReview()` (via the Sprint
20R/21R shadow evaluator) unmodified. This sprint did not touch
`decisionClarificationArchitectureReview.ts` or this document's 79-case corpus — the same four
metrics above remain unchanged. The plan documents, with simulated evidence, why the two "map to an
existing production intent" strategies are unsafe (they reintroduce exactly the
`decision_support_vs_playbook`/`decision_support_vs_general_pm` collisions this document's corpus was
built to surface) and recommends `hybrid_shadow_then_clarify` — shadow-routing confident candidates,
clarifying the rest — for Sprint 24R.

## Sprint 24R update

Sprint 24R built the shadow mode prep contract for `hybrid_shadow_then_clarify`
(`decisionSupportShadowModePrep.ts`), evaluated against this document's own 79-case corpus via
`DecisionSupportShadowModeInput`. This file's own 51-test suite still passes unchanged:
`currentSafeMappingRate` 84.8%, `futureRouteAlreadySupportedRate` 84.8%, `requiresNewHandlerCount` 45,
`requiresClarificationCount` 24. Sprint 24R did not modify
`decisionClarificationArchitectureReview.ts` or this corpus. See
`docs/conversational-brain-decision-support-shadow-mode-prep.md`.

## Sprint 25R update

Sprint 25R's shadow capture harness evaluates against this document's own 79-case corpus too (via the
Sprint 24R shadow mode prep contract), in both `dry_run` and `test_only_in_memory` modes. This file's
own 51-test suite still passes unchanged: `currentSafeMappingRate` 84.8%,
`futureRouteAlreadySupportedRate` 84.8%, `requiresNewHandlerCount` 45, `requiresClarificationCount`
24. Sprint 25R did not modify `decisionClarificationArchitectureReview.ts` or this corpus. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md`.

## Sprint 26R note

Sprint 26R's storage policy evaluates this corpus (via the Sprint 25R capture harness, reused
unmodified) against a field-classification policy — `rawInputViolationCount`,
`fullCandidateViolationCount`, and `userVisibleOutputViolationCount` are all 0 against all 79 cases.
This file's own 51-test suite still passes unchanged: `currentSafeMappingRate` 84.8%,
`futureRouteAlreadySupportedRate` 84.8%, `requiresNewHandlerCount` 45, `requiresClarificationCount`
24. Sprint 26R did not modify `decisionClarificationArchitectureReview.ts` or this corpus. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan evaluates this corpus (via the Sprint 25R capture harness) end to
end into storage drafts — `validDraftRate` is 100% and every forbidden-field inclusion count is 0
against all 79 cases. This file's own 51-test suite still passes unchanged: `currentSafeMappingRate`
84.8%, `futureRouteAlreadySupportedRate` 84.8%, `requiresNewHandlerCount` 45,
`requiresClarificationCount` 24. Sprint 27R did not modify `decisionClarificationArchitectureReview.ts`
or this corpus. See `docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter writes every one of this corpus's 79 mapped drafts into a private,
in-memory adapter instance and accepts 100% of them — `fakeWriteAcceptedRate` 100%, every
real/db/supabase/forbidden-content-stored counter 0. This file's own 51-test suite still passes
unchanged: `currentSafeMappingRate` 84.8%, `futureRouteAlreadySupportedRate` 84.8%,
`requiresNewHandlerCount` 45, `requiresClarificationCount` 24. Sprint 28R did not modify
`decisionClarificationArchitectureReview.ts` or this corpus. See
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
