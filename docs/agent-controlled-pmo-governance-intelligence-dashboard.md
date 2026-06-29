# Controlled PMO Governance Intelligence Dashboard

## Purpose

The Controlled PMO Governance Intelligence Dashboard surfaces privacy-safe, deterministic governance intelligence to PMO leaders. It converts workspace learning signals, governance feedback, risk calibration records, evidence quality records, adapter performance records, review routing feedback, and workspace learning summaries into actionable PMO-facing intelligence cards, a feedback review queue, policy change proposals, and exportable audit-ready governance reports.

## Scope

- Dashboard snapshot generation (deterministic workspace-level rollup)
- Governance insight cards (risk, evidence, adapter, routing, feedback, privacy health, volume, policy, workspace summary)
- Risk calibration insight aggregation
- Evidence quality insight aggregation
- Adapter performance insight aggregation
- Review routing insight aggregation
- Governance feedback queue management
- Policy change proposal creation and PMO review
- Governance report export generation (markdown, json, csv)
- Dashboard events and audit trail
- API routes for all dashboard operations
- Database migration and RLS policies

## Non-Goals

The Controlled PMO Governance Intelligence Dashboard does **not**:

- Train models
- Create embeddings
- Call LLMs (OpenAI, Anthropic, Gemini, or any other provider)
- Call external APIs
- Mutate projects
- Change policies automatically
- Change review routing automatically
- Change risk scoring automatically
- Execute adapters
- Retry dispatch
- Send emails, Slack messages, Jira tickets, GitHub issues, or calendar events
- Retain raw payloads
- Retain free-text rationale in learning signals or dashboard cards
- Expose identifiers blocked by the learning privacy layer
- Allow cross-workspace data access
- Apply policy proposals automatically (even when approved)

It surfaces deterministic, privacy-safe, workspace-scoped governance intelligence for PMO leaders and records auditable policy proposals for future implementation only.

## Relationship to Prior Layers

### Controlled Execution Learning Signals & Governance Feedback Loop

This sprint consumes records from the learning layer:

- `agent_execution_learning_signals`
- `agent_execution_learning_extractions`
- `agent_execution_learning_privacy_filters`
- `agent_execution_governance_feedback`
- `agent_execution_risk_calibration_signals`
- `agent_execution_evidence_quality_signals`
- `agent_execution_adapter_performance_signals`
- `agent_execution_review_decision_patterns`
- `agent_execution_review_routing_feedback`
- `agent_execution_workspace_learning_summaries`
- `agent_execution_aggregate_learning_signals`

All privacy protections of the learning layer remain intact. The dashboard does not bypass or weaken them.

### Controlled Execution Result Reconciliation & Human Outcome Review

Risk calibration and evidence quality signals originate from outcome reconciliation and human review decisions. The dashboard summarizes these patterns without re-exposing individual review records.

### PMO Command Center

The dashboard extends the PMO Command Center with a dedicated Governance Intelligence surface (`/command-center/governance-intelligence`) that focuses on signal trends and policy proposal management.

## Data Models

### Dashboard Snapshot

A deterministic workspace-level rollup for a given period.

Fields:
- `id`, `workspaceId`, `periodStart`, `periodEnd`, `status`
- `totalLearningSignals`, `activeLearningSignals`, `privacyBlockedSignals`
- `openGovernanceFeedback`, `riskCalibrationCount`, `evidenceQualityIssueCount`
- `adapterQualityIssueCount`, `reviewRoutingIssueCount`, `policyProposalCount`
- `topCardsJson` — safe card summaries only
- `safeSnapshotPayload` — redacted payload
- `createdBy`, `createdAt`, `updatedAt`

Snapshots are append-only.

### Governance Insight Card

PMO-facing presentation of a governance signal or trend.

Card types: `risk_calibration`, `evidence_quality`, `adapter_performance`, `review_routing`, `governance_feedback`, `privacy_health`, `learning_signal_volume`, `policy_proposal`, `workspace_summary`

Severities: `info`, `low`, `medium`, `high`, `critical`

Actionability: `informational`, `review_recommended`, `proposal_recommended`, `pmo_attention_required`

