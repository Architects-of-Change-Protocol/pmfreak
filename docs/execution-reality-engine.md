# Execution Reality Engine

**EPIC 3 — Sprint 5**

## Overview

The Execution Reality Engine transforms execution projections into verifiable observations of real execution. It closes the governance loop by enabling continuous comparison between what was expected and what actually occurred, feeding variance data back into the institutional learning system.

## Architecture

```
Signal
↓
Action
↓
Commitment
↓
Execution Projection
↓
Execution Reality
↓
Variance
↓
Learning
```

## Reality Model

A reality is always linked to a projection. It captures observed execution data and progresses through the following lifecycle:

| Status | Meaning |
|--------|---------|
| `observed` | Initial state — execution data recorded |
| `validated` | Observations confirmed — has at least one observation |
| `completed` | Execution fully closed |
| `archived` | Soft-archived — immutable, read-only |

**Key principle:** Reality never modifies the original projection. The projection is the historical record; reality is the observed outcome.

## Variance Model

Variances measure the percentage difference between projected and actual values across five dimensions:

| Type | Projected | Actual |
|------|-----------|--------|
| `effort` | `estimated_effort_hours` | `actual_effort_hours` |
| `duration` | `estimated_duration_days` | `actual_duration_days` |
| `risk` | `projected_risk` (ordinal) | `actual_risk` (ordinal) |
| `tasks` | task count from projection | `actual_task_count` |
| `participants` | participant count from projection | `actual_participant_count` |

Formula: `variance_percentage = ((actual - projected) / projected) * 100`

### Variance Severity Thresholds

| Range | Severity |
|-------|----------|
| 0–9.99% | `low` |
| 10–24.99% | `medium` |
| 25–49.99% | `high` |
| 50%+ | `critical` |

## Drift Model

Drift represents sustained, directional deviation from projection — not just a one-time difference. It is detected when actual values exceed projected values.

| Drift Type | Condition |
|-----------|-----------|
| `schedule` | `actual_duration_days > estimated_duration_days` |
| `effort` | `actual_effort_hours > estimated_effort_hours` |
| `resource` | `actual_participant_count > projected_participant_count` |
| `risk` | `actual_risk rank > projected_risk rank` |

### Drift Severity

| Overrun | Severity |
|---------|----------|
| ≤ 0% | `none` |
| < 15% | `emerging` |
| < 40% | `persistent` |
| ≥ 40% | `critical` |

## Accuracy Model

Projection accuracy measures how well the original projection predicted reality. Score range: 0–100.

```
score = (effort_accuracy × 0.40) + (duration_accuracy × 0.40) + (risk_bonus × 0.20)
```

Where:
- `effort_accuracy = max(0, 100 - |effort_variance_pct|)`
- `duration_accuracy = max(0, 100 - |duration_variance_pct|)`
- `risk_bonus = 100 if risk matched, else 50`

## Health Model

Execution health provides a single 0–100 score combining variance, drift, accuracy, and risk:

```
base_score   = 60 + (accuracy / 100 × 40)
health_score = base_score - variance_penalty - drift_penalty - risk_penalty
```

| Factor | Weight |
|--------|--------|
| Worst variance severity | 5/15/30/50 penalty |
| Drift count | 8 points each, max 30 |
| Risk level | 0/5/15/25 penalty |

## Observation Model

Observations are discrete evidence events recorded against a reality. Each observation has a `type`, `value`, `source`, and optional `observed_by` actor.

- Minimum 1 observation required before validation
- Observations increase `confidence_score` automatically
- Archived realities cannot receive new observations

## Learning Feedback Loop

The engine generates two feedback artifacts:

### Projection Feedback

Identifies the most significant variance dimension and recommends calibration of future projections:

```
projection:  GOV-PROJ-12
accuracy:    72
main_variance: effort
recommendation: Consider increase effort estimate by ~28% for similar commitments.
```

### Recommendation Reality Feedback

Measures whether the governance recommendation that triggered the commitment achieved its intended effect:

```
projection_id:   <id>
reality_id:      <id>
expected_effect: Execution aligns with projection within acceptable variance.
actual_effect:   Execution exceeded projection by ~43%.
effectiveness:   medium
```

## Reality Lineage

Every reality can reconstruct its full constitutional chain:

