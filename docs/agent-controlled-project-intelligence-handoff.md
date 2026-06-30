# Controlled Project Intelligence Handoff

## Purpose

The Controlled Project Intelligence Handoff layer makes project intelligence transferable between Project Managers (PMs) without deleting, overwriting, or moving project memory. It creates a full audit trail from handoff request through PMO approval, incoming PM acceptance, and controlled ownership pointer update.

It updates only dedicated handoff assignment pointer and assignment history records after PMO approval and incoming PM acceptance.

It does not execute adapters, mutate external systems, create external tickets, create calendar events, send communications, call LLMs, create embeddings, train models, call external APIs, delete project memory, overwrite project brain, or perform uncontrolled project ownership mutation.

## Scope

This layer covers:

- Project intelligence handoff requests
- Project context validation
- PMO handoff approval gates and gate decisions
- Project intelligence handoff packs (deterministic, no AI)
- Project memory snapshots (additive, no deletion)
- Project status snapshots
- Risk/blocker/decision/milestone snapshot items
- Stakeholder context snapshots
- Outgoing PM handoff notes (additive)
- Incoming PM acceptance records
- Controlled project assignment pointers (upsert only after approval + acceptance)
- Project assignment history (append-only)
- Handoff continuity checks (internal tracking only)
- Safe handoff exports (markdown/json/csv)
- Handoff audit events (append-only)

## Non-Goals

This layer explicitly does NOT:

- Send emails
- Send Slack messages
- Create Jira tickets
- Create GitHub issues
- Modify calendars
- Mutate external project management systems
- Delete project memory
- Delete project notes, decisions, risks, blockers, commitments
- Erase outgoing PM history
- Overwrite project context or project brain
- Automatically assign PM without PMO approval
- Allow incoming PM assignment without acceptance
- Allow outgoing PM to self-transfer without PMO approval
- Call OpenAI, Anthropic, Gemini, or any LLM provider
- Create embeddings
- Train models or fine-tune models
- Create vector indexes
- Perform semantic similarity
- Call external analytics services
- Implement autonomous scheduling
- Execute adapters
- Retry adapter dispatch
- Execute correction loops
- Automatically accept handoffs
- Create real external work items
- Export unsafe content

## Relationship to Other Layers

### Policy Activation / Rollback Gate

The Policy Activation / Rollback Gate controls PMO governance policy lifecycle. This handoff layer is operationally independent but follows the same PMO approval gate patterns: no action proceeds without an explicit PMO decision record.

### Dry-Run Gate

The Dry-Run Change Executor validates policy changes in safe simulation. This handoff layer uses similar gate/decision patterns for the PMO approval workflow.

### Implementation Planning Workspace

The Implementation Planning Workspace tracks planned governance changes. This handoff layer uses similar snapshot and notes patterns to capture project intelligence for the incoming PM.

### PMO Governance Dashboard

The PMO Governance Dashboard provides observability across all governance layers. This handoff layer emits 19 new observability event types and one new source type to the shared audit event store.

### Future: End-to-End Governance Runtime Integration & Production Hardening

The next sprint (sprint 6 of 7) will harden cross-layer runtime integration, workspace isolation, RLS audit, observability coverage, and production readiness guardrails. This handoff layer's assignment pointer and audit records will be included in that integration scope.

## Domain Models

### Project Intelligence Handoff Request

Represents a controlled PMO request to transfer project intelligence and ownership from one PM to another.

**Statuses:** `created` → `context_validation_pending` → `ready_for_pmo_review` → `pmo_review_required` → `pmo_approved` → `handoff_pack_created` → `incoming_pm_review_required` → `incoming_pm_accepted` → `handoff_completed` → `continuity_monitoring`

Failure/block paths: `context_validation_failed`, `pmo_rejected`, `incoming_pm_rejected`, `blocked`, `archived`

**Reasons:** `workload_rebalance`, `pm_unavailable`, `vacation_coverage`, `role_change`, `performance_intervention`, `client_escalation`, `project_complexity`, `strategic_reassignment`, `delivery_risk`, `pm_departure`, `temporary_coverage`, `other`

**Urgency:** `low`, `normal`, `high`, `critical`

### Project Context Validation

Validates whether the project can be safely handed off. Runs up to 10 checks. Where source data is unavailable (no direct project memory store in scope), limitations are recorded and validations are waived.

**Statuses:** `pending`, `passed`, `failed`, `blocked`, `waived`

### PMO Handoff Approval Gate