Card summaries must be deterministic and generic — no raw project text, rationale, outcome summaries, failure messages, correction reasons, or customer/project identifiers.

### Risk Calibration Insight

Aggregated view of whether risk is being underestimated, overestimated, or aligned.

Recommended postures: `maintain`, `increase_review`, `decrease_review`, `investigate`

No automatic risk score changes are made.

### Evidence Quality Insight

Aggregated view of evidence gaps and missing evidence types.

Recommended postures: `maintain`, `tighten`, `investigate`

No automatic evidence requirement changes are made.

### Adapter Performance Insight

Per-adapter aggregation of success, failure, missing evidence, correction, retry, acceptance, rejection, and confidence distribution counts.

No automatic adapter disablement or routing changes.

### Review Routing Insight

Per-role aggregation of route effectiveness, review priority, and decision patterns.

Suggested route adjustments are stored as proposals only. No automatic reassignment.

### Governance Feedback Queue Item

Surfaces deterministic feedback from the learning layer for PMO review.

Statuses: `open`, `reviewed`, `accepted`, `rejected`, `archived`

PMO review actions are recorded. Feedback is never applied to production policy automatically.

### Policy Change Proposal

PMO-reviewed suggestion derived from governance feedback.

Types: `risk_policy`, `evidence_requirement`, `adapter_quality_review`, `review_routing`, `human_review_policy`, `triage_policy`, `governance_process`

Statuses: `created`, `open`, `under_review`, `approved_for_future_implementation`, `rejected`, `archived`

**Approved for future implementation** means the PMO has acknowledged the proposal as a backlog candidate. It does **not** apply the policy change.

### Governance Report Export

Audit-ready report in `markdown`, `json`, or `csv` format.

Reports include:
- Workspace id and period
- Dashboard snapshot summary
- Risk calibration summary
- Evidence quality summary
- Adapter performance summary
- Review routing summary
- Feedback queue summary
- Policy proposals
- Privacy/data minimization statement
- Non-goals statement

Reports exclude all raw payloads, customer identifiers, project identifiers, free text, rationale, failure messages, correction reasons, secrets, tokens, and credentials. Export content is validated through a safety check before the record is created.

### Dashboard Event

Append-only audit record of dashboard lifecycle changes.

Event types: `dashboard_snapshot_created`, `insight_card_created`, `governance_feedback_reviewed`, `policy_proposal_created`, `policy_proposal_reviewed`, `governance_report_export_created`, `governance_report_export_downloaded`, `dashboard_filter_applied`, `dashboard_summary_viewed`

## Lifecycles

### Dashboard Snapshot Lifecycle

1. PMO triggers snapshot generation for a period.
2. Service loads safe learning records for the period.
3. Counts are computed deterministically.
4. Top cards are built from safe summaries only.
5. Snapshot payload is redacted.
6. Snapshot record is created (append-only).
7. `dashboard_snapshot_created` event is recorded.

### Insight Card Lifecycle

1. Cards are generated from the latest snapshot.
2. Each card type gets one deterministic card.
3. Severity and actionability are derived deterministically.
4. Cards are persisted.
5. `insight_card_created` events are recorded.
6. PMO may update card status to `reviewed` or `archived`.

### Feedback Review Lifecycle

1. Governance feedback queue is built from learning layer feedback records.
2. PMO reviews queue items.
3. Review status is updated: `reviewed`, `accepted`, `rejected`, or `archived`.
4. `governance_feedback_reviewed` event is recorded.
5. Feedback is never applied to production policy.

### Policy Proposal Lifecycle

1. PMO creates a proposal (manually or from a feedback item).
2. Proposal enters `created` or `open` status.
3. PMO reviews the proposal.
4. Decision: `approve_for_future_implementation`, `reject`, `archive`, or `request_more_review`.
5. `policy_proposal_reviewed` event is recorded.
6. Approved proposals are not applied automatically. They become backlog candidates only.

### Export Lifecycle

