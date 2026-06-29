# PMO Governance Proposal Review & Controlled Policy Change Backlog

## Overview

This module provides governance infrastructure for reviewing approved policy proposals and managing a controlled policy change backlog. It enables PMO teams to:

- Promote approved policy proposals into structured backlog items
- Create policy change requests with scoped analysis
- Run deterministic simulations to estimate impact
- Generate non-live policy drafts for review
- Manage multi-stage approval workflows
- Evaluate implementation readiness
- Create rollback plans

## Non-Goals

This module does NOT:

- Call LLMs, external APIs, or AI providers
- Apply, activate, or deploy policy changes
- Mutate live policies, routing, or risk scoring
- Send emails, Slack messages, or calendar invites
- Create embeddings or train models
- Execute adapters or retry dispatch
- Expose raw payloads or blocked identifiers

Draft policies are NOT live policies. `approved_for_future_implementation` is not the same as implementation.

## Architecture

### Types (`agent-pmo-policy-backlog-types.ts`)

Defines all TypeScript types for the backlog system including:

- Status enums for backlog items, change requests, simulations, drafts, workflows
- Record types for all 11 entities
- Input types for creating/updating records

### Validation (`agent-pmo-policy-backlog-validation.ts`)

Pure, deterministic validation functions:

- Type validators for all enum types
- Payload serialization and redaction (blocks sensitive keys)
- Text sanitization with configurable length limits
- Input normalization with required field checks
- Derived value functions (priority, scope type, impact level, readiness)

### Registry (`agent-pmo-policy-backlog-registry.ts`)

In-memory store for all backlog entities:

- Backlog items
- Change requests and scopes
- Simulations and impact previews
- Policy drafts (versioned)
- Approval workflows and decisions (append-only)
- Implementation readiness records
- Rollback plans
- Backlog events (append-only)

### Service (`agent-pmo-policy-backlog-service.ts`)

Orchestration layer with key operations:

- `createPolicyBacklogItemFromProposal`: Validates proposal is approved, extracts safe metadata
- `createPolicyChangeRequestFromBacklogItem`: Creates change request + initial scope
- `runPolicyChangeSimulation`: Deterministic estimation from signal counts (no AI)
- `generatePolicyImpactPreview`: Derives summary from simulation results
- `createVersionedGovernancePolicyDraft`: Non-live draft with explicit non-live statement
- `createPolicyApprovalWorkflowForRequest`: Multi-stage approval workflow
- `recordPolicyApprovalDecisionForWorkflow`: Append-only decision recording
- `evaluatePolicyImplementationReadinessForRequest`: Checks all prerequisites
- `createGovernancePolicyRollbackPlan`: Rollback plan creation
- `archivePolicyChangeRequest`: Archives without applying

## Database Schema

11 tables created in migration `20260808000000`:

1. `agent_pmo_policy_backlog_items`
2. `agent_pmo_policy_change_requests`
3. `agent_pmo_policy_change_scopes`
4. `agent_pmo_policy_simulations`
5. `agent_pmo_policy_impact_previews`
6. `agent_pmo_governance_policy_drafts`
7. `agent_pmo_policy_approval_workflows`
8. `agent_pmo_policy_approval_decisions`
9. `agent_pmo_policy_implementation_readiness`
10. `agent_pmo_policy_rollback_plans`
11. `agent_pmo_policy_backlog_events`

All tables have RLS enabled with workspace member read policies.

## API Routes

Under `src/app/api/agents/execution/policy-backlog/`:

- `backlog-items/` — List and create backlog items
- `change-requests/` — List and create change requests
- `simulations/` — List and run simulations
- `drafts/` — List and create policy drafts
- `approval-workflows/` — List and create workflows, record decisions
- `rollback-plans/` — List and create rollback plans
- `summary/` — Workspace-level summary
- `data/` — Full backlog data
- `events/` — Audit event log

## Security

- All routes require authentication and workspace membership
- No raw payloads, customer identifiers, or sensitive data exposed
- Payload redaction blocks: password, secret, token, apiKey, email, phone, etc.
- Simulations are deterministic, using only historical signal counts
- Draft policies explicitly marked as non-live in their summaries
