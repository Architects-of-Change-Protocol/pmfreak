# Project Operating System Shell

**EPIC 4 — Sprint 1**

## Overview

The Project Operating System (Project OS) is the central orchestration layer of PMFreak. It composes data from all project domains — governance, memory, execution, and intelligence — into a unified operating snapshot without duplicating business logic.

The Project OS answers:

- What is happening in this project right now?
- How healthy is the project?
- What requires human attention?
- What decisions explain its current state?
- What commitments are overdue?
- What risks are emerging?
- What recommendations apply?
- How aligned is real execution against projections?

---

## Architecture

```
Constitution
↓
Memory → Digest → Learning
↓
Recommendation
↓
Signal → Action → Commitment
↓
Projection → Reality → Variance
↓
Project OS Snapshot
```

The Project OS sits above all domains. It **orchestrates** — reads from domains, composes, and records — but never mutates domain state.

### Module Structure

```
src/lib/project-operating-system/
├── index.ts                    # Public API
├── types.ts                    # All domain types, enums, constants, events
├── project-os-registry.ts      # Main service orchestration
├── project-os-repository.ts    # DB CRUD operations
├── health-engine.ts            # Health aggregation (pure functions)
├── attention-engine.ts         # Attention item detection (pure function)
├── context-engine.ts           # Operating context composition
├── lineage-engine.ts           # Lineage reconstruction
└── explain.ts                  # Human-readable explanation
```

---

## Snapshot Model

A **Project OS Snapshot** is a point-in-time composite view of a project's operating state.

### Table: `project_os_snapshots`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace (RLS enforced) |
| `project_id` | uuid | Project this snapshot describes |
| `snapshot_status` | text | `generated`, `validated`, `archived` |
| `operating_health_score` | numeric(5,2) | Aggregate health 0–100 |
| `governance_health_score` | numeric(5,2) | Governance domain health |
| `execution_health_score` | numeric(5,2) | Execution domain health |
| `memory_health_score` | numeric(5,2) | Memory domain health |
| `recommendation_health_score` | numeric(5,2) | Recommendation domain health |
| `snapshot_payload` | jsonb | Full snapshot data |
| `generated_at` | timestamptz | When the snapshot was generated |
| `created_at` | timestamptz | DB record timestamp |

### Snapshot Payload Structure

```json
{
  "project": {
    "project_id": "...",
    "workspace_id": "..."
  },
  "constitution": {
    "status": "active",
    "version": 4,
    "ratified": true
  },
  "governance": {
    "active_signals": 6,
    "critical_signals": 1,
    "unresolved_violations": 2,
    "governance_health": 65
  },
  "execution": {
    "active_commitments": 14,
    "overdue_commitments": 3,
    "execution_health": 71,
    "projection_accuracy": 78
  },
  "memory": {
    "artifacts": 12,
    "memory_records": 34,
    "digests": 8,
    "learning_patterns": 5
  },
  "recommendations": {
    "active_recommendations": 5,
    "high_confidence_recommendations": 3,
    "ignored_recommendations": 1
  },
  "attention": [
    "critical_signal",
    "overdue_commitment",
    "execution_drift"
  ]
}
```

### Snapshot Lifecycle

```
generated → validated → archived
```

- **generated**: Freshly computed from domain data
- **validated**: Reviewed and confirmed by a human actor
- **archived**: Soft-archived for historical reference (never deleted)

---

## Health Model

Operating health is a **weighted average** of four domain health scores, each on a 0–100 scale.

### Weights

| Domain | Weight |
|--------|--------|
| Governance | 35% |
| Execution | 35% |
| Memory | 15% |
| Recommendation | 15% |

### Governance Health

```
penalty = criticalSignals × 25
        + (activeSignals - criticalSignals) × 5
        + unresolvedViolations × 15

governanceHealth = max(0, min(100, 100 - penalty))
```

### Execution Health

```
overdueRatio  = overdueCommitments / activeCommitments
overduePenalty = round(overdueRatio × 40)
accuracyBonus  = round((projectionAccuracy - 70) / 10)

executionHealth = max(0, min(100, 100 - overduePenalty + max(0, accuracyBonus)))
```

### Memory Health

Memory health starts at 60 (neutral) when no records exist. Each record contributes up to 40 bonus points.

```
memoryHealth = min(100, 60 + min(40, floor(totalRecords / 2)))
```

### Recommendation Health

```
penalty = ignoredRecommendations × 10
bonus   = min(10, highConfidenceRecommendations × 3)

recommendationHealth = max(0, min(100, 100 - penalty + bonus))
```

---

## Attention Model

Attention items identify elements that require human review. Each item traces to a verifiable source entity.

### Attention Types

| Type | Trigger | Default Severity |
|------|---------|-----------------|
| `critical_signal` | signal.severity = critical AND status = active | critical |
| `overdue_commitment` | commitment.due_date < now AND status not in (completed, cancelled) | high |
| `execution_drift` | drift.severity IN (persistent, critical) | high or critical |
| `governance_violation` | violation.status IN (open, unresolved) | high |
| `low_health_score` | operating_health_score < 60 | high (< 60) or critical (< 40) |
| `projection_variance` | variance.severity IN (high, critical) | matches variance severity |
| `ignored_recommendation` | recommendation.status IN (ignored, dismissed) | medium |
| `ratification_stall` | (via signal detection) | medium |
| `authority_gap` | (via signal detection) | high |