Explicit PMO approval required before handoff pack can be generated or handoff can be completed.

**Gate statuses:** `created`, `under_review`, `approved_for_handoff`, `rejected`, `changes_requested`, `blocked`, `archived`

**Decision types:** `approve_for_handoff`, `reject`, `request_changes`, `block`, `archive`

### PMO Handoff Gate Decision

Records each PMO decision on a gate. Append-only. Multiple decisions per gate are possible (e.g., request_changes followed by approve_for_handoff).

### Project Intelligence Handoff Pack

A deterministic summary package for the incoming PM. Generated only after PMO approval. No AI calls. No invented facts. If a source is unavailable, a limitation is recorded.

**Pack statuses:** `created`, `assembled`, `pmo_review_ready`, `accepted`, `changes_requested`, `blocked`, `archived`

### Project Memory Snapshot

Captures the transferable project memory at handoff time in 15 categories: `project_summary`, `delivery_history`, `key_decisions`, `risks`, `blockers`, `dependencies`, `milestones`, `stakeholders`, `client_commitments`, `commercial_notes`, `technical_notes`, `governance_notes`, `open_questions`, `next_actions`, `lessons_learned`.

Does not delete or move source memory. Additive and reference-only.

**Snapshot statuses:** `created`, `assembled`, `review_ready`, `accepted`, `changes_requested`, `blocked`, `archived`

### Project Status Snapshot

Captures current execution health at handoff time. Health values default to `unknown` where source data is unavailable.

**Health values:** `unknown`, `green`, `yellow`, `red`, `blocked`, `not_applicable`

### Risk / Blocker / Decision Snapshot Items

Captures individual items the incoming PM needs to know about. Types: `risk`, `blocker`, `open_decision`, `dependency`, `commitment`, `milestone`, `action_item`, `stakeholder_issue`, `commercial_item`, `technical_item`, `governance_item`.

Does not mutate live risks, blockers, decisions, tasks, or milestones. Handoff artifacts only.

**Item statuses:** `open`, `in_progress`, `pending_review`, `resolved`, `accepted`, `blocked`, `closed`, `unknown`

**Severity:** `low`, `medium`, `high`, `critical`, `unknown`

### Stakeholder Context Snapshot

Records relevant roles and relationships for the incoming PM. Role-based summaries preferred over raw personal data.

**Context types:** `client_sponsor`, `client_project_owner`, `client_technical_owner`, `internal_pmo_owner`, `internal_delivery_owner`, `internal_engineering_owner`, `vendor_contact`, `commercial_owner`, `support_contact`, `other`

**Context statuses:** `active`, `inactive`, `unknown`, `not_applicable`

### Outgoing PM Handoff Notes

Human-entered context from the current PM. Additive and auditable. Does not overwrite project memory.

**Note types:** `delivery_context`, `client_context`, `technical_context`, `commercial_context`, `risk_context`, `blocker_context`, `decision_context`, `team_context`, `personal_warning`, `recommended_next_step`, `other`

**Note statuses:** `draft`, `submitted`, `reviewed`, `changes_requested`, `accepted`, `archived`

### Incoming PM Acceptance

Records whether the incoming PM accepts the handoff. Required before assignment pointer update.

**Acceptance statuses:** `created`, `under_review`, `accepted`, `rejected`, `changes_requested`, `blocked`, `archived`

**Acceptance decisions:** `accept_handoff`, `request_changes`, `reject_handoff`, `block_handoff`, `archive`

### Controlled Project Assignment Pointer

The ONLY controlled project assignment state mutation allowed in this layer. Updated only after: PMO approval + handoff pack exists + incoming PM acceptance.

One pointer per `workspaceId + projectId`. Upsert-only. Preserves `previousPmId`. Increments `assignmentVersion`.

### Project Assignment History

Append-only record of every PM assignment change. Sources: `controlled_handoff`, `initial_assignment_snapshot`, `manual_import_reference`, `system_reference`, `unknown`.

### Handoff Continuity Check

Internal tracking record for post-handoff verification. 10 check types: `incoming_pm_acknowledged`, `critical_risks_reviewed`, `critical_blockers_reviewed`, `upcoming_milestones_reviewed`, `open_decisions_reviewed`, `stakeholder_context_reviewed`, `client_commitments_reviewed`, `first_status_update_completed`, `handoff_pack_reviewed`, `assignment_pointer_verified`.

Does not send reminders or notifications. Internal tracking only.

