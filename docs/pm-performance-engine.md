# PM Performance Engine

**Epic**: EPIC 6 — PMO Governance Intelligence  
**Sprint**: Sprint 2  
**Module**: `src/lib/pm-performance/`

---

## Overview

The PM Performance Engine transforms PM assignments into measurable, evidence-based performance intelligence. It aggregates data from Project OS Snapshots, Execution Realities, and Decision Outcomes to produce five domain scores combined into an overall weighted scorecard.

The engine does not punish PMs — it provides early detection and support signals.

---

## Architecture

```
pm_assignments
     │
     ▼
project_os_snapshots ──► governance_score
                     ──► execution_score
                     ──► portfolio_health_score
execution_realities  ──► prediction_accuracy_score
operational_decision_outcomes ──► decision_effectiveness_score
                                         │
                                         ▼
                              overall_score (weighted sum)
                                         │
                                         ▼
                              pm_performance_snapshots
                              pm_performance_metrics
                              pm_performance_evidence
```

### Layer Structure

| Layer | Path | Responsibility |
|-------|------|----------------|
| Types | `src/lib/pm-performance/types.ts` | All input/output types, constants |
| Engines | `src/lib/pm-performance/engines/` | Pure score-calculation functions |
| Registry | `src/lib/pm-performance/performance-registry.ts` | Snapshot persistence |
| Scorecard | `src/lib/pm-performance/scorecard.ts` | Human-readable scorecard |
| Comparison | `src/lib/pm-performance/comparison.ts` | Cross-PM comparison |
| Lineage | `src/lib/pm-performance/lineage.ts` | Evidence traceability |
| Explain | `src/lib/pm-performance/explain.ts` | Engine self-documentation |
| Index | `src/lib/pm-performance/index.ts` | Public surface |

---

## Performance Domains

### Governance Score (`engines/governance-score.ts`)

Measures how well the PM maintains project governance.

**Inputs**:
- `governanceHealthScores: number[]` — from `project_os_snapshots.governance_health_score`
- `openViolationCount: number` — open governance violations
- `pendingEscalationCount: number` — pending authority escalations

**Formula**:
```
avgHealth = mean(governanceHealthScores)
penalty   = min(openViolationCount × 3, 30) + min(pendingEscalationCount × 5, 20)
score     = clamp(round(avgHealth − penalty), 0, 100)
```

**Default**: 75 when no scores available.

---

### Execution Score (`engines/execution-score.ts`)

Measures how well the PM drives execution.

**Inputs**:
- `executionHealthScores: number[]` — from `project_os_snapshots.execution_health_score`
- `completedTasks: number`, `totalTasks: number`, `overdueTasks: number`

**Formula**:
```
avgHealth       = mean(executionHealthScores)
completionBonus = (completedTasks / totalTasks) × 10  [0 when totalTasks = 0]
overduePenalty  = min(overdueTasks × 2, 20)
score           = clamp(round(avgHealth + completionBonus − overduePenalty), 0, 100)
```

**Default**: 75 when no scores available.

---

### Prediction Accuracy Score (`engines/prediction-accuracy.ts`)

Measures the accuracy of the PM's execution projections.

**Inputs**:
- `confidenceScores: number[]` — from `execution_realities.confidence_score` (stored 0.0–1.0, multiplied × 100)

**Formula**:
```
avgConfidence = mean(confidenceScores × 100)
avgVariance   = variance across scores
variancePenalty = min(avgVariance × 10, 25)
score = clamp(round(avgConfidence − variancePenalty), 0, 100)
```

**Default**: 75 when no scores available.

---

### Decision Effectiveness Score (`engines/decision-effectiveness.ts`)

Measures the effectiveness of decisions in PM's assigned projects.

**Inputs**:
- `effectivenessScores: number[]` — from `operational_decision_outcomes.effectiveness_score`
- `outcomes: Array<{ outcomeStatus: string }>` — from `operational_decision_outcomes.outcome_status`

**Formula**:
```
avgEffectiveness = mean(effectivenessScores)   [default 75 when empty]
successCount     = count(outcomes where status = "successful")
failureCount     = count(outcomes where status = "failed")
total            = outcomes.length
successRate      = successCount / total   [0 when total = 0]
failureRate      = failureCount / total   [0 when total = 0]
score = clamp(round(avgEffectiveness + successRate×10 − failureRate×15), 0, 100)
```

**Default**: 75 when no scores and no outcomes.

---

### Portfolio Health Score (`engines/portfolio-health.ts`)

Measures the aggregate health of the PM's assigned project portfolio.

**Inputs**:
- `operatingHealthScores: number[]` — from `project_os_snapshots.operating_health_score`
- `criticalProjectCount: number` — projects with `operating_health_score < 45`

**Formula**:
```
avgHealth       = mean(operatingHealthScores)
criticalPenalty = min(criticalProjectCount × 10, 30)
score           = clamp(round(avgHealth − criticalPenalty), 0, 100)
```

**Default**: 75 when no scores available.

---

## Score Model

| Property | Value |
|----------|-------|
| Range | 0–100 |
| Default when no data | 75 |
| Rounding | Nearest integer |
| Clamping | All scores clamped to [0, 100] |

---

## Weighting Model

The overall score is a weighted sum of the five domain scores:

| Domain | Weight |
|--------|--------|
| Governance | 20% |
| Execution | 25% |
| Prediction | 15% |
| Decision | 20% |
| Portfolio | 20% |
| **Total** | **100%** |

