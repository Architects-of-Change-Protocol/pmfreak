# Decision Support Shadow Capture Harness (Sprint 25R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R),
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R),
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md` (Sprint 23R), and
> `docs/conversational-brain-decision-support-shadow-mode-prep.md` (Sprint 24R). This file is the
> standalone design/results document for the shadow capture harness produced by Sprint 25R.

## Executive summary

Sprint 24R built the technical contract for a future `decision_support` shadow mode
(`decisionSupportShadowModePrep.ts`) — but a contract that computes candidates is not the same thing
as a harness that can *capture* what those candidates would have looked like for later review. Sprint
24R's own evaluator recommended exactly this as its Sprint 25R criterion: "puede proceder si
`acceptableShadowPrepRunRate` y `allBlockingGatesPassedRate` se mantienen en 100%... y no introduce
ningún cambio real al router, adapter, composer, endpoint, o feature flag."

Sprint 25R answers that with `decisionSupportShadowCaptureHarness.ts`: a pure, offline, deterministic
capture harness that turns a Sprint 24R `DecisionSupportShadowModeRun` into a minimized, redacted
**capture record** — never a database write, never a Supabase call, never anything shown to a user,
never an executed action. Two modes exist: `"dry_run"` (the default — computes a preview, writes it
nowhere) and `"test_only_in_memory"` (writes the same minimized record into a caller-supplied,
in-process, test-only array — opt-in via two separate flags). This is a **capture harness**, not a
storage implementation: no schema, no migration, no retention policy, no real persistence exists yet.

| Metric | dry_run | test_only_in_memory |
|---|---|---|
| `totalCases` (Sprint 18R corpus) | 79 | 79 |
| `capturePreviewGeneratedCount` | 79 | 0 |
| `inMemoryCaptureRecordedCount` | 0 | 79 |
| `captureBlockedByGateCount` | 0 | 0 |
| `acceptableCaptureRate` | **100%** | **100%** |
| `allBlockingGatesPassedRate` | **100%** | **100%** |
| `decisionCandidateCaptureCount` / `clarificationCandidateCaptureCount` / `existingRouteCaptureCount` | 18 / 51 / 10 | 18 / 51 / 10 |
| `rawInputRetainedCount` / `fullDecisionCandidateRetainedCount` / `fullClarificationCandidateRetainedCount` / `userVisibleOutputRetainedCount` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| `dbWriteAttemptedCount` / `supabaseWriteAttemptedCount` | 0 / 0 | 0 / 0 |
| `shouldReturnCandidateToUserCount` / `shouldPersistShadowResultCount` / `shouldExecuteActionCount` / `shouldSendEmailCount` / `shouldCreateTaskCount` / `shouldWriteToDbCount` | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 / 0 |
| `recommendedNextSprint` | "Sprint 26R — In-Memory Shadow Capture Validation" (in isolation) | **"Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no feature flag was created or activated, no database or Supabase
call was ever made, and every capture result carries `dbWriteAttempted: false` /
`supabaseWriteAttempted: false` / `shouldExecuteAction: false`.

## What problem this solves

1. **What is captured** — a minimized `DecisionSupportShadowCaptureRecord`: a sanitized input preview,
   a local input hash, a structural candidate summary (counts/levels/labels, never full text), a
   safety snapshot, every capture gate result, and audit metadata.
2. **What is NOT captured** — raw input, the full decision candidate's recommendation text, the full
   clarification candidate's response text, any user-visible output, and anything from a
   `not_applicable`/blocked source run beyond a minimal record.
3. **How input is minimized/anonymized** — `sanitizeDecisionSupportShadowInput()`: collapse
   whitespace, redact email-shaped and phone-number-shaped substrings, truncate to
   `maxInputPreviewChars` (120 by default). `createDecisionSupportShadowInputHash()`: a stable,
   local, non-cryptographic hash (`"dssh_<hex>"`), never containing the raw input.
4. **How the decision candidate is summarized** — `decisionType`, `decisionConfidence`,
   `decisionOptionCount`, `decisionEvidenceNeededCount`, `decisionRiskCount`, `decisionWarningCount`,
   `safetyPass` — never `recommendation.rationale`/`recommendedPath`/`suggestedNextStep` text.
5. **How the clarification candidate is summarized** — `clarificationStrategyType`,
   `clarificationAmbiguityLevel`, `clarificationMissingSlots`, `clarificationRouteOptionIntents`,
   `clarificationQuestionCount`, `safetyPass` — never `responseText` or question text.
6. **What security metadata is kept** — `auditMetadata`: `captureHarnessVersion`, `strategySource`,
   `storagePolicy: "no_persistence"`, and six always-`false` flags (`adapterMappingRealChanged`,
   `routerChanged`, `composerChanged`, `endpointChanged`, `dbWriteAttempted`, `supabaseWriteAttempted`,
   `externalCallAttempted`) plus a `limitations` list.
7. **What gates prevent real persistence** — twelve capture gates (ten blocking, two informational);
   see "Capture gates" below.
8. **What in-memory/test-only capture means** — a plain in-process JS array
   (`createInMemoryDecisionSupportShadowCaptureSink()`), never wired to a database, file, or network
   call, that exists only for this module's own tests and vanishes when the process exits or
   `clear()` is called.
9. **How capture coverage is evaluated** — `runDecisionSupportShadowCaptureHarnessEvaluation()` +
   `summarizeDecisionSupportShadowCaptureHarnessEvaluation()` over the Sprint 18R corpus, in both
   modes (see "Evaluation metrics" below).
10. **What Sprint 26R would need** — see "Criterio para pasar a Sprint 26R" below.

## What this does NOT solve yet

- **Does not implement a real storage/persistence layer.** The only sink is an in-process array; no
  database table, Supabase row, file, or queue is ever created.
- **Does not connect shadow capture to the router or request path.** No router, composer, handler, or
  endpoint file imports this module.
- **Does not design a retention or deletion policy.** That is the explicit Sprint 26R candidate.
- **Does not activate a real feature flag.** No config file, environment variable, or feature-flag
  service is created, read, or evaluated.
- **Does not harden the Sprint 19R candidate handler, Sprint 22R clarification strategy, or Sprint
  24R shadow mode prep contract.** All three are reused exactly as-is.
- **Does not show any capture record to a user.** `userVisibleOutputRetained` is a literal `false` on
  every record.

## Baseline (Sprint 24R)

| Metric | Sprint 24R baseline |
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
| Sprint 24R `shadowEligibleCount` / `decisionCandidateGeneratedCount` / `clarificationCandidateGeneratedCount` | 69 / 18 / 51 |
| Sprint 24R `existingRoutePreservedCount` / `blockedBySafetyGateCount` | 10 / 0 |
| Sprint 24R `acceptableShadowPrepRunRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| Sprint 24R `recommendedNextSprint` | "Sprint 25R — Decision Support Shadow Capture Harness" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Capture modes

