# Recommendation Effectiveness Engine

**EPIC 2 · Sprint 5 — Sovereign Project Vault**

## Overview

The Recommendation Effectiveness Engine closes the institutional learning loop by measuring whether recommendations actually produce better outcomes when applied. It transforms PMFreak from a system that recommends into a system that continuously learns from observed results, preserving sovereignty, traceability, and verifiable evidence.

```
Artifact
↓
Memory
↓
Digest
↓
Learning Pattern
↓
Recommendation
↓
Outcome
```

## Architecture

```
outcome-registry.ts          — recordRecommendationOutcome, calculateRecommendationEffectiveness,
                               adjustRecommendationConfidence, getRecommendationEffectiveness,
                               listRecommendationOutcomes, deprecateRecommendation
feedback-registry.ts         — submitRecommendationFeedback, listRecommendationFeedback
effectiveness-engine.ts      — calculateEffectivenessScore, computeOutcomeEffectivenessScore
adaptation-engine.ts         — adaptRecommendationConfidence
benchmark-engine.ts          — benchmarkRecommendations
ranking-engine.ts            — rankRecommendations
benchmark-registry.ts        — benchmarkRecommendationsForWorkspace, rankRecommendationsForWorkspace
effectiveness-explain-capability.ts — explainRecommendationEffectiveness
```

## Outcome Model

An outcome (`constitutional_recommendation_outcomes`) records an observed result after a recommendation application.

**Outcome Types:**

| Type | Description |
|------|-------------|
| `risk_reduction` | The risk associated with the context was reduced |
| `schedule_improvement` | Delivery timeline improved |
| `cost_reduction` | Cost was reduced |
| `quality_improvement` | Quality of output improved |
| `governance_improvement` | Governance processes improved |
| `delivery_improvement` | Delivery process improved |
| `authority_improvement` | Authority clarity improved |
| `ratification_improvement` | Ratification process improved |

**Outcome Statuses:**

| Status | Meaning |
|--------|---------|
| `successful` | Recommendation clearly produced positive result |
| `neutral` | No significant impact observed |
| `failed` | Recommendation did not produce expected result |
| `unknown` | Insufficient data to determine result |

**Business Rules:**
- Rule 1: Every measurement must originate from a real application.
- Rule 2: No orphan outcomes — `application_id` is required and verified.
- Rule 6: Outcomes are immutable after creation.

## Feedback Model

Feedback (`constitutional_recommendation_feedback`) captures explicit user assessment alongside objective outcome measurements.

**Feedback Types:** `positive`, `neutral`, `negative`  
**Rating Scale:** 1 (very poor) to 5 (excellent)

Feedback contributes 20% to the composite effectiveness score.

## Effectiveness Model

`calculateEffectivenessScore()` produces a composite 0.0–1.0 score:

| Component | Weight | Source |
|-----------|--------|--------|
| Success Rate | 40% | `successful_count / applications_count` |
| Outcome Quality | 30% | Average `effectiveness_score` from individual outcome rows |
| Feedback Rating | 20% | Average normalized user rating |
| Outcome Consistency | 10% | `(1 - failure_rate)` — penalizes high variance |

`computeOutcomeEffectivenessScore()` calculates the per-outcome `effectiveness_score`:
- Without values: maps status directly (successful=1.0, neutral=0.5, failed=0.0, unknown=0.3)
- With `observed_value` and `expected_value`: blends status (70%) with value ratio (30%)

## Adaptation Model

`adaptRecommendationConfidence()` adjusts a recommendation's `confidence_score` based on observed effectiveness. The adaptation scales with evidence volume (more applications = larger adjustment).

**Rules:**

| Rule | Condition | Effect |
|------|-----------|--------|
| Rule A (`high_effectiveness`) | effectiveness > 0.80 | Increase confidence toward observed effectiveness |
| Rule B (`low_effectiveness`) | effectiveness < 0.50 | Reduce confidence proportionally |
| Rule C (`medium_effectiveness`) | 0.50–0.80 | Minor nudge toward effectiveness |

