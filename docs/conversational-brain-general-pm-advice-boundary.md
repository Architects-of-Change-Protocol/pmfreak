# General PM Advice Boundary & Design Review (Sprint 17R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§17R)
> and `docs/conversational-brain-golden-intent-evaluation.md`. This file is the standalone policy
> document for `general_pm_advice`'s boundary, produced by Sprint 17R.

## Executive summary

Sprints 12R-16R calibrated vocabulary for `project_status`, `playbook_analysis`, `closure_billing`,
`governance_audit`, `risk_issue_dependency`, `task_action`, and `communication_draft`, raising the
golden-corpus global `compatibilityRate` from 28.4% to **72.5%** (`needs_adjustment` band).
`general_pm_advice` (40%), `decision_support` (0%), and `ambiguous_or_unknown` (0%) were explicitly
left uncalibrated, because their remaining gaps are architecture/design questions, not missing
pattern-list entries.

Sprint 17R does not touch any classifier pattern list, the adapter, the router, the composer, or any
handler. It produces three artifacts instead:

1. An explicit **routing policy** for when a message should be `general_pm_advice` versus one of the
   other eight categories (this document).
2. A **boundary corpus** of 70 realistic PM phrases (`tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts`),
   each labeled with the policy's intended target.
3. A pure **boundary evaluator**
   (`src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts`) that measures
   how well today's production classifier, enriched classifier, and Sprint 10R adapter mapping align
   with that policy.

Running the evaluator over the boundary corpus today gives:

| Metric | Value |
|---|---|
| `totalCases` | 70 |
| `policyAlignedRate` | **74.3%** (52/70) |
| `currentSystemAcceptableRate` | **84.3%** (59/70) |
| `architectureGapCount` | 10 (14.3% of corpus) |
| `clarificationGapCount` | 10 (14.3% of corpus) |
| `recommendedNextSprint` | **"Decision Support + Clarification Architecture Review"** |

The golden corpus's own `compatibilityRate` (72.5%) and its per-category results are unchanged by
this sprint (see the "Regression awareness" section of
`docs/conversational-brain-golden-intent-evaluation.md`).

## Problem statement

`general_pm_advice` sits at the center of eight boundaries at once: it must not swallow a
`playbook_analysis` request, a `decision_support` request, an `ambiguous`/`needs_clarification`
input, a `project_status` question, a `task_action` request, a `communication_draft` request, a
`risk_issue_dependency` read, or a `governance_audit` question. Two of those eight boundaries
(`decision_support`, `ambiguous_or_unknown`) cannot be resolved by adding vocabulary at all — there
is no production intent, route, or handler for `decision_support`, and there is no real
clarification loop backing `needs_clarification`/`clarification` today. Calibrating
`general_pm_advice`'s vocabulary before defining these two boundaries risks hard-coding the wrong
default (routing every ambiguous or decision-shaped message straight into a canned PM-advice
answer) into the pattern lists.

## Definition of `general_pm_advice`

`general_pm_advice` is the category for **general PM orientation, coaching, and good-practice
guidance** — used when the user asks something like "how would you handle X" or "what should I
watch out for" **without** asking for:

- project status, progress, or health
- a playbook/PMFreak recommendation
- a decision between named options
- a communication artifact (email, minutes, follow-up)
- creation/assignment/update/closure of a task or action
- a risk, issue, dependency, or blocker read
- evidence, rules, justification, or an audit trail
- closure/billing/reception readiness
- any real execution (sending email, creating a task, writing to a database)

Examples that **should** be `general_pm_advice`:

- "cómo manejarías un cliente difícil"
- "qué buenas prácticas aplican para una reunión de cierre"
- "cómo puedo ordenar este proyecto"
- "cómo reduzco fricción con el cliente"
- "cómo preparo una agenda de seguimiento"
- "qué debería cuidar en una implementación compleja"
- "cómo evito que el alcance se descontrole"
- "cómo manejo expectativas con stakeholders"
- "qué hago cuando el equipo está desalineado"
- "cómo recupero confianza con el cliente"

## Non-goals

This sprint deliberately does **not**:

- Calibrate `general_pm_advice`, `decision_support`, or `ambiguous_or_unknown` vocabulary in
  `intentClassifier.rules.ts` or `intent-patterns.ts`.
- Change `intentCompatibilityAdapter.ts`'s mapping table.
- Touch the router, composer, any handler, or `POST /api/command-center/chat`.
- Create a `decision_support` production handler.
- Implement a clarification loop.
- Activate the enriched classifier anywhere, or add a feature flag.
- Attempt to raise the golden corpus's global `compatibilityRate`.

## Precedence rules

When a message carries an explicit signal for one of the following categories, that category wins
over `general_pm_advice`, even if the message also sounds like it could be general advice:

