# Execution Projection Engine

**EPIC 3 — Active Governance Intelligence**
**Sprint 4**

## Overview

The Execution Projection Engine transforms accepted governance commitments into structured execution projections. A projection models the work required to fulfil a commitment without scheduling, assigning, or executing that work.

```
Signal
  ↓
Action
  ↓
Commitment
  ↓
Execution Projection
  ↓
Execution Candidate
```

---

## Architecture

The engine is composed of six independent sub-engines coordinated by the Projection Registry:

```
Projection Registry
  ├── Projection Templates     — deterministic task structure per action type
  ├── Effort Engine            — estimates hours and days from task templates
  ├── Dependency Engine        — derives governance dependencies from action type
  ├── Participant Engine       — suggests role-based participants
  ├── Risk Engine              — calculates execution risk from five factors
  ├── Confidence Engine        — scores projection confidence (0.0–1.0)
  ├── Readiness Engine         — scores execution readiness (0–100)
  ├── Lineage Engine           — reconstructs the full constitutional chain
  ├── Explain Engine           — produces human-readable explanations
  └── Comparison Engine        — diffs two projections
```

All engines are deterministic and pure — same inputs always produce same outputs.

---

## Projection Model

### Tables

| Table | Purpose |
|---|---|
| `execution_projections` | Core projection record |
| `execution_projection_tasks` | Ordered projected tasks |
| `execution_projection_dependencies` | Required governance dependencies |
| `execution_projection_participants` | Suggested role-based participants |

### Projection Statuses

```
generated → validated → approved
          ↘           ↘
           rejected    archived
```

| Status | Description |
|---|---|
| `generated` | Freshly generated from a commitment |
| `validated` | Verified for internal consistency |
| `approved` | Formally accepted for execution planning |
| `rejected` | Rejected at any non-terminal stage |
| `archived` | Soft-archived; never deleted |

---

## Effort Model

Effort is calculated from the sum of task hours in the projection template.

```
estimated_hours = Σ task.estimatedHours
estimated_days  = ceil(estimated_hours / 6)   -- 6 governance hours per day
```

The 6-hour governance day accounts for coordination overhead, reviews, and context switching inherent in governance work.

### Effort by Action Type

| Action Type | Tasks | Hours | Days |
|---|---|---|---|
| `create_delegation` | 4 | 8h | 2d |
| `request_ratification` | 4 | 8h | 2d |
| `review_amendment` | 4 | 12h | 2d |
| `initiate_governance_review` | 4 | 12h | 2d |
| `review_decision` | 4 | 8h | 2d |
| `assign_authority` | 4 | 8h | 2d |
| `other` (default) | 4 | 8h | 2d |

---

## Risk Model

Risk is calculated from five weighted factors:

| Factor | Contribution |
|---|---|
| Commitment Priority | 0 (low) → 3 (critical) |
| Signal Severity | 0 (low) → 3 (critical) |
| Dependency Count | 0 (<3 deps) → 2 (≥5 deps) |
| Historical Effectiveness | 0 (high) → 2 (low <0.4) |
| Recommendation Confidence | 0 (high) → 2 (low <0.4) |

**Risk score to risk level mapping:**

| Score | Risk Level |
|---|---|
| 0–2 | `low` |
| 3–5 | `medium` |
| 6–8 | `high` |
| 9–12 | `critical` |

---

## Confidence Model

Confidence (0.0–1.0) starts at a baseline of 0.5 and is adjusted by:

| Factor | Weight |
|---|---|
| Known action type | +0.15 / -0.10 |
| Historical similarity | ±0.30 × (similarity − 0.5) |
| Learning evidence | ±0.20 × (evidence − 0.5) |
| Recommendation confidence | ±0.20 × (confidence − 0.5) |
| Signal confidence | ±0.15 × (confidence − 0.5) |

Score is clamped to [0.0, 1.0] and rounded to 3 decimal places.

---

## Readiness Model

Execution readiness (0–100) is a binary score across five governance factors, each contributing 20 points:

| Factor | Points |
|---|---|
| Authority Ready | 20 |
| Dependencies Ready | 20 |
| Commitment Accepted | 20 |
| Recommendation Validated | 20 |
| Governance Health | 20 |

A score of 100 indicates the projection is ready for execution planning. A score below 60 indicates significant governance gaps.

---

## Projection Lineage

Every projection traces its complete constitutional ancestry:

```
Artifact (constitutional_artifact)
  ↓
Memory Record (constitutional_memory_record)
  ↓
Digest (constitutional_digest)
  ↓
Learning Pattern (constitutional_learning_pattern)
  ↓
Recommendation (constitutional_recommendation)
  ↓
Signal (governance_signal)
  ↓
Action (governance_action)
  ↓
Commitment (governance_commitment)
  ↓
Execution Projection (execution_projection)
```

---

## Business Rules

