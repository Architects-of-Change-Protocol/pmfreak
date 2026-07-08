# Decision Support Shadow Capture Storage Adapter Fake Implementation (Sprint 28R)

> Full sprint history lives in `docs/conversational-brain-pipeline-reconciliation.md` (§10R-§21R),
> `docs/conversational-brain-golden-intent-evaluation.md`,
> `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R),
> `docs/conversational-brain-decision-support-candidate-handler.md` (Sprint 19R),
> `docs/conversational-brain-decision-support-shadow-mapping.md` (Sprint 20R),
> `docs/conversational-brain-decision-support-classifier-boundary.md` (Sprint 21R),
> `docs/conversational-brain-clarification-response-strategy.md` (Sprint 22R),
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md` (Sprint 23R),
> `docs/conversational-brain-decision-support-shadow-mode-prep.md` (Sprint 24R),
> `docs/conversational-brain-decision-support-shadow-capture-harness.md` (Sprint 25R),
> `docs/conversational-brain-decision-support-shadow-storage-policy.md` (Sprint 26R), and
> `docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` (Sprint 27R). This file
> is the standalone design/results document for the **fake storage adapter implementation** produced by
> Sprint 28R.

## Executive summary

Sprint 27R designed the future storage adapter's method contract, schema proposal, migration
proposal, storage-draft mapper, and draft validator — but left every actual write path
(`writeCaptureDraft`, `deleteByCaptureId`, `deleteByWorkspace`, `purgeExpired`, `listByPolicyVersion`)
`futureOnly: true`, implemented by neither a real adapter nor even a fake one.

Sprint 28R implements those five methods for the first time — but only against a private, in-process
JavaScript array that a single `createDecisionSupportShadowStorageFakeAdapter()` call owns via
closure. There is still no database, migration, table, Supabase client, or real persistence: every
`real*`/`db*`/`supabase*`/`external*` flag this module returns is a literal `false`, and every stored
record disappears the instant the process exits or `adapter.clear()` is called.

1. A strict config (`createDecisionSupportShadowStorageFakeAdapterConfig()`): `allowRealPersistence`/
   `allowDbWrite`/`allowSupabaseWrite`/`allowExternalCalls` are always `false`, forced regardless of
   any caller override.
2. A fake, closure-private in-memory adapter (`createDecisionSupportShadowStorageFakeAdapter()`) with
   `writeDraft`/`deleteByCaptureId`/`deleteByWorkspace`/`purgeExpired`/`listByPolicyVersion`/`listAll`/
   `stats`/`clear`.
3. A defensively-copied fake repository record builder
   (`createDecisionSupportShadowStorageFakeRepositoryRecord()`), deep-cloning every draft it stores.
4. A full-pipeline evaluation over the Sprint 18R corpus
   (`runDecisionSupportShadowStorageFakeAdapterEvaluation()` /
   `summarizeDecisionSupportShadowStorageFakeAdapterEvaluation()`), reusing Sprint 27R's own
   `runDecisionSupportShadowStorageAdapterPlanEvaluation()` to build every draft.

| Metric | Value |
|---|---|
| `totalCaptureRecords` / `totalDraftsCreated` (Sprint 18R corpus) | 79 / 79 |
| `fakeWriteAttemptCount` / `fakeWriteAcceptedCount` / `fakeWriteRejectedCount` | 79 / 79 / 0 |
| `fakeWriteAcceptedRate` / `validDraftRate` | 100% / 100% |
| `fakeRepositoryRecordCount` | 81 (79 corpus + 2 synthetic expired-purge drafts) |
| `fakeListCount` / `fakeDeleteCount` / `fakePurgeCount` | 2 / 4 / 2 |
| `invalidDraftRejectedCount` / `policyViolationRejectedCount` | 11 / 2 |
| `realPersistenceAttemptedCount` / `dbWriteAttemptedCount` / `supabaseWriteAttemptedCount` / `externalCallAttemptedCount` | 0 / 0 / 0 / 0 |
| Every forbidden-content-stored counter (raw input, input preview, full candidate, user-visible output, project name, email, phone) | all 0 |
| `fakeAdapterSafetyRate` | 100% |
| `readinessStatus` | `ready_for_persistence_readiness_review` |
| `recommendedNextSprint` | **"Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness Review"** |

None of this touches production: `intentCompatibilityAdapter.ts` is unmodified, the router/composer/
handlers/endpoint are untouched, no real feature flag was created or activated, no database or
Supabase call was ever made, no migration, SQL file, or table exists, and no *real* storage adapter
exists — this is a fake, in-memory-only stand-in.

## What problem this solves

