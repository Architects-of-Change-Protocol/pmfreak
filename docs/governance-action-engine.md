# Governance Action Engine

**EPIC 3 — Active Governance Intelligence**
**Sprint 2 — Governance Action Engine**

## Overview

The Governance Action Engine transforms PMFreak from active observation into intelligent intervention. It converts detected governance signals into recommended, prioritized, justified, and traceable actions — evolving PMFreak from:

```
Detectar problemas
```

toward:

```
Proponer intervenciones
```

Actions are always **suggested**, never automatically executed. Human authority is preserved at every step.

---

## Architecture

```
Signal
  ↓
Action Candidate
  ↓
Authority Validation
  ↓
Execution Recommendation
  ↓
Governance Outcome
```

Full lineage chain:

```
Artifact → Memory → Digest → Learning Pattern → Recommendation → Signal → Action
```

---

## Action Model

### `GovernanceActionRow`

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Tenant boundary (mandatory) |
| `signal_id` | uuid | Originating signal (mandatory) |
| `action_type` | text | Type of recommended intervention |
| `action_priority` | text | Urgency level |
| `action_status` | text | Lifecycle status |
| `title` | text | Short summary of action |
| `description` | text | Full description |
| `recommended_owner_type` | text | Role expected to execute |
| `recommended_owner_id` | uuid | Specific recommended actor |
| `recommended_due_date` | timestamptz | Deadline derived from priority |
| `justification` | text | Evidence-backed explanation |
| `confidence_score` | numeric(4,3) | 0.0–1.0 composite confidence |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |
| `completed_at` | timestamptz | Completion timestamp |
| `expired_at` | timestamptz | Expiry timestamp |

### Action Types

| Type | Triggered By |
|---|---|
| `create_escalation` | `escalation_gap` |
| `request_ratification` | `ratification_stall` |
| `request_approval` | `approval_delay` |
| `create_delegation` | `authority_gap` |
| `assign_authority` | `authority_gap` |
| `review_amendment` | `amendment_backlog` |
| `review_decision` | `decision_bottleneck`, `delivery_drift` |
| `review_risk` | `risk_accumulation` |
| `initiate_governance_review` | `governance_violation` |
| `close_signal` | Manually triggered |
| `reassess_recommendation` | `recommendation_ignored` |
| `other` | Catch-all |

### Action Status Lifecycle

```
generated → reviewed → approved → completed
    ↓           ↓          ↓
  expired    rejected   expired
```

Terminal states: `completed`, `expired`, `rejected`

---

## Priority Model

Priority is derived deterministically from signal severity, signal type, duration, and historical outcomes.

### Formula

```
priority = base_severity + signal_type_escalation + duration_escalation + historical_escalation
```

### Signal Type Impact

- **High-impact** (`governance_violation`, `authority_gap`, `escalation_gap`): +1 priority level
- **Medium-impact** (`approval_delay`, `ratification_stall`, `decision_bottleneck`, `amendment_backlog`, `risk_accumulation`): minimum `medium`

### Duration Escalation

| Duration | Escalation |
|---|---|
| >= 8 days | +1 level |
| >= 15 days | +2 levels |

### Historical Escalation

Historical negative outcome: +1 level

### Deadlines by Priority

| Priority | Due Date |
|---|---|
| `critical` | now + 24h |
| `high` | now + 48h |
| `medium` | now + 7d |
| `low` | now + 14d |

---

## Confidence Engine

Action confidence is a 0.0–1.0 composite score:

```
confidence = signalConfidence       × 0.40
           + recommendationConfidence × 0.25
           + learningConfidence       × 0.20
           + historicalEffectiveness  × 0.15
```

| Factor | Weight | Description |
|---|---|---|
| `signalConfidence` | 40% | Confidence of the originating signal |
| `recommendationConfidence` | 25% | Confidence of any linked recommendation |
| `learningConfidence` | 20% | Confidence from matched learning patterns |
| `historicalEffectiveness` | 15% | Historical success rate of this action type |

---

## Authority Validation

Every action type maps to a required authority role. The engine validates whether the recommended actor holds that authority.

| Action Type | Required Authority |
|---|---|
| `create_escalation` | `project_manager` |
| `request_ratification` | `sponsor` |
| `request_approval` | `decision_authority` |
| `create_delegation` | `sponsor` |
| `assign_authority` | `sponsor` |
| `review_amendment` | `project_manager` |
| `review_decision` | `decision_authority` |
| `review_risk` | `risk_owner` |
| `initiate_governance_review` | `sponsor` |
| `close_signal` | `project_manager` |
| `reassess_recommendation` | `project_manager` |
| `other` | `project_manager` |