- **`"dry_run"` (default)** — computes a `DecisionSupportShadowCaptureRecord` preview.
  `captureStatus` is `"capture_preview_generated"` (or `"capture_not_applicable"` for a
  `not_applicable` source run). `sinkKind` stays `"none"`. Nothing is ever written anywhere.
- **`"test_only_in_memory"`** — requires the caller to also pass `allowInMemoryCaptureForTests: true`
  AND `policyAcknowledged: true`. Writes the same minimized record into an in-memory sink the caller
  supplies. `captureStatus` becomes `"in_memory_capture_recorded"`, `sinkKind` becomes
  `"in_memory_test_only"`. Omitting either flag fails the `test_only_mode` or
  `capture_policy_acknowledged` blocking gate instead — nothing is written.

## Capture record contract

`DecisionSupportShadowCaptureRecord`: `kind`, `captureId`, `sourceRunId`, `generatedAt`, `mode`,
`sinkKind`, `inputHash`, `inputPreview`, four literal-`false` retention flags
(`rawInputRetained`/`fullDecisionCandidateRetained`/`fullClarificationCandidateRetained`/
`userVisibleOutputRetained`), `architectureCategory`/`desiredFutureRoute`/`targetKind` (carried
through from the source run), `sourceStatus`/`sourceCandidateKind`, `captureStatus`,
`candidateSummary`, `safetySnapshot`, `gateResults`, `allBlockingGatesPassed`, `warnings`, and
`auditMetadata`.

