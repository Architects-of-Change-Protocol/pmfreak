# PMO Governance Compliance — PMO Operating Discipline Snapshot

> NOTE: The `src/lib/pmo-governance-compliance` directory also hosts a separate
> constitution / authority / ratification governance scoring module. This
> document describes the **PMO Operating Discipline Snapshot** feature, whose
> implementation lives in `operating-discipline.ts` and
> `operating-discipline-types.ts`. The two features share a directory but not a
> type space.

## Purpose

The PMO Operating Discipline Snapshot answers a single executive question:
**is the PMO running its Project Manager portfolio with the discipline our
governance model requires?**

It is a **read-only derivation**. It calls existing read aggregations — the PMO
Command Center view and the per-PM Operating Dossiers — and turns them into a
compliance assessment. It does **not** recalculate PM capacity or PM
performance, and it does not mutate any record. The only write it performs is
emitting a `PMO_GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED` platform event.

## Data sources

| Source | Used for |
| --- | --- |
| `pm-registry` (`listProjectManagers`) | enumerating PMs to evaluate |
| `pm-detail-intelligence` (`getPMOperatingDossier`) | per-PM profile, assignments, capacity, performance, evidence, recommendations |
| `pmo-command-center` (`getPMOCommandCenter`) | attention queues used to verify that risky PMs surface to the PMO |
| `platform-events` (`createPlatformEvent`) | recording the snapshot-generated event |

If the PMO Command Center view cannot be built, the snapshot is still produced
from dossiers alone (attention-queue checks then treat every PM as not queued).

## Assessment domains

Seven domains are evaluated. Six are weighted into the compliance score; the
seventh (`dossier_completeness`) is diagnostic only.

| Domain | Weight | Checks |
| --- | --- | --- |
| `pm_profile_completeness` | 15% | profile present, role, experience level, active projects limit |
| `assignment_hygiene` | 20% | inactive/suspended PMs with active work, observers counted as capacity, invalid types, duplicate primary PMs, historical assignment provenance |
| `capacity_governance` | 20% | capacity snapshot present & fresh, recommendations on near/at/overloaded PMs, overloaded PMs surfaced to attention queue |
| `performance_governance` | 20% | performance snapshot present & fresh, recommendations on warning/critical PMs, high-risk PMs surfaced, risk classification present |
| `evidence_readiness` | 15% | evidence confidence present, completeness, confidence level, score interpretation, recommendations on low-confidence PMs |
| `intervention_readiness` | 10% | top recommendation on critical/at-risk PMs, recommendation provenance (severity + source) |
| `dossier_completeness` | diagnostic | every dossier section is present |

Freshness thresholds: capacity and performance snapshots older than **7 days**
(`CAPACITY_SNAPSHOT_FRESHNESS_DAYS`, `PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS`) are
flagged stale.

## Scoring model

Each domain starts at 100 and loses points per violation by severity:

| Severity | Penalty |
| --- | --- |
| critical | 25 |
| high | 15 |
| medium | 8 |
| low | 3 |

A domain score is clamped to `[0, 100]`. The overall **compliance score** is the
weighted sum of the six weighted domain scores (rounded to one decimal).

### Compliance status thresholds

| Score | Status |
| --- | --- |
| ≥ 90 | excellent |
| ≥ 75 | compliant |
| ≥ 60 | watch |
| ≥ 40 | non_compliant |
| < 40 | critical |

### Domain status / risk

Domain status uses the same thresholds. Domain risk:

| Score | Risk |
| --- | --- |
| ≥ 80 | low |
| ≥ 65 | medium |
| ≥ 45 | high |
| < 45 | critical |

### Overall risk

| Condition | Risk |
| --- | --- |
| critical override OR score < 45 | critical |
| score ≥ 80 and no critical violations | low |
| score ≥ 65 | medium |
| score ≥ 45 | high |

### Critical override

If **any** of the following hold, status is forced to `critical`, risk to
`critical`, and the score capped at 39:

- 1+ overloaded active PMs with no governance recommendation
- 1+ critical PMs with no performance snapshot
- > 40% of active PMs missing capacity snapshots
- > 40% of active PMs missing performance snapshots
- > 50% of active PMs at low / very_low evidence confidence

The triggering reasons are recorded in `summary.critical_override_reasons`.

## Violations

Every detected problem is a `GovernanceViolation` with a stable
`violation_type`, `severity`, `domain`, optional `pm_id` / `project_id`,
human-readable `message`, `recommendation`, structured `evidence`, and
`detected_at`. The full list of `violation_type` values is exported from
`operating-discipline-types.ts`.

## Recommendations

Recommendations are derived from violations, grouped by `(domain, violation_type)`,
carrying the highest severity in the group and the count of occurrences. They are
sorted critical → high → medium → low.

## API

| Method | Route | Behaviour |
| --- | --- | --- |
| `GET` | `/api/pmo-governance-compliance` | builds and returns the current snapshot (no persistence) |
| `POST` | `/api/pmo-governance-compliance/snapshot` | generates and returns a snapshot (201) |

Both routes require an authenticated workspace member. Responses follow the
`{ ok, data }` / `{ ok: false, error: { code, message } }` convention. Failure
classes:

- `PMO_GOVERNANCE_COMPLIANCE_WORKSPACE_REQUIRED` → 403
- `PMO_GOVERNANCE_COMPLIANCE_UNAUTHORIZED` → 403
- `PMO_GOVERNANCE_COMPLIANCE_FAILED` → 500

## UI

`/pmo-governance-compliance` (protected) renders: header with a Generate
Snapshot button and links to PMO Command Center / PM Registry / Capacity /
Performance; executive compliance cards; a risk banner; per-domain assessment
cards; a violations table; a recommendations table; and an evidence summary.
Empty and loading states are handled.

## Platform event

After a successful generation the service emits
`PMO_GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED` (category `governance`) with a
structured payload (score, status, risk, violation counts, override flag).
Event emission failures are logged and never fail the snapshot.

## Service surface

Exported from `@/lib/pmo-governance-compliance`:

- `generatePMOGovernanceComplianceSnapshot(input)` — main async entry point
- `assembleSnapshot(workspaceId, dossiers, view, generatedAt)` — pure assembler
- `classifyComplianceStatus`, `classifyDomainStatus`, `classifyDomainRisk`,
  `deriveComplianceRisk`, `evaluateCriticalOverride`, `buildRecommendations`,
  `buildDomainAssessment`, and the seven `detect*Violations` functions
- types: `PMOGovernanceComplianceSnapshot`, `GovernanceViolation`,
  `GovernanceRecommendation`, `DomainAssessment`, `GovernanceEvidence`, etc.
