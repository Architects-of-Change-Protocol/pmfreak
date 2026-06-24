# PMO Governance Compliance Engine

EPIC 6 · Sprint 4

---

## Architecture

The PMO Governance Compliance Engine transforms governance from a set of control mechanisms into a measurable organizational capability. It evaluates the degree to which Project Managers, projects, and the PMO adhere to the constitutional model defined by PMFreak.

```
Constitution
    ↓
Authority
    ↓
Ratification
    ↓
Decision
    ↓
Execution
    ↓
Learning
    ↓
Governance Compliance Snapshot
```

### Module Location

```
src/lib/pmo-governance-compliance/
├── types.ts                          — Types, constants, input/output shapes
├── index.ts                          — Public exports
├── compliance-registry.ts            — Core snapshot generation and retrieval
├── scorecard.ts                      — Per-PM scorecard generation
├── comparison.ts                     — PM-to-PM compliance comparison
├── pmo-summary.ts                    — Organization-wide compliance summary
├── lineage.ts                        — Full traceability chain reconstruction
├── explain.ts                        — Engine self-description
└── engines/
    ├── constitution-compliance.ts    — Constitution domain engine
    ├── authority-compliance.ts       — Authority domain engine
    ├── ratification-compliance.ts    — Ratification domain engine
    ├── decision-compliance.ts        — Decision domain engine
    ├── execution-compliance.ts       — Execution domain engine
    ├── learning-compliance.ts        — Learning domain engine
    ├── overall-compliance.ts         — Weighted overall score
    ├── status-classification.ts      — Score → status mapping
    ├── gap-detection.ts              — Governance gap detection
    ├── debt-engine.ts                — Governance debt aggregation
    └── hotspot-engine.ts             — Domain hotspot identification
```

### Database Tables

```
governance_compliance_snapshots   — Historical per-PM compliance snapshots
governance_compliance_gaps        — Governance gaps detected per snapshot
governance_compliance_evidence    — Evidence sources per snapshot
```

---

## Compliance Domains

Each domain produces a score from 0 to 100 and contributes to the overall compliance score with a fixed weight.

| Domain        | Weight | Source Tables                                                        |
|---------------|--------|----------------------------------------------------------------------|
| constitution  | 15%    | `project_constitutions`, `constitutional_amendments`                 |
| authority     | 20%    | `authority_assignments`                                              |
| ratification  | 15%    | `constitutional_ratifications`                                       |
| decision      | 20%    | `operational_decisions`, `operational_decision_outcomes`             |
| execution     | 20%    | `governance_commitments`, `execution_realities`, `execution_tasks`   |
| learning      | 10%    | `operational_memory`, `constitutional_digests`, `constitutional_learnings`, `sovereign_recommendations` |

### Constitution Domain

Evaluates whether projects operate under a valid, complete constitutional framework.

```
score = lifecycle_rate × 30 + amendment_rate × 20 + completeness_rate × 50
```

- **lifecycle_rate**: constitutions with valid lifecycle / total constitutions
- **amendment_rate**: constitutions with amendments / total constitutions
- **completeness_rate**: complete constitutions / total constitutions
- If no constitutions exist: returns default score of 75

### Authority Domain

Evaluates whether authority assignments are valid, current, and properly scoped.

```
score = 100 − expired_penalty − revoked_penalty − delegation_penalty − unauthorized_penalty
```

| Condition | Penalty | Max |
|---|---|---|
| Expired authority | 5 per | 30 |
| Revoked authority | 3 per | 20 |
| Invalid delegation | 8 per | 30 |
| Unauthorized action | 10 per | 40 |

### Ratification Domain

Evaluates whether decisions requiring ratification have been properly ratified.

```
score = 100 − pending_penalty − expired_penalty − missing_penalty
```

| Condition | Penalty | Max |
|---|---|---|
| Pending ratification | 4 per | 30 |
| Expired ratification | 8 per | 35 |
| Missing ratification | 10 per | 40 |

### Decision Domain

Evaluates whether decisions are made with proper lineage, authority, and accountability.

```
score = lineage_rate × 25 + authority_rate × 30 + outcome_rate × 25 + accountability_rate × 20
```

### Execution Domain

Evaluates whether commitments are fulfilled and execution realities are validated.

```
base = completion_rate × 35 + reality_rate × 35 + 30
score = base − drift_penalty − integrity_penalty
```

| Condition | Penalty | Max |
|---|---|---|
| Execution drift | 5 per | 30 |
| Integrity violation | 10 per | 40 |

### Learning Domain

Evaluates whether the organization captures operational memory, generates digests, and traces recommendations.

```
score = memory_presence × 30 + digest_rate × 30 + learning_rate × 20 + trace_rate × 20
```

