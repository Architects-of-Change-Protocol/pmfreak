# PMO Executive Reporting & Alerts

Executive-facing reporting layer that aggregates existing PMO read models into
deterministic executive reports and alert payloads.

## Overview

This slice turns the operational signals already produced by the PMO stack into
two leadership-oriented artifacts:

- **Executive reports** — a structured document (status, risk, summary, key
  metrics, sections) suitable for a daily brief, weekly review, or board-ready
  summary.
- **Alert payloads** — discrete, severity-tagged, reviewable alerts derived from
  the same sources, deduplicated against open alerts.

It is **read-only** with respect to PM, governance, and intervention state. It:

- does **not** recalculate capacity or performance,
- does **not** mutate PM assignments or intervention statuses,
- does **not** send external notifications,
- does **not** generate PDFs.

## Sources

Reports and alerts are derived from three existing read aggregations:

| Source | Module | Used for |
| --- | --- | --- |
| PMO Command Center view | `@/lib/pmo-command-center` (`getPMOCommandCenter`) | Operational status, capacity, performance, evidence overviews, attention queues |
| Operating Discipline snapshot | `@/lib/pmo-governance-compliance` (`generatePMOGovernanceComplianceSnapshot`) | Compliance score/status/risk, governance violations |
| Intervention actions | `pmo_intervention_actions` table | Open / pending-approval / stale intervention rollup |

Each source is fetched defensively: if a source throws or returns an error, the
report/alert generation continues with that source treated as absent. This makes
generation resilient on partially-onboarded workspaces.

## Derivation

### Executive status (`critical > attention_required > watch > healthy`)

The highest-severity signal wins across:

- PMO operational status (`critical`, `*_pressure`, `evidence_gap`/`watch`),
- compliance status (`critical`, `non_compliant`, `watch`),
- presence of critical/high governance violations,
- critical pending-approval interventions and stale in-progress interventions.

### Executive risk (`critical > high > medium > low`)

Highest-severity signal wins across compliance risk, PMO operational status,
governance violation severity, and intervention pressure.

### Intervention rollup

`INTERVENTION_STALE_DAYS = 7`. An `in_progress` intervention whose `updated_at`
is 7+ days before the report timestamp is counted as **stale**.

## Report shape

A report contains:

- `executiveStatus`, `executiveRisk`
- `executiveSummary` — `headline`, `status_summary`, `risk_summary`,
  `governance_summary`, `intervention_summary`, `evidence_summary`,
  `leadership_attention[]`
- `keyMetrics` — PMO/governance/intervention/alert counts
- `sections[]` — deterministic, in fixed order:
  1. PMO Operating Status
  2. Governance Compliance
  3. Intervention Action Loop
  4. Executive Attention Queue
  5. Evidence & Confidence
  6. Recommended Next Actions
- `alerts[]` — alert drafts computed inline for the report
- `sourceRefs`, `reportPayload`

## Alert types

| Alert type | Severity | Source |
| --- | --- | --- |
| `pmo_status_critical` | critical | command center |
| `pmo_capacity_pressure` | high | command center |
| `pmo_performance_pressure` | high | command center |
| `governance_compliance_critical` | critical | governance |
| `governance_violation_critical` | critical | governance |
| `governance_violation_high` | high | governance |
| `intervention_critical_pending_approval` | critical | intervention |
| `intervention_high_pending_approval` | high | intervention |
| `intervention_in_progress_stale` | medium | intervention |
| `evidence_confidence_low` | medium | command center |
| `missing_capacity_snapshot` | medium | command center |
| `missing_performance_snapshot` | medium | command center |
| `executive_attention_required` | (reserved) | reporting |

### Deduplication

When generating alerts, existing alerts with status `new` are loaded and a dedup
key is built from `(workspace_id, alert_type, severity, target_type, target_id,
source_type, source_id)`. Drafts matching an open key are skipped. Reviewed or
archived alerts do **not** block new alerts (historical alerts are allowed).

An optional `severityThreshold` filters drafts to that severity or higher before
persistence.

## API

Response envelope: `{ ok: true, data }` or
`{ ok: false, error: { code, message } }`.

| Method & path | Description |
| --- | --- |
| `GET /api/pmo-executive-reports` | List reports (`reportType`, `limit`) |
| `POST /api/pmo-executive-reports/generate` | Generate a report (body: `reportType`, `periodStart`, `periodEnd`) → 201 |
| `GET /api/pmo-executive-reports/[reportId]` | Get a single report |
| `GET /api/pmo-alerts` | List alerts (`severity`, `status`, `limit`) |
| `POST /api/pmo-alerts/generate` | Generate alerts (body: `severityThreshold`) → 201 |
| `POST /api/pmo-alerts/[alertId]/review` | Mark an alert reviewed |

All routes require an authenticated workspace member. A missing workspace
returns a 403 deny response.

## Service API

```ts
import {
  generatePMOExecutiveReport,
  listPMOExecutiveReports,
  getPMOExecutiveReport,
  generatePMOAlertPayloads,
  listPMOAlertPayloads,
  markPMOAlertPayloadReviewed,
} from "@/lib/pmo-executive-reporting";
```

Pure derivation helpers are also exported for testing/direct use:
`buildInterventionRollup`, `deriveExecutiveStatus`, `deriveExecutiveRisk`,
`buildKeyMetrics`, `buildExecutiveSummary`, `buildReportSections`,
`buildAlertDrafts`, `filterBySeverityThreshold`, `alertDedupKey`.

## Platform events

Emitted fire-and-forget (failures never block generation):

- `PMO_EXECUTIVE_REPORT_GENERATED` — on report persistence
- `PMO_ALERT_PAYLOAD_GENERATED` — once per newly persisted alert
- `PMO_ALERT_PAYLOAD_REVIEWED` — on review

Event category is `governance`; payloads carry structured facts only (no raw
content).

## Persistence

Two tables (migration `20260725000000_pmo_executive_reporting.sql`):

- `pmo_executive_reports`
- `pmo_alert_payloads`

Both use `workspace_id uuid references workspaces(id)`, RLS scoped to workspace
members, and `workspace_id` indexes. Columns are declared in
`src/lib/db/database-contract.ts`
(`PMO_EXECUTIVE_REPORT_SELECTABLE_COLUMNS`, `PMO_ALERT_PAYLOAD_SELECTABLE_COLUMNS`).

## UI

`/pmo-executive-reporting` (protected) renders executive status cards, the latest
report's executive summary and sections, alerts grouped by severity with a
per-alert "Mark Reviewed" action, and report history. Generate Report / Generate
Alerts buttons drive the corresponding POST endpoints.

## Tests

`tests/pmo-executive-reporting.test.mjs` covers status/risk derivation, the
intervention rollup (including staleness), key metrics, report section assembly,
graceful handling of missing sources, alert generation per rule, severity
thresholds, dedup against open alerts, historical (reviewed) allowance, review,
and event payload shapes.
