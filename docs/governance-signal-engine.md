# Governance Signal Engine

**EPIC 3 — Sprint 1**

## Overview

The Governance Signal Engine transforms PMFreak from a retrospective intelligence system into an **active operational intelligence system**. It continuously observes the constitutional state of active workspaces and generates actionable, time-bound, explainable signals before governance problems materialize.

The engine answers:
- *What is happening right now?*
- *What needs immediate attention?*
- *What historical pattern is repeating?*
- *What risk is emerging?*

## Architecture

```
Project Activity
     ↓
Governance Observation
     ↓
Signal Detection
     ↓
Signal Classification
     ↓
Signal Recommendation
```

### Institutional Lineage Chain

Every signal can be traced back through the full institutional memory:

```
Artifact
  ↓
Memory
  ↓
Digest
  ↓
Learning Pattern
  ↓
Recommendation
  ↓
Signal
```

## Signal Categories

| Type | Description | Default Severity |
|------|-------------|-----------------|
| `approval_delay` | Decision awaiting approval beyond threshold | medium |
| `authority_gap` | Expired or revoked authority registration | high |
| `escalation_gap` | High-severity issue without escalation | high |
| `decision_bottleneck` | Decision process stalled | medium |
| `amendment_backlog` | Multiple amendments pending approval | medium |
| `ratification_stall` | Signature request pending beyond threshold | medium |
| `risk_accumulation` | Unmitigated risks accumulating | medium |
| `recommendation_ignored` | Repeated recommendation never applied | low |
| `governance_violation` | Open governance violation | critical |
| `delivery_drift` | Delivery timeline slipping | low |

## Signal Lifecycle

```
detected → active → acknowledged → resolved
                 ↘              ↗
                  → dismissed
```

| Status | Description |
|--------|-------------|
| `active` | Signal detected, not yet reviewed |
| `acknowledged` | Responsible party recorded, under review |
| `resolved` | Underlying condition corrected |
| `dismissed` | Deemed non-actionable (reason required) |

## Detection Model

Detection rules are **deterministic threshold checks** — no ML or LLM required. Rules are applied per signal category against current workspace state.

### Implemented Detection Rules

**Approval Delay** (`approval_delay`)
- Condition: Decision in `proposed` or `submitted` status for ≥ 3 days
- Source table: `constitutional_decisions`
- Base confidence: 0.90

**Authority Gap** (`authority_gap`)
- Condition: Authority registration with status `expired` or `revoked`
- Source table: `authority_registrations`
- Base confidence: 0.88

**Escalation Gap** (`escalation_gap`)
- Condition: High/critical severity open violation with no linked escalation
- Source table: `governance_violations`, `authority_escalations`
- Base confidence: 0.85

**Amendment Backlog** (`amendment_backlog`)
- Condition: 3 or more amendments in `proposed` or `draft` status
- Source table: `constitution_amendments`
- Base confidence: 0.85

**Ratification Stall** (`ratification_stall`)
- Condition: Signature request pending ≥ 7 days
- Source table: `constitutional_signature_requests`
- Base confidence: 0.88

**Governance Violation** (`governance_violation`)
- Condition: Any open governance violation
- Source table: `governance_violations`
- Base confidence: 1.00

### Deduplication

The detection engine checks existing `active` signals before persisting new ones. Signals with matching `(signal_type, source_entity_id)` pairs are skipped to prevent duplication.

## Confidence Model

Confidence is a `0.0–1.0` score computed from four weighted factors:

```
confidence =
  patternMatch        × 0.40
  + evidenceStrength  × 0.30
  + historicalFrequency × 0.20
  + currentContext    × 0.10
```

| Factor | Weight | Description |
|--------|--------|-------------|
| `patternMatch` | 40% | How precisely the observation satisfies the detection rule |
| `evidenceStrength` | 30% | Volume and quality of supporting evidence |
| `historicalFrequency` | 20% | Prior occurrences of this signal type |
| `currentContext` | 10% | Duration, entity criticality, co-active signals |

### Evidence Strength

