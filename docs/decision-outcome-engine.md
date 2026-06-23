# Decision Outcome Engine

EPIC 4 — Sprint 5 — Project Operating System

## Overview

The Decision Outcome Engine closes the full decision intelligence cycle, evolving PMFreak from a system that recommends decisions into a system that measures, evaluates, and learns from their real-world results.

```
Focus
↓
Consequence
↓
Decision
↓
Outcome
↓
Effectiveness
↓
Learning Feedback
↓
Recommendation Evolution
```

## Architecture

### Layers

| Layer | Responsibility |
|---|---|
| `outcome-registry.ts` | Orchestration service — lifecycle, evaluation, events |
| `outcome-repository.ts` | Data access — all four outcome tables |
| `effectiveness-engine.ts` | Weighted composite effectiveness calculation (0–100) |
| `quality-engine.ts` | Maps effectiveness score to recommendation quality label |
| `variance-engine.ts` | Expected vs actual delta; terminal outcome classification |
| `learning-engine.ts` | Generates learning feedback records from outcome results |
| `evolution-engine.ts` | Synthesises evidence into recommendation evolution snapshot |
| `comparison-engine.ts` | Compares two outcomes; ranked by effectiveness |
| `evidence-engine.ts` | Validates that an outcome has sufficient evidence |
| `lineage-engine.ts` | Reconstructs full causal chain from Constitution to Outcome |
| `explain.ts` | Produces a complete human-readable explanation of an outcome |

### Data Model

Four tables store outcome data:

```
operational_decision_outcomes        — master record per decision
operational_outcome_observations     — observed metric readings
operational_outcome_effects          — before/after values per effect type
operational_learning_feedback        — generated learning records
```

All tables enforce workspace isolation via `is_workspace_member()` RLS.

## Outcome Model

### Lifecycle

```
pending → observed → evaluated → successful | partially_successful | unsuccessful
                                                              ↓
                                                          archived
```

| Status | Description |
|---|---|
| `pending` | Outcome created, no observations yet |
| `observed` | At least one observation recorded |
| `evaluated` | Effectiveness and quality calculated |
| `successful` | Effectiveness ≥ 90 |
| `partially_successful` | Effectiveness 70–89 |
| `unsuccessful` | Effectiveness < 70 |
| `archived` | Soft-archived; immutable |

### Key Fields

| Field | Type | Description |
|---|---|---|
| `expected_impact_score` | 0–100 | Predicted impact at decision time |
| `actual_impact_score` | 0–100 | Derived from observations |
| `effectiveness_score` | 0–100 | Weighted composite |
| `recommendation_quality` | enum | Quality label derived from effectiveness |
| `outcome_variance` | numeric | actual − expected (signed) |

## Effectiveness Model

Effectiveness is a weighted composite of five factors:

| Factor | Weight | Source |
|---|---|---|
| Expected impact achievement | 35% | `actual / expected` ratio |
| Health improvement | 20% | Avg of governance + execution effects |
| Risk reduction | 20% | Avg of risk_reduction effects |
| Execution improvement | 15% | execution_health observations |
| Governance improvement | 10% | governance_health observations |

Scale: 0 → 100

### Effectiveness Levels

| Score | Level |
|---|---|
| 81–100 | `excellent` |
| 61–80 | `high` |
| 41–60 | `medium` |
| 21–40 | `low` |
| 0–20 | `very_low` |

## Quality Model

Recommendation quality is derived directly from the effectiveness score:

| Score | Quality |
|---|---|
| 81–100 | `excellent` |
| 61–80 | `very_good` |
| 41–60 | `good` |
| 21–40 | `fair` |
| 0–20 | `poor` |

## Variance Model

```typescript
variance = actualImpactScore - expectedImpactScore
variancePercentage = (variance / expected) * 100
```

Positive variance = over-performed. Negative variance = under-performed.

## Learning Model

Learning feedback is generated automatically during `evaluateDecisionOutcome()`.

### Learning Types

| Type | Trigger |
|---|---|
| `decision_pattern` | Excellent or high effectiveness |
| `quality_signal` | Medium effectiveness |
| `effectiveness_signal` | Low or very_low effectiveness |
| `risk_insight` | Risk-related decisions |
| `governance_insight` | Governance-related decisions |
| `recommendation_calibration` | Quality mismatch signal |

### Learning Record

Each record captures:
- `learning_type` — classification of what was learned
- `learning_summary` — human-readable explanation
- `confidence_score` — 0–1, derived from effectiveness score
- `should_recommend_again` — boolean guidance for future recommendations

## Evolution Model

`updateRecommendationEffectiveness()` synthesises all learning records for a decision into an evolution snapshot:

