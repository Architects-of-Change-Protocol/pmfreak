# PM Capacity Snapshot Activation

## Purpose

This slice operationalizes PM Capacity / Load Intelligence using real PM Registry data. It generates, stores, exposes, and displays PM capacity snapshots that tell PMO leadership which Project Managers are healthy, overloaded, near capacity, or have available bandwidth.

This slice does **not** replace the existing multi-domain capacity engine. It enriches existing snapshots with assignment-based capacity data stored in `snapshot_payload.assignment_capacity`.

---

## Data Sources

| Source | Used For |
|---|---|
| `project_managers` | Verify PM exists in workspace, read display_name/email |
| `pm_assignments` | Count active assignments by type (where `removed_at IS NULL`) |
| `pm_profiles` | Read `active_projects_limit` per PM |
| `pm_capacity_snapshots` | Persist generated snapshots |
| `pm_capacity_metrics` | Persist per-domain metrics |
| `pm_capacity_evidence` | Persist evidence lineage |

---

## Capacity Counting Rule

**Counted assignment types** (contribute to active workload):
- `primary`
- `secondary`
- `program`

**Excluded assignment types** (do not count toward active workload):
- `observer`

**Additional rules:**
- Only assignments where `removed_at IS NULL` are counted.
- `active_projects_limit` is read from `pm_profiles.active_projects_limit`.
- If no profile exists, the default limit of `5` is used.

This rule is applied consistently in:
- `buildAssignmentCapacityPayload()` in `capacity-registry.ts`
- Evidence lineage (`evidence.counting_rule`)
- Tests in `pm-capacity-load-intelligence.test.mjs`

---

## Assignment-Based Capacity Model

Assignment-based capacity data is stored in `snapshot_payload.assignment_capacity` as a structured JSONB object alongside the existing multi-domain capacity scores.

### Fields

```ts
{
  active_assignment_count: number;        // Total active assignments (including observer)
  counted_assignment_count: number;       // primary + secondary + program only
  observer_assignment_count: number;      // Observer-only count
  active_projects_limit: number;          // From pm_profiles or default (5)
  assignment_capacity_utilization: number; // counted / limit (ratio, 0.0–1.x+)
  assignment_capacity_status: string;     // Derived status (see thresholds)
  assignment_overload_risk: string;       // Derived risk (see thresholds)
  assignment_breakdown: {                 // Per-type counts
    primary: number;
    secondary: number;
    program: number;
    observer: number;
  };
  recommendations: Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }>;
  evidence: {
    profile: { pm_profile_id: string | null; active_projects_limit: number };
    assignments: Array<{
      assignment_id: string;
      project_id: string;
      assignment_type: string;
      assigned_at: string;
    }>;
    counting_rule: {
      counted_assignment_types: string[];
      excluded_assignment_types: string[];
    };
  };
}
```

---

## Status Thresholds

`assignment_capacity_status` is derived from `assignment_capacity_utilization` (counted_assignment_count / active_projects_limit):

| Utilization | Status |
|---|---|
| < 0.40 | `underutilized` |
| >= 0.40 and < 0.75 | `healthy` |
| >= 0.75 and < 1.00 | `near_capacity` |
| == 1.00 | `at_capacity` |
| > 1.00 | `overloaded` |

Note: The pre-existing multi-domain `capacity_status` column uses different thresholds (`underutilized`/`healthy`/`busy`/`overloaded`/`critical`) based on a composite load score. Both models coexist in the snapshot.

---

## Overload Risk Thresholds

`assignment_overload_risk` is derived from utilization:

| Utilization | Risk |
|---|---|
| < 0.75 | `low` |
| >= 0.75 and < 1.00 | `medium` |
| == 1.00 | `high` |
| > 1.00 | `critical` |

---

## Recommendation Logic

Deterministic recommendations generated per status:

| Status | Type | Severity | Message |
|---|---|---|---|
| underutilized | `available_capacity` | low | PM has available capacity and may be considered for additional ownership. |
| healthy | `maintain_load` | low | PM load is within healthy operating range. |
| near_capacity | `monitor_capacity` | medium | PM is approaching capacity. Review before assigning additional projects. |
| at_capacity | `hold_new_assignments` | high | PM is at configured capacity. Avoid additional workload-counting assignments. |
| overloaded | `rebalance_load` | critical | PM exceeds configured capacity. Rebalance assignments or increase capacity with explicit approval. |

---

## API Routes

### `GET /api/pm-capacity`
Returns the latest capacity snapshot per PM for the current workspace.

**Response:**
```json
{ "ok": true, "data": [ /* PMCapacitySnapshotRow[] */ ] }
```

