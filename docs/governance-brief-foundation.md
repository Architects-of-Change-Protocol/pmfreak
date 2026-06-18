# Governance Brief Foundation

## What a Governance Brief Is

A **Governance Brief** is a structured, explainable, exportable, and auditable view of a `ConstitutionalBrief`, reorganized for governance, authority, delegation, capability, trust, and constitutional oversight audiences. It surfaces already-organized constitutional knowledge through the lens of governance: who holds authority, what has been approved, what has been delegated, what capabilities exist, what trust relationships are present, and what policies apply.

A Governance Brief answers the question:
> "What does this constitutional brief reveal about authority, delegation, capability, trust, and policy — where did that information come from, and what remains unknown?"

## What a Governance Brief Is NOT

A Governance Brief is **not**:

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
- Trust scoring
- Trust rating generation

A Governance Brief may only summarize and organize constitutional knowledge that already exists inside a `ConstitutionalBrief`. It invents nothing. It infers nothing. It resolves nothing. It does not calculate trust scores. It does not generate trust ratings. It does not create authority hierarchies from incomplete information.

## Constitutional Intelligence Stack

```
Constitutional Intelligence
↓
Constitutional Context Engine
↓
Constitutional Context Package
↓
Constitutional Brief
├── Executive Brief
└── Governance Brief
```

The Governance Brief sits at the same level as the Executive Brief — both are derived from the `ConstitutionalBrief`. The Governance Brief is a deterministic, reproducible view focused on governance audiences. Every governance brief is reproducible from its source `ConstitutionalBrief`.

## Difference Between Constitutional Brief, Executive Brief, and Governance Brief

| | Constitutional Brief | Executive Brief | Governance Brief |
|---|---|---|---|
| **Source** | Derived from a ConstitutionalContextPackage | Derived from a ConstitutionalBrief | Derived from a ConstitutionalBrief |
| **Purpose** | Organize selected records into sections | Condense constitutional sections for executive audiences | Reorganize constitutional sections for governance audiences |
| **Audience** | Internal system consumers | Executives and decision makers | Governance, authority, delegation, capability, trust, oversight |
| **Key lens** | All constitutional knowledge areas | Key facts, domains, timeline highlights | Authority, approvals, delegations, capabilities, trust, policy |
| **Output** | Sections, evidence trace, timeline, contradictions | Executive summary, key facts, timeline highlights, evidence summary | Governance summary, authority/delegation/capability/trust/policy overviews |
| **Persistence** | Not persisted | Not persisted | Not persisted |
| **AI** | No | No | No |

## Governance Summary

`buildGovernanceSummary()` produces a count-based summary of governance-relevant records in the constitutional brief. It uses counts only — no conclusions, no recommendations, no predictions.

Example:
> "This governance brief contains 6 authority-related records, 4 capability records, 2 delegation relationships, 2 trust relationships and 2 explicit contradictions supported by 17 evidence references."

The counts are derived from:
- **Authority records**: `relevant_knowledge` + `relevant_memories` sections
- **Capability records**: `relevant_patterns` + `relevant_effectiveness` sections
- **Delegation relationships**: `bridge_relationships` section
- **Trust relationships**: `bridge_relationships` section (same source as delegation)
- **Evidence references**: `evidenceTrace` length
- **Contradictions**: `contradictions` length

## Authority Overview

`buildAuthorityOverview()` extracts authority and approval facts from constitutional brief sections. It only surfaces what is explicitly present. It does not:

- Generate authority hierarchies
- Infer missing authority
- Assume delegation chains
- Score authority relationships

Sources used:
- `relevant_knowledge` → authority context (authority chains, policy-linked knowledge)
- `relevant_memories` → approval history context (approval records, past decisions)

## Delegation Overview

`buildDelegationOverview()` surfaces delegation relationships only if explicitly present in the constitutional brief. It uses `bridge_relationships` as the source for delegation context (delegation lineage, delegation evidence, delegation relationships).

No delegation is inferred. No missing delegation is assumed.

## Capability Overview

`buildCapabilityOverview()` surfaces capability information only if explicitly present. It uses:

- `relevant_patterns` → capability grant and consumption patterns
- `relevant_effectiveness` → capability lineage and effectiveness records

No capability is inferred. No capability gaps are generated.