### Overall Compliance

```
overall = constitution × 0.15 + authority × 0.20 + ratification × 0.15
        + decision × 0.20 + execution × 0.20 + learning × 0.10
```

---

## Compliance Status

| Score Range | Status    |
|-------------|-----------|
| ≥ 80        | compliant |
| 60–79       | warning   |
| < 60        | critical  |

---

## Gap Model

A governance gap is a detected deviation from the expected constitutional model. Each gap is classified by domain, type, and severity.

### Gap Types

| Domain        | Gap Type                          | Typical Severity |
|---------------|-----------------------------------|-----------------|
| constitution  | missing_constitution              | critical        |
| constitution  | incomplete_constitution           | medium / high   |
| constitution  | invalid_lifecycle                 | medium          |
| authority     | missing_authority                 | high            |
| authority     | expired_authority                 | medium / high   |
| authority     | revoked_authority                 | low             |
| authority     | invalid_delegation                | high            |
| authority     | unauthorized_action               | critical        |
| ratification  | missing_ratification              | high / critical |
| ratification  | pending_ratification              | medium / high   |
| ratification  | expired_ratification              | high            |
| decision      | decision_without_authority        | high / critical |
| decision      | decision_without_lineage          | medium          |
| decision      | decision_without_accountability   | medium          |
| execution     | execution_drift                   | low / medium / high |
| execution     | projection_integrity_violation    | high            |
| execution     | unvalidated_reality               | medium          |
| learning      | missing_memory                    | medium          |
| learning      | missing_digest                    | medium          |
| learning      | missing_learning                  | medium          |
| learning      | untraced_recommendation           | low             |

### Gap Severity

| Severity | Meaning |
|----------|---------|
| low      | Minor deviation — monitor and address in next review cycle. |
| medium   | Meaningful deviation — plan remediation in current sprint. |
| high     | Significant deviation — address before next governance review. |
| critical | Constitutional violation — requires immediate attention. |

---

## Debt Model

Governance debt is the accumulated count of detected gaps classified by severity.

```typescript
type GovernanceDebt = {
  low:      number;
  medium:   number;
  high:     number;
  critical: number;
  total:    number;
};
```

**Example output:**

```yaml
debt:
  low:      12
  medium:   4
  high:     2
  critical: 1
  total:    19
```

---

## Hotspot Model

Governance hotspots identify which domains have the highest concentration of gaps. They are ranked by dominant severity first, then by gap count.

**Example output:**

```yaml
hotspots:
  - domain: authority
    gapCount: 12
    dominantSeverity: critical
  - domain: ratification
    gapCount: 8
    dominantSeverity: high
  - domain: learning
    gapCount: 6
    dominantSeverity: medium
```

---

## PM Governance

### Generate Compliance Snapshot

```typescript
const result = await generateGovernanceComplianceSnapshot({
  workspaceId: "...",
  pmId:        "...",
});
```

Returns a `GovernanceComplianceSnapshotRow` containing all domain scores, the overall score, and compliance status. Persists gaps and evidence automatically.

### Generate Scorecard

```typescript
const result = await generateGovernanceScorecard({
  workspaceId: "...",
  pmId:        "...",
});
```

Returns a `GovernanceScorecard` containing PM details, all domain scores, gaps, debt, hotspots, and a human-readable explanation.

**Example output:**

```yaml
pm:
  Victor
constitution:  94
authority:     81
ratification:  72
decision:      89
execution:     86
learning:      78
overall:       83
status:        warning
```

### Get Snapshot

```typescript
const result = await getGovernanceComplianceSnapshot({
  workspaceId: "...",
  snapshotId:  "...",
});
```

### List Snapshots

```typescript
const result = await listGovernanceComplianceSnapshots({
  workspaceId: "...",
  pmId:        "...",       // optional
  status:      "warning",  // optional: compliant | warning | critical
  minScore:    60,          // optional
  maxScore:    80,          // optional
  from:        "2026-07-01T00:00:00Z", // optional
  to:          "2026-07-31T23:59:59Z", // optional
  limit:       10,          // optional
});
```

### Compare Two PMs

```typescript
const result = await compareGovernanceCompliance({
  workspaceId: "...",
  pmAId:       "...",
  pmBId:       "...",
});
```

Returns a `GovernanceComplianceComparison` with per-domain scores for both PMs and the winner per domain.

---

## PMO Governance

### Generate PMO Summary

Aggregates compliance snapshots for all active PMs in the workspace.

```typescript
const result = await generatePMOComplianceSummary({
  workspaceId: "...",
});
```

**Example output:**

