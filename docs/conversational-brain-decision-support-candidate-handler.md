# Decision Support Candidate Handler (Sprint 19R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§19R),
> `docs/conversational-brain-golden-intent-evaluation.md`, and
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R). This file
> is the standalone design/reference document for the candidate handler produced by Sprint 19R.

## Executive summary

Sprint 18R found that `decision_support` was the more urgent of the two remaining architecture gaps
(`decision_support`, `needs_clarification`): when it fails, it usually produces a confident, specific,
**wrong** answer (colliding with `playbook_analysis`, `general_pm_advice`, `risk_issue_dependency`,
`closure_billing`, or `governance_audit`) rather than a safe non-answer, and `decision_support` cases
made up 65.2% of the two gap groups combined. It recommended building a **Decision Support Candidate
Handler** first.

Sprint 19R builds that handler — as an **isolated, pure, tested capability**, not connected to
production. It creates:

1. `src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateTypes.ts` — types.
2. `src/lib/playbook-engine/conversation/decision-support/decisionSupportAnalyzer.ts` — a pure,
   deterministic analyzer (decision-type detection, option extraction, tradeoffs, risks, evidence
   needs, confidence estimation).
3. `src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts` — the
   candidate handler itself (`handleDecisionSupportCandidate`,
   `formatDecisionSupportCandidateResponse`, `explainDecisionSupportCandidateHandler`).
4. `src/lib/playbook-engine/conversation/decision-support/index.ts` — an isolated barrel, not
   re-exported from the production conversation barrel.
5. `tests/fixtures/conversational-brain-decision-support-handler-cases.ts` — 50 fixture cases across
   all ten decision types.