## Trust Overview

`buildTrustOverview()` surfaces trust relationships only if explicitly present. It uses `bridge_relationships` as the source for trust context.

It does **not**:
- Calculate trust scores
- Create trust ratings
- Infer trust
- Generate trust hierarchies

Trust records are presented as-is from the constitutional brief.

## Policy Overview

`buildPolicyOverview()` surfaces policy references only if explicitly present. It uses `relevant_knowledge` as the source for policy context (policy references, policy relationships, policy-linked evidence).

No policy conclusions are generated. No policy compliance is assessed.

## Timeline Highlights

Timeline highlights are reused from the constitutional brief and sorted chronologically. No events are invented. No chronology is inferred. Missing timeline entries are not fabricated.

## Evidence Summary

`buildGovernanceEvidenceSummary()` returns governance-specific record counts:

| Field | Description |
|---|---|
| `recordCount` | Total records across all constitutional brief sections |
| `evidenceCount` | Total evidence trace entries |
| `authorityCount` | Records from knowledge + memories sections |
| `capabilityCount` | Records from patterns + effectiveness sections |
| `delegationCount` | Records from bridge relationships section |
| `trustCount` | Records from bridge relationships section |
| `contradictionCount` | Number of contradictions in the constitutional brief |

## Contradictions

Contradictions are reused directly from the constitutional brief. The governance brief does not:

- Create new contradictions
- Resolve contradictions
- Judge which side of a contradiction is correct
- Assign contradiction severity

Contradictions are presented as-is. Not resolved. Not judged. Resolution is a human responsibility.

## Unknowns

Unknowns are reused directly from the constitutional brief. No inferred unknowns are created. Unknowns document what information is missing from the constitutional record.

## Why No Recommendations

Governance Briefs never generate recommendations. Recommendations require value judgements that are the domain of human decision makers. A governance brief organizes constitutional facts for the audience — it does not tell the audience what to do with those facts.

## Why No Trust Scoring

Trust scoring would require inference about the quality and nature of relationships beyond what the evidence explicitly states. Generating a score implies a level of certainty the system cannot provide. The governance brief surfaces trust relationships that exist in the constitutional record without assigning numerical values or ratings.

## Why No AI

The Governance Brief is a deterministic reorganization of existing constitutional knowledge. It requires no inference, no pattern matching, no semantic understanding, and no prediction. Every statement in the governance brief is directly traceable to a specific record in the source constitutional brief. AI would introduce non-determinism and opacity into what must be a fully auditable, explainable view.

## Audit Events

All governance brief operations emit platform audit events:

| Event | Description |
|---|---|
| `GOVERNANCE_BRIEF_GENERATED` | Emitted when a governance brief is built |
| `GOVERNANCE_BRIEF_EXPLAINED` | Emitted when a governance brief is explained |
| `GOVERNANCE_BRIEF_EXPORTED` | Emitted when a governance brief is exported |

All events use:
- `learningEligible: false` — governance briefs are not learning eligible
- `eventCategory: "governance"` — fixed for all brief operations
- `visibility: "workspace"` — workspace-scoped
- `rawReferenceTable: "governance_brief"` — identifies the governance brief layer
- `sensitivityLevel: "internal"`

## No Persistence

Governance Briefs are not persisted to the database. They are deterministic views generated on demand from a `ConstitutionalBrief`. The same constitutional brief always produces the same governance brief. No tables are required. No migrations are required.

## Export

`exportGovernanceBrief()` returns a JSON-serializable structure containing:

- `governanceBrief` — the full governance brief
- `sourceConstitutionalBrief` — the source constitutional brief
- `authorityFacts` — authority and approval facts
- `capabilityFacts` — capability facts
- `delegationFacts` — delegation facts
- `trustFacts` — trust facts
- `timelineHighlights` — chronological timeline entries
- `evidenceSummary` — governance evidence counts
- `contradictions` — reused from constitutional brief
- `unknowns` — reused from constitutional brief
- `exportedAt` — ISO timestamp
- `format: "json"` — JSON only, no PDF

## Explanation

`explainGovernanceBrief()` returns a governance brief explanation that answers:
> "Why does this governance brief contain these sections?"

Each section includes a `reason` that explains why it was included, based on record counts from the source constitutional brief.
