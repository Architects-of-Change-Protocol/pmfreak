# PM Performance Snapshot Activation

## Purpose

This slice extends PMFreak from workload visibility to execution quality measurement. It enables PMO leadership to evaluate each Project Manager not only by how much they carry, but by how effectively they are executing their assigned project portfolio.

After this slice, PMFreak can answer:

- Which PMs are executing well?
- Which PMs are struggling?
- Which PMs have delivery risk?
- Which PMs have governance gaps?
- Which PMs are overloaded but performing well?
- Which PMs have healthy capacity but weak execution?

---

## Data Sources

### A. PM Registry (required)

- `project_managers` — PM identity, status
- `pm_assignments` — Active assignments where `removed_at IS NULL`
- `pm_profiles` — Role, experience level (via PM Capacity)

### B. PM Capacity (read-only context)

- `pm_capacity_snapshots` — Latest snapshot per PM
- Fields used: `capacity_status`, `burn_risk`, `utilization_percentage`, `snapshot_payload.assignment_capacity`
- PM Performance **never mutates** capacity snapshots

### C. Project OS Snapshots (if available)

- `project_os_snapshots` — Latest per project
- Fields used: `operating_health_score`, `governance_health_score`, `execution_health_score`

### D. Execution Tasks (if available)

- `execution_tasks` — Tasks across assigned projects
- Used for: `totalTasks`, `completedTasks`, `overdueTasks`

### E. Execution Realities (if available)

- `execution_realities` — Confidence scores for prediction accuracy

### F. Decision Outcomes (if available)

- `operational_decision_outcomes` — Effectiveness scores and outcome status

### G. Governance Violations (if available)

- `governance_violations` — Open violations on assigned projects

---

## Relationship to PM Registry

PM Performance reads PM Registry data to:

- Verify PM exists in workspace
- Retrieve active assignments
- Include PM identity in evidence

PM Performance does **not**:

- Create, update or delete PM records
- Change PM status
- Mutate PM assignments
- Change PM profiles

---

## Relationship to PM Capacity

PM Capacity is an input signal. PM Performance:

- Reads the latest `pm_capacity_snapshots` record per PM
- Embeds capacity context in `snapshot_payload.capacity_context`
- Uses capacity status to contextualize performance recommendations

PM Performance does **not**:

- Trigger capacity snapshot regeneration
- Change capacity thresholds
- Modify capacity scoring rules

---

## Scoring Domains

| Domain | Weight | Source |
|--------|--------|--------|
| Governance | 20% | `project_os_snapshots.governance_health_score`, `governance_violations` |
| Execution | 25% | `project_os_snapshots.execution_health_score`, `execution_tasks` |
| Prediction accuracy | 15% | `execution_realities.confidence_score` |
| Decision effectiveness | 20% | `operational_decision_outcomes` |
| Portfolio health | 20% | `project_os_snapshots.operating_health_score` |

---

## Missing Source Policy

If a source domain has no data:

- The domain returns a neutral baseline score (75)
- The missing source is recorded in `snapshot_payload.evidence.missing_sources`
- No data is invented

---

## Status Thresholds

| Score | Status |
|-------|--------|
| ≥ 90 | `excellent` |
| ≥ 80 | `strong` |
| ≥ 65 | `stable` |
| ≥ 45 | `warning` |
| < 45 | `critical` |

---

## Capacity Adjustment Logic

Capacity context adjusts recommendations but not scores.

| Performance | Capacity | Recommendation type |
|-------------|----------|---------------------|
| Weak (warning/critical) | Overloaded | `rebalance_capacity` |
| Strong (excellent/strong) | Overloaded | `protect_high_performer` |
| Weak | Underutilized | `coach_execution` |
| Strong | Underutilized | `candidate_for_additional_ownership` |
| Excellent | Healthy | `recognize_high_performance` |
| Strong | Healthy | `maintain_execution_cadence` |
| Stable | Healthy | `monitor_execution` |
| Warning | Healthy | `intervene_execution` |
| Critical | Healthy | `executive_intervention` |

---

## Evidence Structure

Each snapshot's `snapshot_payload` includes:

```json
{
  "pm_name": "...",
  "pm_email": "...",
  "assigned_project_count": 3,
  "os_snapshot_count": 3,
  "domain_scores": {
    "governance": 82,
    "execution": 78,
    "prediction": 75,
    "decision": 80,
    "portfolio": 74
  },
  "capacity_context": {
    "capacity_snapshot_id": "...",
    "capacity_status": "healthy",
    "burn_risk": "low",
    "utilization_percentage": 60,
    "generated_at": "...",
    "assignment_capacity": { ... }
  },
  "evidence": {
    "pm": { "pm_id": "...", "display_name": "...", "email": "..." },
    "assignments": [
      { "assignment_id": "...", "project_id": "...", "assignment_type": "primary", "assigned_at": "..." }
    ],
    "missing_sources": ["stakeholder_pressure"]
  }
}
```

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/pm-performance` | List latest snapshots per PM in workspace |
| POST | `/api/pm-performance/snapshots` | Generate snapshots for all active PMs |
| GET | `/api/pm-performance/[pmId]` | Get latest + history for one PM |
| POST | `/api/pm-performance/[pmId]/snapshot` | Generate snapshot for one PM |
| GET | `/api/pm-performance/at-risk` | List PMs with warning or critical status |

---

## UI Routes

| Route | Description |
|-------|-------------|
| `/pm-performance` | PM Performance dashboard: summary cards, table, at-risk banner |
| `/pm-registry/[pmId]` | PM detail page now includes Performance Snapshot section |

---

## Platform Events

| Event type | Trigger |
|------------|---------|
| `PM_PERFORMANCE_SNAPSHOT_GENERATED` | Single PM snapshot successfully persisted |
| `PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED` | Workspace-level generation completed with at least one snapshot |

Events are **not** emitted if snapshot persistence fails.

---

## Known Limitations

- Performance scoring depends on available Project OS, execution, decision and governance data. Domains with no data use neutral baselines (75).
- Recommendations are deterministic, not AI-generated.
- PM Performance snapshot generation is manually/API-triggered in this slice. Auto-generation on assignment changes is a follow-up.
- PM Performance does not yet power PMO Command Center.
- Stakeholder sentiment and coordination gap signals are not yet integrated.
- Historical trend visualization requires additional UI work in a future slice.
- `at-risk` uses "warning" and "critical" status values (the schema's vocabulary), not "at_risk" as a literal string.

---

## Follow-up Slices

- PMO Command Center integration
- Auto-generate performance snapshots after assignment changes
- Historical trend chart on PM detail page
- Stakeholder sentiment integration
- Scheduled / cron-triggered workspace-level generation
