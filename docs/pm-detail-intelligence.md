# PM Detail Intelligence — PM Operating Dossier

## Purpose

Transforms the `/pm-registry/[pmId]` page into a unified PM Operating Dossier that PMO leadership can use to understand a Project Manager's identity, workload, execution quality, evidence confidence, recommendations, and event history in one place.

## Scope

- Aggregates existing PM Registry, PM Capacity, PM Performance, and Platform Event data into a single read model.
- Derives `operational_status` from the latest available snapshot data.
- Consolidates and deduplicates recommendations from all sources.
- Provides an event timeline of recent PM-relevant platform events.
- Exposes a unified API route: `GET /api/pm-registry/[pmId]/intelligence`.

## Non-Goals

- Does not implement PMO Command Center.
- Does not recalculate capacity or performance scores.
- Does not mutate PM assignments, profiles, projects, or snapshots.
- Does not introduce AI-generated recommendations.
- Does not create new scoring engines.

## Data Sources

| Section | Source |
|---|---|
| PM identity | `pm_registry.getProjectManager()` |
| PM profile | `pm_registry.getProjectManagerProfile()` |
| Assignments | `pm_registry.listProjectManagerProjects({ includeRemoved: true })` |
| Capacity | `pm_capacity.listPMCapacitySnapshots({ limit: 1 })` |
| Performance | `pm_performance.listPMPerformanceSnapshots({ limit: 1 })` |
| Evidence confidence | `snapshot_payload.evidence_confidence` (from performance snapshot) |
| Event timeline | `platform_events` table (JSONB contains filter on `pm_id`) |

## API Route

```
GET /api/pm-registry/[pmId]/intelligence
```

**Auth**: Requires authenticated user and workspace membership.

**Success response**:
```json
{ "ok": true, "data": { ...PMOperatingDossier } }
```

**Error codes**:
| Code | HTTP | Meaning |
|---|---|---|
| `PM_DETAIL_WORKSPACE_REQUIRED` | 403 | No workspace context |
| `PM_DETAIL_PM_NOT_FOUND` | 404 | PM not found |
| `PM_DETAIL_CROSS_WORKSPACE_ACCESS` | 403 | PM belongs to different workspace |
| `PM_DETAIL_DOSSIER_FAILED` | 500 | Unrecoverable error |

## UI Route

```
/pm-registry/[pmId]
```

The page renders the full PM Operating Dossier UI, consuming `/api/pm-registry/[pmId]/intelligence`.

## Dossier Shape

```typescript
{
  pm: PMDossierIdentity;
  profile: PMDossierProfile;
  executive_summary: PMExecutiveSummary;
  assignments: PMDossierAssignments;
  capacity: PMDossierCapacity;
  performance: PMDossierPerformance;
  evidence_confidence: PMDossierEvidence;
  project_breakdown: PMProjectBreakdownRow[];
  recommendations: PMDossierRecommendation[];
  event_timeline: PMEventTimelineItem[];
  actions: PMDossierAction[];
  generated_at: string;
}
```

## Executive Summary Fields

| Field | Description |
|---|---|
| `pm_name` | PM display name |
| `pm_status` | active / inactive / suspended |
| `role` | PM role (from profile, nullable) |
| `experience_level` | PM experience level (from profile, nullable) |
| `active_assignment_count` | Total active assignments |
| `counted_assignment_count` | Active assignments that count toward capacity |
| `capacity_status` | Latest capacity status (prefers assignment_capacity_status) |
| `overload_risk` | Latest overload risk |
| `performance_status` | Latest performance status |
| `performance_risk` | Latest performance risk (from snapshot payload) |
| `evidence_confidence_level` | high / medium / low / very_low |
| `evidence_completeness` | 0–1 float |
| `operational_status` | Derived PM-level status (see below) |
| `top_recommendation` | Message of the highest-priority recommendation |
| `last_capacity_generated_at` | When the latest capacity snapshot was generated |
| `last_performance_generated_at` | When the latest performance snapshot was generated |

## Operational Status Rules

`operational_status` is derived by evaluating rules in precedence order. The first matching rule wins.

