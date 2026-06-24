# PMO Command Center

EPIC 6 Sprint 5 — PMO Governance Intelligence

## Architecture

```
Projects
  ↓
Portfolios
  ↓
PMs
  ↓
Performance (Sprint 2)
  ↓
Capacity (Sprint 3)
  ↓
Compliance (Sprint 4)
  ↓
PMO Command Center (Sprint 5)
```

The PMO Command Center aggregates all Sprint 1–4 intelligence into a single organizational view. It never modifies projects, PMs, or portfolios — it observes and recommends.

### Module Location

```
src/lib/pmo-command-center/
├── index.ts
├── types.ts
├── pmo-registry.ts         ← generatePMOSnapshot, getPMOSnapshot, listPMOSnapshots
├── pmo-dashboard.ts        ← generatePMODashboardModel, calculatePMOTrendsFromWorkspace
├── pmo-lineage.ts          ← getPMOLineage
├── explain.ts              ← explainPMOCommandCenter
└── engines/
    ├── pmo-health-engine.ts
    ├── organizational-capacity-engine.ts
    ├── governance-maturity-engine.ts
    ├── pmo-risk-engine.ts
    ├── attention-queue-engine.ts
    ├── recommendation-engine.ts
    ├── hotspot-engine.ts
    └── trend-engine.ts
```

### Database Tables

```
supabase/migrations/20260718000000_pmo_command_center.sql
```

| Table | Purpose |
|---|---|
| `pmo_command_center_snapshots` | Aggregated PMO organizational snapshots |
| `pmo_attention_items` | Prioritized attention queue items per snapshot |
| `pmo_recommendations` | Executive recommendations per snapshot |

All tables have RLS enabled. Members can read; admins/owners can manage.

---

## PMO Health Model

**Function:** `calculatePMOHealth(input)`

**Inputs:**

| Field | Source |
|---|---|
| `avgPerformanceScore` | Average of all PM `pm_performance_snapshots.overall_score` |
| `avgCapacityScore` | Average of all PM `pm_capacity_snapshots.capacity_score` |
| `avgComplianceScore` | Average of all PM `governance_compliance_snapshots.overall_score` |
| `projectHealthScore` | Average of all active `project_os_snapshots.operating_health_score` |

**Weights:**

| Dimension | Weight |
|---|---|
| Performance | 30% |
| Capacity | 25% |
| Compliance | 25% |
| Project Health | 20% |

**PMO Status Thresholds:**

| Status | Score Range |
|---|---|
| excellent | ≥ 90 |
| healthy | 75–89 |
| stable | 60–74 |
| warning | 45–59 |
| critical | < 45 |

---

## Capacity Model

**Function:** `calculateOrganizationalCapacity(input)`

Inverts average PM utilization and applies overload/healthy PM ratios.

```
capacity_score = (100 - avgUtilization) - (overloadRatio × 30) + (healthyRatio × 10)
```

- **Saturated PMO** (many overloaded PMs, high utilization): score < 40
- **Healthy PMO** (balanced load): score 40–70
- **Underutilized PMO** (low load): score > 70

---

## Governance Maturity Model

**Function:** `calculateGovernanceMaturity(input)`

Measures organizational governance discipline.

```
base = avgComplianceScore × 0.70
debtPenalty = min(20, totalGovernanceDebt × 0.5)
hotspotPenalty = min(10, hotspotCount × 2)
maturity = base - debtPenalty - hotspotPenalty + (avgComplianceScore × 0.30)
```

Sources governance debt from `governance_compliance_gaps` severity counts.

---

## Risk Model

**Function:** `calculatePMORiskIndex(input)`

Composite risk score from 5 factors:

| Factor | Weight | Calculation |
|---|---|---|
| Critical Projects | 35% | `criticalCount / totalCount × 100` |
| Execution Drift | 25% | `driftCount / commitmentCount × 100` |
| Governance Gaps | 20% | `min(100, gapCount × 5)` |
| Overloaded PMs | 15% | `overloadedCount / pmCount × 100` |
| Escalations | 5% | `min(100, escalationCount × 10)` |

Risk index: 0 = no risk, 100 = maximum risk.

---

## Attention Queue

**Function:** `generateAttentionQueue(params)`

Generates a prioritized list of items requiring PMO intervention. Items are ordered: `critical → high → medium → low`.

**Triggers:**

| Condition | Priority | Type |
|---|---|---|
| PM utilization ≥ 130% | critical | pm |
| PM utilization 110–129% | high | pm |
| PM utilization 90–109% | medium | pm |
| PM compliance < 60 | high | pm |
| PM compliance 60–79 | medium | pm |
| PM performance < 60 | high | pm |
| Project health < 50 | critical | project |
| Project health 50–69 | high | project |
| Governance score < 60 | critical | governance |
| Risk score > 70 | critical | governance |

Every item includes: `priority`, `entityType`, `entityId`, `title`, `description`, `recommendedAction`.

---

## Recommendation Model

**Function:** `generateExecutiveRecommendations(params)`

Generates actionable PMO-level recommendations sorted by confidence score.

**Recommendation Types:** `capacity` | `governance` | `execution` | `portfolio` | `staffing` | `risk`

**Impact Values:** `low` | `medium` | `high` | `critical`

**Examples:**

