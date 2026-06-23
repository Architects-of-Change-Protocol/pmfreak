# Operational Command Center

**EPIC 4 — Project Operating System | Sprint 2**

## Overview

The Operational Command Center transforms Project OS Snapshots into a prioritized, explainable, and traceable operational focus layer. It answers six critical operational questions:

- **What** must be attended to first?
- **Why** does it require attention?
- **What happens** if it is not addressed?
- **What action** is related?
- **Who** is responsible?
- **How urgent** is it?

The Command Center does **not** create new reality — it prioritizes existing reality surfaced by the Project OS Snapshot.

---

## Architecture

```
Project OS Snapshot
       ↓
  Attention Items
       ↓
  Focus Scoring
       ↓
 Operational Focus
       ↓
Command Center State
```

### Layer Flow

```
Project OS Snapshot
  → Attention Items (detected from domain signals)
    → Focus Detection Engine (transforms attention → focus)
      → Focus Score (0–100 composite score)
        → Operational Priority (low / medium / high / critical)
          → Rationale (explainable reason)
            → Intervention Mapping (recommended action)
              → Owner Recommendation (responsible role)
                → Due Date (time-bound urgency)
                  → Operational Focus Item
                    → Command Center
```

---

## Command Center Model

### `operational_command_centers`

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace isolation |
| `project_id` | uuid | Project reference |
| `snapshot_id` | uuid | Source Project OS Snapshot |
| `command_status` | text | `generated` \| `validated` \| `archived` |
| `overall_priority` | text | `low` \| `medium` \| `high` \| `critical` |
| `focus_score` | numeric | Aggregate focus score (0–100) |
| `generated_at` | timestamptz | Generation timestamp |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

**Status Lifecycle:** `generated` → `validated` → `archived`

---

## Focus Model

### `operational_focus_items`

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace isolation |
| `command_center_id` | uuid | Parent command center |
| `attention_item_id` | uuid \| null | Source attention item (traceability) |
| `focus_type` | text | Focus category (see below) |
| `priority` | text | `low` \| `medium` \| `high` \| `critical` |
| `focus_score` | numeric | 0–100 scoring |
| `title` | text | Short label |
| `description` | text | What this item is |
| `rationale` | text | Why it requires attention (explainable) |
| `recommended_action_type` | text | Suggested intervention |
| `recommended_owner_type` | text | Role category responsible |
| `recommended_due_date` | timestamptz | Time-bound recommendation |
| `status` | text | `open` \| `acknowledged` \| `in_progress` \| `resolved` \| `dismissed` |
| `resolved_at` | timestamptz \| null | Resolution timestamp |
| `dismissed_at` | timestamptz \| null | Dismissal timestamp |

**Focus Types:**

| Type | Maps From |
|------|-----------|
| `authority` | `authority_gap` |
| `ratification` | `ratification_stall` |
| `governance` | `governance_violation`, `critical_signal` |
| `commitment` | `overdue_commitment` |
| `execution` | `execution_drift` |
| `projection` | `projection_variance` |
| `recommendation` | `ignored_recommendation` |
| `health` | `low_health_score` |
| `risk` | (catch-all) |
| `reality` | (future expansion) |

**Status Lifecycle:**

```
open → acknowledged → in_progress → resolved
open → dismissed
acknowledged → in_progress → resolved
```

### `operational_focus_links`

Links focus items to their source entities for full traceability.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace isolation |
| `focus_item_id` | uuid | Parent focus item |
| `entity_type` | text | Type of linked entity |
| `entity_id` | uuid | ID of linked entity |
| `relationship_type` | text | Nature of link (e.g., `source_attention_item`) |

---

## Scoring Model

### `calculateFocusScore()`

Scale: **0 to 100**

Computed from six dimensions:

