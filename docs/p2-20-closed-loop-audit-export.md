# P2-20 — Closed-Loop Audit Export Compatibility Gate

One canonical, redacted, gap-aware audit export package spanning the governed PM
operational lineage:

```
Source → Raw Input → Normalized Event → Evidence → Finding → Governance
      → Recommendation → Decision → Material Action → Task → Internal Execution
      → Outcome → Observation / Outcome Review
```

## Architecture

P2-20 adds a **composition layer**, not a second lineage model:

```
canonical operational-flow persisted state
   → getCompleteLineageProjection() / reconstructAuditTrail()   (VERIFIED P2-10)
   → src/lib/audit-export/                                      (P2-20: this gate)
   → pmfreak.canonical-audit-export.v1
   → pmfreak.legacy-decision-audit-compatibility.v1             (legacy consumers)
```

`src/lib/audit-export/canonical-audit-export.ts` issues **no database query of its own**
and builds no aggregate. Every lineage fact — step status, gap, dispute, transition
relationship, governance integrity, reconstruction labelling — is carried through from the
verified projection verbatim.

## Entry points

| Symbol | Contract | Purpose |
| --- | --- | --- |
| `buildCanonicalAuditExportPackage(client, workspaceId, projectId, options?)` | `AuditExportPackage` | The canonical export. |
| `exportLegacyDecisionAuditCompatibilityPackage(decisionId, options?)` | `Result<LegacyDecisionAuditCompatibilityPackage>` | Bounded legacy envelope. |
| `GET /api/operational-flow?view=audit_export` | `{ auditExport }` | Same `authorize()` gate as every other view on that route. |

`options` accepts `outcomeId`, `taskId`, `correlationId`, `auditRecordLimit` and
`generatedAt` (a replay seam; `generatedAt` is the only field allowed to vary between two
exports of unchanged state).

## Requested-scope semantics

A package exposes one `requestedScope`, so lineages and audit records are scoped coherently
— a narrowed request never returns project-wide records alongside a narrow lineage.

| Request | Lineages | Audit records |
| --- | --- | --- |
| none | all project lineages | project-scope trail; `associationBasis: "unlinked"` |
| `outcomeId` | exact outcome | verified P2-10 outcome-scoped reconstruction |
| `taskId` | the task's canonical outcome lineage(s) | reconstructed **per selected outcome**, merged, deduplicated by audit item id, chronologically ordered, then **one** combined `auditRecordLimit`. Empty if the task has no canonical outcome — never a project-wide fallback |
| `correlationId` | lineages carrying that correlation on a stored step or transition | correlation-scoped trail |
| `taskId` + `correlationId` | intersection | correlation passed into each outcome-scoped reconstruction; a correlation contradicting the outcome's own contributes nothing |
| `outcomeId` + `taskId` | both filters applied by the projection | scoped to the surviving outcome; a mismatch yields no lineages **and** no audit records |

Correlation narrowing uses only correlation values the verified projection already carries.
It is association by correlation and is never promoted into causation — a lineage can match
because it genuinely shares upstream provenance rows with another chain, and the export says
so rather than hiding it.

`associationBasis` describes **how an item entered this export**, which stays distinct from
the item's stored `relationship`. A platform event pulled in through a canonical outcome of
the requested task is `correlation_only`, and its explanation names both the outcome and the
task. Reconstructed canonical observations remain `reconstruction`.

## Honesty invariants

- **Correlation is not causation.** `LineageTransition[]` is carried through verbatim; the
  export layer never assigns a relationship. Each retained platform event additionally
  carries an `associationBasis` naming how it was *selected* for the lineage
  (`direct_reference` / `correlation_only` / `unlinked`), which is deliberately distinct
  from its own stored `relationship`.
- **Gaps are preserved, never repaired.** A missing step exports with `id: null`,
  `status: "missing"`, `entityFields: null` and a `gapReason`. `integrity.isComplete` is
  false whenever any gap, dispute or non-`complete` lineage status exists.
- **Task completion is not Outcome achievement.** `outcomeAssessment.isAchieved` reads the
  canonical outcome state alone. Task status is exported alongside it as context only, and
  `taskCompletionImpliesOutcomeAchievement` is a literal `false` in the payload.
- **Reconstructions stay labelled.** A canonical outcome observation with no emitted
  platform event appears through the verified P2-10 reconstruction, namespaced
  `canonical_outcome_observations:<id>`, with `isReconstructed: true`.
- **Event-side completeness is not asserted.** No emitter tags `platform_events` with a
  canonical outcome id, so `integrity.eventAssociationComplete` is a literal `false`.

## Redaction

Two composed mechanisms, reported in `package.redaction`:

1. **Entity field allowlist** (`ENTITY_FIELD_ALLOWLIST`, per lineage step kind). Free-form
   payload columns — `operational_raw_inputs.payload`,
   `operational_normalized_events.event_payload`, `evidence_items.content`/`metadata`,
   `material_action_proposals.proposal`,
   `material_action_governance_evaluations.authorization_evidence`,
   `operational_decision_records.authority_evaluation`, the `provenance` columns — are
   absent from every allowlist and are **named** in `withheldEntityFields` rather than
   silently dropped. Where a digest exists it is exported instead, so provenance survives
   without the payload.