1. PMO requests a governance report export.
2. Service loads dashboard snapshot, cards, insights, feedback queue, and proposals.
3. Report is built in the requested format.
4. Safety validation runs on the content.
5. If safety check fails, export is created with status `failed`.
6. If safe, export is created with status `generated`.
7. `governance_report_export_created` event is recorded.
8. PMO may download the export.
9. `governance_report_export_downloaded` event is recorded on download.

## Privacy and Data Minimization

- No raw payloads are retained in dashboard records.
- No free-text rationale from learning signals is retained in cards or exports.
- No outcome summaries, failure messages, or correction reasons are included.
- No customer, project, or user identifiers are exposed beyond what workspace membership already permits.
- All blocked field names are redacted from snapshot and card payloads.
- Export safety validation blocks all prohibited field names before the export record is created.
- Cross-workspace data access is not permitted.

## RLS / Security Model

All dashboard tables have RLS enabled. Workspace members can read dashboard records in their workspace. Write access for PMO-specific operations (feedback queue review, policy proposals, exports) is enforced at the application layer if role helpers are not available in the current schema.

No public access policies exist. No unrestricted `using (true)` policies are used.

## API Routes

All routes are under `/api/agents/execution/governance-dashboard/`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /snapshots | Generate dashboard snapshot |
| GET | /snapshots | List snapshots |
| GET | /snapshots/[snapshotId] | Get snapshot by id |
| POST | /cards | Create insight card |
| GET | /cards | List insight cards |
| POST | /cards/[cardId]/status | Update card status |
| POST | /risk-calibration | Generate risk calibration insights |
| POST | /evidence-quality | Generate evidence quality insights |
| POST | /adapter-performance | Generate adapter performance insights |
| POST | /review-routing | Generate review routing insights |
| POST | /feedback-queue | Build governance feedback queue |
| GET | /feedback-queue | List feedback queue |
| POST | /feedback-queue/[queueItemId]/review | Review feedback queue item |
| POST | /policy-proposals | Create policy proposal |
| GET | /policy-proposals | List policy proposals |
| POST | /policy-proposals/from-feedback | Create proposal from feedback |
| POST | /policy-proposals/[proposalId]/review | Review policy proposal |
| POST | /exports | Generate governance report export |
| GET | /exports | List exports |
| GET | /exports/[exportId] | Get export by id |
| GET | /exports/[exportId]/download | Download safe export content |
| GET | /summary | Get dashboard summary |
| GET | /data | Get complete dashboard data |
| GET | /events | List dashboard events |

## UI Behavior

The dashboard UI is at `/command-center/governance-intelligence`.

- Displays latest snapshot period and summary metrics.
- Shows insight cards for each governance area.
- Provides a Feedback Queue tab for PMO review.
- Provides a Policy Proposals tab with PMO review actions.
- Provides an Exports tab for generating and downloading governance reports.

UI rules:
- No raw payloads are rendered.
- No rationale text from learning signals is rendered.
- No outcome summaries, failure messages, or correction reasons are rendered.
- No AI-generated recommendations are displayed.
- No "Apply Policy" buttons exist.
- Policy proposal approval button text reads "Approve for future implementation" — not "Apply policy".

## Example Records

### Example Dashboard Snapshot

```json
{
  "id": "snap-001",
  "workspaceId": "ws-123",
  "periodStart": "2026-08-01T00:00:00.000Z",
  "periodEnd": "2026-08-31T23:59:59.999Z",
  "status": "active",
  "totalLearningSignals": 142,
  "activeLearningSignals": 138,
  "privacyBlockedSignals": 4,
  "openGovernanceFeedback": 3,
  "riskCalibrationCount": 12,
  "evidenceQualityIssueCount": 5,
  "adapterQualityIssueCount": 2,
  "reviewRoutingIssueCount": 1,
  "policyProposalCount": 0
}
```

### Example Risk Calibration Card

```json
{
  "cardType": "risk_calibration",
  "title": "Risk Calibration: Underestimation Trend Detected",
  "severity": "medium",
  "summary": "Risk calibration signals indicate underestimation in 8 of 12 recorded periods. Review posture adjustment recommended.",
  "metricValue": 8,
  "trendDirection": "worsening",
  "actionability": "proposal_recommended"
}
```