```
evidenceStrength = avg(weight) × 0.70 + min(1, count/5) × 0.30
```

### Historical Frequency

- 0 prior occurrences → 0.20 (small base for new detections)
- 1 prior → 0.36
- 3 prior → 0.68
- 5+ prior → 1.00 (capped)

## Severity Model

Severity is derived from a type baseline, escalated by duration and context.

### Baselines

| Signal Type | Baseline |
|-------------|----------|
| `governance_violation` | critical |
| `authority_gap` | high |
| `escalation_gap` | high |
| `approval_delay` | medium |
| `ratification_stall` | medium |
| `decision_bottleneck` | medium |
| `amendment_backlog` | medium |
| `risk_accumulation` | medium |
| `recommendation_ignored` | low |
| `delivery_drift` | low |

### Escalation Rules

| Condition | Effect |
|-----------|--------|
| Duration ≥ 8 days | +1 severity level |
| Duration ≥ 15 days | +2 severity levels |
| Historical negative outcome | +1 severity level |
| 5+ affected entities | +1 severity level |

## Governance Health Model

The Governance Health score is a `0–100` metric reflecting the current signal landscape of a workspace.

```
health = 100
  − (critical × 25)
  − (high     × 10)
  − (medium   × 5)
  − (low      × 2)
  + min(10, resolved × 1)
```

### Interpretation

| Score | Status |
|-------|--------|
| 90–100 | Excellent |
| 70–89 | Good |
| 50–69 | Moderate — attention required |
| 25–49 | Poor — multiple high-severity signals |
| 0–24 | Critical — governance failure risk |

## Signal Correlation Model

The correlation engine identifies causal relationships between co-existing active signals.

| From | To | Confidence | Reason |
|------|----|-----------|--------|
| `approval_delay` | `delivery_drift` | 0.80 | Delays cascade into delivery drift |
| `authority_gap` | `governance_violation` | 0.82 | Absent authority enables violations |
| `escalation_gap` | `governance_violation` | 0.75 | Unescalated issues become violations |
| `amendment_backlog` | `ratification_stall` | 0.78 | Backlogs block ratification |
| `recommendation_ignored` | `governance_violation` | 0.70 | Ignored recommendations signal governance gaps |
| `risk_accumulation` | `delivery_drift` | 0.76 | Unmitigated risks affect delivery |
| `decision_bottleneck` | `delivery_drift` | 0.72 | Bottlenecks stall execution |
| `ratification_stall` | `delivery_drift` | 0.74 | Stalled ratification blocks execution |

## Recommendation Integration

The signal engine associates detected signals with existing constitutional recommendations via signal type → recommendation type affinity mapping.

| Signal Type | Affinity Recommendation Types |
|-------------|-------------------------------|
| `approval_delay` | `ratification_control`, `decision_guidance` |
| `authority_gap` | `authority_control`, `governance_control` |
| `escalation_gap` | `authority_control`, `governance_control` |
| `decision_bottleneck` | `decision_guidance`, `ratification_control` |
| `amendment_backlog` | `amendment_guidance`, `governance_control` |
| `ratification_stall` | `ratification_control`, `amendment_guidance` |
| `risk_accumulation` | `risk_mitigation`, `governance_control` |
| `recommendation_ignored` | `governance_control`, `delivery_improvement` |
| `governance_violation` | `governance_control`, `authority_control` |
| `delivery_drift` | `delivery_improvement`, `risk_mitigation` |

## Audit Events

Every state transition emits an immutable platform event:

| Event | Trigger |
|-------|---------|
| `GOVERNANCE_SIGNAL_DETECTED` | Signal created via `detectSignal()` |
| `GOVERNANCE_SIGNAL_ACKNOWLEDGED` | Signal acknowledged via `acknowledgeSignal()` |
| `GOVERNANCE_SIGNAL_RESOLVED` | Signal resolved via `resolveSignal()` |
| `GOVERNANCE_SIGNAL_DISMISSED` | Signal dismissed via `dismissSignal()` |
| `GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED` | Confidence score computed |
| `GOVERNANCE_SIGNAL_SEVERITY_CALCULATED` | Severity level computed |
| `GOVERNANCE_SIGNAL_CORRELATED` | Correlations computed via `correlateWorkspaceSignals()` |
| `GOVERNANCE_HEALTH_CALCULATED` | Health score computed via `getGovernanceHealth()` |