1. **What a write path actually does, end to end** — `writeDraft()` re-validates every draft via the
   Sprint 27R validator, independently re-checks for forbidden content and any Sprint 26R-classified
   prohibited field (defense in depth), rejects `storageEnabled`/`realPersistenceAllowed: true` as a
   distinct policy violation, and only then pushes a defensively-copied record into its private array.
2. **What a delete path actually does** — `deleteByCaptureId()`/`deleteByWorkspace()` mark matching,
   not-already-deleted records as deleted (hard-delete semantics, audited via `deleteReason`/
   `deletedAt`), never physically removing them from the array and never touching a real database.
3. **What a purge path actually does** — `purgeExpired(now)` deletes every non-deleted record whose
   `retentionExpiresAt` is set and `<=` a caller-supplied (or config-level) reference time — never the
   system clock.
4. **What a list/read path actually does** — `listByPolicyVersion()` returns defensive copies of every
   non-deleted record matching a policy version.
5. **What observability a real adapter would need** — `stats()`: record/write/delete/purge/list counts
   plus every real/db/supabase/forbidden-content-stored counter (all zero, by construction).
6. **That the write path rejects every forbidden field/policy flag independently of the corpus** — 11
   synthetic invalid drafts (one per forbidden field/flag) are written and rejected in every
   evaluation run.
7. **What must exist before Sprint 29R** — see "Criterio para pasar a Sprint 29R" below.

## What this does NOT solve yet

- **Does not create a database, migration file, table, or Supabase write.** No client of any kind is
  imported anywhere in this package tree.
- **Does not implement a real (persistent, cross-process) storage adapter or repository.** Every
  record lives only in one call's own JavaScript closure.
- **Does not implement tenant isolation or access control.** `deleteByWorkspace()` is implemented
  structurally, but no draft carries a `workspaceIdHash` by default — Sprint 27R's draft type has no
  such field yet.
- **Does not implement a real feature flag.** Reuses the Sprint 26R named-but-unimplemented
  `ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE` flag as-is.
- **Does not connect `decision_support` (or this adapter) to the router or request path.**
- **Does not show any stored record to a user, and does not persist any record** outside a single
  adapter instance's own in-process array.
- **Does not harden** the Sprint 19R/22R/24R/25R/26R/27R contracts this module reuses — all are reused
  exactly as-is.

## Baseline (Sprint 27R)

| Metric | Sprint 27R baseline |
|---|---|
| Golden corpus `compatibilityRate` | 72.5% |
| Sprint 17R `policyAlignedRate` / `currentSystemAcceptableRate` | 82.9% / 84.3% |
| Sprint 18R `currentSafeMappingRate` / `futureRouteAlreadySupportedRate` | 84.8% / 84.8% |
| Sprint 18R `requiresNewHandlerCount` / `requiresClarificationCount` | 45 / 24 |
| Sprint 19R/20R/21R `candidateHandlerSafeRate` | 100% |
| Sprint 20R/21R `shadowRoutableRate` | 40% |
| Sprint 21R `unsafeClassifierCollisionCount` | 5 |
| Sprint 22R `acceptableResponseRate` / `safetyPassRate` / `routeOptionsCoverageRate` | 100% / 100% / 100% |
| Sprint 23R `recommendedSprint24Strategy` | `hybrid_shadow_then_clarify` |
| Sprint 24R `shadowEligibleCount` / `decisionCandidateGeneratedCount` / `clarificationCandidateGeneratedCount` | 69 / 18 / 51 |
| Sprint 24R `existingRoutePreservedCount` / `blockedBySafetyGateCount` | 10 / 0 |
| Sprint 25R `acceptableCaptureRate` / `allBlockingGatesPassedRate` | 100% / 100% |
| Sprint 26R `storageReadinessStatus` | `ready_for_storage_adapter_design` |
| Sprint 27R `totalCaptureRecords` / `totalDraftsCreated` / `validDraftRate` | 79 / 79 / 100% |
| Sprint 27R `readinessStatus` | `ready_for_noop_adapter_implementation` / `ready_for_fake_adapter_implementation` |
| Sprint 27R `recommendedNextSprint` | "Sprint 28R — Shadow Capture Storage Adapter Fake Implementation" |

All of the above are re-verified unchanged by this sprint's own test suite (see "Verification" below).

## Fake adapter config

`createDecisionSupportShadowStorageFakeAdapterConfig()` returns `profile:
"strict_test_only_fake_adapter"` with:

| Field | Default | Overridable? |
|---|---|---|
| `mode` | `test_only_in_memory` | yes (`dry_run_fake_write`, `policy_validation_only`) |
| `allowInMemoryWriteForTests` | `true` | yes |
| `allowDryRunFakeWrite` | `false` | yes |
| `allowDeleteSimulation` / `allowPurgeSimulation` / `allowListSimulation` | `true` | yes |
| `allowRealPersistence` / `allowDbWrite` / `allowSupabaseWrite` / `allowExternalCalls` | `false` | **no — forced false regardless of override** |
| `requirePolicyValidation` / `requireDraftValidation` / `requireDeletionPolicy` / `requireRetentionPolicy` | `true` | no — always true |