## Input minimization

`createDecisionSupportShadowCapturePolicy()` always returns
`retainRawInput`/`retainFullDecisionCandidate`/`retainFullClarificationCandidate`/
`retainUserVisibleOutput: false`, `maxInputPreviewChars: 120` (default), `hashInput: true`,
`redactPotentialEmails: true`, `redactPotentialPhoneNumbers: true` — regardless of any override a
caller passes. A caller forcing one of the four retain* fields to `true` does not loosen
minimization: it is read directly by `computeCaptureGateResults()` and fails the
`no_raw_input_retention` or `candidate_minimized` blocking gate instead, so the capture is blocked
rather than the policy weakened.

## Redaction policy

`sanitizeDecisionSupportShadowInput()`: trims and collapses whitespace, replaces email-shaped
substrings with `"[redacted-email]"` and phone-number-shaped substrings (a leading `+` and 6+ digits,
a `\d{3,4}-\d{3,4}` pattern, or a bare 7+-digit run) with `"[redacted-phone]"`, then truncates to
`maxInputPreviewChars` with a trailing `"…"`. `createDecisionSupportShadowInputHash()` builds a
stable, local, dependency-free 32-bit FNV-1a-style hash of the *raw* input, formatted as
`"dssh_<8-hex-chars>"` — same input always hashes identically; different input hashes differently;
the hash never contains or reveals the raw input.

## Candidate summary policy

`summarizeDecisionSupportShadowCandidate()` reduces whichever candidate (if any) the source run
carries to structural fields only:

- **decision_support_candidate**: `decisionType`, `decisionConfidence`, `decisionOptionCount`,
  `decisionEvidenceNeededCount`, `decisionRiskCount`, `decisionWarningCount`, `safetyPass` — never
  `recommendation.rationale`/`recommendedPath`/`suggestedNextStep`/`caveats` text, never option
  labels/descriptions.
- **clarification_response_candidate**: `clarificationStrategyType`, `clarificationAmbiguityLevel`,
  `clarificationMissingSlots`, `clarificationRouteOptionIntents`, `clarificationQuestionCount`,
  `safetyPass` — never `responseText` or question text.
- **existing_route_preserved** / **none**: `candidateKind` and `status` only, `safetyPass: true`.

## Safety snapshot

Every record's `safetySnapshot` carries `sourceShadowRunAllBlockingGatesPassed` (from the Sprint 24R
run) plus ten literal-constant fields
(`shouldReturnCandidateToUser`/`shouldPersistShadowResult`/`shouldExecuteAction`/`shouldSendEmail`/
`shouldCreateTask`/`shouldWriteToDb`/`userVisibleOutputAllowed`/`persistenceAllowed`/
`executionAllowed`/`productionRouteChangeAllowed`), all `false` — never computed from caller input.

## Capture gates

