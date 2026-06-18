# Constitutional Brief Foundation

## What a Constitutional Brief Is

A **Constitutional Brief** is a structured, explainable, exportable, and auditable view of a `ConstitutionalContextPackage`. It organizes already-selected constitutional context into human-readable sections that can be inspected, traced, and exported as JSON.

A Constitutional Brief answers the question:
> "What do I know about this operational context, where did it come from, and what is missing?"

## What a Constitutional Brief Is NOT

A Constitutional Brief is **not**:

- AI
- Machine learning
- Embeddings
- Semantic search
- Vector search
- Prediction
- Recommendation generation
- Autonomous reasoning
- Autonomous decision making
- Scoring
- Ranking
- Prioritization

A brief may only organize knowledge that already exists in a `ConstitutionalContextPackage`. It invents nothing.

## How It Differs from the Constitutional Context Package

| | Constitutional Context Package | Constitutional Brief |
|---|---|---|
| **Purpose** | Select relevant records for an operational context | Organize selected records into a human-readable structure |
| **Source** | Queries constitutional knowledge stores | Derived from a ConstitutionalContextPackage |
| **Output** | Arrays of raw records, evidence, timeline, contradictions | Typed sections, summary, evidence trace, unknowns |
| **Auditability** | Traceable to explicit ID matches | Traceable to source context package + sections |
| **Persistence** | None (in-memory) | None (in-memory, deterministic view) |

## Constitutional Intelligence Stack

```
Constitutional Intelligence
↓
Constitutional Context Engine
↓
Constitutional Context Package
↓
Constitutional Brief
```

The brief is the final human-readable layer. Every brief is deterministically reproducible from its source `ConstitutionalContextPackage`.

## How Sections Are Built

Sections are built by `buildBriefSections(contextPackage)`. Each section corresponds to one content area of the context package:

| Section Type | Source | Created When |
|---|---|---|
| `context_summary` | All counts from the package | Always |
| `relevant_memories` | `contextPackage.memories` | Non-empty |
| `relevant_patterns` | `contextPackage.patterns` | Non-empty |
| `relevant_effectiveness` | `contextPackage.effectivenessRecords` | Non-empty |
| `bridge_relationships` | `contextPackage.bridgeRelationships` | Non-empty |
| `relevant_knowledge` | `contextPackage.knowledgeDomains` | Non-empty |
| `contradictions` | `contextPackage.contradictions` | Non-empty |
| `evidence_trace` | `contextPackage.evidence` | Non-empty |
| `timeline` | `contextPackage.timeline` | Non-empty |

Each section includes:
- `id`: Deterministic ID derived from `contextId` and `sectionType`
- `sectionType`: The section category
- `title`: Human-readable title
- `summary`: Count-based summary (no inferred conclusions)
- `records`: Raw records from the source package
- `evidence`: Evidence records (for context_summary)
- `lineage`: Bridge relationship lineage entries (for bridge_relationships)

## How Unknowns Work

Unknowns are created by `buildBriefUnknowns(contextPackage)` for each missing content area:

- No linked memories
- No linked patterns
- No relevant effectiveness records
- No explicit bridge relationships
- No contradictions found
- No evidence trace found

**Unknowns are constitutional transparency, not failures.** They document what is absent so the brief consumer can make informed decisions without inventing knowledge to fill gaps.

## How the Evidence Trace Works

The evidence trace is built by `buildEvidenceTrace(contextPackage)`. For each record in the context package, an evidence trace entry captures:

- `recordType`: The type of record (memory, pattern, effectiveness, bridge_relationship, evidence)
- `recordId`: The record's ID
- `source`: The data source field from the record
- `lineage`: Workspace-scoped lineage identifier
- `reasonIncluded`: A plain description of why this record is in the brief

The evidence trace enables full audit from brief back to source records.

## How Contradictions Are Handled

Contradictions are taken directly from `contextPackage.contradictions`. The brief:

- Includes all contradictions present in the context package
- Does **not** create new contradictions
- Does **not** resolve contradictions
- Does **not** judge which side is correct

Both sides of every contradiction are presented in full. Resolution is a human responsibility.

## Summary Rules

`buildBriefSummary(contextPackage)` produces a deterministic summary using counts only:

```
"This decision context contains 4 relevant memories, 2 patterns, 1 effectiveness record,
3 bridge relationships, and 1 explicit contradiction across governance and risk domains
(6 evidence records)."
```

Rules:
- Uses counts from `memories.length`, `patterns.length`, etc.
- Includes context type
- Includes knowledge domains by name
- Includes contradiction count
- Includes evidence count
- No natural language conclusions beyond available counts
- No scoring, ranking, or prediction

## Export Format

`exportConstitutionalBrief(brief)` returns a JSON-serializable `ConstitutionalBriefExport`:

```json
{
  "brief": { ... },
  "sourceContextPackage": { ... },
  "evidenceTrace": [ ... ],
  "timeline": [ ... ],
  "contradictions": [ ... ],
  "unknowns": [ ... ],
  "exportedAt": "2026-06-18T00:00:00.000Z",
  "format": "json"
}
```

No PDF. No UI. JSON only.

## Auditability

Every brief is auditable via:

1. **Sections** — each section traces to a specific field in the context package
2. **Evidence trace** — each record has `reasonIncluded` and `lineage`
3. **Unknowns** — explicitly documents what is missing
4. **Audit events** — three platform events emitted on generate, explain, and export, all with `learningEligible: false`
5. **Source context package** — included in full in the brief and in exports

## Why Briefs Are Not Persisted

A `ConstitutionalBrief` is a **deterministic view** of a `ConstitutionalContextPackage`. Given the same context package, the brief is always identical.

Persisting briefs would add a database table, migrations, RLS policies, and contract entries — for a value that can be reproduced on demand from the context package. This foundation establishes the brief as a pure service output (in-memory).

If persistence is introduced in a future iteration, it requires:
- A database migration
- RLS policies
- An entry in `DATABASE_CONTRACT_VERSION`

## Audit Events

All brief operations emit platform events with:

| Field | Value |
|---|---|
| `learningEligible` | `false` |
| `eventCategory` | `"governance"` |
| `visibility` | `"workspace"` |
| `rawReferenceTable` | `"constitutional_brief"` |
| `rawReferenceId` | `brief.id` |
| `correlationId` | Defaults to `brief.id` |
| `causationId` | Preserves context package correlation when provided |

Events emitted:

- `CONSTITUTIONAL_BRIEF_GENERATED` — on `buildConstitutionalBrief()`
- `CONSTITUTIONAL_BRIEF_EXPLAINED` — on `explainConstitutionalBrief()`
- `CONSTITUTIONAL_BRIEF_EXPORTED` — on `exportConstitutionalBrief()`