`owner` and `admin` roles are always authorized.

---

## Intervention Model

The intervention engine simulates the expected governance effect of each action without executing it. Results are advisory estimates.

### Example

```yaml
action: request_ratification
expected_effect: reduce_approval_delay
confidence: 0.78
estimated_resolution_days: 3
```

### Simulation Formula

```
simulated_confidence = profile.baseConfidence × 0.6 + action.confidenceScore × 0.4
```

---

## Action Lineage

Every action maintains a full provenance chain from artifact to action:

```
Artifact          → Source entity that triggered the signal
Memory            → Operational observations accumulated over workspace lifecycle
Digest            → Synthesized constitutional intelligence
Learning Pattern  → Recurring governance behavior recognized
Recommendation    → Prior advisory generated from pattern
Signal            → Detected governance signal (type, severity, confidence)
Action            → Recommended governance intervention
```

Reconstructed via `getActionLineage(action, signal)`.

---

## Audit Events

All lifecycle events are emitted as immutable platform events:

| Event | Trigger |
|---|---|
| `GOVERNANCE_ACTION_GENERATED` | Action created from signal |
| `GOVERNANCE_ACTION_ASSIGNED` | Action assigned to an actor |
| `GOVERNANCE_ACTION_APPROVED` | Action approved by authority |
| `GOVERNANCE_ACTION_REJECTED` | Action rejected |
| `GOVERNANCE_ACTION_COMPLETED` | Action marked completed |
| `GOVERNANCE_ACTION_EXPIRED` | Action expired past due date |
| `GOVERNANCE_ACTION_CONFIDENCE_CALCULATED` | Confidence computed |
| `GOVERNANCE_ACTION_PRIORITY_CALCULATED` | Priority computed |
| `GOVERNANCE_ACTION_AUTHORITY_VALIDATED` | Authority check performed |
| `GOVERNANCE_ACTION_LINEAGE_GENERATED` | Lineage chain reconstructed |

---

## Business Rules

1. Every action must originate from a signal.
2. Every action must have a justification.
3. Every action must have a recommended owner.
4. Every action must have a priority.
5. Every action must have a recommended due date.
6. Workspace isolation is mandatory — no action crosses workspace boundaries.
7. Every action must be auditable.
8. No orphan actions — every action has a traceable signal.
9. Actions cannot be executed automatically.
10. Every action must maintain complete lineage.

---

## Use Cases

### Transform approval_delay into action

```yaml
signal:
  type: approval_delay
  severity: high
  confidence: 0.84

→ action:
  type: request_approval
  priority: high
  recommended_owner_type: decision_authority
  recommended_due_date: now + 48h
  confidence: 0.802
  justification: >
    Action 'request_approval' is recommended because the signal indicates
    a pending approval that is stalling progress. Triggered by signal
    'Approval delayed by 5 days' (type: approval_delay). Supporting patterns:
    approval_delay, delivery_drift. This pattern has occurred 117 times
    historically. Confidence: 80.2%.
```

### Transform authority_gap into action

```yaml
signal:
  type: authority_gap
  severity: high
  confidence: 0.88

→ actions:
  - type: create_delegation
    priority: critical
    recommended_owner_type: sponsor
    recommended_due_date: now + 24h
    justification: >
      An authority gap has been detected and delegation is required to fill it.

  - type: assign_authority
    priority: high
    recommended_owner_type: sponsor
    recommended_due_date: now + 48h
```

### Simulate intervention effect

```yaml
action: initiate_governance_review
expected_effect: resolve_governance_violation
confidence: 0.882
estimated_resolution_days: 14
```

---

## Service API

```typescript
// Generate a single action from a signal
generateAction(input: GenerateActionInput): Promise<GovernanceActionResult<GovernanceActionRow>>

// Generate all actions for a signal type automatically
generateActionsForSignal(input: GenerateActionsForSignalInput): Promise<GovernanceActionResult<GovernanceActionRow[]>>

// Scan all active signals and generate actions
generateGovernanceActions(input: GenerateGovernanceActionsInput): Promise<GovernanceActionResult<GenerateActionsResult>>

// Lifecycle
assignAction(input)   → assign responsible actor
approveAction(input)  → approve for execution
rejectAction(input)   → reject as not applicable
completeAction(input) → mark completed
expireAction(input)   → mark expired past due date

// Query
getAction(input)   → action with evidence and assignments
listActions(input) → filtered list

// Intelligence
getActionLineageForAction(input)          → full 7-layer lineage chain
simulateGovernanceIntervention(type, c)   → expected effect simulation
explainGovernanceActions()                → full system explanation
```