| Gate | Severity | Passes when |
|---|---|---|
| `capture_default_off` | blocking | `mode` is a recognized capture mode (`"dry_run"` or `"test_only_in_memory"`) |
| `test_only_mode` | blocking | `mode === "dry_run"`, or `mode === "test_only_in_memory"` with `allowInMemoryCaptureForTests === true` |
| `no_db_persistence` | blocking | `allowDbWrite !== true` and `allowPersistence !== true` |
| `no_supabase` | blocking | `allowSupabaseWrite !== true` |
| `no_user_visible_output` | blocking | `allowUserVisibleOutput !== true` and `policy.retainUserVisibleOutput` is not forced `true` |
| `no_execution` | blocking | `allowExecution !== true` |
| `no_raw_input_retention` | blocking | `policy.retainRawInput` is not forced `true` |
| `candidate_minimized` | blocking | none of `retainFullDecisionCandidate`/`retainFullClarificationCandidate`/`retainUserVisibleOutput` is forced `true` |
| `shadow_run_acceptable` | blocking | the source Sprint 24R run passed every blocking gate and carries every side-effect flag as `false` |
| `capture_policy_acknowledged` | blocking | `mode === "dry_run"` (no acknowledgement required), or `test_only_in_memory` with `policyAcknowledged === true` |
| `adapter_unchanged` | info | this module does not import `intentCompatibilityAdapter.ts` (always true) |
| `router_unchanged` | info | this module does not import any router/composer/handler file (always true) |

If any **blocking** gate fails, `captureStatus` becomes `"capture_blocked_by_gate"`, `recordCreated`
is `false`, no record is attached, and no sink write ever happens — regardless of what mode was
requested.

## No persistence policy

`dbWriteAttempted`/`supabaseWriteAttempted`/`externalCallAttempted` are literal `false` constants on
every record's `auditMetadata`, never computed from caller input. No database, Supabase, file, or
network write ever happens anywhere in this module — the only "write" that can happen at all is an
in-process array push behind the `test_only_in_memory` + double-opt-in gate.

## No user-visible output policy

`userVisibleOutputRetained` and `safetySnapshot.userVisibleOutputAllowed` are literal `false` on every
record. This sprint captures for offline evaluation only — whether or how a capture record should ever
reach a user is a separate, deliberate integration decision explicitly out of scope here.

## No execution policy

`safetySnapshot.shouldExecuteAction`/`shouldSendEmail`/`shouldCreateTask`/`shouldWriteToDb` are literal
`false` on every record, and `no_execution` fails as a blocking gate the moment a caller forces
`allowExecution: true` — no action, task, or email is ever executed by this module, in any mode.

## In-memory sink behavior

`createInMemoryDecisionSupportShadowCaptureSink()` returns a `{ kind: "in_memory_test_only", write,
list, clear, count }` object backed by a plain JS array. `write()` pushes a record and returns it;
`list()` returns a shallow copy; `clear()` empties the array; `count()` returns its length. Nothing
here is durable: the sink's contents live only in process memory and disappear when the process
exits or `clear()` is called. `captureDecisionSupportShadowRun()` only ever calls `sink.write()` when
every blocking capture gate has passed AND `mode === "test_only_in_memory"` — never in `"dry_run"`
mode, and never when any gate failed.

## Evaluation metrics

Running `runDecisionSupportShadowCaptureHarnessEvaluation()` +
`summarizeDecisionSupportShadowCaptureHarnessEvaluation()` over the unmodified Sprint 18R corpus (79
cases), in each mode:

### dry_run

| Metric | Value |
|---|---|
| `totalCases` / `evaluatedRuns` | 79 / 79 |
| `capturePreviewGeneratedCount` | 79 |
| `inMemoryCaptureRecordedCount` / `captureBlockedByGateCount` / `captureNotApplicableCount` | 0 / 0 / 0 |
| `acceptableCaptureRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| `rawInputRetainedCount` / `fullDecisionCandidateRetainedCount` / `fullClarificationCandidateRetainedCount` / `userVisibleOutputRetainedCount` | 0 / 0 / 0 / 0 |
| `dbWriteAttemptedCount` / `supabaseWriteAttemptedCount` | 0 / 0 |
| `shouldReturnCandidateToUserCount` / `shouldPersistShadowResultCount` / `shouldExecuteActionCount` / `shouldSendEmailCount` / `shouldCreateTaskCount` / `shouldWriteToDbCount` | 0 / 0 / 0 / 0 / 0 / 0 |
| `decisionCandidateCaptureCount` / `clarificationCandidateCaptureCount` / `existingRouteCaptureCount` | 18 / 51 / 10 |
| `recommendedNextSprint` (dry_run evaluated alone) | "Sprint 26R — In-Memory Shadow Capture Validation" |

### test_only_in_memory (allowInMemoryCaptureForTests + policyAcknowledged)

| Metric | Value |
|---|---|
| `inMemoryCaptureRecordedCount` | 79 |
| `sink.count()` | 79 (matches `inMemoryCaptureRecordedCount`) |
| `acceptableCaptureRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| Every retention/side-effect count | 0 |
| `recommendedNextSprint` | **"Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan"** |