| Category | Beats `general_pm_advice` when… |
|---|---|
| `project_status_preferred` | the message asks about status, progress, or health ("cómo va", "estado", "avance", "atrasados", "salud del proyecto", "bloqueos"). |
| `playbook_analysis_preferred` | the message asks for the playbook's own recommendation or governed next action ("qué recomienda el playbook", "según el playbook", "siguiente mejor acción"). |
| `communication_draft_preferred` | the message asks to draft, answer, or prepare a communication artifact ("redactame un correo", "preparame una minuta", "cómo le digo al cliente"). |
| `task_action_preferred` | the message asks to create, assign, convert, mark, or close a task/action ("creá una tarea", "asignale seguimiento", "cerrá esta acción"). |
| `closure_billing_preferred` | the message asks about closure/billing/reception readiness ("qué falta para facturar", "estamos listos para cerrar"). |
| `risk_issue_dependency_preferred` | the message asks about explicit risks, issues, dependencies, or blockers ("qué riesgos hay", "qué nos está deteniendo"). |
| `governance_audit_preferred` | the message asks for evidence, rules, justification, or an audit trail ("por qué recomendaste esto", "mostrame el audit trail"). |
| `decision_support_candidate` | the message asks to choose between named options or unblock a specific pending decision ("qué opción debería escoger", "deberíamos hacer A o B"). **Architecture candidate — not mapped to a production intent yet.** |
| `ambiguous_clarification_candidate` | the message is too underspecified to answer safely ("ayuda", "qué hacemos", "no sé qué hacer"). **Clarification candidate — needs a real clarification loop, not a canned advice answer.** |

`general_pm_advice` is the fallback that wins only once none of the above nine signals are present.

## Boundary corpus

`tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts` — 70 cases across the ten
`boundaryCategory` values (minimums from the sprint spec in parentheses):

| `boundaryCategory` | Cases | `policyAlignedRate` | `currentSystemAcceptableRate` |
|---|---|---|---|
| `safe_general_pm_advice` (≥12) | 12 | 16.7% | 16.7% |
| `playbook_analysis_preferred` (≥8) | 8 | 87.5% | 100% |
| `decision_support_candidate` (≥10) | 10 | 40% | 90% |
| `ambiguous_clarification_candidate` (≥10) | 10 | 90% | 100% |
| `project_status_preferred` (≥5) | 5 | 100% | 100% |
| `communication_draft_preferred` (≥5) | 5 | 100% | 100% |
| `task_action_preferred` (≥5) | 5 | 100% | 100% |
| `closure_billing_preferred` (≥5) | 5 | 100% | 100% |
| `risk_issue_dependency_preferred` (≥5) | 5 | 100% | 100% |
| `governance_audit_preferred` (≥5) | 5 | 100% | 100% |

Two findings stand out:

1. **Every "beats general_pm_advice" category is at 100% alignment today.** Production's existing
   patterns for `project_status`, `playbook_analysis` (mostly), `communication_draft`, `task_action`,
   `closure_billing`, `risk_issue_dependency`, and `governance_audit` correctly win over
   `general_pm_advice` on every corpus case — the precedence rules above already hold in practice for
   unambiguous phrasing.
2. **`safe_general_pm_advice` alignment is only 16.7% (2/12).** This is not a boundary problem — none
   of the 12 cases got misrouted into a wrong specific category except one (see below) — it is a
   vocabulary problem: production's `general_pm_advice` pattern list requires exact phrasing ("que
   hago si", "que deberia hacer", "como manejo/lidio/debo manejar/debo lidiar", "consejo") that misses
   common conditional/interrogative PM phrasing ("cómo puedo ordenar…", "cómo reduzco…", "cómo
   evito…", "cómo recupero…"). This is a real, calibratable gap — but see "Recommendation for next
   PR" below for why it should not be calibrated yet.

One boundary collision was found inside `safe_general_pm_advice` itself: "qué buenas prácticas
aplican para una reunión de cierre" currently resolves to `closure_question` (production's bare
`cierre` pattern, weight 20) instead of `general_pm_advice`. This is a real `general_pm_vs_closure_billing`
conflict that any future `general_pm_advice` calibration must guard against (mirroring the
collision-avoidance work already done for `communication_draft` in Sprint 16R).

## Architecture gaps

`decision_support_candidate` (10 cases, all flagged `isArchitectureGap: true` by construction —
`decision_support` has no production `ConversationIntent`, route, or handler):

- `policyAlignedRate`: 40% — i.e. even the **enriched** classifier (the best available signal, since
  production can never express `decision_support`) only detects 4/10 cases correctly. Missed cases
  include singular "alternativa" (pattern list only covers plural "alternativas"), "recomiendas"
  (pattern list only covers conditional "recomendarias"), and messages with no decision-specific
  keyword at all ("deberíamos hacer A o B", "conviene escalar o esperar").