**Example:**

```yaml
original_confidence: 0.78
observed_effectiveness: 0.88
new_confidence: 0.82
confidence_adjustment: +0.04
rule: high_effectiveness
```

**Constraints (Rules 7 and 8):** Adjusted confidence is always clamped to `[0.0, 1.0]`.

## Effectiveness Aggregation

`calculateRecommendationEffectiveness()` aggregates all outcomes and feedback for a recommendation into a single `constitutional_recommendation_effectiveness` row (upserted on each calculation).

```yaml
recommendation: Early Ratification
applications: 74
successful: 61
failed: 8
neutral: 5
effectiveness: 0.82
confidence_adjustment: +0.06
```

`adjustRecommendationConfidence()` then reads the effectiveness record and updates `constitutional_recommendations.confidence_score`.

## Benchmarking

`benchmarkRecommendationsForWorkspace()` compares all recommendations in a workspace by `average_effectiveness`, sorted descending.

```yaml
# Example output
- recommendation: Early Ratification
  effectiveness: 0.84
  applications: 127

- recommendation: Governance Review Board
  effectiveness: 0.63
  applications: 45
```

## Ranking

`rankRecommendationsForWorkspace()` produces an ordered list using a composite rank score:

| Dimension | Weight |
|-----------|--------|
| Effectiveness | 40% |
| Confidence | 30% |
| Usage (scaled) | 20% |
| Success Rate | 10% |

Usage scoring: 0–5 applications = 0.3, 6–20 = 0.6, 21–50 = 0.85, 51+ = 1.0.

## Recommendation Deprecation

A published recommendation can transition to `deprecated` when its observed effectiveness falls below a threshold (default: 0.30). This is a lifecycle extension — the record is preserved for audit purposes.

```
published → deprecated
```

Conditions:
- Status must be `published`
- `average_effectiveness < threshold`
- Emits `CONSTITUTIONAL_RECOMMENDATION_DEPRECATED` audit event

## Lineage (Extended)

`getRecommendationLineage()` reconstructs the complete provenance chain. Sprint 5 extends the conceptual chain to include observed outcomes:

```
Artifact              — original document registered in the Constitutional Vault
↓
Memory Record         — structured knowledge extracted from the Artifact
↓
Digest                — anonymized, pattern-bearing record
↓
Learning Pattern      — aggregated insight across published Digests
↓
Recommendation        — actionable guidance derived from the Learning Pattern
↓
Outcome               — observed result after applying the Recommendation
```

## Audit Events

| Event | Trigger |
|-------|---------|
| `CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED` | An outcome was recorded for an application |
| `CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED` | User feedback was submitted |
| `CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED` | Effectiveness was aggregated |
| `CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED` | Confidence was adapted using effectiveness |
| `CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED` | Workspace-level benchmark was produced |
| `CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED` | Ranked list was generated |
| `CONSTITUTIONAL_RECOMMENDATION_DEPRECATED` | Recommendation was deprecated due to low effectiveness |

All events use:
- `eventCategory: "governance"`
- `learningEligible: true`
- `visibility: "workspace"`
- `sensitivityLevel: "internal"`

## Business Rules

| Rule | Description |
|------|-------------|
| Rule 1 | Every measurement must originate from a real application |
| Rule 2 | No orphan outcomes — `application_id` is required and verified |
| Rule 3 | Every adaptation must be auditable |
| Rule 4 | Every recommendation must maintain history |
| Rule 5 | Workspace isolation is mandatory |
| Rule 6 | Outcomes cannot be modified retroactively |
| Rule 7 | Adjusted confidence never exceeds 1.0 |
| Rule 8 | Adjusted confidence never falls below 0.0 |

## Use Cases

### 1. Record an outcome after applying a recommendation