## Results

- `representativeCaptureRecords`: the first five capture results with a record created, per mode.
- `weakCaptures`: none in either mode — every one of the 79 corpus cases is an acceptable capture.
- `recommendedNextSprint`: **"Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence
  Plan"** once both dry_run and test_only_in_memory are evaluated clean.

The separate `tests/fixtures/conversational-brain-decision-support-shadow-capture-harness-cases.ts`
corpus (28 hand-authored cases) additionally exercises: dry_run/test_only_in_memory previews for each
candidate kind, every blocking-gate failure mode (`allowDbWrite`/`allowSupabaseWrite`/
`allowPersistence`/`allowUserVisibleOutput`/`allowExecution`/`retainRawInput`/
`retainFullDecisionCandidate`/`retainFullClarificationCandidate`/`retainUserVisibleOutput`/missing
`allowInMemoryCaptureForTests`/missing `policyAcknowledged`/an already-blocked source shadow run),
email/phone redaction, long-input truncation, hash stability/difference, and the
`capture_not_applicable` status in both modes.

## Por qué no se cambió el adapter real

Este módulo llama directamente a `prepareDecisionSupportShadowModeRun()` (Sprint 24R), que a su vez
llama a `handleDecisionSupportCandidate()` (Sprint 19R) y `handleClarificationResponseCandidate()`
(Sprint 22R) sin pasar por `intentCompatibilityAdapter.ts` en ningún punto. Este sprint no agrega
ningún import nuevo hacia el adapter, el classifier de producción, ni `intent-patterns.ts`.

## Por qué no se conectó el router

Ninguna función de este módulo es importada por `router/brainRouter.ts`,
`composer/responseComposer.ts`, `handlers/*.ts`, `conversationalBrainGateway.ts`, ni por
`POST /api/command-center/chat` — verificado directamente por un test que lee el código fuente del
archivo y falla si aparece cualquiera de esos imports.

## Por qué no se activó feature flag

Este módulo no lee `process.env`, ningún archivo de config, ni ningún servicio de feature flags — el
único "flag" que existe es `DecisionSupportShadowCaptureContext.mode`/`allowInMemoryCaptureForTests`/
`policyAcknowledged`, todos campos tipados que el caller provee explícitamente en memoria, nunca
leídos de una fuente externa.

## Por qué no se creó DB/storage/migration

No existe todavía una política de retención, un esquema revisado, ni un mecanismo de borrado para el
capture output — escribirlo hoy en una base de datos real o en Supabase crearía datos sin gobernanza.
El único sink que este sprint ofrece es un arreglo en memoria, de un solo proceso, que nunca se
serializa a disco ni se envía a ningún servicio externo.

## Criterio para pasar a Sprint 26R

Sprint 26R (**Shadow Capture Storage Policy / Default-Off Persistence Plan**) puede proceder si:
`acceptableCaptureRate` y `allBlockingGatesPassedRate` se mantienen en 100% contra el corpus del
Sprint 18R en ambos modos (`dry_run` y `test_only_in_memory`), todos los conteos de
retention/side-effect se mantienen en 0, `inMemoryCaptureRecordedCount` es > 0 (validando que el sink
en memoria funciona), y no se introduce ningún cambio real al router, adapter, composer, endpoint, o
feature flag — exactamente las mismas restricciones que gobernaron este sprint. Sprint 26R diseñaría
el esquema de persistencia/retención real (todavía default-off); seguiría sin activar shadow mode en
el request path ni mostrar nada a un usuario.