```typescript
{
  decisionId,
  effectivenessScore,
  effectivenessLevel,
  recommendationQuality,
  shouldRecommendAgain,  // majority vote across learning records
  evidenceCount,
  updatedAt
}
```

This snapshot is the data structure that future recommendation engines consume to improve their guidance.

## Evidence Model

`validateOutcomeEvidence()` checks that an outcome has:

- At least 1 observation
- At least 1 effect
- At least 1 learning feedback record

| Validation Status | Meaning |
|---|---|
| `valid` | All three types present |
| `insufficient_observations` | No observations recorded |
| `insufficient_effects` | No effects recorded |
| `no_learning` | No learning generated |

## Lineage

`getDecisionOutcomeLineage()` reconstructs the full causal chain from Constitutional level down to the Outcome:

```
Constitution
↓ Memory
  ↓ Learning
    ↓ Recommendation
      ↓ Signal
        ↓ Action
          ↓ Commitment
            ↓ Projection
              ↓ Reality
                ↓ Snapshot
                  ↓ Focus Item
                    ↓ Consequence
                      ↓ Decision
                        ↓ Outcome
```

Each layer records entity type, entity ID (where applicable), label, and count.

## Audit Events

All operations emit typed platform events:

| Event | Trigger |
|---|---|
| `OPERATIONAL_DECISION_OUTCOME_CREATED` | `createDecisionOutcome()` |
| `OPERATIONAL_OUTCOME_OBSERVATION_RECORDED` | `recordOutcomeObservation()` |
| `OPERATIONAL_DECISION_OUTCOME_EVALUATED` | `evaluateDecisionOutcome()` |
| `OPERATIONAL_DECISION_OUTCOME_COMPLETED` | `completeDecisionOutcome()` |
| `OPERATIONAL_DECISION_OUTCOME_ARCHIVED` | `archiveDecisionOutcome()` |
| `OPERATIONAL_DECISION_EFFECTIVENESS_CALCULATED` | `evaluateDecisionOutcome()` |
| `OPERATIONAL_RECOMMENDATION_QUALITY_CALCULATED` | `evaluateDecisionOutcome()` |
| `OPERATIONAL_OUTCOME_LEARNING_GENERATED` | `evaluateDecisionOutcome()` |
| `OPERATIONAL_RECOMMENDATION_EVOLUTION_UPDATED` | `evaluateDecisionOutcome()` |
| `OPERATIONAL_DECISION_OUTCOME_LINEAGE_GENERATED` | `getDecisionOutcomeLineageService()` |

All events are `learning_eligible: true` and reference the outcome via `rawReferenceTable/rawReferenceId`.

## Use Cases

### Close the loop on a decision

```typescript
// 1. Create outcome for a completed decision
const outcome = await createDecisionOutcome({
  workspaceId,
  decisionId,
  expectedImpactScore: 90,
  actorId,
});

// 2. Record real-world observations
await recordOutcomeObservation({
  workspaceId,
  outcomeId: outcome.data.id,
  observationType: 'governance_health',
  observationValue: 82,
  observationSource: 'governance_dashboard',
  observedBy: actorId,
});

// 3. Evaluate — calculates effectiveness, quality, variance, generates learning
await evaluateDecisionOutcome({ workspaceId, outcomeId: outcome.data.id, actorId });

// 4. Complete — promotes to terminal status
await completeDecisionOutcome({ workspaceId, outcomeId: outcome.data.id, actorId });
```

### Get a full explanation

```typescript
const explanation = await explainDecisionOutcomes({ workspaceId, outcomeId });
// Returns: status, effectivenessScore, effectivenessLevel, quality, variance,
//          learning count, recommendation, and full lineage.
```

### Compare two decisions

```typescript
const comparison = await compareDecisionOutcomesService({
  workspaceId,
  outcomeIdA,
  outcomeIdB,
});
// Returns: winner, effectivenessDifference, ranked list
```

### Validate evidence

```typescript
const validation = await validateOutcomeEvidenceService({ workspaceId, outcomeId });
// Returns: isValid, validationStatus, missingRequirements
```

## Business Rules

1. Every outcome must originate from a decision in the same workspace.
2. Observations cannot be added to archived outcomes.
3. Evaluation requires `observed` or `pending` status.
4. Completion requires `evaluated` status.
5. Archive is soft only — no data deletion.
6. Outcomes never modify historical decisions or recommendations automatically.
7. All evaluation preserves evidence — records are append-only.
8. Every evaluation generates at least one learning feedback record.
9. Workspace isolation is enforced at both SQL (RLS) and service layer.
10. All audit events are emitted with `learning_eligible: true`.