**Check statuses:** `pending`, `passed`, `failed`, `blocked`, `waived`, `not_applicable`

### Handoff Export

Safe export of the handoff pack and related records. Formats: `markdown`, `json`, `csv`.

Excluded from export: raw payloads, secrets, tokens, credentials, unnecessary personal data, private contact details, failure messages, correction reasons, outcome summaries, blocked field patterns.

**Export statuses:** `created`, `generated`, `failed`, `downloaded`, `archived`

### Handoff Audit Event

19 event types covering the full handoff lifecycle from `handoff_request_created` through `handoff_request_archived`. Append-only. Workspace-scoped.

## Handoff Lifecycle

```
PMO identifies handoff need
↓
createProjectHandoffRequest → status: context_validation_pending
↓
validateProjectHandoffContext → status: ready_for_pmo_review (or failed/blocked)
↓
createProjectHandoffGate → status: pmo_review_required
↓
recordProjectHandoffGateDecision → status: pmo_approved (or rejected/blocked)
↓
generateProjectHandoffPack → status: handoff_pack_created
↓
createProjectMemorySnapshot (additive, no deletion)
↓
createProjectStatusSnapshot
↓
createProjectHandoffSnapshotItems (no live mutation)
↓
createStakeholderContextSnapshot
↓
recordOutgoingPmNote (additive)
↓
status: incoming_pm_review_required
↓
recordIncomingPmAcceptance → status: incoming_pm_accepted
↓
completeProjectHandoff → upsertControlledAssignmentPointer + recordAssignmentHistory
↓
status: handoff_completed
↓
createHandoffContinuityChecks → status: continuity_monitoring
↓
generateProjectHandoffExport
```

## Privacy and Data Minimization Policy

- Export safety validation blocks all sensitive field patterns before export
- Stakeholder context uses role summaries over raw personal data
- Payload redaction blocks: `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`, `raw_payload`, `payload`, `outcomePayload`, `safeOutcomePayload`, `intendedSummary`, `actualSummary`, `rationale_from_learning`, `failureMessage`, `correctionReason`, `unredacted_email`, `unredacted_phone`, `private_address`, `personal_identifier`
- All free text is sanitized (control chars stripped, length capped)
- All payloads are JSON-serialized, redacted, and capped at 50 KB
- No raw payload is retained in the registry

## RLS / Security Model

All 16 tables have RLS enabled. Policies are workspace-member scoped:

- Read: workspace members only
- Insert: workspace members only
- Update: workspace members only (where applicable)
- No public access
- No `USING (true)` policies

PMO-level enforcement (approvals, completions) is enforced at the application layer through service function preconditions. Future hardening sprint may add role-specific RLS policies.

## API Routes