## Verification

Ran the following, all green, all prior-sprint metrics unchanged:

- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-capture-harness.test.mjs` (new, 77 tests)
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mode-prep.test.mjs` (51 tests)
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
  (`node_modules` is not fully installed — missing `react`/`@types/node`, same condition Sprint 23R/
  24R documented). None of this sprint's new/modified files appear in that error output.

Confirmed untouched: `POST /api/command-center/chat`, the router, the composer, every production
handler, every feature flag, the DB/Supabase/Gmail integrations, `intentClassifier.rules.ts`,
`intentCompatibilityAdapter.ts`, and `intent-patterns.ts`.
`src/lib/playbook-engine/conversation/decision-support/index.ts` was updated to export the new module
(an isolated barrel, not re-exported from `src/lib/playbook-engine/conversation/index.ts` — the
production barrel is unmodified).

## Sprint 26R note

Sprint 26R built `decisionSupportShadowCaptureStoragePolicy.ts`, a storage policy / default-off
persistence plan that assesses real captures produced by this harness (via
`runDecisionSupportShadowCaptureHarnessEvaluation()`, unmodified) against a field-classification
policy — proving `captureHarnessCleanRate` is 100% against the Sprint 18R corpus. This sprint's own
77-test suite still passes unchanged: `acceptableCaptureRate`/`allBlockingGatesPassedRate` stay at
100% in both `dry_run` and `test_only_in_memory` modes, `existingRouteCaptureCount` stays at 10, and
`recommendedNextSprint` still reads "Sprint 26R — Shadow Capture Storage Policy / Default-Off
Persistence Plan". Sprint 26R did not modify `decisionSupportShadowCaptureHarness.ts` or
`decisionSupportShadowCaptureHarnessTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-policy.md` for the full policy.

## Sprint 27R note

Sprint 27R's storage adapter plan reuses this harness's capture records (via
`runDecisionSupportShadowCaptureHarnessEvaluation()`, unmodified) as the input to its storage-draft
mapper. This file's own 77-test suite still passes unchanged: `acceptableCaptureRate`/
`allBlockingGatesPassedRate` stay at 100% in both `dry_run` and `test_only_in_memory` modes,
`existingRouteCaptureCount` stays at 10. Sprint 27R did not modify
`decisionSupportShadowCaptureHarness.ts` or `decisionSupportShadowCaptureHarnessTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md`.

## Sprint 28R note

Sprint 28R's fake storage adapter reuses `captureDecisionSupportShadowRun()` directly (to build one
real base draft its synthetic invalid/expired-purge fixtures clone from) and reuses this harness's
capture records transitively via Sprint 27R's evaluator for the corpus pass. This file's own 77-test
suite still passes unchanged: `acceptableCaptureRate`/`allBlockingGatesPassedRate` stay at 100% in
both `dry_run` and `test_only_in_memory` modes, `existingRouteCaptureCount` stays at 10. Sprint 28R
did not modify `decisionSupportShadowCaptureHarness.ts` or
`decisionSupportShadowCaptureHarnessTypes.ts`. See
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md`.

---

## Nota — Sprint 29R

Sprint 29R creó una **Persistence Readiness Review**
(`docs/conversational-brain-decision-support-shadow-persistence-readiness.md`). No cambió producción.
No cambió routing. No activó ningún feature flag. No creó DB/migrations/tables/SQL files. No creó
storage adapter real. No creó repository real. No implementó un loop de clarificación persistente. No
conectó `decision_support` al router. Decisión explícita: `do_not_build_real_persistence_yet`. Siguiente
sprint recomendado: **Sprint 30R — Controlled Shadow Replay Evaluation**.

