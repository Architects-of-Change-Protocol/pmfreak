# Pattern Extraction Foundation

## What Extraction Is

Pattern extraction is the process of scanning accumulated operational history — decisions, outcomes, risks, dependencies — and applying **deterministic counting rules** to surface candidate patterns for human review.

Extraction does not create patterns. It surfaces **candidates** that a human must review and promote.

## What Extraction Is Not

- **Not AI.** No language model is involved at any stage.
- **Not machine learning.** No training, no weights, no inference.
- **Not embeddings.** No vector representations.
- **Not semantic search.** No similarity matching.
- **Not autonomous.** No candidate is promoted without human action.
- **Not recommendations.** The system surfaces evidence; humans decide meaning.
- **Not prediction.** Rules count what happened, not what will happen.

## Why Deterministic Rules Exist

An auditor must be able to reconstruct — without consulting an AI — why any given candidate was created.

Deterministic rules make this possible. Each rule specifies:

- **Which table** to query
- **Which columns** to count
- **What threshold** triggers a candidate

The rule registry is the complete, human-readable specification of every extraction behavior.

## Lineage Diagram

```
Events (platform_events)
    ↓
Memory (organizational_memory, project_decisions, raid_items, decision_outcomes)
    ↓
[Deterministic Rule Evaluation]
    ↓
Candidate (organizational_pattern_candidates)
    ↓
Human Review
    ↓
Organizational Pattern (organizational_patterns)
```

## The Difference Between a Candidate and a Pattern

| | Candidate | Organizational Pattern |
|---|---|---|
| **Created by** | Deterministic rule | Human promotion |
| **Status** | candidate → promoted / rejected / archived | candidate → validated → deprecated / archived |
| **Editable?** | Yes, until promoted | No, once validated |
| **Requires evidence?** | Yes, rule threshold must be met | Yes, inherited from candidate |
| **Lineage** | `rule_id`, `promoted_pattern_id` | `metadata.promoted_from_candidate_id` |

## Rules

Rules are defined in `src/lib/pattern-extraction/rule-registry.ts`. Every rule is pure data: no code executes on its own.

### Repeated Decision Outcome

**Trigger:** The same `decision_type` produces the same `outcome_status` at least 3 times within a workspace.

**Source tables:** `project_decisions` joined to `decision_outcomes`.

**Candidate category:** `decision_pattern`

### Repeated Risk Escalation

**Trigger:** Risk `raid_items` in `open` or `monitoring` status accumulate at least 3 records in a workspace.

**Source tables:** `raid_items` where `category = 'risk'`.

**Candidate category:** `risk_pattern`

### Repeated Dependency Delay

**Trigger:** Dependency `raid_items` in `open` or `monitoring` status accumulate at least 3 records in a workspace.

**Source tables:** `raid_items` where `category = 'dependency'`.

**Candidate category:** `dependency_pattern`

### Repeated Decision Rejection

**Trigger:** The same `decision_type` is rejected at least 3 times in a workspace.

**Source tables:** `project_decisions` where `decision_status = 'rejected'`.

**Candidate category:** `governance_pattern`

## Promotion Flow

```
Evidence meets rule threshold
    ↓
Candidate created (status: candidate)
    ↓
Human inspects candidate (explainPatternCandidate)
    ↓
Human promotes OR rejects OR archives
    ↓
If promoted:
  - Organizational pattern created
  - Candidate linked via promoted_pattern_id
  - Pattern linked back via metadata.promoted_from_candidate_id
```

Candidates **cannot** be auto-promoted. `promotePatternCandidate()` is the only path to pattern creation via extraction, and it requires an explicit `actorId`.

## Immutability

Promoted candidates are immutable. The DB trigger `pattern_candidates_promoted_guard` enforces this at the database level. To supersede a promoted candidate, archive it and re-run extraction.

## Audit Events

Every state transition emits a `platform_events` record with `learningEligible: false`:

| Event | Trigger |
|---|---|
| `PATTERN_EXTRACTION_RUN_STARTED` | `runPatternExtraction()` begins |
| `PATTERN_EXTRACTION_RUN_COMPLETED` | `runPatternExtraction()` finishes |
| `PATTERN_CANDIDATE_CREATED` | Rule threshold met, candidate inserted |
| `PATTERN_CANDIDATE_PROMOTED` | Human promotes candidate |
| `PATTERN_CANDIDATE_REJECTED` | Human rejects candidate |
| `PATTERN_CANDIDATE_ARCHIVED` | Human archives candidate |

## Governance Capability Vocabulary

These capability constants are defined in `types.ts` for future policy wiring:

- `PATTERN_EXTRACTION_RUN` — permission to run extraction
- `PATTERN_CANDIDATE_CREATE` — permission to create candidates
- `PATTERN_CANDIDATE_REVIEW` — permission to view candidates
- `PATTERN_CANDIDATE_PROMOTE` — permission to promote candidates
- `PATTERN_CANDIDATE_REJECT` — permission to reject candidates
- `PATTERN_CANDIDATE_EXPORT` — permission to export candidates

Capability enforcement is prepared but not fully wired yet.

## Extraction Health

`getPatternExtractionHealth(workspaceId)` returns:

```ts
{
  runCount: number;
  candidateCount: number;
  promotedCount: number;
  rejectedCount: number;
  archivedCount: number;
  averageCandidatesPerRun: number;
}
```

## Export

`exportPatternCandidate(candidateId)` returns a self-contained JSON package:

```ts
{
  candidate,     // the candidate record
  rules,         // which rule produced it
  observations,  // the evidence that triggered the rule
  sources,       // source record IDs for auditor inspection
  lineage: { promotedPatternId }  // null until promoted
}
```

Export is JSON only. It contains no content copied from source documents.

## No AI Constitutional Guarantee

The following are prohibited by design:

- No LLM calls inside any extraction function
- No embeddings or vector operations
- No semantic similarity
- No autonomous candidate promotion
- No scoring or ranking beyond occurrence counts
- No text inference or NLP

An auditor can reconstruct every candidate from the rule registry and the raw data in the source tables, with no AI involved.