| Method | Path | Function |
|--------|------|----------|
| POST | `/api/agents/execution/project-handoff/requests` | createProjectHandoffRequest |
| GET | `/api/agents/execution/project-handoff/requests` | listAgentPmoProjectHandoffRequests |
| GET | `/api/agents/execution/project-handoff/requests/[id]` | getAgentPmoProjectHandoffRequestById |
| POST | `/api/agents/execution/project-handoff/requests/[id]/status` | updateAgentPmoProjectHandoffRequestStatus |
| POST | `/api/agents/execution/project-handoff/requests/[id]/archive` | archiveProjectHandoffRequest |
| POST | `/api/agents/execution/project-handoff/context-validation` | validateProjectHandoffContext |
| GET | `/api/agents/execution/project-handoff/context-validation` | listAgentPmoProjectContextValidations |
| POST | `/api/agents/execution/project-handoff/gates` | createProjectHandoffGate |
| GET | `/api/agents/execution/project-handoff/gates` | listAgentPmoProjectHandoffGates |
| POST | `/api/agents/execution/project-handoff/gate-decisions` | recordProjectHandoffGateDecision |
| GET | `/api/agents/execution/project-handoff/gate-decisions` | listAgentPmoProjectHandoffGateDecisions |
| POST | `/api/agents/execution/project-handoff/packs` | generateProjectHandoffPack |
| GET | `/api/agents/execution/project-handoff/packs` | listAgentPmoProjectHandoffPacks |
| GET | `/api/agents/execution/project-handoff/packs/[id]` | getAgentPmoProjectHandoffPackById |
| POST | `/api/agents/execution/project-handoff/packs/[id]/status` | updateAgentPmoProjectHandoffPackStatus |
| POST | `/api/agents/execution/project-handoff/memory-snapshots` | createProjectMemorySnapshot |
| GET | `/api/agents/execution/project-handoff/memory-snapshots` | listAgentPmoProjectMemorySnapshots |
| POST | `/api/agents/execution/project-handoff/status-snapshots` | createProjectStatusSnapshot |
| GET | `/api/agents/execution/project-handoff/status-snapshots` | listAgentPmoProjectStatusSnapshots |
| POST | `/api/agents/execution/project-handoff/snapshot-items` | createProjectHandoffSnapshotItems |
| GET | `/api/agents/execution/project-handoff/snapshot-items` | listAgentPmoProjectHandoffSnapshotItems |
| POST | `/api/agents/execution/project-handoff/snapshot-items/[id]/status` | updateAgentPmoProjectHandoffSnapshotItemStatus |
| POST | `/api/agents/execution/project-handoff/stakeholder-context` | createStakeholderContextSnapshot |
| GET | `/api/agents/execution/project-handoff/stakeholder-context` | listAgentPmoStakeholderContextSnapshots |
| POST | `/api/agents/execution/project-handoff/outgoing-notes` | recordOutgoingPmNote |
| GET | `/api/agents/execution/project-handoff/outgoing-notes` | listAgentPmoOutgoingPmNotes |
| POST | `/api/agents/execution/project-handoff/outgoing-notes/[id]/status` | updateAgentPmoOutgoingPmNoteStatus |
| POST | `/api/agents/execution/project-handoff/incoming-acceptance` | recordIncomingPmAcceptance |
| GET | `/api/agents/execution/project-handoff/incoming-acceptance` | listAgentPmoIncomingPmAcceptances |
| POST | `/api/agents/execution/project-handoff/complete` | completeProjectHandoff |
| GET | `/api/agents/execution/project-handoff/assignment-pointers` | listAgentPmoControlledProjectAssignmentPointers |
| GET | `/api/agents/execution/project-handoff/assignment-history` | listAgentPmoProjectAssignmentHistory |
| POST | `/api/agents/execution/project-handoff/continuity-checks` | createHandoffContinuityChecks |
| GET | `/api/agents/execution/project-handoff/continuity-checks` | listAgentPmoHandoffContinuityChecks |
| POST | `/api/agents/execution/project-handoff/continuity-checks/[id]/status` | updateHandoffContinuityCheck |
| POST | `/api/agents/execution/project-handoff/exports` | generateProjectHandoffExport |
| GET | `/api/agents/execution/project-handoff/exports` | listAgentPmoProjectHandoffExports |
| GET | `/api/agents/execution/project-handoff/exports/[id]` | getAgentPmoProjectHandoffExportById |
| GET | `/api/agents/execution/project-handoff/exports/[id]/download` | download with Content-Disposition |
| GET | `/api/agents/execution/project-handoff/audit` | listAgentPmoProjectHandoffAuditEvents |
| GET | `/api/agents/execution/project-handoff/summary` | buildProjectHandoffSummary |
| GET | `/api/agents/execution/project-handoff/data` | getProjectHandoffData |

All routes require `requireAuthenticatedUser()` and `requireWorkspaceMember(workspaceId)`.

## Optional UI Behavior

UI is implemented under `/command-center/project-intelligence-handoff` if the existing command-center structure is clear.

Allowed UI labels:
- Create handoff request
- Validate handoff context
- Create PMO handoff gate
- Approve handoff preparation
- Generate handoff pack
- Create memory snapshot
- Create status snapshot
- Create snapshot items
- Record stakeholder context
- Record outgoing PM note
- Record incoming PM acceptance
- Complete controlled handoff
- Create continuity checks
- Update continuity check
- Generate handoff export
- Download safe export
- Archive handoff request

UI must not include Send Email, Send Slack, Create Jira Ticket, Create GitHub Issue, Schedule Meeting, Execute Adapter, or any uncontrolled assignment action.

## Examples

### Create Handoff Request

```json
POST /api/agents/execution/project-handoff/requests
{
  "workspaceId": "workspace_123",
  "projectId": "project_123",
  "currentPmId": "user_current_pm",
  "incomingPmId": "user_incoming_pm",
  "handoffReason": "client_escalation",
  "handoffUrgency": "high",
  "requestReason": "PMO is reassigning the project after client escalation."
}
```

### Record PMO Gate Decision