```yaml
pmo:
  pms:       18
  compliant: 11
  warning:   5
  critical:  2
overall:     84
hotspots:
  - domain: authority
    gapCount: 24
    dominantSeverity: critical
totalDebt:
  low:      48
  medium:   17
  high:     8
  critical: 3
  total:    76
```

---

## Lineage

`getGovernanceComplianceLineage()` reconstructs the full traceability chain:

```
PM
  ↓
Constitutions
  ↓
Authorities
  ↓
Decisions (with outcome presence)
  ↓
Ratifications
  ↓
Commitments
  ↓
Memories
  ↓
Compliance Snapshot
```

```typescript
const result = await getGovernanceComplianceLineage({
  workspaceId: "...",
  pmId:        "...",
});
```

Emits `GOVERNANCE_LINEAGE_GENERATED` audit event.

---

## Audit Events

| Event Type | Trigger |
|---|---|
| `GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED` | Snapshot created |
| `GOVERNANCE_CONSTITUTION_SCORE_CALCULATED` | Constitution score computed |
| `GOVERNANCE_AUTHORITY_SCORE_CALCULATED` | Authority score computed |
| `GOVERNANCE_RATIFICATION_SCORE_CALCULATED` | Ratification score computed |
| `GOVERNANCE_DECISION_SCORE_CALCULATED` | Decision score computed |
| `GOVERNANCE_EXECUTION_SCORE_CALCULATED` | Execution score computed |
| `GOVERNANCE_LEARNING_SCORE_CALCULATED` | Learning score computed |
| `GOVERNANCE_GAP_DETECTED` | One or more gaps detected |
| `GOVERNANCE_DEBT_CALCULATED` | Debt computed |
| `GOVERNANCE_HOTSPOT_IDENTIFIED` | Hotspots identified |
| `GOVERNANCE_COMPLIANCE_COMPARED` | Two PMs compared |
| `GOVERNANCE_LINEAGE_GENERATED` | Lineage reconstructed |

---

## Business Rules

1. Every compliance snapshot must originate from a registered PM.
2. Every metric must be traceable to evidence.
3. Every gap must have evidence.
4. Every debt must be calculable from detected gaps.
5. Workspace isolation is mandatory — no cross-workspace data access.
6. Projects must not be modified by this engine.
7. Constitutions must not be modified by this engine.
8. Decisions must not be modified by this engine.
9. No automatic remediations may be executed.
10. Every evaluation must be explainable from evidence.

---

## Non-Punitive Design

The PMO Governance Compliance Engine is designed to identify and surface governance gaps — not to penalize Project Managers. Scores are:

- **Advisory** — no automatic actions are taken
- **Explainable** — every score derives from visible evidence
- **Traceable** — every gap links to specific entities
- **Historical** — snapshots accumulate over time for trend analysis

---

## Use Cases

1. Generate a governance compliance snapshot for a PM to assess constitutional adherence.
2. Generate a governance scorecard for a PMO review meeting.
3. List historical compliance snapshots filtered by status, score, or date range.
4. Compare two PMs by governance compliance to identify organizational patterns.
5. Generate a PMO compliance summary showing organization-wide adherence and hotspots.
6. Detect governance gaps early to prevent constitutional drift.
7. Calculate governance debt to prioritize remediation efforts.
8. Identify governance hotspots across domains for targeted improvement.
9. Reconstruct the full governance lineage from PM through compliance snapshot.
10. Explain the governance compliance engine to PMO stakeholders.

---

## Examples

### Compliant PM Scorecard

```yaml
pm: Victor
constitution:  94
authority:     88
ratification:  85
decision:      91
execution:     87
learning:      82
overall:       88
status:        compliant
gaps:          0
debt:
  total: 0
```

### PM with Governance Gaps

```yaml
pm: Ana
constitution:  100
authority:     60
ratification:  50
decision:      75
execution:     80
learning:      65
overall:       71
status:        warning
gaps:
  - domain: authority
    type:   expired_authority
    severity: medium
    description: 2 authority assignment(s) have expired.
  - domain: ratification
    type:   missing_ratification
    severity: high
    description: 2 decision(s) requiring ratification have none.
debt:
  low: 0, medium: 1, high: 1, critical: 0, total: 2
hotspots:
  - domain: ratification, gapCount: 1, dominantSeverity: high
  - domain: authority,    gapCount: 1, dominantSeverity: medium
```

### PMO Summary with Issues

```yaml
pmo:
  pms:       18
  compliant: 11
  warning:   5
  critical:  2
overall: 79
hotspots:
  - domain: authority,    gapCount: 12, dominantSeverity: critical
  - domain: ratification, gapCount: 8,  dominantSeverity: high
  - domain: learning,     gapCount: 6,  dominantSeverity: medium
totalDebt:
  low: 12, medium: 8, high: 5, critical: 3, total: 28
```