6. `tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — 54 tests.

## What problem this solves

Sprint 18R documented that `decision_support` had **no production `ConversationIntent`, route, or
handler at all** — every decision-shaped message either fell through to the safe-but-empty
`unsupported` fallback, or (worse, ~45% of the time per Sprint 18R's corpus) got pattern-matched into
a *different, wrong, confident* production intent. This sprint creates the technical capability to
answer a decision-shaped message with a structured analysis: a decision statement, named or
constructed options, tradeoffs, risks, evidence still needed, and a candidate recommendation with an
explicit confidence level — all computed locally, deterministically, with no LLM call and no network
access.

## What this does NOT solve yet

- **Production is not changed.** This handler is not imported by `router/brainRouter.ts`,
  `composer/responseComposer.ts`, any `handlers/*.ts`, `conversationalBrainGateway.ts`, or
  `POST /api/command-center/chat`. A message classified as `decision_support` today still maps to
  `unsupported` exactly as documented in Sprint 10R's `intentCompatibilityAdapter.ts`.
- **No feature flag exists.** There is nothing to toggle — the capability is present in the codebase
  but has zero reachable path from a real user request.
- **The classifier is not touched.** `intentClassifier.rules.ts`, `intent-patterns.ts`, and
  `intentCompatibilityAdapter.ts`'s mapping table are unmodified — see "Verification" below.
- **No clarification loop.** `needs_clarification` remains exactly as Sprint 18R left it — a separate,
  still-unbuilt gap (`Clarification Response Strategy`, per the recommended implementation order).
- **Does not yet reuse `DecisionDraft`.** Sprint 18R's documented future-handler requirement — reusing
  the `DecisionDraft` data already produced by `operational-intelligence-engine.ts` (Sprint 5) instead
  of inventing a new data source — is **not** implemented in this sprint. The analyzer's tradeoffs,
  risks, and evidence needs are deterministic templates keyed only by decision type, not yet informed
  by real project data. This is the single largest gap before Sprint 20R.
- **Not a tie-break implementation for the five documented collisions.** Sprint 18R's
  `decision_support_vs_{playbook,general_pm,risk,closure,governance}` collisions are real-classifier
  collisions (production/enriched classifier pattern-matching into the wrong family). This handler
  only runs once a message is *already known* to be decision-shaped; it does not resolve which
  category a message belongs to in the first place.

## Input contract

```ts
type DecisionSupportInput = {
  input: string;                          // required, non-empty
  projectId?: string;
  projectName?: string;
  conversationId?: string;
  availableContext?: DecisionSupportContext; // optional known facts — never fetched
  source?: "manual_test" | "candidate_handler" | "architecture_review" | "future_router";
  now?: string;                            // optional ISO timestamp for auditMetadata.generatedAt
};
```

`availableContext` (risks, issues, dependencies, constraints, evidence, stakeholder preferences,
previous recommendations, notes) is always caller-supplied — the handler never calls a database,
Supabase, or any external service to populate it. Its only effect is raising
`recommendation.confidence` when present.

## Output contract

`DecisionSupportCandidateResult`:

| Field | Description |
|---|---|
| `decisionStatement` | Short, human-readable statement of the decision to resolve. Always non-empty. |
| `detectedDecisionType` | One of the ten decision types below. |
| `options` | `DecisionSupportOption[]`, always at least one. |
| `tradeoffs` | `DecisionSupportTradeoff[]`, deterministic per decision type. |
| `risks` | `DecisionSupportRisk[]`, deterministic per decision type. |
| `evidenceNeeded` | `DecisionSupportEvidenceNeed[]`, deterministic per decision type. |
| `recommendation` | Candidate path, rationale, confidence, caveats, next step, and (when confidence is low) a clarifying question instead of a firm recommended option. |
| `safety` | Fixed safe-candidate object — see below. |
| `auditMetadata` | Handler version, matched pattern codes, extraction/recommendation strategy names, limitations. |
| `warnings` | Non-fatal notes, e.g. when every option is a generic placeholder. |

## Decision types supported

| Type | Example input |
|---|---|
| `bill_or_wait` | "conviene facturar ya o esperar recepción formal" |
| `close_or_continue` | "deberíamos cerrar ya o pedir más evidencia" |
| `escalate_or_wait` | "conviene escalar o esperar" |
| `accept_or_mitigate_risk` | "deberíamos aceptar este riesgo o mitigarlo" |
| `change_vendor_or_continue` | "deberíamos cambiar de proveedor o presionar al actual" |
| `approve_or_request_evidence` | "aprobamos esto o pedimos más evidencia" |
| `identify_missing_decision` | "qué decisión falta" / "quién debería decidir esto" |
| `prioritize_next_step` | "qué hago primero" / "cuál es el siguiente paso" |
| `choose_between_options` | "deberíamos hacer A o B" / any explicit "o"/"vs"/"entre...y" split |
| `general_decision_support` | safe fallback — e.g. "qué opción debería escoger" (no explicit split or specific vocabulary) |

Detection is ordered keyword/connector matching, most decision-domain-specific first (billing,
closure, escalation, risk, vendor, evidence, missing-decision, prioritization), then structural option
connectors, falling back to `general_decision_support` when nothing more specific fires. See
`explainDecisionSupportAnalysis()` for the full, in-code description of the rule set — it is
intentionally not hidden in a separate design note, to keep the rules and their documentation from
drifting apart.

## Safety guarantees

Every result's `safety` field is the same fixed object:

```ts
{
  shouldExecuteAction: false,
  shouldCreateTask: false,
  shouldSendEmail: false,
  shouldWriteToDb: false,
  requiresHumanConfirmation: true,
  productionRoutingEnabled: false,
}
```

Additionally:

- The analyzer and handler never call `fetch`, a database, Supabase, Gmail, or an LLM.
- Neither module imports the router, composer, any production handler, or the gateway.
- Every function in the analyzer is a pure function of its arguments — no system clock read, no
  randomness, no mutable module-level state affecting output (the internal option-id counter only
  affects `id` uniqueness, never any other field).
- `formatDecisionSupportCandidateResponse()` always states explicitly that nothing was executed, no
  task was created, and no email was sent.

## Human confirmation policy

`safety.requiresHumanConfirmation` is always `true` — there is no code path that produces `false`.
When `recommendation.confidence` is `"low"` (ambiguous decision, or missing options/context),
`recommendation.shouldAskClarifyingQuestion` is `true` and `recommendation.clarificationQuestion` is
populated instead of a firm `recommendedOptionId`. Every formatted response ends with an explicit note
that this is a candidate recommendation requiring human validation before any action.

## Example output

Input: `"deberíamos cerrar ya o pedir más evidencia"`

```
## Decisión a resolver
Definir si conviene Cerrar ahora o Continuar y reunir más evidencia.

## Opciones detectadas
1. Cerrar ahora — Camino candidato: Cerrar ahora.
2. Continuar y reunir más evidencia — Camino candidato: Continuar y reunir más evidencia.

## Tradeoffs principales
- Cerrar ya acelera el cierre administrativo pero puede dejar observaciones sin resolver que luego generen disputa.
- Pedir más evidencia antes de cerrar fortalece la defensa del cierre pero retrasa la facturación asociada.

## Riesgos
- Pérdida de trazabilidad si se cierra sin documentar observaciones pendientes.
- Retraso de facturación asociado si el cierre se pospone indefinidamente.

## Evidencia que conviene confirmar
- Lista de pendientes: Confirma si queda algo abierto antes de cerrar.
- Aceptación del cliente: Valida que el cliente esté de acuerdo con el cierre.
- Evidencia de cierre técnico: Respalda que el trabajo técnico está completo.
- Criterios de cierre: Define qué condiciones deben cumplirse para cerrar formalmente.

## Recomendación candidata
Cerrar formalmente solo si no quedan observaciones abiertas; si hay pendientes, mantenerlo abierto y pedir la evidencia faltante antes de cerrar.
Caveats: Esta es una recomendación candidata generada sin evidencia externa verificada; requiere validación humana antes de ejecutar cualquier acción.

## Siguiente paso sugerido
Confirmar con el equipo o stakeholder correspondiente antes de proceder con: Cerrar formalmente solo si no quedan observaciones abiertas; si hay pendientes, mantenerlo abierto y pedir la evidencia faltante antes de cerrar.

Nota: esta es una recomendación candidata. No se ejecutó ninguna acción, no se creó ninguna tarea y no se envió ningún correo — requiere validación humana antes de ejecutar cualquier acción.
```

## Limitations

- Keyword/connector-based detection, not full NLP — extracted option labels from free-text splits
  ("entre X y Y", "vs", " o ") may include surrounding words for unusual phrasing.
- Tradeoffs, risks, and evidence needs are deterministic templates per decision type, not tailored to
  the exact wording or real project data of each message.
- Does not yet reuse `DecisionDraft` data from `operational-intelligence-engine.ts` (see "What this
  does NOT solve yet").
- Confidence estimation is a simple two-signal rule (2+ detected options AND context presence), not a
  calibrated model.

## Why this does not connect to the router yet

Per this sprint's explicit constraints and Sprint 18R's own recommended sequencing
(`recommendedImplementationOrder`: Decision Support Candidate Handler → Clarification Response
Strategy → General PM Advice Calibration → Controlled Shadow Capture Prep), connecting a
`decision_support` production route requires, at minimum:

1. A resolution to the five documented `decision_support_vs_*` classifier collisions (Sprint 18R,
   sharpest first: `decision_support_vs_playbook`, `decision_support_vs_general_pm`) — this sprint does
   not touch classifier patterns or the adapter mapping table at all.
2. A feature-flagged integration path, defaulting off, per the Sprint 10R adapter's own documented
   integration criteria (`intentCompatibilityAdapter.ts`'s `explainIntentCompatibilityMapping()`).
3. Reusing real `DecisionDraft` project data instead of the deterministic per-type templates this
   sprint ships with.

Doing any of that now would risk exactly what Sprint 17R/18R were designed to avoid: wiring a new
route before its boundary against the other eight categories is resolved.

## Criteria to pass to Sprint 20R

A future integration sprint should, in order:

1. Reuse this sprint's fixture corpus and test suite as its own regression baseline — re-run
   `tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` and confirm all 54
   tests still pass, plus the golden corpus (`compatibilityRate` 72.5%), Sprint 17R boundary review
   (`policyAlignedRate` 74.3%, `currentSystemAcceptableRate` 84.3%), and Sprint 18R architecture review
   (`currentSafeMappingRate` 64.6%, `futureRouteAlreadySupportedRate` 49.4%) all stay unchanged.
2. Resolve the `decision_support_vs_playbook` and `decision_support_vs_general_pm` collisions with
   explicit tie-break logic in the classifier layer (not in this handler).
3. Wire `DecisionDraft` reuse into the analyzer before considering any real routing change.
4. Only then propose a feature-flagged (default-off) router integration, following the same staged
   shadow-mode discipline as every prior sprint in this series.

## Sprint 20R follow-up — Decision Support Shadow Mapping Evaluation

Sprint 20R answered this document's own "Criteria to pass to Sprint 20R" with real measurements rather
than assumptions: `docs/conversational-brain-decision-support-shadow-mapping.md` reuses this handler
unmodified against the full Sprint 18R corpus. Findings: `candidateHandlerCoverageRate` 100% (this
handler's eligibility surface exactly matches the `decision_support_*` architecture categories),
`candidateHandlerSafeRate` 100% (zero safety/structural failures on any of the 45 eligible cases), but
`shadowRoutableRate` only 40% — driven in equal measure by (a) live classifier collisions, mostly with
`general_pm_advice` and `playbook_analysis`, and (b) 19/45 cases landing on `"low"` confidence for lack
of real project context, exactly the `DecisionDraft`-reuse gap this document already flagged as "the
single largest gap before Sprint 20R." `recommendedIntegrationMode` is `do_not_integrate` and
`recommendedNextSprint` is **"Sprint 21R — Decision Support Classifier Boundary Calibration"** — this
sprint's own criteria above, item 2, confirmed by evidence rather than assumed. This handler's own
behavior, its 54-test suite, and every metric in this document are unchanged by Sprint 20R.

## Sprint 21R follow-up — Decision Support Classifier Boundary Calibration

Sprint 21R calibrated the enriched classifier's `decision_support` pattern boundary (see
`docs/conversational-brain-decision-support-classifier-boundary.md`) without touching this handler's
source at all — `decisionSupportCandidateHandler.ts`, `decisionSupportAnalyzer.ts`, and
`decisionSupportCandidateTypes.ts` are unmodified, and this document's own 54-test suite passes
unchanged. `enrichedDecisionSupportDetectionRate` rose from 33.3% to 88.9% and
`unsafeClassifierCollisionCount` fell from 21 to 5, but `shadowRoutableRate` (still 40%) and
`candidateHandlerSafeRate` (still 100%) are unaffected — the low-confidence gap this document already
flagged (item 3 in "Criteria to pass to Sprint 20R" above, `DecisionDraft` reuse) remains the next
real blocker to shadow routability, not the classifier boundary anymore.

## Sprint 22R follow-up — Clarification Response Strategy

Sprint 22R built the Clarification Response Strategy this document's own "Criteria to pass to Sprint
20R" pointed toward as a distinct, unbuilt gap (`needs_clarification`) — see
`docs/conversational-brain-clarification-response-strategy.md`. It did not touch this handler's
source at all: `decisionSupportCandidateHandler.ts`, `decisionSupportAnalyzer.ts`, and
`decisionSupportCandidateTypes.ts` are unmodified, and this document's own 54-test suite
(`tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs`) passes unchanged.
The new strategy lives in a sibling package
(`src/lib/playbook-engine/conversation/clarification/`), not this one, and is equally disconnected
from production — no router, composer, handler, or endpoint wiring, no feature flag.

## Sprint 23R follow-up — Decision Support Adapter Mapping Plan

Sprint 23R built an offline adapter mapping plan — see
`docs/conversational-brain-decision-support-adapter-mapping-plan.md` — that calls
`handleDecisionSupportCandidate()` from this handler unmodified, via the Sprint 20R/21R shadow
evaluator, as part of simulating eight mapping strategies. `decisionSupportCandidateHandler.ts`,
`decisionSupportAnalyzer.ts`, and `decisionSupportCandidateTypes.ts` remain unmodified, and this
document's own 54-test suite still passes unchanged. The new plan's recommended strategy,
`hybrid_shadow_then_clarify`, routes this handler's confident/safe results (`isShadowRoutable`) to
shadow mode and everything else to the Sprint 22R clarification strategy — still no router, composer,
handler, or endpoint wiring, and no feature flag activated.

## Sprint 24R update

Sprint 24R's shadow mode prep contract (`decisionSupportShadowModePrep.ts`) calls
`handleDecisionSupportCandidate()` exactly as-is for every `decision_support`-desired, non-existing-route
input, and shadow-routes to its result only when it passes the same safety/structural checks documented
here and confidence is medium/high. This file's own 54-test suite still passes unchanged; this sprint
did not modify `decisionSupportCandidateHandler.ts`, `decisionSupportAnalyzer.ts`, or
`decisionSupportCandidateTypes.ts`. See `docs/conversational-brain-decision-support-shadow-mode-prep.md`.

## Sprint 25R update

Sprint 25R's shadow capture harness summarizes a decision candidate produced by this handler into
structural fields only (`decisionType`, `decisionConfidence`, `decisionOptionCount`,
`decisionEvidenceNeededCount`, `decisionRiskCount`, `decisionWarningCount`) — never the full
`recommendation.rationale`/`recommendedPath`/`suggestedNextStep` text. This file's own 54-test suite
still passes unchanged; this sprint did not modify `decisionSupportCandidateHandler.ts`,
`decisionSupportAnalyzer.ts`, or `decisionSupportCandidateTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-capture-harness.md`.

## Sprint 26R note

Sprint 26R's storage policy classifies `fullDecisionCandidate` and any `recommendation.rationale`/
`recommendedPath`/`suggestedNextStep`-shaped full-candidate field as permanently prohibited —
consistent with the Sprint 25R capture harness never retaining this handler's full output. This
file's own 54-test suite still passes unchanged; Sprint 26R did not modify
`decisionSupportCandidateHandler.ts`, `decisionSupportAnalyzer.ts`, or
`decisionSupportCandidateTypes.ts`. See `docs/conversational-brain-decision-support-shadow-storage-policy.md`.

## Sprint 27R note

Sprint 27R's storage adapter plan's draft mapper never includes `fullDecisionCandidate` or its
`recommendation.rationale`/`recommendedPath`/`suggestedNextStep` text — only the minimized
`candidateSummary` this handler's own summary already restricts to counts/labels. This file's own
54-test suite still passes unchanged; Sprint 27R did not modify `decisionSupportCandidateHandler.ts`,
`decisionSupportAnalyzer.ts`, or `decisionSupportCandidateTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter rejects (`rejected_by_validation`) any draft carrying a
`fullDecisionCandidate` field — one of the 11 synthetic invalid drafts every evaluation run writes and
expects rejected — consistent with this handler's own summary already restricting a mapped
`candidateSummary` to counts/labels only. This file's own 54-test suite still passes unchanged;
Sprint 28R did not modify `decisionSupportCandidateHandler.ts`, `decisionSupportAnalyzer.ts`, or
`decisionSupportCandidateTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md`.

---

## Nota — Sprint 29R

Sprint 29R creó una **Persistence Readiness Review**
(`docs/conversational-brain-decision-support-shadow-persistence-readiness.md`). No cambió producción.
No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó un loop de clarificación persistente. No
conectó `decision_support` al router. Decisión explícita: `do_not_build_real_persistence_yet`. Siguiente
sprint recomendado: **Sprint 30R — Controlled Shadow Replay Evaluation**.