1. Every projection must originate from a commitment.
2. Every projection must have tasks.
3. Every projection must have estimated effort > 0.
4. Every projection must have a projected risk.
5. Every projection must have a confidence score.
6. Workspace isolation is mandatory (RLS + application-layer UUID validation).
7. No orphan projections — projection is rejected if commitment not found.
8. Every projection is traceable via lineage.
9. Every projection can be regenerated by calling `generateExecutionProjection` again.
10. Projections never execute real work — no tasks are created in the backlog, no calendar events are scheduled, no resources are allocated.

---

## Dependency Types

| Type | Criticality | Description |
|---|---|---|
| `decision` | high | Depends on a governance decision being in place |
| `authority` | critical | Depends on authority being registered |
| `ratification` | high | Depends on formal ratification |
| `amendment` | medium | Depends on a proposed amendment |
| `resource` | low | Depends on resource availability |

Every projection automatically includes a `decision` dependency on the originating commitment (criticality: critical).

---

## Audit Events

| Event | Trigger |
|---|---|
| `EXECUTION_PROJECTION_GENERATED` | Projection created |
| `EXECUTION_PROJECTION_VALIDATED` | Projection validated |
| `EXECUTION_PROJECTION_APPROVED` | Projection approved |
| `EXECUTION_PROJECTION_REJECTED` | Projection rejected |
| `EXECUTION_PROJECTION_ARCHIVED` | Projection archived |
| `EXECUTION_PROJECTION_EFFORT_CALCULATED` | Effort computed during generation |
| `EXECUTION_PROJECTION_RISK_CALCULATED` | Risk computed during generation |
| `EXECUTION_PROJECTION_CONFIDENCE_CALCULATED` | Confidence computed during generation |
| `EXECUTION_PROJECTION_READINESS_CALCULATED` | Readiness computed on demand |
| `EXECUTION_PROJECTION_LINEAGE_GENERATED` | Lineage reconstructed on demand |

All events flow through `platform_events` with `event_category: "governance"` and `learning_eligible: true`.

---

## Use Cases

### Example 1: Create Delegation

```
Input:
  commitment_title: "Create Delegation for Amendment 7"
  commitment_priority: high

Output:
  projection:
    tasks:
      - Validate Authority     (2h, sponsor)
      - Prepare Delegation     (2h, project_manager)
      - Review Delegation      (2h, sponsor)
      - Approve Delegation     (2h, sponsor)
    effort:      8h / 2 days
    participants: sponsor, project_manager
    risk:        medium
    confidence:  0.650
```

### Example 2: Review Amendment

```
Input:
  commitment_title: "Review Amendment 12 — Technical Scope"
  commitment_priority: critical

Output:
  projection:
    tasks:
      - Review Amendment           (3h, technical_lead)
      - Impact Assessment          (4h, technical_lead)
      - Governance Validation      (3h, sponsor)
      - Approval Recommendation    (2h, project_manager)
    effort:      12h / 2 days
    participants: sponsor, project_manager, technical_lead
    risk:        high
    confidence:  0.650
```

### Example 3: Request Ratification

```
Input:
  commitment_title: "Request Ratification of Constitution v3"
  commitment_priority: critical

Output:
  projection:
    tasks:
      - Prepare Ratification Package  (3h, project_manager)
      - Identify Approvers            (1h, sponsor)
      - Execute Review                (3h, sponsor)
      - Record Ratification           (1h, project_manager)
    effort:      8h / 2 days
    participants: sponsor, project_manager
    risk:        high
    confidence:  0.650
```

### Example 4: Comparing Two Projections

```
projection_a:
  effort:     8h
  risk:       medium
  confidence: 0.70

projection_b:
  effort:     16h
  risk:       high
  confidence: 0.55

comparison:
  effortDifferenceHours:   +8
  durationDifferenceDays:  +1
  riskComparison:          b_higher_by_1
  confidenceDifference:    -0.15
```

---

## API

```typescript
// Generate a projection from a commitment
generateExecutionProjection({ workspaceId, commitmentId, actorId })

// Lifecycle
validateExecutionProjection({ workspaceId, projectionId, actorId })
approveExecutionProjection({ workspaceId, projectionId, actorId })
rejectExecutionProjection({ workspaceId, projectionId, reason, actorId })
archiveExecutionProjection({ workspaceId, projectionId, actorId })

// Query
getExecutionProjection({ workspaceId, projectionId })
listExecutionProjections({ workspaceId, status?, risk?, commitmentId? })

// Intelligence
getProjectionLineage(projectionId, workspaceId, commitment, action, signal)
getProjectionReadiness(projectionId, workspaceId, { authorityReady, ... })
getProjectionExplanation(projectionId, workspaceId, commitmentTitle)
compareProjections(projectionIdA, projectionIdB, workspaceId)
```

---

## Constraints

- **NO UI** — engine is service-layer only.
- **NO real task creation** — tasks are projected, never instantiated in a backlog.
- **NO calendar integration** — duration is an estimate, not a schedule.
- **NO automatic execution** — projections require explicit human action to proceed.
- **Soft archive only** — projections are never hard-deleted.
- **Workspace isolation** — all operations enforce `workspace_id` at both RLS and application layers.
