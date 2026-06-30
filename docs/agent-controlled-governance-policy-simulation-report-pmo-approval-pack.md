# Agent-Controlled Governance Policy Simulation Report & PMO Approval Pack

Sprint 14 of the PMO Governance Intelligence layer. Bridges a ready-for-review policy change request to a PMO-approved implementation planning package.

## Overview

This module generates governed, reviewable PMO packages from policy change backlog items. It produces reports, checklists, sign-off records, and implementation ticket drafts — all deterministically and in-memory, without applying policy or calling external services.

## Constraints

- Does NOT apply, mutate, or activate any policy
- Does NOT change review routing, risk scoring, or evidence requirements
- Does NOT execute adapters, send communications, or create external tickets
- Does NOT call LLMs, external APIs, or create embeddings
- All operations are deterministic and in-memory
- Payloads are redacted before storage or export
- Export content is validated for sensitive term leakage before generation

## Domain Models

### AgentPmoSimulationReport
A full governance simulation report generated from a policy change request. Contains sections covering executive summary, policy delta analysis, impact assessment, risk assessment, compliance alignment, rollback readiness, implementation readiness, resource requirements, stakeholder impact, approval checklist summary, dissenting opinions, and non-goals.

Status flow: `created` → `generating` → `generated` → `review_ready` → `signed_off` | `archived` | `failed`

### AgentPmoPolicyImpactSummary
Summarises the policy impact previews for a change request: total simulations run, total affected items, net benefit/risk score, and overall recommendation.

### AgentPmoPolicyDraftDiff
A diff between the conceptual current policy and the non-live governance policy draft. Uses `unknownBaseline=true` and labeled baselines (`conceptual_current_policy` / `non_live_governance_policy_draft`). The diff is never applied to live policy.

### AgentPmoApprovalChecklist
A structured checklist of governance gates that must pass before an approval pack can be signed off. Items cover: impact summary present, draft diff present, rollback checklist present, risk score within threshold, readiness confirmed, compliance aligned.

### AgentPmoRollbackReadinessChecklist
A checklist verifying that rollback plans exist, are documented, and that rollback steps have been reviewed. Derived from implementation readiness records.

### AgentPmoSignOffPacket
A governance sign-off packet collecting all required sign-off metadata: signer, role, decision type, rationale, and optional conditions. Sign-off decision type for approvals is `approve_for_implementation_planning` (not "implement policy").

### AgentPmoSignOffDecision
An individual sign-off decision record. When decision type is `approve_for_implementation_planning` and an `approvalPackId` is present, the associated approval pack is automatically moved to `signed_off` status.

### AgentPmoApprovalPack
The top-level container for the full PMO approval package. Assembles the simulation report, impact summary, draft diff, approval checklist, rollback checklist, sign-off packet, and implementation ticket draft into a single reviewable artifact.

Status flow: `created` → `assembling` → `assembled` → `review_ready` → `signed_off` | `changes_requested` | `archived` | `failed`

### AgentPmoApprovalPackArtifact
A reference artifact attached to an approval pack (e.g., simulation report, impact summary, draft diff). Tracks artifact type, reference ID, and size.

### AgentPmoImplementationTicketDraft
A draft implementation ticket. Title always starts with "Draft:". Body always contains "NOT a real ticket". The `blockedUntilSignOff` flag is `true` unless the associated approval pack is already signed off.

### AgentPmoApprovalPackExport
An export of approval pack content in Markdown, JSON, or CSV format. Content is validated for sensitive term leakage before generation. Exports are immutable once created.

### AgentPmoApprovalPackEvent
An observability event emitted for every state transition and significant action within the approval pack lifecycle.

## API Routes