### Table: `project_os_attention_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace (RLS) |
| `snapshot_id` | uuid | Parent snapshot |
| `attention_type` | text | One of 9 types |
| `attention_severity` | text | `low`, `medium`, `high`, `critical` |
| `source_entity_type` | text | Table name of originating entity |
| `source_entity_id` | uuid | ID of originating entity |
| `title` | text | Human-readable title |
| `description` | text | Detailed description |
| `recommended_action` | text | Suggested human action |

---

## Context Model

The **Operating Context** is a denormalized, normalized view of all domain entities relevant to a project at query time. Unlike a snapshot (persisted), the context is computed on-demand.

```typescript
type ProjectOSOperatingContext = {
  projectId: string;
  workspaceId: string;
  constitution: ProjectOSConstitutionSummary | null;
  signals: Signal[];
  actions: Action[];
  commitments: Commitment[];
  projections: Projection[];
  realities: Reality[];
  recommendations: Recommendation[];
  learningPatterns: LearningPattern[];
  attentionItems: DetectedAttentionItem[];
  composedAt: string;
};
```

### Context Links

`project_os_context_links` records which domain entities were included in a snapshot, enabling traceability.

---

## Lineage

The Project OS lineage reconstructs the full chain of entities that led to the current operating state:

```
Step  1: Constitution          → project_constitutions
Step  2: Memory                → operational_memory_entries
Step  3: Digest                → constitutional_digests
Step  4: Learning              → learning_patterns
Step  5: Recommendation        → recommendations
Step  6: Signal                → governance_signals
Step  7: Action                → governance_actions
Step  8: Commitment            → governance_commitments
Step  9: Projection            → execution_projections
Step 10: Reality               → execution_realities
Step 11: Snapshot              → project_os_snapshots
```

---

## Audit Events

Every significant Project OS operation emits a platform event for audit and learning.

| Event | Trigger |
|-------|---------|
| `PROJECT_OS_SNAPSHOT_GENERATED` | Snapshot successfully generated |
| `PROJECT_OS_SNAPSHOT_VALIDATED` | Snapshot status → validated |
| `PROJECT_OS_SNAPSHOT_ARCHIVED` | Snapshot status → archived |
| `PROJECT_OS_HEALTH_CALCULATED` | Health scores computed |
| `PROJECT_OS_ATTENTION_ITEM_CREATED` | Each attention item persisted |
| `PROJECT_OS_CONTEXT_COMPOSED` | Operating context assembled |
| `PROJECT_OS_LINEAGE_GENERATED` | Lineage chain reconstructed |

---

## Usage Examples

### Generate a Snapshot

```typescript
import { generateProjectOSSnapshot } from "@/lib/project-operating-system";

const result = await generateProjectOSSnapshot({
  workspaceId: "ws-uuid",
  projectId: "proj-uuid",
  actorId: "user-uuid",
});

if (result.ok) {
  console.log("Health:", result.data.operating_health_score);
  console.log("Payload:", result.data.snapshot_payload);
}
```

### List Snapshots with Filters

```typescript
import { listProjectOSSnapshots } from "@/lib/project-operating-system";

const result = await listProjectOSSnapshots({
  workspaceId: "ws-uuid",
  projectId: "proj-uuid",
  status: "generated",
  maxHealthScore: 60,
});
```

### Get Operating Context

```typescript
import { getProjectOperatingContext } from "@/lib/project-operating-system";

const result = await getProjectOperatingContext({
  workspaceId: "ws-uuid",
  projectId: "proj-uuid",
  actorId: "user-uuid",
});

if (result.ok) {
  const { signals, commitments, attentionItems } = result.data;
  // signals: all active/acknowledged governance signals
  // commitments: all non-cancelled project commitments
  // attentionItems: detected items requiring human review
}
```

### Get Lineage

```typescript
import { getProjectOSLineageForProject } from "@/lib/project-operating-system";

const result = await getProjectOSLineageForProject({
  workspaceId: "ws-uuid",
  projectId: "proj-uuid",
  actorId: "user-uuid",
});

if (result.ok) {
  result.data.chain.forEach((layer) => {
    console.log(`${layer.layer}: ${layer.count} records`);
  });
}
```

### Explain the System

```typescript
import { explainProjectOperatingSystem } from "@/lib/project-operating-system";

const explanation = explainProjectOperatingSystem();
console.log(explanation.healthModel);
console.log(explanation.attentionModel);
console.log(explanation.lineageChain);
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| 1 | Project OS does not duplicate logic from lower domains |
| 2 | Every snapshot must belong to a project |
| 3 | Every snapshot must belong to a workspace |
| 4 | Every attention item must trace to a verifiable source entity |
| 5 | Every health score must be explainable via `explainProjectOperatingSystem()` |
| 6 | Workspace isolation is mandatory (RLS + service-level validation) |
| 7 | Snapshots are historical records |
| 8 | Archiving a snapshot does not delete it |
| 9 | Project OS does not execute actions |
| 10 | Project OS is a composition layer, not a mutation layer |

---

## Principles

1. Project OS does not replace existing domains — it orchestrates them.
2. Project OS does not duplicate business logic — it composes existing data.
3. Project OS must be explainable — every score and item has a traceable origin.
4. Project OS must be trazable — lineage is always reconstructible.
5. Project OS must respect workspace isolation — all queries filter by `workspace_id`.
6. Project OS must be auditable — every operation emits a platform event.
7. Project OS must be able to feed future interfaces — snapshots are self-contained payloads.
