# Personal PM Effectiveness Foundation

## What it is

The Personal PM Effectiveness Foundation is an **evidence-backed, inspectable, sovereign, exportable, and auditable** registry that connects a Project Manager's professional operating patterns to project outcomes.

It answers one question:

> Which professional operating patterns appear alongside better or worse outcomes?

Every record is:
- Explicitly created by the PM themselves
- Traceable to source evidence (decisions, patterns, memory, outcomes, platform events)
- Exportable in full as structured JSON
- Immutable once validated (auditable forever)
- Isolated to the individual PM — no cross-PM reads

---

## What it is NOT

| It is NOT | What that means |
|---|---|
| Performance scoring | No numeric score is computed or stored |
| Employee evaluation | No manager or system rates PMs |
| Behavioral prediction | No probability of future success or failure |
| Psychological profiling | No personality or behavioral archetype inference |
| AI or ML | No embeddings, vectors, LLMs, or model inference |
| Semantic search | No similarity search or natural language matching |
| Recommendation generation | No automated suggestions about PM behavior |
| Rankings | No PM is ranked against another |
| Peer comparison | No cross-PM reads; records are fully isolated |

---

## Difference Between PM Memory, PM Patterns, and PM Effectiveness

```
Events
  ↓
Decisions
  ↓
Outcomes
  ↓
Personal PM Memory        ← raw behavioral observations, domain-specific
  ↓
Personal PM Patterns      ← repeating operating patterns derived from memory
  ↓
Personal PM Effectiveness ← explicit PM-created records linking patterns/memory/decisions/outcomes
```

| Layer | Table | Purpose |
|---|---|---|
| Personal PM Memory | `personal_pm_memory` | Raw behavioral observations: what happened, when, in what context |
| Personal PM Patterns | `personal_pm_patterns` | Repeating professional operating patterns derived from memory and evidence |
| Personal PM Effectiveness | `personal_pm_effectiveness` | Explicit records connecting patterns/memory/decisions/outcomes to classified results |

The key difference: **effectiveness records are created by the PM deliberately**, after reviewing evidence. They are not automatically inferred or machine-generated.

---

## Privacy Model

- A PM can **only read their own** personal effectiveness records.
- A PM can **only create** effectiveness records for themselves (`pm_user_id = auth.uid()`).
- A PM can **update, validate, archive, deprecate, and delete** their own records.
- **No user can read another PM's records.**
- Cross-PM reads **fail silently with `not_found`** to avoid existence disclosure.

RLS enforces **both** `workspace_id` and `pm_user_id` on every table:

```sql
create policy "personal_pm_effectiveness_isolation"
  on public.personal_pm_effectiveness
  for all
  using (
    workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
    and pm_user_id = auth.uid()
  );
```

Child tables (`_sources`, `_observations`) inherit this isolation via subquery joins back to the parent effectiveness record.

---

## Cross-PM Isolation

Cross-PM reads **must fail**. The service returns `not_found` when a PM attempts to access another PM's record — even if the record exists. This avoids revealing whether a given effectiveness record exists for another PM in the same workspace.

There is **no delegation system** in this foundation. Future explicit delegation (if ever introduced) requires a separate policy layer.

---

## No Scoring / No Profiling / No Performance Rating Guarantee

The following field names and behaviors are **prohibited** throughout this layer:

- `pm_score`, `performance_score`, `behavior_score`, `trust_score`, `leadership_score`, `effectiveness_score`
- `ranking`, `rating`, `probability`, `prediction`
- `future_success`, `future_failure`
- `personality`, `psychological`, `profile`

The only outcome field is `outcome_classification` with exactly four values:

| Value | Meaning |
|---|---|
| `success` | The PM's record reflects a successful outcome |
| `partial_success` | Mixed outcome |
| `failure` | Outcome reflects failure |
| `unknown` | Outcome cannot be classified yet |

This is **classification only** — not scoring, not probability, not prediction.

---

## Outcome Classification

```typescript
type PersonalEffectivenessOutcomeClassification =
  | "success"
  | "partial_success"
  | "failure"
  | "unknown";
```

Classification is:
- Set by the PM explicitly
- Not computed by any algorithm
- Not inferred by any ML model
- Not predicted or ranked

---

## Source Lineage

Every effectiveness record **must have at least one source** (enforced at service level before insert). Sources are explicit links to other records in the system:

**Supported source types:**

| Source Type | What it links to |
|---|---|
| `platform_event` | Governance event in the audit log |
| `decision` | A project decision |
| `decision_effectiveness` | An effectiveness record for a decision |
| `organizational_pattern` | An org-wide operating pattern |
| `organizational_memory` | An org-wide memory record |
| `personal_memory` | This PM's personal memory record |
| `personal_pattern` | This PM's personal operating pattern |
| `outcome` | A decision outcome |
| `risk` | A risk item |
| `task` | An execution task |
| `milestone` | A project milestone |
| `stakeholder` | A stakeholder record |