## Fake repository record

Every stored record (`DecisionSupportShadowStorageFakeRepositoryRecord`) is a deep-cloned,
defensively-copied Sprint 27R `DecisionSupportShadowStorageDraft` plus:

- `recordId`: deterministic, `dss_fake_<sourceCaptureId>`.
- `storedAt`, `policyVersion`, an optional `retentionExpiresAt`/`workspaceIdHash`.
- `deletionRequired: true`, `deleted: boolean`, `deleteReason`/`deletedAt` once deleted.
- `purgeEligible`: computed against a caller-supplied reference time, never the system clock.
- `audit`: `fakeOnly: true` plus seven literal-`false` real/db/supabase/external/forbidden-content
  flags.

## Write behavior

`writeDraft(draft)`:

1. Runs Sprint 27R's `validateDecisionSupportShadowStorageDraft()`.
2. Independently re-checks (defense in depth) for any of the nine forbidden content fields (`rawInput`,
   `inputPreview`, `fullDecisionCandidate`, `fullClarificationCandidate`, `responseText`,
   `userVisibleOutput`, `projectName`, `emailAddress`, `phoneNumber`) anywhere on the draft, and for any
   field inside `draft.fields` that Sprint 26R's `classifyDecisionSupportShadowStorageField()` calls
   `"prohibited"`.
3. Rejects `storageEnabled: true` / `realPersistenceAllowed: true` as a **policy** violation
   (`rejected_by_policy`), distinct from a **content** violation (`rejected_by_validation`).
4. If everything passes and `config.mode === "test_only_in_memory"` with
   `allowInMemoryWriteForTests: true` (the default): builds a fake repository record and pushes it —
   `accepted_in_memory`.
5. `dry_run_fake_write` (with `allowDryRunFakeWrite: true`) validates and accepts but never touches the
   array (`dry_run_accepted`); `policy_validation_only` never writes at all (`not_attempted`).

> **Note on Sprint 26R reuse scope:** the Sprint 26R field classifier's dynamic fallback rule flags any
> field name containing both `"full"` and `"candidate"` as prohibited. Sprint 27R's own draft carries a
> `policyAssessmentSummary.fullCandidatesExcluded` documentation flag whose *name* innocently matches
> that pattern despite carrying no content. This defense-in-depth check is therefore scoped to
> `draft.fields` only — the actual content bag — not the whole draft object, avoiding a false positive
> on Sprint 27R's own safe metadata.

## Delete behavior

`deleteByCaptureId(captureId)` / `deleteByWorkspace(workspaceIdHash)`: marks every matching,
not-already-deleted record `deleted: true` with a `deleteReason`, returning `deleted_in_memory` with a
count, or `not_found` for zero matches. `allowDeleteSimulation: false` short-circuits to
`rejected_by_policy`. Deletion is a flag, not a physical array removal — hard-delete *semantics*, but
records remain inspectable via `listAll()` for audit purposes.

## Purge behavior

`purgeExpired(now)`: deletes every non-deleted record whose `retentionExpiresAt` is set and `<=` the
caller-supplied `now` (falling back to `config.now`) — **never the system clock**. Returns
`purged_in_memory` with a count, or `nothing_to_purge` when nothing qualifies (including when no
reference time is available at all). `allowPurgeSimulation: false` short-circuits to
`rejected_by_policy`.

## List behavior

`listByPolicyVersion(policyVersion)`: returns defensive copies of every non-deleted record matching a
policy version (`listed_in_memory`), or `empty` for zero matches. `listAll()` returns defensive copies
of every record, deleted or not. `allowListSimulation: false` short-circuits `listByPolicyVersion` to
`rejected_by_policy`.

## Stats and clear

`stats()` reports `totalRecords`/`activeRecords`/`deletedRecords`/`purgeEligibleRecords`,
`writeAcceptedCount`/`writeRejectedCount`/`deleteCount`/`purgeCount`/`listCount` (each call counts
once, regardless of how many records it affected), and every real/db/supabase/forbidden-content-stored
counter — all zero, always. `clear()` resets the array and every counter to empty/zero.

## Invalid draft rejection policy

Every evaluation run writes 11 synthetic invalid drafts, each a clone of one real, policy-clean base
draft (built directly via the Sprint 24R -> Sprint 25R -> Sprint 27R pipeline) with exactly one
forbidden field or policy flag injected: `rawInput`, `inputPreview`, `fullDecisionCandidate`,
`fullClarificationCandidate`, `responseText`, `userVisibleOutput`, `projectName`, `emailAddress`,
`phoneNumber`, `storageEnabled: true`, `realPersistenceAllowed: true`. All 11 are expected to be
rejected — 9 as `rejected_by_validation`, 2 (the policy flags) as `rejected_by_policy`.