```
Artifact (constitutional knowledge origin)
↓ Memory (contextual retention)
↓ Digest (synthesized insight)
↓ Learning Pattern (behavioral model)
↓ Recommendation (prescribed intervention)
↓ Signal (governance signal)
↓ Action (governance action)
↓ Commitment (governance commitment)
↓ Execution Projection (structural plan)
↓ Execution Reality (observed outcome)
```

## Explain Capability

`explainReality()` produces a human-readable summary covering:

- **Observation**: what was actually executed (effort, duration, risk, tasks)
- **Variance**: largest deviation and its severity
- **Drift**: any detected drift types and severities
- **Accuracy**: projection accuracy score
- **Execution Health**: composite health score
- **Reality Confidence**: confidence in observation quality

## Use Cases

### 1. Close a Sprint

```typescript
// 1. Create reality from projection
const reality = await createExecutionReality({
  workspaceId,
  projectionId,
  realityTitle: "Sprint 5 Actual",
  actualEffortHours: 21,
  actualDurationDays: 4,
  actualRisk: "high",
  actualTaskCount: 7,
  actualParticipantCount: 3,
  actorId,
});

// 2. Record evidence
await recordExecutionObservation({
  workspaceId,
  realityId: reality.data.id,
  observationType: "effort",
  observationValue: "21h logged in Jira",
  observationSource: "jira",
  actorId,
});

// 3. Calculate variances
await calculateAndPersistVariances(reality.data.id, workspaceId, actorId);

// 4. Detect drifts
await detectAndPersistDrifts(reality.data.id, workspaceId, actorId);

// 5. Validate
await validateExecutionReality({ workspaceId, realityId: reality.data.id, actorId });

// 6. Complete
await completeExecutionReality({ workspaceId, realityId: reality.data.id, actorId });
```

### 2. Measure Projection Quality

```typescript
const accuracy = await getProjectionAccuracy(realityId, workspaceId, actorId);
// { score: 72, effortAccuracy: 62, durationAccuracy: 80, riskMatched: false }

const feedback = await getProjectionFeedback(realityId, workspaceId);
// { projectionId: '...', accuracy: 72, mainVariance: 'effort', recommendation: '...' }
```

### 3. Assess Execution Health

```typescript
const health = await getExecutionHealth(realityId, workspaceId, actorId);
// { score: 54, varianceSeverity: 'high', driftCount: 2, projectionAccuracy: 72, riskLevel: 'high' }
```

### 4. Explain a Reality

```typescript
const explanation = await explainReality(realityId, workspaceId);
// {
//   observation: "Observed 21h of effort over 4 days at high risk with 7 tasks.",
//   variance: "Largest variance: effort at +75.0% (high severity).",
//   drift: "2 drift(s) detected: schedule (persistent), effort (persistent).",
//   accuracy: 72,
//   executionHealth: 54,
//   realityConfidence: 0.58
// }
```

## Business Rules

| Rule | Description |
|------|-------------|
| 1 | Every reality must originate from a projection |
| 2 | Every reality must have observations before validation |
| 3 | Every variance must be calculable from projection + reality data |
| 4 | Every drift must be auditable |
| 5 | Workspace isolation is mandatory on all queries |
| 6 | No orphan realities — projection must exist |
| 7 | Reality never modifies the original projection |
| 8 | Every reality maintains full lineage |
| 9 | Every reality feeds the learning engine |
| 10 | Every reality contributes to future projection accuracy |

## Audit Events

| Event | Trigger |
|-------|---------|
| `EXECUTION_REALITY_CREATED` | Reality created from projection |
| `EXECUTION_OBSERVATION_RECORDED` | New observation added |
| `EXECUTION_REALITY_VALIDATED` | Reality validated |
| `EXECUTION_REALITY_COMPLETED` | Reality completed |
| `EXECUTION_REALITY_ARCHIVED` | Reality archived |
| `EXECUTION_VARIANCE_CALCULATED` | Variances computed and persisted |
| `EXECUTION_DRIFT_DETECTED` | One or more drifts detected |
| `EXECUTION_ACCURACY_CALCULATED` | Projection accuracy scored |
| `EXECUTION_HEALTH_CALCULATED` | Execution health scored |
| `EXECUTION_REALITY_LINEAGE_GENERATED` | Full chain reconstructed |

## Database Tables

| Table | Purpose |
|-------|---------|
| `execution_realities` | Core reality records |
| `execution_observations` | Evidence events |
| `execution_variances` | Computed variance data |
| `execution_drifts` | Detected drift records |

All tables enforce RLS via `is_workspace_member(workspace_id)`.
