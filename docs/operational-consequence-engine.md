# Operational Consequence Engine

**EPIC 4 — Sprint 3**

Transforms Focus Items into structured consequence analyses. Answers: *what happens if we don't act?*

---

## Architecture

```
Attention Item
↓
Focus Item
↓
Consequence Analysis
↓
Impact Projection
↓
Decision Support
```

The Consequence Engine is a read-mostly analysis layer. It reads Focus Items and related operational context, computes consequence projections, and persists structured analyses. It **never modifies** source entities.

---

## Consequence Model

An `OperationalConsequence` is generated from a single Focus Item. It captures:

| Field | Description |
|---|---|
| `focus_item_id` | Source Focus Item |
| `severity` | Computed severity: `low`, `medium`, `high`, `critical`, `systemic` |
| `impact_horizon` | Time window before consequences materialise: `24h`, `48h`, `7d`, `14d`, `30d`, `90d` |
| `escalation_probability` | 0.0–1.0 probability of further escalation |
| `impact_score` | 0–100 composite impact score |
| `analysis_status` | Lifecycle: `generated`, `validated`, `archived` |

---

## Impact Model

`OperationalConsequenceImpacts` record the specific downstream effects:

| Field | Description |
|---|---|
| `impact_type` | One of: `governance`, `execution`, `authority`, `ratification`, `commitment`, `projection`, `reality`, `recommendation`, `risk`, `health` |
| `affected_entity_type` | Table name of affected entity |
| `affected_entity_count` | Count of affected entities |
| `impact_score` | Severity of this specific impact |
| `description` | Human-readable explanation |

---

## Cascade Model

`OperationalConsequencePaths` record the cascade chain step by step:

| Field | Description |
|---|---|
| `source_entity_type` | Upstream entity |
| `source_entity_id` | Upstream entity UUID |
| `target_entity_type` | Downstream entity |
| `target_entity_id` | Downstream entity UUID |
| `relationship_type` | Type of cascade (e.g. `cascade_effect`) |
| `cascade_depth` | Step depth in the chain (0 = root) |

### Authority Gap Cascade Example

```
Authority Gap (depth 0)
↓
Ratification Blocked (depth 1)
↓
Commitments Delayed (depth 2)
↓
Execution Drift (depth 3)
↓
Health Reduction (depth 4)
```

---

## Escalation Model

Escalation probability is computed by `calculateEscalationProbability()`:

```
P = base_severity + dependency_density_weight + open_commitments_weight
    + active_violations_weight + historical_escalation_rate_weight
```

Capped to [0.0, 1.0] with 3 decimal precision.

| Severity | Base probability |
|---|---|
| systemic | 0.40 |
| critical | 0.30 |
| high | 0.20 |
| medium | 0.12 |
| low | 0.05 |

---

## Scenario Model

Three scenarios are always generated per consequence:

| Scenario | Probability |
|---|---|
| `best_case` | 0.20 |
| `expected_case` | 0.60 |
| `worst_case` | 0.20 |

Scenarios describe narrative outcomes conditioned on whether action is taken within the impact horizon.

---

## Decision Support Model

`generateDecisionSupport()` produces a structured recommendation:

```typescript
{
  focusItemId:           string,
  focusType:             string,
  recommendedAction:     string,   // e.g. "Create a formal delegation to close the authority gap"
  impactIfIgnored:       ConsequenceSeverity,
  blockedEntityCount:    number,
  escalationProbability: number,
  impactHorizon:         ConsequenceImpactHorizon,
  rationale:             string,
}
```

Focus type → recommended action mapping:

| Focus Type | Recommended Action |
|---|---|
| authority | create_delegation |
| governance | resolve_governance_issue |
| ratification | close_ratification |
| commitment | deliver_commitment |
| projection | review_projection |
| execution | address_execution_drift |
| reality | review_reality |
| recommendation | review_recommendation |
| risk | mitigate_risk |
| health | restore_health |

---

## Lineage

`getOperationalConsequenceLineage()` reconstructs the full 13-layer chain:

```
Constitution (layer 0)
↓
Memory (layer 1)
↓
Learning (layer 2)
↓
Recommendation (layer 3)
↓
Signal (layer 4)
↓
Action (layer 5)
↓
Commitment (layer 6)
↓
Projection (layer 7)
↓
Reality (layer 8)
↓
Project OS Snapshot (layer 9)
↓
Operational Command Center (layer 10)
↓
Focus Item (layer 11)
↓
Consequence Analysis (layer 12)
```

---

## Audit Events

| Event | When |
|---|---|
| `OPERATIONAL_CONSEQUENCE_GENERATED` | Consequence created |
| `OPERATIONAL_CONSEQUENCE_VALIDATED` | Status moved to `validated` |
| `OPERATIONAL_CONSEQUENCE_ARCHIVED` | Status moved to `archived` |
| `OPERATIONAL_IMPACT_SCORE_CALCULATED` | Impact score computed |
| `OPERATIONAL_ESCALATION_PROBABILITY_CALCULATED` | Escalation probability computed |
| `OPERATIONAL_CASCADE_ANALYZED` | Cascade chain analyzed |
| `OPERATIONAL_SCENARIO_GENERATED` | Scenarios written |
| `OPERATIONAL_DECISION_SUPPORT_GENERATED` | Decision support derived |
| `OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED` | Lineage chain reconstructed |

---

## Use Cases

### authority_gap → Consequence Analysis

```yaml
focus_item:
  type: authority_gap
  priority: critical
  focus_score: 88

consequence:
  severity: critical
  impact_horizon: 24h
  escalation_probability: 0.84
  impact_score: 87

cascade:
  authority_gap → ratification_blocked → commitments_delayed → execution_drift → health_reduction
  max_depth: 4

scenarios:
  best_case:     0.20  # Gap closed within 24h, no downstream impact
  expected_case: 0.60  # Partial action, commitments delayed 3–5 days
  worst_case:    0.20  # Gap unresolved, governance escalation triggered

decision_support:
  recommended_action: create_delegation
  blocked_entities: 17
  impact_if_ignored: critical
```

### overdue_commitment → Consequence Analysis

```yaml
focus_item:
  type: commitment
  priority: high
  focus_score: 67

consequence:
  severity: high
  impact_horizon: 48h
  escalation_probability: 0.55
  impact_score: 62

cascade:
  overdue_commitment → projections_affected → realities_impacted → health_reduction
  max_depth: 3

decision_support:
  recommended_action: deliver_commitment
  impact_if_ignored: high
```

---

## Business Rules

1. Every consequence originates from a Focus Item.
2. Every consequence has a computed impact score.
3. Every consequence has a severity.
4. Every consequence has an impact horizon.
5. Every consequence has three scenarios (best/expected/worst).
6. Every consequence is traceable via lineage.
7. Workspace isolation is mandatory (RLS enforced).
8. Consequences never modify source entities.
9. Every consequence maintains full lineage.
10. Consequences feed Decision Support.