### Example Evidence Quality Card

```json
{
  "cardType": "evidence_quality",
  "title": "Evidence Quality: Missing Evidence Signals Present",
  "severity": "low",
  "summary": "5 evidence quality signals indicate missing evidence in the current period. Evidence posture review recommended.",
  "metricValue": 5,
  "trendDirection": "stable",
  "actionability": "review_recommended"
}
```

### Example Adapter Performance Card

```json
{
  "cardType": "adapter_performance",
  "title": "Adapter Performance: Quality Issues Detected",
  "severity": "medium",
  "summary": "2 adapter quality issue signals recorded. Affected adapters show elevated rejection rates.",
  "metricValue": 2,
  "trendDirection": "worsening",
  "actionability": "review_recommended"
}
```

### Example Feedback Queue Item

```json
{
  "feedbackType": "risk_calibration",
  "feedbackCategory": "risk_calibration",
  "severity": "medium",
  "status": "open",
  "recommendation": "Consider increasing review frequency for high-risk action types.",
  "sourceSignalCount": 8,
  "ownerRole": "pmo_lead"
}
```

### Example Policy Proposal

```json
{
  "proposalType": "risk_policy",
  "proposalCategory": "risk_calibration",
  "proposedChangeSummary": "Increase review threshold for risk_underestimated signal patterns.",
  "riskLevel": "medium",
  "status": "open",
  "reviewDecision": null
}
```

### Example Governance Export (Markdown excerpt)

```markdown
# PMO Governance Report
Period: 2026-08-01 to 2026-08-31
Workspace: ws-123

## Summary
- Total Learning Signals: 142
- Active Signals: 138
- Privacy Blocked Signals: 4
- Open Governance Feedback: 3

## Privacy Statement
This report contains no raw payloads, customer identifiers, project identifiers,
user free text, rationale, failure messages, correction reasons, secrets, or tokens.

## Non-Goals
This report does not imply automatic policy mutation, routing mutation,
risk scoring mutation, or AI-generated recommendations.
```

## Prohibited Behavior

The following are explicitly prohibited:

- Calling OpenAI, Anthropic, Gemini, or any LLM provider
- Creating embeddings or vector indexes
- Training or fine-tuning models
- Performing semantic similarity
- Calling external analytics services
- Sending emails, Slack messages, Jira tickets, GitHub issues, or calendar events
- Mutating production project records
- Executing adapters
- Retrying dispatch
- Applying policy changes
- Changing review routing
- Changing risk scoring
- Retaining raw payloads
- Retaining free-text rationale in learning signals
- Cross-workspace data access
- Bypassing learning layer privacy filters

## Testing Guide

Run the full test suite:

```bash
npm test
```

Run focused dashboard tests:

```bash
npm test -- tests/agent-controlled-pmo-governance-intelligence-dashboard.test.mjs
```

Tests cover:
- Type/model validation
- Validation helper behavior
- Migration content verification
- Database contract completeness
- Registry function exports and behavior
- Service function exports and prohibited behavior checks
- API route file existence
- Observability integration
- Terminology compliance

## Known Limitations

- RLS role granularity for PMO/admin-only operations is enforced at the application layer. Fine-grained database role helpers for PMO roles are not yet implemented.
- UI is implemented as a page skeleton. Full interactive components require further UI sprint work.
- The dashboard reads from in-memory stores. In production, these would be backed by Supabase tables defined in the migration.
- Export download does not stream large reports. For large workspaces, pagination may be needed.

## Suggested Next Sprint

**PMO Governance Proposal Review & Controlled Policy Change Backlog**

Once PMFreak can surface governance intelligence and policy proposals to PMO leaders, the next layer should turn approved-for-future proposals into a controlled backlog of policy changes that can be reviewed, simulated, tested, and approved before any governance behavior changes.

That next sprint should focus on:
- Policy change backlog
- Proposal-to-change-request conversion
- Policy simulation only (no live changes)
- Impact preview
- Approval workflow
- Versioned governance policy drafts
- Rollback planning
- No automatic policy mutation
- No automatic routing mutation
- No live scoring changes
