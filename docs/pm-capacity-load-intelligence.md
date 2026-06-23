# PM Capacity & Load Intelligence

**EPIC 6 — Sprint 3**

Transforms Project Managers from entities evaluated only by performance into entities evaluated by **operational sustainability**. The system answers: *Can this PM take more work? Is this PM overloaded? Who should receive the next project?*

---

## Architecture

```
PM
↓
Assignments
↓
Projects
↓
Performance Snapshot
↓
Capacity (from PM Profile)
↓
Load (from active work items)
↓
Utilization (load / capacity × 100)
↓
Burn Risk (compounded stress score)
↓
Capacity Status + Recommendation
```

**Module**: `src/lib/pm-capacity/`

```
pm-capacity/
├── index.ts
├── types.ts
├── capacity-registry.ts      # generatePMCapacitySnapshot, getPMCapacitySnapshot, listPMCapacitySnapshots
├── capacity-profile.ts       # generatePMCapacityProfile (real-time, non-persisted)
├── comparison.ts             # comparePMCapacity
├── lineage.ts                # getPMCapacityLineage
├── explain.ts                # explainPMCapacityEngine
└── engines/
    ├── capacity-engine.ts    # calculatePMCapacity
    ├── load-engine.ts        # calculatePMLoad
    ├── utilization-engine.ts # calculatePMUtilization
    ├── burn-risk-engine.ts   # calculatePMBurnRisk
    ├── overload-detection.ts # detectPMOverload
    └── recommendation-engine.ts # generateCapacityRecommendations
```

---

## Capacity Model

Maximum sustainable operational load for a PM.

**Formula**:
```
capacity = base * roleMultiplier * experienceMultiplier + (activeProjectsLimit × 10 - 50)
```

**Role Multipliers**:

| Role               | Multiplier |
|--------------------|------------|
| project_manager    | 1.00       |
| senior_pm          | 1.15       |
| program_manager    | 1.25       |
| portfolio_manager  | 1.40       |

**Experience Multipliers**:

| Level     | Multiplier |
|-----------|------------|
| junior    | 0.80       |
| mid       | 1.00       |
| senior    | 1.20       |
| principal | 1.35       |

**Sources**: `pm_profiles.capacity_limit`, `pm_profiles.active_projects_limit`, `pm_profiles.role`, `pm_profiles.experience_level`

---

## Load Model

Observed operational pressure on a PM, aggregated from all active work items.

| Domain                | Source                          | Weight per unit |
|-----------------------|---------------------------------|-----------------|
| project_count         | pm_assignments (active)         | 12              |
| critical_projects     | project_os_snapshots (score<45) | +8 per project  |
| open_decisions        | operational_decisions (open)    | 4               |
| open_commitments      | governance_commitments (open)   | 3               |
| execution_drift       | execution_tasks (overdue)       | 5               |
| escalations           | governance_violations (open)    | 8               |
| attention_allocation  | inverse of portfolio health     | × 0.30          |

---

## Utilization Model

```
utilization = (load / capacity) × 100
```

- Values above 100% mean the PM carries more load than capacity allows.
- Rounded to two decimal places.
- Returns 0 if capacity is 0.

---

## Burn Risk Model

Burn risk is the probability of operational degradation. It compounds utilization with additional stress signals.

```
riskScore = utilization
          + criticalProjectCount × 5
          + escalationCount × 6
          + executionDriftCount × 4
          + min(openDecisionCount × 1.5, 15)
```

| Risk Score | Level    | Meaning                                               |
|------------|----------|-------------------------------------------------------|
| < 50       | none     | Sustainable — no risk signals.                        |
| 50–69      | low      | Approaching capacity — monitor.                      |
| 70–89      | medium   | Multiple risk signals — intervene soon.              |
| 90–114     | high     | High compounded risk — immediate attention required. |
| ≥ 115      | critical | Systemic failure risk — redistribute immediately.    |

---

## Overload Detection

Classifies operational sustainability from utilization percentage.

| Utilization | Status        |
|-------------|---------------|
| < 60%       | underutilized |
| 60–89%      | healthy       |
| 90–109%     | busy          |
| 110–129%    | overloaded    |
| ≥ 130%      | critical      |

---

## Recommendation Model

Advisory only. No automatic actions are ever executed.

| Trigger                            | Action                  |
|------------------------------------|-------------------------|
| utilization ≥ 130% or critical     | redistribute_projects   |
| overloaded or high/critical risk   | reduce_load             |
| busy or healthy                    | maintain_load           |
| underutilized (< 60%)              | assign_new_project      |

---

## Capacity Profile

`generatePMCapacityProfile()` produces a real-time, non-persisted view:

```yaml
pm:
  id: <uuid>
  name: Victor
  email: v@example.com
capacity: 100
load: 142
utilization: 142%
burnRisk: critical
status: critical
overload: true
recommendedAction: redistribute_projects
evidence:
  projectCount: 8
  criticalProjectCount: 3
  openDecisionCount: 5
  openCommitmentCount: 4
  escalationCount: 2
  executionDriftCount: 3
generatedAt: 2026-06-23T...
```