### `POST /api/pm-capacity/snapshots`
Generates capacity snapshots for all active PMs in the workspace. Emits `PM_WORKSPACE_CAPACITY_SNAPSHOTS_GENERATED` event on success.

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "generated": [ /* PMCapacitySnapshotRow[] */ ],
    "totalPMs": 5,
    "successCount": 5,
    "failureCount": 0
  }
}
```

### `POST /api/pm-capacity/[pmId]/snapshot`
Generates a single PM capacity snapshot. Emits `PM_CAPACITY_SNAPSHOT_GENERATED` event on success.

**Response (201):**
```json
{ "ok": true, "data": { /* PMCapacitySnapshotRow */ } }
```

### `GET /api/pm-capacity/[pmId]`
Returns the latest snapshot and recent history (last 10) for a PM.

**Response:**
```json
{ "ok": true, "data": { "latest": { /* snapshot */ }, "history": [ /* ... */ ] } }
```

### `GET /api/pm-capacity/overloaded`
Returns latest snapshots for PMs with `capacity_status` of `overloaded`/`critical` or `burn_risk` of `high`/`critical`.

**Response:**
```json
{ "ok": true, "data": [ /* PMCapacitySnapshotRow[] */ ] }
```

---

## UI Routes

### `/pm-capacity`
Protected page. Shows:
- Header with "Generate snapshots" and "Refresh" actions
- Summary cards: Total PMs, Underutilized, Healthy, Near capacity, At capacity, Overloaded, Avg utilization
- Capacity table with per-PM: name, email, limit, counted assignments, observer assignments, utilization, capacity status badge, overload risk badge, recommendation, generated at
- Empty state with generate action
- Loading and error states

### `/pm-registry/[pmId]` (enriched)
Existing PM detail page now includes a **Capacity Snapshot** section showing:
- Active project limit
- Counted assignments
- Observer assignments
- Utilization
- Capacity status badge
- Overload risk badge
- Recommendation
- Generated at
- Generate PM capacity snapshot button

The capacity section degrades gracefully if the capacity endpoint fails.

---

## Platform Events

### `PM_CAPACITY_SNAPSHOT_GENERATED`
Emitted after a single PM snapshot is successfully persisted.

Payload:
```json
{
  "pm_id": "...",
  "snapshot_id": "...",
  "active_projects_limit": 5,
  "counted_assignment_count": 3,
  "observer_assignment_count": 1,
  "assignment_capacity_utilization": 0.6,
  "assignment_capacity_status": "healthy",
  "assignment_overload_risk": "low",
  "generated_at": "...",
  "source": "pm_capacity"
}
```

### `PM_WORKSPACE_CAPACITY_SNAPSHOTS_GENERATED`
Emitted after workspace-level generation (all PMs) completes with at least one success.

Payload:
```json
{
  "workspace_id": "...",
  "actor_user_id": "...",
  "generated_snapshot_count": 5,
  "total_pm_count": 5,
  "healthy_count": 3,
  "near_capacity_count": 1,
  "at_capacity_count": 1,
  "overloaded_count": 0,
  "average_utilization": 61.2,
  "generated_at": "...",
  "source": "pm_capacity"
}
```

Events are **not** emitted if snapshot persistence fails.

---

## Evidence Structure

Each snapshot includes evidence explaining the calculation in `snapshot_payload.assignment_capacity.evidence`:

```json
{
  "profile": {
    "pm_profile_id": "uuid-or-null",
    "active_projects_limit": 5
  },
  "assignments": [
    {
      "assignment_id": "...",
      "project_id": "...",
      "assignment_type": "primary",
      "assigned_at": "..."
    }
  ],
  "counting_rule": {
    "counted_assignment_types": ["primary", "secondary", "program"],
    "excluded_assignment_types": ["observer"]
  }
}
```

---

## Known Limitations

- This slice measures assignment-based capacity, not calendar hours or effort estimates.
- Project complexity weighting is not included in the assignment-based model (the existing multi-domain engine includes project health scores).
- This slice does not integrate PM Performance snapshots into assignment-based recommendations.
- This slice does not include PMO Command Center aggregation.
- Recommendations are deterministic, not AI-generated.
- Capacity snapshots are only as current as the last generation time (manual or triggered).
- The `GET /api/pm-capacity/overloaded` endpoint filters by the **multi-domain** `capacity_status` and `burn_risk` columns (existing DB values), not the assignment-based status stored in `snapshot_payload`. This reflects the DB-indexed columns available in the existing schema.

---

## Recommended Next Vertical Slice

**PM Capacity Alerting + Auto-Generation**
- Trigger snapshot generation on `PROJECT_MANAGER_ASSIGNED` and `PROJECT_MANAGER_UNASSIGNED` events
- Add webhook/cron for periodic workspace-level regeneration
- Filter `GET /api/pm-capacity/overloaded` by assignment-based status from `snapshot_payload`
- Add PMO dashboard widget showing overload count