```yaml
- type: capacity
  recommendation: Redistribute project load across underutilized PMs to reduce burn risk.
  confidence: 0.85
  impact: high

- type: governance
  recommendation: Accelerate ratifications and close authority gaps across PMs with critical compliance scores.
  confidence: 0.81
  impact: high

- type: staffing
  recommendation: Organizational capacity is critically low. Evaluate PM headcount expansion or project deferral.
  confidence: 0.85
  impact: critical
```

---

## Hotspot Detection

**Function:** `identifyPMOHotspots(params)`

Identifies zones of anomalous behavior across 4 dimensions:

| Hotspot Type | Trigger |
|---|---|
| capacity | PM utilization ≥ 110% |
| governance | PM compliance < 75 (critical < 60) |
| execution | Project health < 65 (critical < 50) |
| portfolio | PMO risk score > 70 |

---

## Trend Analysis

**Function:** `calculatePMOTrends(snapshots)` / `calculatePMOTrendsFromWorkspace(workspaceId)`

Compares the newest and oldest snapshots in a window to compute trends.

**Trend Directions:**
- `improving`: delta > +1
- `stable`: delta between -1 and +1
- `deteriorating`: delta < -1

**Example output:**

```yaml
health:
  current: 84
  previous: 80
  delta: +4
  direction: improving

capacity:
  current: 72
  previous: 75
  delta: -3
  direction: deteriorating

governance:
  current: 89
  previous: 82
  delta: +7
  direction: improving

risk:
  current: 17
  previous: 22
  delta: -5
  direction: improving  # risk decrease = improvement
```

---

## Lineage

**Function:** `getPMOLineage(input)`

Reconstructs the full evidence chain for a PMO snapshot:

```
Project → Portfolio → PM → Performance Snapshot → Capacity Snapshot → Compliance Snapshot → PMO Snapshot
```

Returns:
- The PMO snapshot
- All active PMs with their latest Performance, Capacity, and Compliance snapshot IDs
- All active projects with health scores and PM assignments
- Portfolio count

Emits `PMO_LINEAGE_GENERATED` audit event.

---

## Governance by Exception

The PMO Command Center implements a governance-by-exception model:

1. **PMO observes — it does not execute.** No automatic redistributions, remediations, or modifications.
2. **Every metric is traceable.** Health → Engines → PM Snapshots → Project Evidence → Raw Data.
3. **Every recommendation is explainable.** Each has a `confidence` (0–1) and `impact` score.
4. **Attention is prioritized.** The PMO sees the most critical items first.
5. **Workspace isolation is enforced.** All queries are scoped to `workspace_id`.
6. **Snapshots are immutable.** History is preserved; old snapshots are never modified.

---

## Audit Events

| Event | Emitted By |
|---|---|
| `PMO_SNAPSHOT_GENERATED` | `generatePMOSnapshot` |
| `PMO_HEALTH_CALCULATED` | `generatePMOSnapshot` |
| `PMO_CAPACITY_CALCULATED` | `generatePMOSnapshot` |
| `PMO_GOVERNANCE_MATURITY_CALCULATED` | `generatePMOSnapshot` |
| `PMO_RISK_INDEX_CALCULATED` | `generatePMOSnapshot` |
| `PMO_ATTENTION_QUEUE_GENERATED` | `generatePMOSnapshot` |
| `PMO_RECOMMENDATIONS_GENERATED` | `generatePMOSnapshot` |
| `PMO_HOTSPOT_IDENTIFIED` | `generatePMOSnapshot` (when hotspots detected) |
| `PMO_LINEAGE_GENERATED` | `getPMOLineage` |
| `PMO_TREND_CALCULATED` | (type declared, emitted on trend calculation) |

---

## Use Cases

1. **Weekly PMO health review** — call `generatePMOSnapshot()` then `generatePMODashboardModel()`.
2. **Identify overloaded PMs** — review `attention` items with `entityType: pm` and `priority: critical`.
3. **Monitor governance trend** — call `calculatePMOTrendsFromWorkspace()` with last 10 snapshots.
4. **Surface critical projects** — check `projects.critical` in dashboard model.
5. **Executive brief preparation** — use `PMODashboardModel` as structured input.
6. **Trace any metric** — call `getPMOLineage()` to reconstruct full evidence chain.
7. **Explain the system** — call `explainPMOCommandCenter()` for structured documentation.

---

## Example Dashboard Model Output

```yaml
pmo:
  health: 84
  governance: 87
  capacity: 82
  execution: 79
  risk: 21
  status: healthy

projects:
  total: 76
  critical: 8
  warning: 19
  healthy: 49

pms:
  total: 18
  overloaded: 4
  warning: 6
  healthy: 8

portfolios:
  total: 5

attention:
  - priority: critical
    entityType: pm
    title: "Victor — critical overload"
    description: "PM is at 142% utilization — well above safe threshold."
    recommendedAction: "Immediately redistribute projects or defer non-critical work."

  - priority: high
    entityType: project
    title: "MEP-14156 — governance debt"
    description: "Project health score is 58."
    recommendedAction: "Schedule executive review and define corrective actions."

recommendations:
  - type: capacity
    recommendation: "Redistribute project load across underutilized PMs to reduce burn risk."
    confidence: 0.90
    impact: critical

  - type: governance
    recommendation: "Accelerate ratifications and close authority gaps."
    confidence: 0.81
    impact: high
```
