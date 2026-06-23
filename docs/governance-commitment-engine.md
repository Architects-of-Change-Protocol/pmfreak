# Governance Commitment Engine

**EPIC 3 — Active Governance Intelligence**
**Sprint 3 — Governance Commitment Engine**

---

## Overview

The Governance Commitment Engine transforms PMFreak from intelligent intervention into operational accountability. It converts governance actions into verifiable, auditable, and traceable commitments with explicit human ownership, enabling PMFreak to answer:

- Who accepted the action?
- Who is responsible?
- When did they accept?
- Did they execute?
- Did they breach?
- Is it overdue?
- Was it delegated?

Commitments are **human obligations**, never automatic executions.

---

## Architecture

```
Signal
  ↓
Action
  ↓
Commitment
  ↓
Outcome
```

---

## Commitment Model

### governance_commitments

| Field                  | Type        | Description                          |
|------------------------|-------------|--------------------------------------|
| id                     | uuid        | Primary key                          |
| workspace_id           | uuid        | Workspace isolation                  |
| action_id              | uuid        | Originating governance action        |
| commitment_title       | text        | Human-readable title                 |
| commitment_description | text        | Full description                     |
| owner_id               | uuid        | Responsible actor                    |
| owner_type             | text        | Role type of owner                   |
| priority               | text        | low / medium / high / critical       |
| status                 | text        | Lifecycle status (9 values)          |
| due_date               | timestamptz | Deadline                             |
| accepted_at            | timestamptz | When owner accepted                  |
| started_at             | timestamptz | When execution began                 |
| completed_at           | timestamptz | When fulfilled                       |
| cancelled_at           | timestamptz | When cancelled                       |
| breached_at            | timestamptz | When breach was registered           |
| expired_at             | timestamptz | When it expired                      |
| outcome                | text        | successful / partial / failed / unknown |
| created_at             | timestamptz | Record creation timestamp            |
| updated_at             | timestamptz | Last modification timestamp          |

### governance_commitment_history

| Field           | Type        | Description                        |
|-----------------|-------------|------------------------------------|
| id              | uuid        | Primary key                        |
| workspace_id    | uuid        | Workspace isolation                |
| commitment_id   | uuid        | Parent commitment                  |
| previous_status | text        | Status before transition           |
| new_status      | text        | Status after transition            |
| changed_by      | uuid        | Actor who caused the change        |
| reason          | text        | Optional reason for change         |
| created_at      | timestamptz | When the transition occurred       |

### governance_commitment_delegations

| Field         | Type        | Description                         |
|---------------|-------------|-------------------------------------|
| id            | uuid        | Primary key                         |
| workspace_id  | uuid        | Workspace isolation                 |
| commitment_id | uuid        | Commitment being delegated          |
| delegated_by  | uuid        | Actor delegating                    |
| delegated_to  | uuid        | Actor receiving delegation          |
| reason        | text        | Reason for delegation               |
| delegated_at  | timestamptz | When delegation was created         |
| accepted_at   | timestamptz | When delegate accepted              |
| status        | text        | pending / accepted / rejected / cancelled |
| created_at    | timestamptz | Record creation                     |

### governance_commitment_evidence

| Field            | Type        | Description                        |
|------------------|-------------|------------------------------------|
| id               | uuid        | Primary key                        |
| workspace_id     | uuid        | Workspace isolation                |
| commitment_id    | uuid        | Commitment being supported         |
| artifact_id      | uuid        | Optional artifact reference        |
| memory_record_id | uuid        | Optional memory record reference   |
| description      | text        | Evidence description               |
| created_at       | timestamptz | When evidence was attached         |

---

## Lifecycle Model

### Status Values

| Status             | Description                                     |
|--------------------|-------------------------------------------------|
| pending_acceptance | Initial state. Awaiting owner acceptance.        |
| accepted           | Owner formally accepted. Timestamp recorded.    |
| rejected           | Owner rejected. Terminal.                       |
| active             | Execution in progress.                          |
| completed          | Fulfilled. Outcome recorded. Terminal.          |
| breached           | Not fulfilled by due_date. Terminal.            |
| cancelled          | Cancelled before completion. Terminal.          |
| delegated          | Transferred to another actor.                   |
| expired            | Passed due date without acceptance. Terminal.   |