All routes require authentication (`requireAuthenticatedUser`) and workspace membership (`requireWorkspaceMember`). The `actorId` is always derived from the authenticated user identity, never from the request body.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents/execution/approval-pack/reports` | List simulation reports |
| POST | `/api/agents/execution/approval-pack/reports` | Generate a simulation report |
| GET | `/api/agents/execution/approval-pack/reports/:reportId` | Get a simulation report |
| POST | `/api/agents/execution/approval-pack/reports/:reportId/status` | Update report status |
| POST | `/api/agents/execution/approval-pack/impact-summary` | Create an impact summary |
| POST | `/api/agents/execution/approval-pack/draft-diff` | Create a policy draft diff |
| POST | `/api/agents/execution/approval-pack/approval-checklist` | Create an approval checklist |
| POST | `/api/agents/execution/approval-pack/rollback-checklist` | Create a rollback readiness checklist |
| GET | `/api/agents/execution/approval-pack/signoff-packets` | List sign-off packets |
| POST | `/api/agents/execution/approval-pack/signoff-packets` | Create a sign-off packet |
| POST | `/api/agents/execution/approval-pack/signoff-decisions` | Record a sign-off decision |
| GET | `/api/agents/execution/approval-pack/packs` | List approval packs |
| GET | `/api/agents/execution/approval-pack/packs/:approvalPackId` | Get an approval pack |
| POST | `/api/agents/execution/approval-pack/packs/:approvalPackId/status` | Update pack status |
| POST | `/api/agents/execution/approval-pack/packs/:approvalPackId/archive` | Archive a pack |
| POST | `/api/agents/execution/approval-pack/assemble` | Assemble a full approval pack |
| GET | `/api/agents/execution/approval-pack/implementation-ticket-drafts` | List implementation ticket drafts |
| POST | `/api/agents/execution/approval-pack/implementation-ticket-draft` | Create an implementation ticket draft |
| GET | `/api/agents/execution/approval-pack/exports` | List exports |
| POST | `/api/agents/execution/approval-pack/exports` | Generate an export |
| GET | `/api/agents/execution/approval-pack/exports/:exportId` | Get an export record |
| GET | `/api/agents/execution/approval-pack/exports/:exportId/download` | Download raw export content |
| GET | `/api/agents/execution/approval-pack/summary` | Get approval pack summary |
| GET | `/api/agents/execution/approval-pack/data` | Get full approval pack data |
| GET | `/api/agents/execution/approval-pack/events` | List approval pack events |

## Security

### Payload Redaction
The following keys are always redacted from stored payloads:
`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `private_key`, `credential`, `client_secret`, `refresh_token`, `access_token`, `session_cookie`, `cookie`, `raw_payload`, `payload`, `outcomePayload`, `safeOutcomePayload`, `intendedSummary`, `actualSummary`, `rationale_from_learning`, `failureMessage`, `correctionReason`, `customer`, `client`, `project_name`, `email`, `phone`, `address`

### Export Safety Validation
Exports are checked for sensitive content before generation. Export creation fails if the content contains any blocked patterns including: password, secret, token, apiKey, api_key, authorization, private_key, credential, raw_payload, outcomePayload, failureMessage, correctionReason, actualSummary, intendedSummary.

### Forbidden Executable Terms
Text fields are sanitized to block: `applyPolicy`, `mutatePolicy`, `updateLivePolicy`, `executeAdapter`, `activatePolicy`, `deployPolicy`, `pushToProduction`, `triggerAdapter`, `sendEmail`, `sendNotification`, `createExternalTicket`, `callLLM`, `callExternalAPI`, `trainModel`, `createEmbedding`.

## Database

15 tables under Supabase with RLS enabled. All policies use workspace_memberships checks (no `using (true)`). Migration: `20260809000000_agent_controlled_governance_policy_simulation_report_pmo_approval_pack.sql`.

## Observability

All lifecycle events are emitted to `agent_pmo_approval_pack_events` with source type `agent_controlled_governance_policy_simulation_report_pmo_approval_pack`.

Event types: `pmo_approval_pack_created`, `pmo_approval_pack_assembling`, `pmo_approval_pack_assembled`, `pmo_simulation_report_created`, `pmo_simulation_report_section_created`, `pmo_impact_summary_created`, `pmo_policy_draft_diff_created`, `pmo_approval_checklist_created`, `pmo_approval_checklist_item_recorded`, `pmo_rollback_checklist_created`, `pmo_rollback_checklist_item_recorded`, `pmo_signoff_packet_created`, `pmo_signoff_decision_recorded`, `pmo_implementation_ticket_draft_created`, `pmo_approval_pack_export_created`, `pmo_approval_pack_archived`.
