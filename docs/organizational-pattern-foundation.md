# Organizational Pattern Formation Foundation

## What is a Pattern?

A pattern is a **repeatable operational behavior** that has been explicitly observed multiple times and recorded by a human actor with traceable evidence.

A pattern exists only when multiple evidence-backed events, decisions, outcomes, or memories show the same behavior repeatedly.

Every pattern must be:

- **Inspectable** — readable by any authorized workspace member
- **Explainable** — backed by explicit observations and source lineage
- **Auditable** — every lifecycle change emits a governance event
- **Exportable** — full JSON export including sources, observations, and lineage
- **Deletable** — unless validated (see immutability rule below)

## What a Pattern Is NOT

- A pattern is not an opinion.
- A pattern is not an AI inference.
- A pattern is not an embedding or vector similarity result.
- A pattern is not an autonomous discovery result.
- A pattern is not a prediction or recommendation.
- Patterns are never generated automatically.

> "A pattern is not an AI inference. A pattern exists only when multiple evidence-backed events, decisions, outcomes, or memories show the same behavior repeatedly."

## Pattern Lifecycle

```
candidate → validated
candidate → deprecated
candidate → archived
validated → deprecated   (only path out of validated)
deprecated → archived
```

A pattern begins as a `candidate`. It can only become `validated` once it has accumulated at least **3 observations** (the validation threshold). Once validated, it becomes immutable.

## Why Explicit Validation Exists

Patterns are not automatically promoted. A human actor must explicitly call `validatePattern()` after sufficient observations have accumulated. This ensures that:

1. No pattern reaches `validated` status without human review.
2. The observation threshold (minimum 3) is enforced as a constitutional rule.
3. Patterns reflect deliberate organizational knowledge, not algorithmic guesses.

## Why Validated Patterns Are Immutable

Once a pattern reaches `validated` status, it cannot be edited directly. This preserves constitutional auditability: the validated pattern record is a stable, trustworthy reference.

To change a validated pattern:

1. **Deprecate** the existing pattern using `deprecatePattern()`.
2. **Create** a new pattern with the corrected information.

This deprecate-then-recreate protocol ensures that the audit trail always shows why the old pattern was superseded and when.

The database enforces this at the trigger level:

```sql
-- Validated organizational patterns are immutable.
-- To change a validated pattern, deprecate it and create a new one.
```

## Pattern Categories

| Category | Description |
|---|---|
| `risk_pattern` | Repeating risk behaviors across projects or periods |
| `decision_pattern` | Recurring decision types or decision-making behaviors |
| `schedule_pattern` | Repeating schedule drift, delay, or acceleration patterns |
| `stakeholder_pattern` | Recurring stakeholder engagement or friction patterns |
| `delivery_pattern` | Repeating delivery behaviors (on-time, late, scope-cut) |
| `resource_pattern` | Resource allocation or contention patterns |
| `dependency_pattern` | Recurring dependency failures or resolutions |
| `governance_pattern` | Repeating governance or approval behaviors |
| `execution_pattern` | Task execution or operational flow patterns |
| `memory_pattern` | Patterns derived primarily from organizational memory |
| `other` | Patterns that don't fit a named category |

## Pattern Statuses

| Status | Meaning |
|---|---|
| `candidate` | Newly created; under observation; editable |
| `validated` | Meets observation threshold; immutable; authoritative |
| `deprecated` | Superseded by a newer pattern; preserved for audit |
| `archived` | No longer active; retained for historical reference |

## Observation Threshold

The default validation threshold is **3 observations**.

This constant is defined in `src/lib/organizational-patterns/types.ts`:

```typescript
export const PATTERN_VALIDATION_THRESHOLD = 3;
```

A pattern accumulates observations as humans explicitly record them using `recordObservation()`. The database trigger `organizational_pattern_observations_sync_count` keeps `observation_count` in sync automatically.

## Source Lineage

Every pattern must reference at least one source. Sources link the pattern to concrete evidence in the system.

Supported source types:

- `organizational_memory` — linked to an organizational memory entry
- `platform_event` — linked to a platform governance event
- `decision` — linked to a recorded decision
- `outcome` — linked to a decision outcome
- `risk` — linked to a risk or issue record
- `task` — linked to an execution task
- `milestone` — linked to a project milestone
- `dependency` — linked to a task dependency
- `stakeholder` — linked to a stakeholder record

## Capability Vocabulary

The following capabilities are defined for future runtime governance integration. Capability enforcement is prepared but not fully wired yet.

| Capability | Purpose |
|---|---|
| `PATTERN_CREATE` | Create a new pattern |
| `PATTERN_UPDATE` | Update a candidate pattern |
| `PATTERN_VALIDATE` | Promote a candidate to validated |
| `PATTERN_ARCHIVE` | Archive a pattern |
| `PATTERN_DEPRECATE` | Deprecate a pattern |
| `PATTERN_DELETE` | Delete a non-validated pattern |
| `PATTERN_EXPORT` | Export full pattern JSON |
| `PATTERN_INSPECT` | Inspect pattern lineage and observations |

## Audit Events

Every lifecycle action emits a platform governance event with `learningEligible: false`.

| Event | Trigger |
|---|---|
| `PATTERN_CREATED` | Pattern successfully created |
| `PATTERN_UPDATED` | Pattern fields updated |
| `PATTERN_VALIDATED` | Pattern promoted to validated status |
| `PATTERN_ARCHIVED` | Pattern archived |
| `PATTERN_DEPRECATED` | Pattern deprecated |
| `PATTERN_DELETED` | Pattern deleted |
| `PATTERN_OBSERVATION_RECORDED` | New observation recorded |

All events include `correlation_id`, `causation_id`, and reference `organizational_patterns` as the `raw_reference_table`.

## Relationship with Events, Decisions, Outcomes, and Memory

```
Platform Events
↓
Organizational Memory
↓
Organizational Patterns
```

Raw operational events are captured in the platform event log. Humans curate significant events into organizational memory entries. Patterns emerge when the same memory-level behavior is explicitly observed multiple times across different contexts.

Patterns can be sourced directly from platform events, memory entries, decisions, outcomes, risks, tasks, milestones, dependencies, or stakeholders — enabling full lineage reconstruction.

## Health Metrics

`getPatternHealth(workspaceId)` returns:

| Metric | Meaning |
|---|---|
| `candidateCount` | Patterns in candidate status |
| `validatedCount` | Validated, authoritative patterns |
| `deprecatedCount` | Deprecated patterns (audit record) |
| `archivedCount` | Archived patterns |
| `averageObservationCount` | Mean observations per pattern |
| `lineageCoverage` | Fraction of patterns with at least one source |

## Export Format

`exportPattern(patternId)` returns a complete JSON snapshot:

```json
{
  "pattern": { ... },
  "observations": [ ... ],
  "sources": [ ... ],
  "memories": [ ... ],
  "events": [ ... ],
  "decisions": [ ... ],
  "outcomes": [ ... ],
  "lineage": [ ... ]
}
```

## What Is Not Implemented

This foundation deliberately excludes:

- Machine learning or AI inference
- Embeddings or vector search
- Automatic pattern discovery or extraction
- Autonomous scoring or prediction
- Recommendation generation

Patterns are always explicitly created and observed by human actors.