### State Machine

```
pending_acceptance → accepted, rejected, expired
accepted           → active, cancelled, delegated
active             → completed, breached, cancelled, expired, delegated
delegated          → accepted, active, cancelled
completed          → (terminal)
breached           → (terminal)
cancelled          → (terminal)
rejected           → (terminal)
expired            → (terminal)
```

**Terminal states are irreversible.** Every transition is recorded in `governance_commitment_history`.

---

## Accountability Model

The `calculateCommitmentAccountability()` function answers, per commitment:

```yaml
commitment: GOV-COM-12
owner: victor_valverde_id
accepted: true
completed: false
overdue: true
daysLate: 11
status: active
```

**Logic:**
- `overdue = due_date < now AND status ∉ {completed, cancelled, rejected}`
- `daysLate = floor((now - due_date) / MS_PER_DAY)` if overdue, else 0
- `accepted = accepted_at !== null`
- `completed = status === "completed"`

---

## Delegation Model

The `validateCommitmentDelegation()` function enforces:

1. **Authority** — Only the current owner may delegate.
2. **Delegation Rights** — Cannot delegate to yourself.
3. **Ownership Rules** — Cannot delegate a commitment in a terminal state.
4. **Active Delegation Check** — Cannot delegate if an active delegation already exists.

When delegation succeeds:
- A `governance_commitment_delegations` record is created with status `pending`.
- The commitment's `owner_id` is updated to the new delegate.
- Status transitions to `delegated`.
- History record and audit event are emitted.

---

## Commitment Health Engine

`calculateCommitmentHealth()` produces a 0–100 score:

```
score = completionRate × 100 − (breachRate × 40) − (overdueRate × 30)
score = clamp(score, 0, 100)
```

**Interpretation:**

| Score Range | Health        |
|-------------|---------------|
| 80–100      | Healthy       |
| 60–79       | Watch         |
| 40–59       | Elevated risk |
| 0–39        | Critical      |

---

## Breach Detection Engine

`detectCommitmentBreaches()` scans commitments where:

```
due_date < now
AND status ∉ {completed, cancelled, rejected, breached, expired}
```

Returns a report with:
- `commitmentId`, `title`, `ownerId`, `dueDate`, `status`, `daysOverdue`

---

## Forecast Model

`forecastCommitmentOutcome()` estimates:

```yaml
commitment: GOV-COM-31
probabilityOfCompletion: 0.82
riskOfBreach: 0.18
```

**Formula:**

```
p = base(priority) + statusMod + timeMod + severityMod + historicalMod
p = clamp(p, 0.0, 1.0)
riskOfBreach = 1 - p
```

**Components:**

| Factor                  | Base Value               | Modifier                   |
|-------------------------|--------------------------|----------------------------|
| Priority (critical)     | 0.55                     | Lowest base                |
| Priority (low)          | 0.85                     | Highest base               |
| Status (active)         | +0.20                    | Boosts probability         |
| Status (pending)        | -0.05                    | Reduces probability        |
| Days until due (< 0)    | -0.20                    | Already overdue            |
| Signal (critical)       | -0.15                    | High contextual risk       |
| Historical (0.9)        | +0.08                    | Strong past performance    |

---

## Lineage

`getCommitmentLineage()` reconstructs the full chain:

```
Artifact              (constitutional_artifact)
  ↓
Memory                (constitutional_memory_record)
  ↓
Digest                (constitutional_digest)
  ↓
Learning Pattern      (constitutional_learning_pattern)
  ↓
Recommendation        (constitutional_recommendation)
  ↓
Signal                (governance_signal)
  ↓
Action                (governance_action)
  ↓
Commitment            (governance_commitment)
```

---

## Audit Events