```typescript
const result = await recordRecommendationOutcome({
  workspaceId,
  actorId,
  recommendationId,
  applicationId,
  outcomeType: "risk_reduction",
  outcomeStatus: "successful",
  observedValue: 0.85,
  expectedValue: 1.0,
});
```

### 2. Submit user feedback

```typescript
const result = await submitRecommendationFeedback({
  workspaceId,
  actorId,
  recommendationId,
  applicationId,
  feedbackType: "positive",
  rating: 4,
  comments: "Risk was significantly reduced after applying this recommendation.",
});
```

### 3. Calculate and aggregate effectiveness

```typescript
const effectiveness = await calculateRecommendationEffectiveness({
  workspaceId,
  actorId,
  recommendationId,
});
// → { applicationsCount: 74, successfulCount: 61, averageEffectiveness: 0.82 }
```

### 4. Adapt confidence based on observed results

```typescript
const updated = await adjustRecommendationConfidence(workspaceId, actorId, recommendationId);
// → recommendation.confidence_score updated using adaptation rules
```

### 5. Benchmark all recommendations in a workspace

```typescript
const benchmark = await benchmarkRecommendationsForWorkspace(workspaceId, actorId);
// → sorted list by average_effectiveness descending
```

### 6. Get ranked recommendations for decision support

```typescript
const ranking = await rankRecommendationsForWorkspace(workspaceId, actorId);
// → ranked list: rank 1 is the most valuable recommendation to apply
```

### 7. Deprecate an ineffective recommendation

```typescript
const deprecated = await deprecateRecommendation(workspaceId, actorId, recommendationId, 0.30);
// → recommendation.status set to 'deprecated'
```

### 8. Understand the engine's capabilities

```typescript
const explanation = explainRecommendationEffectiveness();
// → complete self-describing documentation of the effectiveness engine
```

## Database Schema

### `constitutional_recommendation_outcomes`

| Column | Type | Constraint |
|--------|------|-----------|
| `id` | uuid | PK |
| `workspace_id` | uuid | FK workspaces |
| `recommendation_id` | uuid | FK recommendations |
| `application_id` | uuid | FK applications (not null — Rule 2) |
| `outcome_type` | text | enum-constrained |
| `outcome_status` | text | enum-constrained |
| `observed_value` | numeric(6,3) | nullable |
| `expected_value` | numeric(6,3) | nullable |
| `effectiveness_score` | numeric(4,3) | 0.0–1.0 |
| `observed_at` | timestamptz | |
| `created_at` | timestamptz | |

### `constitutional_recommendation_feedback`

| Column | Type | Constraint |
|--------|------|-----------|
| `id` | uuid | PK |
| `workspace_id` | uuid | FK workspaces |
| `recommendation_id` | uuid | FK recommendations |
| `application_id` | uuid | FK applications |
| `feedback_type` | text | positive/neutral/negative |
| `rating` | integer | 1–5 |
| `comments` | text | nullable |
| `submitted_by` | uuid | actorId |
| `created_at` | timestamptz | |

### `constitutional_recommendation_effectiveness`

| Column | Type | Constraint |
|--------|------|-----------|
| `id` | uuid | PK |
| `workspace_id` | uuid | FK workspaces |
| `recommendation_id` | uuid | FK recommendations |
| `applications_count` | integer | ≥ 0 |
| `successful_count` | integer | ≥ 0 |
| `failed_count` | integer | ≥ 0 |
| `neutral_count` | integer | ≥ 0 |
| `average_effectiveness` | numeric(4,3) | 0.0–1.0 |
| `confidence_adjustment` | numeric(4,3) | -1.0–1.0 |
| `last_calculated_at` | timestamptz | |

Unique: `(workspace_id, recommendation_id)` — one record per recommendation.

## Workspace Isolation

All tables enforce:
- `workspace_id` column with `references workspaces(id) on delete cascade`
- Row Level Security with `is_workspace_member()` policies
- Composite FK constraints linking `(recommendation_id, workspace_id)` and `(application_id, workspace_id)`
- UUID validation on `workspaceId` at the application layer
