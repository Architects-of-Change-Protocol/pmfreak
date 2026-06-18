# Constitutional Context Engine Foundation

## What It Is

The Constitutional Context Engine selects relevant constitutional knowledge for a **specific operational context** — a decision, project, stakeholder, risk, milestone, task, escalation, meeting, outcome, or governance review.

It sits directly above the Constitutional Intelligence Layer and answers the question:

> "Given this specific context (e.g., decision `abc-123`), which constitutional knowledge records are explicitly related to it?"

The output is a **ConstitutionalContextPackage**: a complete, auditable, exportable collection of memories, patterns, effectiveness records, bridge relationships, contradictions, evidence, a timeline, and knowledge domains — all scoped to the requested context.

## What It Is Not

The Constitutional Context Engine is **not**:

- An AI system
- A machine learning model
- An embedding or vector search engine
- A semantic similarity engine
- A recommendation engine
- A scoring or ranking engine
- A prediction engine
- An autonomous reasoning system
- A profiling system

It performs only one operation: **deterministic constitutional context selection**.

## Supported Context Types

| Context Type | Description |
|---|---|
| `decision` | A recorded decision with outcomes and effectiveness |
| `project` | A project and its associated knowledge |
| `stakeholder` | A stakeholder and their interaction history |
| `risk` | A risk item with patterns and mitigations |
| `milestone` | A project milestone and its delivery history |
| `task` | An execution task and its context |
| `escalation` | An escalation event and its resolution knowledge |
| `meeting` | A meeting and associated decisions or outcomes |
| `outcome` | A recorded outcome and its evidence base |
| `governance-review` | A governance review and its constitutional basis |

## How Deterministic Selection Works

Selection uses **only**:

1. **Explicit IDs** — Records whose `id` exactly matches the requested `contextId` or a member of `relatedIds[]`
2. **Reference fields** — Records containing fields like `decision_id`, `project_id`, `risk_id`, `context_id`, `reference_id`, or `source_id` whose value matches the context ID
3. **Array reference fields** — Records containing arrays like `related_ids[]` or `source_ids[]` that include the context ID
4. **Bridge relationships** — Explicit bridge links between personal and organizational knowledge
5. **Workspace scope** — All records are scoped to `workspaceId`
6. **PM scope** — Personal records are additionally scoped to `pmUserId`

The engine never uses:

- Semantic similarity
- Text embeddings
- NLP analysis
- Fuzzy matching
- Cosine similarity
- Dot products
- Any probabilistic or learned model

Every selection decision is recorded in `selectionReasons[]`, which names the matched field and matched value for each selected record.

## Context Package Structure

```typescript
ConstitutionalContextPackage {
  workspaceId       // workspace scope
  pmUserId          // PM user scope
  contextType       // one of the 10 supported types
  contextId         // the specific context being queried
  generatedAt       // ISO 8601 timestamp
  memories          // organizational + personal memories referencing this context
  patterns          // organizational + personal patterns referencing this context
  effectivenessRecords  // decision + personal effectiveness referencing this context
  bridgeRelationships   // bridge links referencing this context
  contradictions    // contradictions already detected by the Intelligence Layer
  evidence          // all selected records combined
  timeline          // chronological ordering of all evidence
  knowledgeDomains  // knowledge domains represented
}
```

## Timeline Construction

The timeline is built from all selected records by reading their explicit timestamp fields:

- `created_at`
- `occurred_at`
- `recorded_at`
- `updated_at`

Records are sorted chronologically by timestamp (ascending). No timestamps are inferred. Records without a timestamp field are excluded from the timeline.

Each timeline entry includes:

- `timestamp` — ISO 8601
- `recordType` — type of the source record
- `recordId` — UUID of the source record
- `summary` — content from `memory_content`, `pattern_description`, `outcome_summary`, or `description` fields
- `source` — origin system or source type

## Contradictions

The Context Engine **does not detect new contradictions**. It only surfaces contradictions that were already detected by the Constitutional Intelligence Layer (via explicit `contradicts` bridge relationship types). A contradiction is included in the context package if either side of the contradiction (`sourceAId` or `sourceBId`) is part of the selected evidence for this context.

## Auditability

Every context package is fully auditable:

- `selectionReasons[]` — why each record was selected (which field, which value matched)
- `sourceRelationships[]` — explicit bridge relationships between records
- `lineage[]` — provenance chain for bridge-linked records
- Audit events emitted for every operation (generate, explain, export)

The `explainContextSelection()` function returns a full explanation without requiring you to re-build the package.

## Exportability

`exportContextPackage()` returns the complete package in **JSON format only**. No transformations. No compression. No filtering beyond what was already selected.

The export includes:

- The full `ConstitutionalContextPackage`
- `exportedAt` timestamp
- `format: "json"`

## Privacy Model

All context selection is scoped to two mandatory dimensions:

1. **Workspace scope** (`workspaceId`) — no records from other workspaces are ever included
2. **PM user scope** (`pmUserId`) — personal records (memories, patterns, effectiveness, bridges) are additionally filtered to the specific PM user

Both IDs are validated as UUIDs before any database access. Cross-PM isolation is enforced at the query level.

## Audit Events

Every engine operation emits a platform event with:

| Event | When |
|---|---|
| `CONTEXT_PACKAGE_GENERATED` | `buildConstitutionalContext()` completes |
| `CONTEXT_PACKAGE_EXPLAINED` | `explainContextSelection()` completes |
| `CONTEXT_PACKAGE_EXPORTED` | `exportContextPackage()` completes |

All events are emitted with:

- `learningEligible: false` — context packages are never used to train models
- `eventCategory: "governance"` — governance audit trail
- `visibility: "workspace"` — scoped to the workspace

## Health Metrics

`getContextEngineHealth()` returns:

- `contextCount` — number of context simulations run
- `averageRecordsPerContext` — average memories + patterns + effectiveness per context
- `averageEvidencePerContext` — average total evidence items per context
- `averageContradictionsPerContext` — average contradictions surfaced per context
- `coverageMetrics` — breakdown by context type and record category