## Business Rules

1. Every signal must have a verifiable origin (`source_entity_id`).
2. Every signal must have at least one piece of evidence.
3. Every signal must be resolvable via acknowledge, resolve, or dismiss.
4. Every resolution and dismissal must be auditable.
5. Workspace isolation is mandatory — no signal crosses workspace boundaries.
6. Signals are not permanent — they are either resolved or dismissed.
7. Signals participate in Governance Health calculation.
8. No orphan signals — a signal without traceable source entity is rejected.

## Data Model

### `governance_signals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace isolation FK |
| `signal_type` | text | One of 10 signal categories |
| `signal_source` | text | Entity type that originated the signal |
| `source_entity_type` | text | Table name of source entity |
| `source_entity_id` | uuid | ID of source entity |
| `title` | text | Human-readable signal title |
| `description` | text | Detailed signal description |
| `severity` | text | low / medium / high / critical |
| `confidence_score` | numeric | 0.0–1.0 |
| `status` | text | active / acknowledged / resolved / dismissed |
| `detected_at` | timestamptz | When the signal was first detected |
| `acknowledged_at` | timestamptz | When acknowledged (nullable) |
| `acknowledged_by` | uuid | Who acknowledged (nullable) |
| `resolved_at` | timestamptz | When resolved (nullable) |
| `resolved_by` | uuid | Who resolved (nullable) |
| `dismissed_at` | timestamptz | When dismissed (nullable) |
| `dismissed_by` | uuid | Who dismissed (nullable) |
| `dismissed_reason` | text | Why dismissed (nullable) |

### `governance_signal_evidence`

Evidence items linking signals to observable entities.

### `governance_signal_recommendations`

Links signals to relevant constitutional recommendations.

## API Reference

```typescript
// Detect and persist a signal
detectSignal(input: DetectSignalInput): Promise<GovernanceSignalResult<GovernanceSignalRow>>

// Lifecycle transitions
acknowledgeSignal(input: AcknowledgeSignalInput): Promise<GovernanceSignalResult<GovernanceSignalRow>>
resolveSignal(input: ResolveSignalInput): Promise<GovernanceSignalResult<GovernanceSignalRow>>
dismissSignal(input: DismissSignalInput): Promise<GovernanceSignalResult<GovernanceSignalRow>>

// Queries
getSignal(signalId, workspaceId): Promise<GovernanceSignalResult<GovernanceSignalRow>>
listSignals(input: ListSignalsInput): Promise<GovernanceSignalResult<GovernanceSignalRow[]>>

// Detection engine orchestrator
detectGovernanceSignalsForWorkspace(input): Promise<GovernanceSignalResult<DetectionSummary>>

// Analytics
correlateWorkspaceSignals(workspaceId, actorId): Promise<GovernanceSignalResult<SignalCorrelation[]>>
getGovernanceHealth(workspaceId, actorId): Promise<GovernanceSignalResult<GovernanceHealthScore>>

// Lineage
getSignalLineage(signalId, workspaceId): Promise<GovernanceSignalResult<SignalLineage>>

// Explain
explainGovernanceSignals(): GovernanceSignalExplanation
```

## Use Cases

1. **Proactive Approval Management** — Detect an approval delay before it cascades into a delivery blocker.
2. **Authority Gap Prevention** — Surface expired authority before unauthorized decisions are made.
3. **Violation Escalation** — Identify open violations and route them to the appropriate escalation chain.
4. **Pattern Correlation** — Connect an approval delay signal to a concurrent delivery drift signal.
5. **Governance Health Dashboard** — Compute a 0–100 workspace health score from active signals.
6. **Full Accountability** — Trace any signal back to its originating artifact for audit compliance.
7. **Recommendation Routing** — Associate each signal with relevant constitutional recommendations.