```json
POST /api/agents/execution/project-handoff/gate-decisions
{
  "workspaceId": "workspace_123",
  "handoffGateId": "handoff_gate_123",
  "decision": "approve_for_handoff",
  "rationale": "PMO approves handoff preparation. Assignment update pending incoming PM acceptance."
}
```

### Complete Controlled Handoff

```json
POST /api/agents/execution/project-handoff/complete
{
  "workspaceId": "workspace_123",
  "handoffRequestId": "handoff_request_123",
  "completionRationale": "PMO approved and incoming PM accepted. Completing controlled assignment pointer update."
}
```

## Prohibited Behavior

The following are explicitly prohibited in this layer:

- `sendEmail` / `send_email` / any SMTP/mail call
- `sendSlack` / any Slack API call
- `createJiraTicket` / `createGithubIssue` / any external ticket creation
- `createCalendarEvent` / any calendar mutation
- `callOpenAI` / `callAnthropic` / `callGemini` / any LLM provider call
- `createEmbedding` / any embedding call
- `trainModel` / `fineTuneModel` / any model training call
- `executeAdapter` / `runAdapter` / `dispatchExecutionToAdapter`
- `updateExternalProject` / `mutateExternalProject` / `callExternalApi`
- `deleteProjectMemory` / `eraseProjectHistory`
- `overwriteProjectBrain`
- `autoAssignProjectOwner` / any uncontrolled ownership mutation
- `fetch()` from service or registry layer
- Raw payload retention

## Testing Guide

Test file: `tests/agent-controlled-project-intelligence-handoff.test.mjs`

Key assertions:
- `handoff_completed` and `continuity_monitoring` are valid request statuses
- `client_escalation` and `pm_departure` are valid handoff reasons
- `createProjectHandoffRequest` does NOT create assignment pointer
- `validateProjectHandoffContext` does NOT create assignment pointer
- PMO gate is created with `under_review` (not auto-approved)
- Gate decision does NOT complete handoff
- `generateProjectHandoffPack` requires `pmo_approved` status
- `generateProjectHandoffPack` records limitations when data sources are unavailable
- `createProjectMemorySnapshot` is additive (does not delete existing memory)
- Snapshot items do not mutate live risks/blockers/decisions
- `recordIncomingPmAcceptance` requires pack exists and does NOT create pointer
- `completeProjectHandoff` requires `incoming_pm_accepted`, PMO approval, pack, memory snapshot
- `completeProjectHandoff` preserves `previousPmId` from prior pointer
- `createHandoffContinuityChecks` creates 10 checks, no notifications
- Export excludes raw_payload, secrets, password fields
- Service does not import openai/anthropic/gemini
- Service does not use `fetch()`
- Service does not call sendEmail/createJiraTicket/createGithubIssue/sendSlack/executeAdapter/deleteProjectMemory/overwriteProjectBrain/autoAssignProjectOwner

## Known Limitations

1. **Project memory store:** PMFreak does not have a dedicated project memory table in scope for this sprint. Memory snapshots are created with placeholder text and limitation notes. Future hardening sprint may wire them to actual project records.

2. **Risk/blocker/decision tables:** PMFreak does not have dedicated risk/blocker/decision tables in scope. Snapshot items are created as handoff artifacts with limitation notes.

3. **Stakeholder personal data:** Stakeholder context uses role-based summaries. Raw contact details are not included unless already safe per repo conventions.

4. **PMO role enforcement:** PMO-level gate approval and handoff completion require PMO identity. RLS uses workspace-member scope. PMO enforcement is application-layer only. Future hardening sprint may add role-specific RLS.

5. **Assignment pointer uniqueness:** Enforced via `UNIQUE (workspace_id, project_id)` SQL constraint and composite Map key in registry. External project ownership fields are not mutated.

6. **UI:** UI components are implemented only where the existing command-center structure is clear. See `src/app/(protected)/command-center/` for the actual route location.

7. **Export PDF:** PDF export is not implemented. Markdown, JSON, and CSV exports are supported.

## Suggested Next Sprint

**End-to-End Governance Runtime Integration & Production Hardening**

Once PMFreak has controlled governance policy activation/rollback and controlled project intelligence handoff, the next sprint should harden the full runtime path end-to-end:

- Cross-layer integration checks
- Runtime wiring validation
- Workspace isolation hardening
- RLS/policy audit
- Route contract consistency
- Dashboard integration
- Observability coverage
- Error handling
- Idempotency
- Safe exports
- CI/smoke checks
- Production readiness guardrails

No new product expansion. No new autonomous behavior.
