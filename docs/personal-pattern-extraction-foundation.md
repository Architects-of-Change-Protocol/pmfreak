# Personal Pattern Extraction Foundation

## What It Is

The Personal Pattern Extraction Foundation is a **deterministic, evidence-based system** for discovering *candidate* personal PM patterns from a PM's existing evidence records — decisions, memories, effectiveness records, and outcomes.

It does **not** create patterns automatically. It does not use AI. It surfaces candidates that a PM must review and approve before they become Personal PM Patterns.

---

## What It Is Not

| It is NOT | Why |
|-----------|-----|
| AI or machine learning | All rules are deterministic — no models, no inference |
| Embeddings or vector search | No semantic similarity, no NLP |
| Automatic pattern creation | Human review is mandatory before any candidate is promoted |
| Personality or behavioral profiling | No personality scores, leadership ratings, or behavior predictions |
| A recommendation engine | It identifies recurring evidence patterns, not recommendations for future behavior |
| Cross-PM visible | RLS enforces `pm_user_id = auth.uid()` — a PM's candidates are completely invisible to other PMs |

---

## The Flow

```
Events
  ↓
Personal Memory
  ↓
Personal Effectiveness
  ↓
Candidate Pattern        ← Deterministic rules fire when threshold met (≥ 3 occurrences)
  ↓
Human Review             ← PM must inspect, explain, and decide
  ↓
Personal PM Pattern      ← Only created on explicit promotion by the PM
```

---

## Difference: Personal PM Pattern vs Personal Pattern Candidate

| | Personal Pattern Candidate | Personal PM Pattern |
|--|---------------------------|---------------------|
| Created by | Deterministic extraction rule | Human promotion action |
| Status | `candidate` | `active` |
| Editable | Yes (until promoted) | No (immutable; archive to supersede) |
| Visible to others | Never | Never |
| Requires review | Yes — mandatory | Already reviewed |
| Constitutional weight | None | Part of PM's personal constitutional lineage |

---

## Why Review Is Required

Deterministic rules count occurrences. They cannot judge context. A PM who escalated three issues might have done so appropriately, inappropriately, or in entirely different circumstances. Only the PM can decide whether a recurring evidence pattern represents a genuine personal behavioral pattern worth preserving.

The system surfaces the evidence. The PM decides the meaning.

---

## Why Deterministic Rules Exist

Every candidate must be **explainable without AI**. A PM must be able to answer:

> *Why was this candidate created?*

The answer is always:
1. A named rule fired
2. The rule counted occurrences of a specific evidence type
3. The count met or exceeded the threshold (≥ 3)
4. The specific source record IDs are stored in `personal_pm_pattern_candidate_sources`

No hidden inference. No embeddings. No black box.

---

## Why Candidates Are Not Patterns

Candidates are **provisional signals**. They exist to prompt reflection, not to assert truth. Promoting a candidate to a Personal PM Pattern is a deliberate constitutional act — it says: *I recognize this as a pattern in my own PM behavior, and I want to preserve it.*

Candidates that are wrong, irrelevant, or misinterpreted can be rejected or archived. Rejection and archival are permanent signals in the audit trail.

---

## Extraction Rules

| Rule ID | Name | Source Table | Trigger |
|---------|------|-------------|---------|
| `personal_repeated_escalation` | Repeated Escalation Pattern | `personal_pm_memory` | `memory_category = 'escalation_behavior'` ≥ 3 active records |
| `personal_repeated_stakeholder` | Repeated Stakeholder Management Pattern | `personal_pm_memory` | `memory_category = 'stakeholder_behavior'` ≥ 3 active records |
| `personal_repeated_risk_response` | Repeated Risk Response Pattern | `personal_pm_effectiveness` | `outcome_classification in ('success','partial_success')` ≥ 3 validated records |
| `personal_repeated_decision` | Repeated Decision Pattern | `personal_pm_memory` | `memory_category = 'decision_behavior'` ≥ 3 active records |

---

## Database Tables

### `personal_pm_pattern_candidates`
The candidate registry. Each row represents one candidate awaiting human review.

- `pm_user_id` is enforced by RLS: `pm_user_id = auth.uid()`
- `status` lifecycle: `candidate → promoted | rejected | archived`
- Promoted candidates are **immutable** (enforced by database trigger)
- `metadata` stores `ruleId`, `groupKey`, and `runId` for full auditability

### `personal_pm_pattern_extraction_runs`
Every extraction run is logged. Candidates are traceable to their run.

### `personal_pm_pattern_candidate_sources`
Every source record that triggered a candidate is linked here. An auditor can reconstruct exactly which evidence records caused each candidate.

---

## Audit Events

Every lifecycle action emits a platform event with:

- `learningEligible: false`
- `visibility: "personal"`
- `sensitivityLevel: "confidential"`

Events emitted:

| Event | When |
|-------|------|
| `PERSONAL_PATTERN_EXTRACTION_RUN_STARTED` | Extraction run begins |
| `PERSONAL_PATTERN_EXTRACTION_RUN_COMPLETED` | Extraction run finishes |
| `PERSONAL_PATTERN_CANDIDATE_CREATED` | A new candidate is created |
| `PERSONAL_PATTERN_CANDIDATE_PROMOTED` | A candidate is promoted to a Personal PM Pattern |
| `PERSONAL_PATTERN_CANDIDATE_REJECTED` | A candidate is rejected by the PM |
| `PERSONAL_PATTERN_CANDIDATE_ARCHIVED` | A candidate is archived |

---

## Privacy Guarantees

- Every query enforces `workspace_id + pm_user_id`
- RLS on all three tables: `pm_user_id = auth.uid()`
- No existence disclosure: a PM cannot discover another PM's candidates exist
- Audit events are `visibility: "personal"` — they do not surface to workspace views

---

## Immutability Guarantee

Once a candidate is promoted, it cannot be edited or deleted. To correct a promoted candidate:

1. Archive the candidate (which archives the associated Personal PM Pattern separately)
2. Re-run extraction
3. Review the new candidate

This preserves the constitutional lineage: every Personal PM Pattern can be traced back to the exact evidence that created it.

---

## Explainability Contract

`explainPersonalPatternCandidate()` returns:

```typescript
{
  candidate,              // The candidate record itself
  rulesTriggered,         // Which deterministic rule fired
  observations,           // The reconstructed observation from metadata
  sourceEvents,           // platform_event sources
  sourceDecisions,        // decision sources
  sourceOutcomes,         // outcome sources
  sourcePersonalMemory,   // personal_memory sources
  sourcePersonalPatterns, // personal_pattern sources
  sourcePersonalEffectiveness  // personal_effectiveness sources
}
```

A PM can answer *"Why was this candidate created?"* without consulting any AI model.

---

## No Profiling

This system does not create:

- Personality assessments
- Psychological profiles
- Leadership scores
- Performance scores
- Behavior scores
- Trust scores
- Rankings
- Predictions of future success or failure

It observes **what happened** in structured evidence records and counts **how many times** a pattern appears. The PM decides what it means.