- `currentSystemAcceptableRate`: 90% — one case ("deberíamos cerrar ya o pedir más evidencia")
  confidently misroutes to `governance_question`/`governance_audit` on both classifiers (the bare
  "evidencia" pattern outscores everything else), which is the one decision_support case where the
  system actively claims a wrong answer instead of staying neutral.
- The `governance_audit`/`decision_support` overlap documented since Sprint 11R (golden corpus case
  `ga-09`, "qué trazabilidad tiene esta decisión") is the same underlying gap.

**Conclusion: `decision_support` needs a production intent, route, and handler before any of this
vocabulary can be meaningfully calibrated.**

## Clarification gaps

`ambiguous_clarification_candidate` (10 cases, all flagged `isClarificationGap: true` by
construction — no real clarification loop exists yet):

- `policyAlignedRate`: 90% — production's own `clarification` intent and the enriched classifier's
  `needs_clarification` family already catch 9/10 cases via the existing short-message/no-signal
  fallback logic.
- `currentSystemAcceptableRate`: 100% — the one non-aligned case ("no sé qué hacer") still falls to a
  safe `unknown`/`unknown` rather than a confident wrong answer.
- The catch is architectural, not a detection failure: both `clarification` and `needs_clarification`
  currently resolve straight through to `general_pm_advisor` (see `intentCompatibilityAdapter.ts`'s
  documented `needs_clarification -> general_pm_advice` mapping decision) with no actual clarifying
  question asked back to the user. Detecting ambiguity is already solved; **responding to it with a
  real clarification loop is not.**

## Recommendation for next PR

`architectureGapCount` (10/70 = 14.3%) and `clarificationGapCount` (10/70 = 14.3%) are both above the
12% "high" threshold this sprint's evaluator uses, so `recommendedNextSprint` resolves to:

> **"Decision Support + Clarification Architecture Review"**

Rationale: `safe_general_pm_advice`'s low alignment (16.7%) does look like an obvious vocabulary-
calibration target on its own, but two of its nine competing boundaries (`decision_support`,
`ambiguous_or_unknown`) have no production home yet. Calibrating `general_pm_advice` vocabulary now
would either (a) leave those two boundaries unaddressed, or (b) risk baking in `general_pm_advice` as
a silent default for decision- and clarification-shaped messages precisely because nothing else
claims them — the opposite of this sprint's own precedence rules. The next PR should scope both a
`decision_support` production handler and a clarification-loop strategy; only after those exist
should a Sprint 19R-style `general_pm_advice` vocabulary calibration follow, re-running this same
boundary review to confirm the newly-lower-risk categories don't regress.

## Sprint 18R follow-up — Decision Support + Clarification Architecture Review

Sprint 18R answered the "next PR" question above with a dedicated architecture review rather than
implementation: `docs/conversational-brain-decision-support-clarification-architecture.md` defines
policy for both `decision_support` and `needs_clarification` (precedence rules against all eight other
categories, a safe-mapping definition, and future-handler/strategy requirements), backed by a new
79-case corpus (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`) and a pure
evaluator (`decisionClarificationArchitectureReview.ts`). This sprint's own corpus, `policyAlignedRate`
(74.3%), `currentSystemAcceptableRate` (84.3%), `architectureGapCount` (10), and
`clarificationGapCount` (10) are all unchanged by Sprint 18R — verified by
`tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs`'s regression-awareness
section. Sprint 18R's own evaluator recommends **"Sprint 19R — Decision Support Candidate Handler"**
as the next step, since `decision_support` cases turned out to be both the majority (65.2%) of the
combined architecture/clarification gap and the more severe failure mode (a wrong, confident
operational answer roughly half the time, versus clarification's mostly-safe non-answer fallback).

## Sprint 19R follow-up — Decision Support Candidate Handler

Sprint 19R answered that recommendation with an isolated, pure, tested candidate handler
(`src/lib/playbook-engine/conversation/decision-support/`) — not a boundary or vocabulary change, and
not a production connection. This sprint's own corpus, `policyAlignedRate` (74.3%),
`currentSystemAcceptableRate` (84.3%), `architectureGapCount` (10), and `clarificationGapCount` (10)
are all unchanged by Sprint 19R — verified by
`tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs`'s regression-awareness
section. See `docs/conversational-brain-decision-support-candidate-handler.md` for the full design,
and its "Criteria to pass to Sprint 20R" for what still has to happen — resolving the
`decision_support_vs_playbook`/`decision_support_vs_general_pm` classifier collisions documented in
this boundary review and in Sprint 18R — before `general_pm_advice` vocabulary calibration or any
router integration can proceed.