2. **Bounded recursive value redaction** over everything that survives, plus the audit
   record payload/metadata (which are the audit evidence and cannot be dropped): an
   export-specific sensitive-key sweep that records each redacted key, then the
   repository's existing `redactSecretLikeValues()` (`src/lib/security/redaction.ts`) for
   secret-*shaped* values.
3. **Presentation-surface redaction** (`redactText`). The verified projection composes
   human-readable values out of persisted free text — `Recommendation: ${title}`,
   `Decision: ${decision} — Rationale: ${rationale}`, `Task: ${title}`,
   `Expected Outcome (…): ${expected_result}`, `Criteria: ${JSON.stringify(success_criteria)}`,
   `Observation (…): ${summary}` — whose underlying columns the allowlist withholds. Without
   this, a secret embedded in one of those strings would reach the export through the
   presentation surface even though its raw column was withheld. Covered surfaces: step
   `title` / `summary` / `gapReason` / `fixtureLabel`, `lineage.expectedResult`,
   `lineage.fixtureLabel`, `gaps[]`, `disputes[]`, `outcomeAssessment.taskStatus`,
   governance reference strings and arrays, and audit/lineage event type and category. Only
   secret-*shaped* substrings are replaced, so ordinary business prose stays readable and
   identifiers and timestamps are never structurally altered. Each redacted surface is named
   in `redaction.redactedTextSurfaces`. Fixed framework explanatory strings
   (`relationshipExplanation`, `associationExplanation`, notes) are deliberately not touched.

Preserved through redaction: canonical IDs, correlation/causation, `occurredAt` vs
`recordedAt`, actor, step status and gap reason, transition classification, evidence
assertion type / confidence / missing-data state, content and event digests, AOC governance
references, and material state changes.

## AOC boundary

`package.aocBoundary` is explicit: AOC-P owns identity/integrity/capability primitives,
AOC-E owns policy/authority/obligations/grants/delegation/revocation, PMFreak owns PM
business objects. `allowDecisionWriteback` remains `false`.

`governanceReferences[]` exports only the reference and status columns PMFreak already
persists on `material_action_governance_evaluations` — `policy_decision_reference`,
`grant_references`, `obligation_references`, `approval_references`, `reason_codes`,
`governance_state`, `contract_version`, `evaluator_kind`, timestamps, `can_commit_action`,
`can_execute`. The raw `authorization_evidence` blob is never copied, and every reference
carries `pmfreakOwnsGovernanceEvidence: false` / `authorityOwner: "AOC-E"`.

Governance is exported as the AOC-E evaluation attached to the canonical material action by
the verified P2-10 projection. PMFreak's own `governance_events` row is not a step in that
verified contract, and P2-20 does not invent one.

## Legacy compatibility

`exportDecisionAuditPackage()` / `buildDecisionLineage()` / `DecisionAuditPackage` /
`DecisionLineage` in `src/lib/decision-governance/` are **unchanged**. P2-20 adds a bounded
envelope around the legacy export rather than re-keying it.

`project_decisions` carries no reference to any canonical P2 entity, so no canonical lineage
can be produced for a legacy decision without fabricating provenance. The envelope therefore
sets `canonicalLineageSupported: false`, lists explicit `compatibilityGaps`, preserves legacy
IDs verbatim, and points at `pmfreak.canonical-audit-export.v1` for the real chain. No
canonical/legacy aggregate is merged, and there is no dual write.

## Determinism

Same persisted state ⇒ same logical export, independent of row arrival order:

- lineages sorted by `outcomeId`;
- the canonical step *sequence* preserved, with same-kind steps (in practice observations)
  ordered by `(occurredAt, recordedAt, id)`;
- `lineageEvents` ordered by `(occurredAt, recordedAt, id)`;
- `gaps`, `disputes`, `observationIds`, `governanceEvaluationIds`, `withheldEntityFields`
  and `redactedPayloadKeys` sorted;
- `auditRecords` in the verified `reconstructAuditTrail()` order.

## Tests

`tests/p2-20-audit-export-compatibility-gate.test.ts` — complete canonical export,
correlation-not-causation, gap preservation, multiple evidence links, Task ≠ Outcome,
observation reconstruction, redaction (positive and negative), tenant isolation, AOC
ownership, determinism under shuffled rows, and legacy regression.

## Known limitations

- `check:operational-flow-db` requires isolated Supabase infrastructure and is not run in a
  cloud session. P2-20 changes no migration and no data access, so it exercises the same
  RLS-scoped queries P2-10 already verified.
- The out-of-scope P2-10 findings T1, T2, T5, T6, T9 and the latent
  `linkedAuditEvents`/`raw_reference` assumptions are untouched. The export makes the
  event-association bound visible (`eventAssociationComplete: false`,
  `associationBasis`) rather than changing the projection's filter.