---

## Sustainability Design

The system is designed to **prevent systemic failures**, not to rank or punish PMs.

- Every capacity value is derived from `pm_profiles` — never assumed.
- Every load unit is traceable to a database record.
- Every utilization value is reproducible from `load / capacity × 100`.
- No snapshot modifies projects, assignments, or triggers automatic redistribution.
- Every recommendation includes an explanatory reason.

---

## Lineage

`getPMCapacityLineage()` reconstructs the full traceability chain:

```
PM → Assignments → Projects → Portfolio (PM Profile)
  → Performance Snapshot → Capacity Snapshot
```

This provides a complete audit trail from registration through sustainability assessment.

---

## Data Model

### `pm_capacity_snapshots`

| Column                  | Type           | Description                        |
|-------------------------|----------------|------------------------------------|
| id                      | uuid PK        |                                    |
| workspace_id            | uuid FK        | workspace isolation                |
| pm_id                   | uuid FK        | references project_managers        |
| capacity_score          | numeric(7,2)   | calculated capacity                |
| load_score              | numeric(7,2)   | observed load                      |
| utilization_percentage  | numeric(7,2)   | load / capacity × 100              |
| burn_risk               | text           | none/low/medium/high/critical      |
| capacity_status         | text           | underutilized/healthy/busy/overloaded/critical |
| recommended_action      | text           |                                    |
| snapshot_payload        | jsonb          | full context at snapshot time      |
| generated_at            | timestamptz    |                                    |

### `pm_capacity_metrics`

Per-domain metrics linked to a snapshot: `project_count`, `critical_projects`, `open_decisions`, `open_commitments`, `execution_drift`, `escalations`, `attention_allocation`.

### `pm_capacity_evidence`

Evidence records linking snapshots to source entities: `project_os_snapshot`, `pm_performance_snapshot`, `personal_portfolio_snapshot`.

---

## Audit Events

| Event                              | Emitted by                        |
|------------------------------------|-----------------------------------|
| PM_CAPACITY_SNAPSHOT_GENERATED     | generatePMCapacitySnapshot        |
| PM_CAPACITY_CALCULATED             | generatePMCapacityProfile         |
| PM_LOAD_CALCULATED                 | load engine (via snapshot)        |
| PM_UTILIZATION_CALCULATED          | utilization engine (via snapshot) |
| PM_BURN_RISK_CALCULATED            | burn risk engine (via snapshot)   |
| PM_OVERLOAD_DETECTED               | auto-emitted when status ∈ {overloaded, critical} |
| PM_CAPACITY_RECOMMENDATION_GENERATED | recommendation engine            |
| PM_CAPACITY_COMPARED               | comparePMCapacity                 |
| PM_CAPACITY_LINEAGE_GENERATED      | getPMCapacityLineage              |

---

## Business Rules

1. Every snapshot must originate from a registered PM.
2. Every capacity value must be calculable from PM profile data.
3. Every load must originate from measurable evidence.
4. Every utilization must be reproducible via `load / capacity × 100`.
5. Workspace isolation is mandatory.
6. Capacity cannot be calculated for inactive PMs.
7. Projects must not be modified by this engine.
8. Assignments must not be modified by this engine.
9. Redistributions must not be executed automatically.
10. Every recommendation must be explainable from evidence.

---

## Use Cases

- Generate a PM capacity snapshot to assess current operational sustainability.
- Generate a PM capacity profile for a real-time view without persisting.
- List historical capacity snapshots filtered by status or burn risk.
- Compare two PMs by utilization percentage to identify redistribution candidates.
- Detect PMs at critical overload before projects are impacted.
- Identify underutilized PMs eligible for new assignments.
- Trace the full evidence chain behind any capacity assessment.
- Explain the capacity engine to PMO stakeholders.

---

## Examples

### PM at Critical Overload

```
Input:
  - 8 projects (3 critical)
  - 5 open decisions, 2 escalations, 4 drifted tasks
  - capacityLimit: 100, role: project_manager, experience: mid

Output:
  capacity: 100
  load: 154
  utilization: 154%
  burnRisk: critical
  status: critical
  recommendedAction: redistribute_projects
```

### PM with Capacity Available

```
Input:
  - 2 projects (0 critical)
  - 1 open decision, 0 escalations
  - capacityLimit: 100, role: senior_pm, experience: senior

Output:
  capacity: 165
  load: 28
  utilization: 17%
  burnRisk: none
  status: underutilized
  recommendedAction: assign_new_project
```

### Capacity Comparison

```
PM A (Victor):
  utilization: 142%
  status: critical
  burnRisk: critical

PM B (Ana):
  utilization: 83%
  status: healthy
  burnRisk: low

difference: +59%
moreLoaded: a
```