## No-real-storage guarantees

- `realPersistenceAttempted`/`dbWriteAttempted`/`supabaseWriteAttempted`/`externalCallAttempted` are
  literal `false` on every result type this module returns.
- No database client, Supabase client, `fetch`, or environment-variable read exists anywhere in this
  module.
- No `new Date()`/`Date.now()` call exists anywhere in this module — every timestamp used for purge
  eligibility is caller-supplied.
- No migration/SQL/table vocabulary appears as executable code.

## Evaluation metrics and results

`runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES)` +
`summarizeDecisionSupportShadowStorageFakeAdapterEvaluation()` against the Sprint 18R corpus (79 cases):

- `totalCaptureRecords` / `totalDraftsCreated` / `fakeWriteAttemptCount`: 79 / 79 / 79
- `fakeWriteAcceptedCount` / `fakeWriteRejectedCount` / `fakeWriteAcceptedRate`: 79 / 0 / 100%
- `fakeRepositoryRecordCount`: 81 (79 corpus-accepted + 2 synthetic expired-then-purged drafts, still
  counted since purge marks `deleted: true` rather than removing the record)
- `fakeListCount` / `fakeDeleteCount` / `fakePurgeCount`: 2 / 4 / 2
- `invalidDraftRejectedCount` / `policyViolationRejectedCount`: 11 / 2
- `realPersistenceAttemptedCount` / `dbWriteAttemptedCount` / `supabaseWriteAttemptedCount` /
  `externalCallAttemptedCount`: 0 / 0 / 0 / 0
- Every forbidden-content-stored counter (raw input, input preview, full candidate, user-visible
  output, project name, email address, phone number): 0
- `validDraftRate` / `fakeAdapterSafetyRate`: 100% / 100%
- `readinessStatus`: `ready_for_persistence_readiness_review`
- `recommendedNextSprint`: "Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness Review"
- `representativeStoredRecords`: non-empty; `rejectedWriteExamples`: 11 entries;
  `weakFakeAdapterResults`: empty

## Why no real DB/migration/Supabase/real-adapter/real-repository exists yet

- **No DB:** no tenant isolation or access control exists yet — writing to a real, cross-process
  database today would create ungoverned, undeletable data, exactly what the Sprint 26R deletion
  policy forbids.
- **No migration:** a migration presumes a settled, reviewed schema and a real deletion/rollback path
  validated against real infrastructure; this sprint only proves the write/delete/purge/list contract
  against an in-memory stand-in.
- **No Supabase storage:** no Supabase client is imported anywhere in this package tree.
- **No real storage adapter:** every record this fake adapter ever stores lives only in one call's own
  JavaScript closure — it disappears the instant the process exits or `clear()` is called, is never
  shared across requests/processes, and is never backed by any durable medium.
- **No repository:** a repository presumes a real adapter exists underneath it.

## Criterio para pasar a Sprint 29R

1. `fakeWriteAcceptedRate` / `validDraftRate` / `fakeAdapterSafetyRate` stay at 100% against the Sprint
   18R corpus.
2. `invalidDraftRejectedCount` equals the number of synthetic invalid drafts attempted (11), and
   `policyViolationRejectedCount` correctly isolates the two policy-flag violations.
3. Every real/db/supabase/external/forbidden-content-stored counter stays at 0.
4. `readinessStatus` reaches `ready_for_persistence_readiness_review`.
5. All regression suites (Sprint 17R-27R + golden) stay unchanged.

## Verification

Ran:

```
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-fake-adapter.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-adapter-plan.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-storage-policy.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-capture-harness.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mode-prep.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs
npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs
npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs
npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs
npx tsx --test tests/conversational-brain-intent-classifier.test.mjs
npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs
npm run lint:aoc-boundaries
```

All green (943 assertions across the full related suite; 85 in this sprint's own file, up from 858
before this sprint). `tsc --noEmit` surfaces only pre-existing, unrelated failures elsewhere in the
repository (missing `react`/`next`/`stripe`/`@supabase/*`/`@types/node` type declarations) — none
reference any Sprint 28R file.

Nothing in this sprint touched `POST /api/command-center/chat`, the router, the composer, any
production handler, `intentCompatibilityAdapter.ts`, `intentClassifier.rules.ts`, or
`intent-patterns.ts`. No database, migration, SQL file, table, real storage adapter, or repository was
created. No feature flag was activated. No email/task/execution ever happened. No stored record was
shown to or persisted for a user beyond a single test's own in-process fake adapter instance.
Recommendation: **Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness Review**.

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