### critical
- `capacity_status` is `overloaded` or `critical`, **OR**
- `performance_status` is `critical`, **OR**
- `performance_risk` is `critical`

### performance_risk
- `performance_status` is `warning`, **OR**
- `performance_risk` is `high`

### capacity_risk
- `capacity_status` is `near_capacity`, `at_capacity`, or `busy`, **OR**
- `overload_risk` is `high`

### insufficient_evidence
- `confidence_level` is `low` or `very_low`, **OR**
- `score_interpretation` is `low_confidence_provisional`

### watch
- `performance_status` is `stable`, **OR**
- `performance_risk` is `medium`, **OR**
- `capacity_status` is `near_capacity`, **OR**
- `confidence_level` is `medium`

### healthy
- No higher-severity rule matched.

**Precedence**: critical → performance_risk → capacity_risk → insufficient_evidence → watch → healthy

## Recommendation Priority

Recommendations are consolidated from:
1. PM Capacity snapshot recommendations
2. Evidence confidence recommendations (low/very_low)
3. Dossier-derived recommendations (based on operational_status)

Deduplication: by `type + message + source`.

Sorting: critical → high → medium → low.

If no recommendations are present after consolidation, a single `no_action_required` (low severity) recommendation is returned.

## Event Timeline Rules

- Queries `platform_events` for PM-relevant event types using JSONB `@>` filter on `{ pm_id: pmId }`.
- Returns the latest 20 events by `occurred_at` descending.
- Includes: `PROJECT_MANAGER_REGISTERED`, `PROJECT_MANAGER_UPDATED`, `PROJECT_MANAGER_PROFILE_UPDATED`, `PROJECT_MANAGER_ASSIGNED`, `PROJECT_MANAGER_UNASSIGNED`, `PM_CAPACITY_SNAPSHOT_GENERATED`, `PM_CAPACITY_NEAR_LIMIT`, `PM_CAPACITY_AT_LIMIT`, `PM_CAPACITY_OVERLOADED`, `PM_PERFORMANCE_SNAPSHOT_GENERATED`, `PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED`.
- Each item includes a human-readable `summary` and a safe `payload_excerpt` (no secrets).

## Capacity-Counted Rule

| Assignment Type | Counts Toward Capacity |
|---|---|
| primary | Yes |
| secondary | Yes |
| program | Yes |
| observer | No |

## Missing Data Behavior

| Section | Missing behavior |
|---|---|
| Profile | `{ present: false, message: "No PM profile has been configured yet." }` |
| Capacity snapshot | `{ present: false, message: "No capacity snapshot has been generated for this Project Manager yet." }` |
| Performance snapshot | `{ present: false, message: "No performance snapshot has been generated for this Project Manager yet." }` |
| Evidence confidence | `{ present: false, message: "Evidence confidence is not available yet." }` |
| Project health | `latest_health_status = "not_available"` |
| Performance contribution | `performance_contribution = "not_enough_data"` |
| Event timeline | Empty array (no error) |

## Actions

Allowed actions surfaced in the dossier:
- Generate Capacity Snapshot → `POST /api/pm-capacity/[pmId]/snapshot`
- Generate Performance Snapshot → `POST /api/pm-performance/[pmId]/snapshot`
- Refresh Dossier → `GET /api/pm-registry/[pmId]/intelligence`
- Edit PM Profile → `/pm-registry/[pmId]/profile`
- Assign Project → `/pm-registry/[pmId]/assignments`
- View PM Capacity → `/pm-capacity/[pmId]`
- View PM Performance → `/pm-performance/[pmId]`

## Known Limitations

- Does not create new capacity scoring.
- Does not create new performance scoring.
- Does not implement PMO Command Center.
- Does not generate AI recommendations.
- Depends on latest generated snapshots; historical trends are not aggregated here.
- Project-level health and performance contribution are not available without Project OS snapshot joins (marked `not_available` / `not_enough_data`).
- Event timeline depends on available `platform_events` records that include `pm_id` in payload.
- `PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED` events are only included if they contain `pm_id` in the payload.

## Recommended Next Slice

**PMO Command Center** — aggregate PM Operating Dossiers into an executive PMO operations view across all Project Managers in the workspace.