**Formula**:
```
overall = round(
  governance × 0.20 +
  execution  × 0.25 +
  prediction × 0.15 +
  decision   × 0.20 +
  portfolio  × 0.20
)
```

**Example**: `{governance:87, execution:82, prediction:78, decision:91, portfolio:74}` → **83**

---

## Status Classification

| Score Range | Status |
|-------------|--------|
| 90–100 | `excellent` |
| 80–89 | `strong` |
| 65–79 | `stable` |
| 45–64 | `warning` |
| 0–44 | `critical` |

---

## Evidence Model

### Data Sources

| Source Table | Evidence Provided |
|---|---|
| `project_os_snapshots` | governance, execution, portfolio health |
| `execution_realities` | prediction accuracy |
| `operational_decision_outcomes` | decision effectiveness |
| `governance_violations` | governance penalty |
| `execution_tasks` | execution completion and overdue |

### Non-Punitive Design

The engine measures to support, not to punish. Scores below threshold trigger support recommendations, not automatic consequences. No PM score modifies projects, assignments, or activates automatic actions.

---

## Scorecard

`generatePMScorecard(input)` produces a structured `PMScorecard`:

```typescript
{
  pm:        { id, name, email },
  snapshot:  { id, generatedAt },
  scores: {
    governance, execution, prediction,
    decision, portfolio, overall
  },
  statuses: {
    governance, execution, prediction,
    decision, portfolio, overall
  },
  evidenceCounts: {
    osSnapshots, executionRealities,
    decisionOutcomes, governanceViolations, executionTasks
  },
  explanation: string,   // human-readable summary
  generatedAt: string
}
```

`explainPMScorecard(scorecard)` returns the same formatted explanation string.

---

## Lineage

`getPMPerformanceLineage(input)` reconstructs the full traceability chain:

```
PM → Assignments → Projects → Project OS Snapshots
                            → Execution Realities
                            → Decision Outcomes
                            → Performance Snapshot
```

Returns a `PMPerformanceLineage` object with all entities linked.

---

## Use Cases

1. Generate a PM performance snapshot on demand.
2. View a PM scorecard with domain scores and explanations.
3. List historical performance snapshots for a PM.
4. Compare two PMs by overall score.
5. Trace the full evidence chain behind a PM's score.
6. Identify PMs whose portfolio health is declining.
7. Detect PMs who need support before projects become critical.

---

## Business Rules

1. Every performance snapshot must originate from a registered PM.
2. Every score must be calculable from evidence.
3. Every score must be between 0 and 100.
4. Every score must have a status classification.
5. Every snapshot is historical and immutable after generation.
6. Workspace isolation is mandatory — no cross-workspace access.
7. PMs without active assignments cannot be evaluated.
8. Performance scores do not modify projects or assignments.
9. Performance scores do not activate automatic actions.
10. Every evaluation is explainable and traceable to assigned projects.

---

## Audit Events

All events use `eventCategory: "governance"`.

| Event Type | Trigger |
|---|---|
| `PM_PERFORMANCE_SNAPSHOT_GENERATED` | `generatePMPerformanceSnapshot()` |
| `PM_SCORECARD_GENERATED` | `generatePMScorecard()` |
| `PM_GOVERNANCE_SCORE_CALCULATED` | governance engine run |
| `PM_EXECUTION_SCORE_CALCULATED` | execution engine run |
| `PM_PREDICTION_ACCURACY_CALCULATED` | prediction engine run |
| `PM_DECISION_EFFECTIVENESS_CALCULATED` | decision engine run |
| `PM_PORTFOLIO_HEALTH_CALCULATED` | portfolio engine run |
| `PM_OVERALL_PERFORMANCE_CALCULATED` | overall engine run |
| `PM_PERFORMANCE_COMPARED` | `comparePMPerformance()` |
| `PM_PERFORMANCE_LINEAGE_GENERATED` | `getPMPerformanceLineage()` |

---

## Database Schema

Three tables added by migration `20260715000000_pm_performance_engine.sql`:

### `pm_performance_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces(id) |
| pm_id | uuid | FK project_managers(id) |
| governance_score | numeric(5,2) | 0–100 |
| execution_score | numeric(5,2) | 0–100 |
| prediction_accuracy_score | numeric(5,2) | 0–100 |
| decision_effectiveness_score | numeric(5,2) | 0–100 |
| portfolio_health_score | numeric(5,2) | 0–100 |
| overall_score | numeric(5,2) | 0–100 |
| performance_status | text | enum check |
| snapshot_payload | jsonb | full evidence payload |
| generated_at | timestamptz | immutable after insert |

### `pm_performance_metrics`

Per-domain metric breakdown per snapshot.

### `pm_performance_evidence`

Source entity links for audit traceability.

All tables have RLS: members can SELECT, workspace admins can INSERT/UPDATE/DELETE.

---

## Public API

```typescript
import {
  // Score engines (pure functions)
  calculatePMGovernanceScore,
  calculatePMExecutionScore,
  calculatePMPredictionAccuracy,
  calculatePMDecisionEffectiveness,
  calculatePMPortfolioHealth,
  calculatePMOverallPerformance,
  classifyPMPerformanceStatus,

  // Registry
  generatePMPerformanceSnapshot,
  getPMPerformanceSnapshot,
  listPMPerformanceSnapshots,

  // Scorecard
  generatePMScorecard,
  explainPMScorecard,

  // Comparison
  comparePMPerformance,

  // Lineage
  getPMPerformanceLineage,

  // Explain
  explainPMPerformanceEngine,
} from "@/lib/pm-performance";
```
