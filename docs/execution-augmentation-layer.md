# Execution Augmentation Layer

## What Augmentation Is

Execution Augmentation is a deterministic, traceable layer that surfaces
constitutional knowledge at the moment operational execution artifacts are
viewed or created.

When a PM opens a task, risk, decision, milestone, blocker, escalation,
dependency, stakeholder record, project, or portfolio view — the Execution
Augmentation Layer injects relevant evidence, memories, patterns,
effectiveness records, briefs, and dashboards that are **explicitly linked**
to that artifact.

Augmentation answers: *what constitutional knowledge is already on record
about this artifact?*

## What Augmentation Is Not

Augmentation is **not**:

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
- Invention of relationships

Augmentation never invents knowledge. Augmentation never infers missing
facts. Augmentation never creates recommendations. Augmentation never
chooses actions.

## Supported Artifact Types

| Artifact Type  | Description                                          |
|---------------|------------------------------------------------------|
| `task`        | Operational execution task                           |
| `decision`    | Governance decision record                           |
| `milestone`   | Project milestone marker                             |
| `dependency`  | Cross-team or cross-project dependency               |
| `risk`        | Identified risk record                               |
| `blocker`     | Active blocker on execution path                     |
| `escalation`  | Governance escalation artifact                       |
| `stakeholder` | Named stakeholder in workspace                       |
| `project`     | Project-level constitutional view                    |
| `portfolio`   | Portfolio-level cross-project constitutional view    |

## ReasonIncluded Model

Every `AugmentationArtifact` carries a `reasonIncluded` field. This field
must be explicit and traceable. It is never vague.

### Valid reasonIncluded values

- `"Linked by evidence"` — artifact was found in the evidence set passed to the builder
- `"Linked by decision lineage"` — artifact appears in decision lineage or governance brief
- `"Linked by constitutional memory"` — artifact was found in the memory set passed to the builder
- `"Linked by pattern source"` — artifact was found in the pattern set passed to the builder
- `"Linked by effectiveness lineage"` — artifact was found in the effectiveness set passed to the builder
- `"Linked by constitutional brief"` — artifact was found in the briefs set passed to the builder
- `"Linked by workspace lineage"` — artifact was found in the dashboards set or workspace lineage

### Invalid reasonIncluded values

These are **never** acceptable:

- `"Probably related"`
- `"Likely relevant"`
- `"May be useful"`
- Any inferred or probabilistic language

## Lineage

Every `ExecutionAugmentation` carries a `lineage` array. Lineage entries
record:

- `recordType` — the kind of artifact (e.g. `"evidence"`, `"pattern"`)
- `recordId` — the unique ID of the artifact
- `relationship` — how it relates (e.g. `"augmentation_member"`, `"workspace_member"`)
- `resolvedAt` — ISO timestamp of resolution

Lineage is built exclusively from records that were explicitly passed to the
augmentation builder. No relationships are inferred.

## Evidence Traceability

Every artifact in an augmentation must be traceable to one of these
constitutional sources:

- Evidence records
- Memory records (organizational or personal)
- Pattern records (organizational or personal)
- Effectiveness records (decision or personal)
- Context Packages
- Briefs (constitutional, executive, governance, operational, portfolio)
- Dashboards
- Workspace Lineage

If a record cannot be traced to one of these sources, it must not appear in
an augmentation.

## Contradictions

Contradictions are **reused** from the `AvailableArtifacts.contradictions`
input. Augmentation does not create contradictions. Augmentation does not
resolve contradictions. Contradictions are surfaced as-is for constitutional
transparency.

A contradiction records that two constitutional sources (A and B) are in
conflict. No judgment is made about which is correct.

## Unknowns

Unknowns are **reused** from the `AvailableArtifacts.unknowns` input.
Augmentation does not infer unknowns. Unknowns document what is missing from
the constitutional record — they are a form of transparency, not a gap to be
filled by AI.

## Auditability

Every augmentation operation emits a governance audit event to the platform
events log:

| Operation                     | Event Type                          |
|-------------------------------|-------------------------------------|
| Augmentation generated        | `EXECUTION_AUGMENTATION_GENERATED`  |
| Augmentation explained        | `EXECUTION_AUGMENTATION_EXPLAINED`  |
| Augmentation exported         | `EXECUTION_AUGMENTATION_EXPORTED`   |

All events carry:

- `learningEligible: false` — augmentation output must never train models
- `eventCategory: "governance"` — these are governance-class events
- `visibility: "workspace"` — scoped to workspace membership
- `rawReferenceTable: "execution_augmentation"` — traceable to this layer
- `rawReferenceId: augmentation.id` — traceable to this augmentation

## Why No AI

Constitutional knowledge is explicit. It was recorded by PMs, extracted from
real events, and constitutionally validated. There is no need for a model to
guess what is relevant — the explicit links are the answer.

AI introduces hallucination risk: a model may surface knowledge that does not
exist, or surface incorrect relationships. Execution Augmentation eliminates
this risk by working only with records that are explicitly passed to the
builder.

## Why No Recommendations

Recommendations require judgment about what to do next. Augmentation's role
is to surface what is already known — not to direct action. The PM retains
full decision authority. Injecting recommendations would reduce constitutional
accountability and introduce AI-shaped bias into execution.

## Why No Scoring

Scores require models, weights, and assumptions. Constitutional context does
not have a score — it has explicit relationships. A risk pattern linked by
explicit evidence is present, full stop. It is not "more relevant" than a
memory linked by explicit memory. Both are surfaced. The PM reads both.

## Persistence

Augmentations are **not persisted**. They are deterministic views generated
on demand from constitutional artifacts. The underlying constitutional
artifacts (evidence, memory, patterns, effectiveness, briefs, dashboards) are
persisted. The augmentation itself is ephemeral.

This is intentional: if the underlying constitutional record changes, the
next augmentation automatically reflects the updated state.

## Layer Diagram

```
Evidence
  ↓
Memory
  ↓
Patterns
  ↓
Effectiveness
  ↓
Context
  ↓
Briefs
  ↓
Dashboards
  ↓
Workspace
  ↓
Execution Augmentation
```

The Execution Augmentation Layer sits directly above the Constitutional
Workspace Foundation. It consumes constitutional artifacts from every layer
above and injects them deterministically into operational execution views.