**Supported relationship types:**

| Relationship | Meaning |
|---|---|
| `supports` | Source supports this effectiveness record |
| `contradicts` | Source contradicts it |
| `caused_by` | This effectiveness is caused by the source |
| `derived_from` | Derived from the source |
| `reviewed_during` | The source was reviewed when creating this record |
| `supersedes` | This record supersedes the source |
| `related_to` | General relationship |

Unresolvable source types (those without a current table mapping) are exposed in `unresolvedSources` in all explain/lineage/export outputs so audit visibility is preserved.

---

## Export

```typescript
exportPersonalEffectiveness(effectivenessId, pmUserId)
// → PersonalEffectivenessExport (JSON)
```

The export includes:
- `effectiveness` — the core record
- `observations` — all review notes
- `sources` — all source links
- `lineage` — full lineage including resolved source records and platform events
- `unresolvedSources` — sources that could not be resolved to a current table

Format: **JSON only**. No PDF. No UI. The PM owns and controls their own data.

---

## Validated-Record Immutability

Once an effectiveness record is **validated**, the following are **permanently prohibited**:

| Prohibited action | Error |
|---|---|
| Update summary or classification | `governance_violation` |
| Delete the record | `governance_violation` |
| Deprecate the record | `governance_violation` |
| Add or remove sources | `governance_violation` (enforced by DB trigger) |
| Add or remove observations | `governance_violation` (enforced by DB trigger) |

The **only permitted transition** for a validated record is: `validated → archived`.

Immutability is enforced at **two layers**:
1. **Service level** — checked before any write
2. **Database trigger level** — `personal_pm_effectiveness_validated_guard` raises an exception if a validated record is mutated by any means

---

## Audit Events

All writes emit platform events with:

| Field | Value |
|---|---|
| `learningEligible` | `false` |
| `eventCategory` | `"governance"` |
| `visibility` | `"personal"` |
| `sensitivityLevel` | `"confidential"` |
| `rawReferenceTable` | `"personal_pm_effectiveness"` |
| `rawReferenceId` | The effectiveness record ID |

| Event Type | When emitted |
|---|---|
| `PERSONAL_EFFECTIVENESS_CREATED` | On creation |
| `PERSONAL_EFFECTIVENESS_UPDATED` | On any field update |
| `PERSONAL_EFFECTIVENESS_VALIDATED` | On validation |
| `PERSONAL_EFFECTIVENESS_ARCHIVED` | On archive |
| `PERSONAL_EFFECTIVENESS_DEPRECATED` | On deprecation |
| `PERSONAL_EFFECTIVENESS_DELETED` | Before deletion |
| `PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED` | When observation added |

All events are append-only and cannot be mutated or deleted.

---

## Future Governance Hooks (Capability Vocabulary)

These constants exist as future governance hooks only. They do **not** wire a permission system in this foundation.

```typescript
PERSONAL_EFFECTIVENESS_CREATE
PERSONAL_EFFECTIVENESS_UPDATE
PERSONAL_EFFECTIVENESS_VALIDATE
PERSONAL_EFFECTIVENESS_INSPECT
PERSONAL_EFFECTIVENESS_EXPORT
PERSONAL_EFFECTIVENESS_ARCHIVE
PERSONAL_EFFECTIVENESS_DELETE
PERSONAL_EFFECTIVENESS_OBSERVE
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `personal_pm_effectiveness` | Core effectiveness records |
| `personal_pm_effectiveness_sources` | Source evidence links |
| `personal_pm_effectiveness_observations` | Review notes |

---

## Health Metrics

```typescript
getPersonalEffectivenessHealth(workspaceId, pmUserId)
```

Returns:

| Metric | Definition |
|---|---|
| `candidateCount` | Records in candidate status |
| `validatedCount` | Records in validated status |
| `archivedCount` | Records in archived status |
| `deprecatedCount` | Records in deprecated status |
| `observationCount` | Total observations across all records |
| `sourceCoverage` | Records with ≥1 source / total records (0–1) |
| `lineageCoverage` | Records with ≥1 lineage source (decision/outcome/event/decision_effectiveness) / total records (0–1) |
| `successCount` | Records classified as success |
| `partialSuccessCount` | Records classified as partial_success |
| `failureCount` | Records classified as failure |
| `unknownCount` | Records classified as unknown |

Coverage values are clamped to `[0, 1]`.

---

## What was intentionally left out

- **No AI / LLM / embeddings** — all evidence is explicit and human-authored
- **No recommendations** — the system surfaces evidence, not suggestions
- **No cross-PM views** — there is no aggregated PM comparison view
- **No delegation** — access sharing requires a future explicit delegation system
- **No PDF export** — JSON only; the PM controls the format
- **No scoring** — outcome classification is the only allowed judgment
- **No automatic effectiveness creation** — a PM must always deliberately create records