| Event                                      | Trigger                         |
|--------------------------------------------|---------------------------------|
| GOVERNANCE_COMMITMENT_CREATED              | `createCommitment()`            |
| GOVERNANCE_COMMITMENT_ACCEPTED             | `acceptCommitment()`            |
| GOVERNANCE_COMMITMENT_REJECTED             | `rejectCommitment()`            |
| GOVERNANCE_COMMITMENT_ACTIVATED            | `activateCommitment()`          |
| GOVERNANCE_COMMITMENT_COMPLETED            | `completeCommitment()`          |
| GOVERNANCE_COMMITMENT_CANCELLED            | `cancelCommitment()`            |
| GOVERNANCE_COMMITMENT_BREACHED             | `breachCommitment()`            |
| GOVERNANCE_COMMITMENT_EXPIRED              | `expireCommitment()`            |
| GOVERNANCE_COMMITMENT_DELEGATED            | `delegateCommitment()`          |
| GOVERNANCE_COMMITMENT_FORECAST_GENERATED   | `forecastCommitment()`          |
| GOVERNANCE_COMMITMENT_HEALTH_CALCULATED    | `getCommitmentHealth()`         |
| GOVERNANCE_COMMITMENT_LINEAGE_GENERATED    | `getCommitmentLineageForCommitment()` |

---

## Business Rules

1. Every commitment must originate from an action.
2. Every commitment must have a responsible owner.
3. Every acceptance must record a timestamp.
4. Every breach must be recorded.
5. Every delegation must be validated.
6. Workspace isolation is mandatory.
7. No orphan commitments — every commitment has a traceable action.
8. Terminal states are irreversible.
9. Every transition must generate an audit history record.
10. Every commitment must maintain complete lineage.

---

## Use Cases

### Transform an action into a commitment

```typescript
const commitment = await createCommitment({
  workspaceId: "...",
  actionId: "action_123",
  commitmentTitle: "Request Sponsor Ratification",
  commitmentDescription: "Sponsor must ratify amendment 7 before July 15.",
  ownerId: "sponsor_456",
  ownerType: "sponsor",
  priority: "high",
  dueDate: "2026-07-12T00:00:00Z",
  actorId: "system",
});
```

### Accept a commitment

```typescript
const accepted = await acceptCommitment({
  workspaceId: "...",
  commitmentId: "commitment_123",
  actorId: "sponsor_456",
});
```

### Detect breaches

```typescript
const report = await detectBreaches("workspace_123", "system");
// report.breaches → [{ commitmentId, title, ownerId, daysOverdue }]
```

### Forecast outcome

```typescript
const forecast = await forecastCommitment({
  workspaceId: "...",
  commitmentId: "commitment_123",
  actorId: "system",
  signalSeverity: "high",
  historicalEffectiveness: 0.72,
});
// forecast.probabilityOfCompletion → 0.74
// forecast.riskOfBreach → 0.26
```

### Get workspace health

```typescript
const health = await getCommitmentHealth("workspace_123", "system");
// health.score → 68
// health.breached → 2
// health.overdue → 1
```

### Get full lineage

```typescript
const lineage = await getCommitmentLineageForCommitment({
  workspaceId: "...",
  commitmentId: "commitment_123",
  actorId: "system",
});
// lineage.chain → 8-layer chain from artifact to commitment
```

---

## Module Structure

```
src/lib/governance-commitments/
  types.ts                            — Domain types, Result type, input/output types
  governance-commitment-repository.ts — Supabase data access layer
  lifecycle-engine.ts                 — State machine (canTransition, isTerminal)
  accountability-engine.ts            — Per-commitment accountability calculation
  health-engine.ts                    — 0–100 workspace health score
  breach-engine.ts                    — Overdue commitment detection
  delegation-engine.ts                — Delegation validation rules
  forecast-engine.ts                  — Probability of completion / risk of breach
  lineage.ts                          — 8-layer lineage reconstruction
  explain.ts                          — Human-readable explanation of all capabilities
  commitment-registry.ts              — Service layer (all business operations)
  index.ts                            — Public API exports
```