| Dimension | Description | Max Contribution |
|-----------|-------------|-----------------|
| **Attention Severity** | Base score: critical=40, high=28, medium=16, low=8 | 40 |
| **Source Criticality** | Bonus by attention type (authority_gap=20, ratification_stall=18, ...) | 20 |
| **Health Impact** | `(1 - healthScore/100) × 15` — worse health = higher urgency | 15 |
| **Time Sensitivity** | Critical=8, High=4, else=0 | 8 |
| **Blocker Effect** | +5 for types that block downstream work | 5 |
| **Recommendation Confidence** | Inverse confidence — lower confidence adds score | 4 |

**Source Criticality Bonuses:**

| Attention Type | Bonus |
|----------------|-------|
| `authority_gap` | 20 |
| `ratification_stall` | 18 |
| `governance_violation` | 16 |
| `critical_signal` | 15 |
| `overdue_commitment` | 12 |
| `execution_drift` | 10 |
| `projection_variance` | 8 |
| `low_health_score` | 6 |
| `ignored_recommendation` | 5 |

---

## Priority Model

### `calculateOperationalPriority()`

| Score Range | Priority |
|-------------|----------|
| 0–39 | `low` |
| 40–64 | `medium` |
| 65–84 | `high` |
| 85–100 | `critical` |

### `calculateFocusDueDate()`

| Priority | Due |
|----------|-----|
| `critical` | 24 hours |
| `high` | 48 hours |
| `medium` | 7 days |
| `low` | 14 days |

---

## Intervention Mapping

### `mapFocusToIntervention()`

| Attention Type | Recommended Action |
|----------------|-------------------|
| `authority_gap` | `create_delegation` |
| `ratification_stall` | `request_ratification` |
| `governance_violation` | `initiate_governance_review` |
| `critical_signal` | `escalate_signal` |
| `overdue_commitment` | `breach_commitment` |
| `execution_drift` | `review_projection` |
| `projection_variance` | `review_execution_reality` |
| `ignored_recommendation` | `reactivate_recommendation` |
| `low_health_score` | `initiate_health_review` |

The Command Center recommends actions but **never executes them**.

---

## Owner Recommendation

### `recommendFocusOwner()`

| Attention Type | Recommended Owner |
|----------------|-------------------|
| `authority_gap` | `sponsor` |
| `ratification_stall` | `sponsor` |
| `governance_violation` | `governance_board` |
| `critical_signal` | `governance_board` |
| `overdue_commitment` | `commitment_owner` |
| `execution_drift` | `project_manager` |
| `projection_variance` | `project_manager` |
| `ignored_recommendation` | `project_manager` |
| `low_health_score` | `project_manager` |

Owner types are **role categories**, not specific users.

---

## Lineage

### `getOperationalFocusLineage()`

Reconstructs the full traceable chain from Constitution down to Focus Item:

```
Constitution
     ↓
  Memory
     ↓
 Learning
     ↓
Recommendation
     ↓
  Signal
     ↓
  Action
     ↓
Commitment
     ↓
Projection
     ↓
 Reality
     ↓
Project OS Snapshot
     ↓
Command Center
     ↓
Focus Item
```

Every focus item is traceable 12 layers back to the constitutional foundation.

---

## Command Center Health

### `calculateCommandCenterHealth()`

Returns:

```yaml
open_focus_items: 12
critical_focus_items: 2
resolved_focus_items: 5
average_focus_score: 73
overall_priority: high
```

Resolved and dismissed items are excluded from open counts and average score.

---

## Audit Events

| Event | Description |
|-------|-------------|
| `OPERATIONAL_COMMAND_CENTER_GENERATED` | New Command Center created from snapshot |
| `OPERATIONAL_COMMAND_CENTER_VALIDATED` | Command Center validated by operator |
| `OPERATIONAL_COMMAND_CENTER_ARCHIVED` | Command Center soft-archived |
| `OPERATIONAL_FOCUS_ITEM_CREATED` | Focus item created from attention item |
| `OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED` | Focus item acknowledged |
| `OPERATIONAL_FOCUS_ITEM_STARTED` | Work begun on focus item |
| `OPERATIONAL_FOCUS_ITEM_RESOLVED` | Focus item resolved |
| `OPERATIONAL_FOCUS_ITEM_DISMISSED` | Focus item dismissed |
| `OPERATIONAL_FOCUS_SCORE_CALCULATED` | Aggregate focus score computed |
| `OPERATIONAL_PRIORITY_CALCULATED` | Overall priority determined |
| `OPERATIONAL_FOCUS_LINEAGE_GENERATED` | Lineage chain reconstructed |

