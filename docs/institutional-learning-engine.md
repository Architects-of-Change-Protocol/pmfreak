# Institutional Learning Engine — Constitutional Learning Engine

**EPIC 2 Sprint 3 — Sovereign Project Vault**

## Overview

The Institutional Learning Engine transforms anonymized Constitutional Digests into reusable, auditable Learning Patterns. These patterns capture recurring behaviors, risks, governance failures, and outcomes discovered across multiple projects — without retaining any client-identifiable information.

The engine operates as the fourth layer of the Constitutional Stack:

```
Artifact
  ↓
Memory Record
  ↓
Constitutional Digest
  ↓
Learning Pattern
```

---

## Sovereignty Rules

| Rule | Description |
|------|-------------|
| **Rule 1** | Learning Patterns never contain clients, persons, specific vendors, project IDs, emails, or URLs. |
| **Rule 2** | All learning must originate from published Digests — never from raw Memory Records. |
| **Rule 3** | No direct learning from Memory. The Digest boundary is mandatory. |
| **Rule 4** | Every pattern must be traceable to its contributing Digests, Memory Records, and Artifacts. |
| **Rule 5** | Every recommendation must be justifiable via the pattern's evidence chain. |

---

## Database Tables

### `constitutional_learning_patterns`

Stores discovered recurring patterns across multiple published Digests.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace scope |
| `pattern_type` | text | One of 7 learning categories |
| `pattern_key` | text | Canonical pattern identifier |
| `description` | text | Human-readable description |
| `confidence_score` | numeric(4,3) | 0.0–1.0 composite score |
| `occurrence_count` | integer | Number of digests where pattern was observed |
| `first_seen_at` | timestamptz | Earliest detection |
| `last_seen_at` | timestamptz | Most recent detection |

### `constitutional_learning_evidence`

Links each Learning Pattern to the Digest that contributed to it.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace scope |
| `learning_pattern_id` | uuid | FK to `constitutional_learning_patterns` |
| `digest_id` | uuid | FK to `constitutional_digests` |
| `contribution_weight` | numeric(4,3) | Weight reflecting the digest's confidence score |

### `constitutional_learning_recommendations`

Actionable recommendations derived from a Learning Pattern.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace scope |
| `learning_pattern_id` | uuid | FK to `constitutional_learning_patterns` |
| `recommendation` | text | Actionable recommendation text |
| `confidence_score` | numeric(4,3) | 0.0–1.0 |

---

## Learning Categories

```
decision_pattern    — recurring decision types (vendor_replacement, schedule_change, etc.)
risk_pattern        — recurring risk types (third_party_dependency, approval_delay, etc.)
governance_pattern  — recurring governance issues (authority_gap, late_escalation, etc.)
authority_pattern   — recurring authority-related patterns
amendment_pattern   — recurring amendment-related patterns
delivery_pattern    — recurring delivery method/structure patterns
outcome_pattern     — recurring project outcomes (delivery_delay, cost_overrun, etc.)
```

---

## Core Capabilities

### `aggregateDigestsForLearning(input)`

Reads all published Digests in a workspace and groups recurring pattern keys. For each pattern found:
1. Upserts the `constitutional_learning_patterns` row (creates or updates `occurrence_count`).
2. Records evidence links in `constitutional_learning_evidence`.
3. Calculates and stores a confidence score.
4. Emits `CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED` or `CONSTITUTIONAL_LEARNING_PATTERN_UPDATED`.

### `discoverLearningPatterns(workspaceId, actorId)`

Convenience wrapper around `aggregateDigestsForLearning` for the full workspace.

### `calculatePatternConfidence(patternId, workspaceId, actorId)`

Recalculates the confidence score for a specific pattern using:
- **Frequency (35%)**: ratio of pattern occurrences to total published digests
- **Coverage (30%)**: breadth, scaling with occurrence count
- **Consistency (20%)**: average contribution weight from evidence rows
- **Evidence Strength (15%)**: number of distinct co-occurring pattern types

Returns a `LearningConfidenceBreakdown` with all four dimensions and the composite `overall` score.

### `discoverCorrelationsForWorkspace(workspaceId, minFrequency?)`

Identifies patterns that co-occur in the same Digest. Uses Jaccard similarity to calculate confidence. Returns `PatternCorrelation[]` sorted descending by confidence.

**Example output:**
```
pattern:          third_party_dependency
observed_with:    delivery_delay
frequency:        71%
confidence:       0.84
```

### `generateRecommendations(input)`

Generates an actionable recommendation for a specific Learning Pattern. Persists it to `constitutional_learning_recommendations` and emits `CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED`.

**Example:**
```
pattern:        approval_delay
recommendation: Introduce early ratification checkpoints. Identify approval authorities
                before project kickoff and pre-schedule sign-off windows.
confidence:     0.79
```

### `getLearningLineage(input)`

Reconstructs the full provenance chain for a Learning Pattern:

```
Artifact  →  Memory Record  →  Digest  →  Learning Pattern
```

Reads: `constitutional_learning_evidence` → `constitutional_digests` → `constitutional_memory_records` → `constitutional_artifacts`.

Emits `CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED`.

### `explainInstitutionalLearning()`

Returns a self-describing `InstitutionalLearningExplanation` covering:
- Sovereignty Rules
- Digest → Learning flow
- Pattern types and categories
- Correlation model with example
- Confidence model dimensions
- Recommendation example
- Lineage chain
- All audit events

---

## Audit Events

| Event | Trigger |
|-------|---------|
| `CONSTITUTIONAL_LEARNING_PATTERN_CREATED` | `createLearningPattern()` — manual creation |
| `CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED` | `aggregateDigestsForLearning()` — new pattern found |
| `CONSTITUTIONAL_LEARNING_PATTERN_UPDATED` | `aggregateDigestsForLearning()` — existing pattern updated |
| `CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED` | `generateRecommendations()` |
| `CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED` | `calculatePatternConfidence()` |
| `CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED` | `getLearningLineage()` |

All events use `eventCategory: "governance"`, `learningEligible: true`, `sensitivityLevel: "internal"`, and `rawReferenceTable: "constitutional_learning_patterns"`.

---

## Workspace Isolation

- All three tables have Row Level Security enabled.
- RLS policies enforce `is_workspace_member(workspace_id)` for reads and writes.
- `constitutional_learning_evidence` and `constitutional_learning_recommendations` use composite foreign keys `(learning_pattern_id, workspace_id)` → `constitutional_learning_patterns(id, workspace_id)` to prevent cross-workspace joins.
- All service layer functions validate `workspaceId` as a UUID before any database access.
- Aggregation filters to `digest_status = 'published'` and `workspace_id = input.workspaceId`.

---

## Constraints

- No UI, dashboards, or visualizations.
- No external ML libraries.
- No LLM dependency — all pattern discovery is deterministic.
- Uses the existing `Result<T>` discriminated union pattern (`LearningResult<T>`).
- Uses the existing `createPlatformEvent()` audit framework.
- Maintains workspace isolation via RLS and composite FKs.
