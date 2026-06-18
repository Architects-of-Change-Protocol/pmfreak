# Executive Brief Foundation

## What an Executive Brief Is

An **Executive Brief** is a structured, explainable, exportable, and auditable view of a `ConstitutionalBrief`, reorganized for executive consumption. It condenses and organizes already-organized constitutional knowledge into sections suitable for decision makers who need a concise, traceable summary of constitutional context.

An Executive Brief answers the question:
> "What are the key facts from this constitutional brief, where did they come from, and what remains unknown?"

## What an Executive Brief Is NOT

An Executive Brief is **not**:

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

An Executive Brief may only summarize and organize constitutional knowledge that already exists inside a `ConstitutionalBrief`. It invents nothing. It infers nothing. It resolves nothing.

## Constitutional Intelligence Stack

```
Constitutional Intelligence
↓
Constitutional Context Engine
↓
Constitutional Context Package
↓
Constitutional Brief
↓
Executive Brief
```

The Executive Brief is the final layer in the constitutional intelligence stack. Every executive brief is deterministically reproducible from its source `ConstitutionalBrief`.

## Difference Between Constitutional Brief and Executive Brief

| | Constitutional Brief | Executive Brief |
|---|---|---|
| **Source** | Derived from a ConstitutionalContextPackage | Derived from a ConstitutionalBrief |
| **Purpose** | Organize selected records into sections | Condense constitutional sections for executive audiences |
| **Sections** | 10 section types (memories, patterns, effectiveness, bridge, etc.) | 7 section types (executive summary, key facts, domains, contradictions, timeline, evidence, unknowns) |
| **Summary** | Count-based summary of context package content | Count-based summary of constitutional brief content |
| **Key Facts** | Not present | Condensed facts per content area |
| **Timeline** | Chronological events from context package | Sorted highlights from constitutional brief |
| **Comparison** | Wider, more detailed | Narrower, more condensed |
| **Persistence** | None (in-memory) | None (in-memory, deterministic view) |

## How Executive Summaries Are Built

Executive summaries are built by `buildExecutiveSummary(brief)`. The function uses **counts only** from the source `ConstitutionalBrief`:

- Total record count (sum of all section records)
- Section count
- Knowledge domain names
- Evidence reference count
- Contradiction count

Example output:
> "This executive brief contains 12 constitutional records across 5 sections, governance, execution, stakeholder domains, supported by 24 evidence references and 2 explicit contradictions."

No natural language conclusions are added beyond available counts.

## How Key Facts Are Built

Key facts are built by `buildKeyFacts(brief)`. Each fact maps to one content area in the source `ConstitutionalBrief`:

| Fact Type | Source | Created When |
|---|---|---|
| `memory` | `relevant_memories` section | Non-empty |
| `pattern` | `relevant_patterns` section | Non-empty |
| `effectiveness` | `relevant_effectiveness` section | Non-empty |
| `bridge` | `bridge_relationships` section | Non-empty |
| `contradiction` | `contradictions` section | Non-empty |
| `timeline` | `timeline` section | Non-empty |
| `domain` | `knowledgeDomains` | Non-empty |

Each fact includes:
- `id`: Deterministic ID
- `factType`: Content area type
- `summary`: Count-based summary
- `sourceCount`: Number of source records
- `evidenceCount`: Number of supporting evidence records
- `lineage`: Bridge relationship lineage (for bridge facts)

## How Evidence Summaries Work

Evidence summaries are built by `buildEvidenceSummary(brief)`. The function returns:

- `recordCount`: Total records across all sections
- `evidenceCount`: Total evidence trace entries from the constitutional brief
- `domainCoverage`: List of knowledge domains
- `contradictionCount`: Total contradictions

No records are filtered, scored, or ranked. The summary is a direct count reflection of the source brief.

## How Contradictions Are Handled

Contradictions are **reused directly** from the `ConstitutionalBrief`. Executive Briefs do not:

- Create new contradictions
- Resolve existing contradictions
- Judge which side is correct
- Filter contradictions by relevance

All contradictions are included as-is. The `contradictions` section states explicitly: "Not resolved. Not judged."

## How Timeline Highlights Work

Timeline highlights are built by `buildTimelineHighlights(brief)`. The function:

1. Takes `brief.timeline` directly (no new events invented)
2. Sorts chronologically by timestamp
3. Preserves all fields: `timestamp`, `recordType`, `recordId`, `summary`, `source`

No events are inferred. No gaps are filled. No chronology is invented.

## How Unknowns Are Handled

Unknowns are **reused directly** from the `ConstitutionalBrief`. Executive Briefs do not:

- Create new unknowns
- Infer missing knowledge
- Attempt to fill gaps

Unknowns are constitutional transparency. They document what is missing from the constitutional knowledge base, not failures.

## Why There Are No Recommendations

Executive Briefs exist to organize and summarize existing constitutional knowledge, not to make recommendations. Recommendations would require:

- Inference beyond available data
- Value judgments about what is important
- Prediction of future outcomes
- Autonomous reasoning about PM decisions

None of these are constitutional operations. Recommendations belong in the `recommended-actions` layer, which requires explicit human approval.

## Why There Is No Scoring

Scoring would imply that some constitutional knowledge is more important than other constitutional knowledge. Executive Briefs treat all constitutional knowledge equally — each fact is included because it exists in the source brief, not because it was scored or ranked.

Scoring is a form of autonomous prioritization and is explicitly excluded from all constitutional layers.

## Why There Is No AI

Constitutional intelligence layers operate on explicit record relationships, counts, and structural mappings. AI would introduce:

- Non-determinism (same input may produce different outputs)
- Inference beyond available data
- Invented conclusions
- Non-traceable reasoning

Executive Briefs must be deterministic — the same `ConstitutionalBrief` always produces the same `ExecutiveBrief`.

## Persistence

Executive Briefs are **not persisted**. They are deterministic, in-memory views of a `ConstitutionalBrief`. There are no database tables for executive briefs, no migrations, and no row-level storage.

If a caller needs to store an executive brief, they should use `exportExecutiveBrief()` to get a JSON structure and store it in their own infrastructure.

## Sections

Executive Briefs contain up to 7 sections:

| Section Type | Source | Created When |
|---|---|---|
| `executive_summary` | Count-based summary of constitutional brief | Always |
| `key_facts` | One fact per non-empty content area | At least one content area present |
| `knowledge_domains` | `brief.knowledgeDomains` | Non-empty |
| `contradictions` | `brief.contradictions` | Non-empty |
| `timeline_highlights` | `brief.timeline` (sorted) | Non-empty |
| `evidence_summary` | Counts from all sections | Always |
| `unknowns` | `brief.unknowns` | Non-empty |

## Audit Events

All executive brief operations emit governance audit events:

| Event | Emitted By | Payload |
|---|---|---|
| `EXECUTIVE_BRIEF_GENERATED` | `buildExecutiveBrief()` | pmUserId, contextType, contextId, sectionCount, factCount, timelineCount, contradictionCount, unknownCount, sourceConstitutionalBriefId |
| `EXECUTIVE_BRIEF_EXPLAINED` | `explainExecutiveBrief()` | pmUserId, contextType, contextId, sectionCount, sourceConstitutionalBriefId |
| `EXECUTIVE_BRIEF_EXPORTED` | `exportExecutiveBrief()` | pmUserId, contextType, contextId, sectionCount, factCount, timelineCount, contradictionCount, unknownCount, sourceConstitutionalBriefId, exportedAt |

All events use:
- `learningEligible: false`
- `eventCategory: "governance"`
- `visibility: "workspace"`
- `rawReferenceTable: "executive_brief"`