---

## Business Rules

| Rule | Description |
|------|-------------|
| Rule 1 | Every Command Center must originate from a Project OS Snapshot |
| Rule 2 | Every Focus Item must originate from an Attention Item |
| Rule 3 | Every Focus Item must have a priority |
| Rule 4 | Every Focus Item must have an explainable rationale |
| Rule 5 | Every Focus Item must have a recommended intervention |
| Rule 6 | Every Focus Item must be traceable to its source |
| Rule 7 | Workspace isolation is mandatory on all tables |
| Rule 8 | The Command Center does not execute actions |
| Rule 9 | The Command Center does not modify source entities |
| Rule 10 | Archiving does not delete history |

---

## Use Cases

### Example 1: Authority Gap Blocking Ratification

**Situation:** A project has no authority delegation in place, blocking ratification.

**Snapshot attention item:**
```yaml
attention_type: authority_gap
attention_severity: critical
```

**Generated focus item:**
```yaml
focus_type: authority
priority: critical
rationale: "This item is critical priority because an unresolved authority gap blocks
  ratification and may prevent governance actions from being executed. Without clear
  authority, decisions lack legitimacy and downstream work cannot proceed."
recommended_action_type: create_delegation
recommended_owner_type: sponsor
recommended_due_date: <now + 24h>
```

---

### Example 2: Execution Drift

**Situation:** Execution effort has diverged significantly from the approved projection.

**Snapshot attention item:**
```yaml
attention_type: execution_drift
attention_severity: high
```

**Generated focus item:**
```yaml
focus_type: execution
priority: high
rationale: "This item is high priority because execution has drifted significantly
  from the approved plan. Persistent drift indicates that the projection model no
  longer reflects reality and must be reconciled."
recommended_action_type: review_projection
recommended_owner_type: project_manager
recommended_due_date: <now + 48h>
```

---

### Example 3: Overdue Commitment

**Situation:** A governance commitment has passed its due date.

**Snapshot attention item:**
```yaml
attention_type: overdue_commitment
attention_severity: high
```

**Generated focus item:**
```yaml
focus_type: commitment
priority: high
rationale: "This item is high priority because a commitment has passed its due date
  without completion. Overdue commitments signal execution risk and may trigger
  breach-of-commitment escalation if not addressed promptly."
recommended_action_type: breach_commitment
recommended_owner_type: commitment_owner
recommended_due_date: <now + 48h>
```

---

## Service API

### Generate Command Center

```typescript
const result = await generateOperationalCommandCenter({
  workspaceId: "...",
  projectId:   "...",
  snapshotId:  "...",
  actorId:     "...",
});
```

### Get Operational Focus

```typescript
const focus = await getOperationalFocus({
  workspaceId:     "...",
  commandCenterId: "...",
});
// Returns: topFocusItems, criticalBlockers, overdueItems, recommendedInterventions
```

### Focus Item Lifecycle

```typescript
await acknowledgeFocusItem({ workspaceId, focusItemId, actorId });
await startFocusItem({ workspaceId, focusItemId, actorId });
await resolveFocusItem({ workspaceId, focusItemId, actorId });
// or
await dismissFocusItem({ workspaceId, focusItemId, actorId });
```

### Command Center Health

```typescript
const health = await getCommandCenterHealth({
  workspaceId:     "...",
  commandCenterId: "...",
});
// Returns: { openFocusItems, criticalFocusItems, resolvedFocusItems, averageFocusScore, overallPriority }
```

---

## What It Does Not Do

- Does not execute recommended actions automatically
- Does not modify source entities (snapshots, attention items, signals, commitments)
- Does not create governance signals, violations, or commitments
- Does not render UI or dashboards
- Does not delete historical data — archive only
- Does not assign actions to specific users — only recommends role types
