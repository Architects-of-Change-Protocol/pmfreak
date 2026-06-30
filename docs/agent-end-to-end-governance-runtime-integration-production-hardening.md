# End-to-End Governance Runtime Integration & Production Hardening

## Purpose

The End-to-End Governance Runtime Integration & Production Hardening layer validates the existing PMFreak governance runtime without introducing new product behavior.

It systematically audits all governance layers, verifies route contracts, checks database contracts, inspects RLS policies, enforces workspace isolation, confirms observability coverage, validates export safety, checks idempotency boundaries, verifies error handling, and evaluates production readiness.

**Explicit statement:** The End-to-End Governance Runtime Integration & Production Hardening layer validates the existing PMFreak governance runtime without introducing new product behavior. It does not execute adapters, activate policies, rollback policies, complete handoffs, mutate external systems, create external tickets, create calendar events, send communications, call LLMs, create embeddings, train models, call external APIs, create beta tenants, or create demo customers.

## Scope

Sprint #6 of 7 PMFreak governance/core readiness sprints.

Covers:

- Layer integration audits for all 15 governance layers
- Route contract audits for all `runtime-hardening` API routes
- Database contract audits for all new hardening tables
- RLS policy audits verifying workspace-scoped access
- Workspace isolation verification
- Observability coverage for new source and event types
- Export safety validation blocking unsafe fields
- Idempotency boundary documentation
- Error handling safety checks
- UI/dashboard integration check (optional, if UI exists)
- CI smoke check recording safe summaries
- Production readiness gate with blocker tracking
- Remediation item tracking

## Non-Goals

- Does not call LLMs or AI providers
- Does not call external APIs
- Does not execute adapters
- Does not activate policies
- Does not rollback policies
- Does not complete handoffs
- Does not send emails, Slack messages, or communications
- Does not create Jira tickets or GitHub issues
- Does not create calendar events
- Does not create embeddings
- Does not train models
- Does not mutate external systems
- Does not create beta tenants or demo customers
- Does not create beta onboarding flows (even when production readiness gate passes)

## Relationship to Prior Governance Layers

### Project Intelligence Handoff (Sprint 5)
The final prior layer. Hardening verifies that `agent-pmo-project-handoff-types.ts`, validation, registry, service, tests, docs, and migration all exist and are exported correctly.

### Policy Activation / Rollback Gate (Sprint 4)
Hardening verifies that `agent-pmo-policy-activation-types.ts`, validation, registry, and service exist. Idempotency checks confirm activation and rollback both require approved gates.

### Dry-Run Gate (Sprint 3)
Hardening verifies dry-run gate type, validation, registry, and service files exist.

### Implementation Planning Workspace (Sprint 2)
Hardening verifies implementation planning layer files and exports.

### Approval Pack (Sprint 1)
Hardening verifies approval pack layer files and exports.

### Policy Backlog
Hardening verifies policy backlog layer files and exports.

### PMO Governance Dashboard
Hardening verifies governance dashboard layer files and exports.

### Execution Request Runtime
Hardening verifies the execution request runtime type and registry files.

### Relationship to Future Beta Onboarding Sprint
Passing the production readiness gate in this sprint enables — but does not implement — Sprint 7 (Beta Onboarding / Demo Data / Tenant Readiness). The gate explicitly records that passing it does not create beta onboarding flows.

---

## Models

### Runtime Hardening Run

Represents a complete or scoped hardening audit session.

**Statuses:** `created` | `running` | `passed` | `passed_with_warnings` | `failed` | `blocked` | `archived`

**Scopes:** `full_governance_runtime` | `route_contracts` | `database_contracts` | `rls_policies` | `workspace_isolation` | `observability` | `exports` | `idempotency` | `error_handling` | `ui_dashboard` | `ci_smoke` | `production_readiness`

Key fields: `id`, `workspaceId`, `scope`, `status`, `layersAudited`, `blockerCount`, `warningCount`, `passedCheckCount`, `failedCheckCount`, `safeRunPayloadJson`

### Layer Integration Audit

Per-layer audit verifying files, exports, docs, tests, and migrations.

**Governance Layers:** execution_request_runtime, tool_adapter_layer, execution_results_evidence, human_review_action_inbox, action_conversion_approval_bridge, dispatch_gate, result_reconciliation, learning_signals, governance_dashboard, policy_backlog, approval_pack, implementation_planning, dry_run_gate, policy_activation_rollback, project_intelligence_handoff

Each audit checks: type file, validation file, registry file, service file, docs, tests, migration, API routes, exports.

### Route Contract Audit

Per-route audit verifying route file existence, exported HTTP methods, dynamic param convention, request parsing safety, deterministic responses, and sanitized errors.

### Database Contract Audit

Per-table audit verifying migration file, row type, column constants, contract version inclusion, indexes, and `created_at`/`updated_at` conventions.

### RLS Policy Audit

Per-table audit verifying RLS enabled, workspace-scoped read policy, write policies, no public access, and no broad `USING (true)` policies.

### Workspace Isolation Check

Verifies: `workspaceId` required, list functions filter by workspace, get functions verify workspace, API routes require workspaceId, no cross-workspace leakage.

### Observability Coverage Check

Verifies: source type `agent_end_to_end_governance_runtime_integration_production_hardening` exists, event types exist, category is governance, no circular imports, no unsafe payload.

### Export Safety Check

Verifies that exports exclude: raw payloads, secrets, tokens, credentials, stack traces, unnecessary personal data. Verifies non-goals are included.

Blocked field patterns: `raw_payload`, `raw_ci_log`, `stack_trace`, `password`, `secret`, `token`, `credential`, `api_key`, `private_key`, `correction_detail`, `failure_detail`.

### Idempotency Check

Verifies: append-only decisions preserved, pointer updates preserve previous, completion requires correct status, activation requires approved gate, rollback requires approved gate, exports regeneratable, archive does not hard-delete.

### Error Handling Check

Verifies: route errors sanitized, service errors don't leak raw payloads, validation errors are clear, missing records return safe messages, stack traces not returned from API routes.

### UI / Dashboard Integration Check

Optional. Verifies: dashboard routes exist, command-center page builds, no uncontrolled action buttons, no prohibited labels.

### CI Smoke Check

Records safe summaries for: typecheck result, test result, build result, hardening test result, terminology result, prohibited behavior result. Does NOT store raw CI logs.

### Production Readiness Gate

**Statuses:** `created` | `under_review` | `passed` | `passed_with_warnings` | `failed` | `blocked` | `archived`

Passing this gate does not create beta onboarding flows.

**Decision types:** `pass_for_beta_onboarding` | `pass_with_warnings` | `fail` | `block` | `request_remediation` | `archive`

### Blocker

**Types:** missing_layer_export, missing_route_contract, failing_typecheck, failing_test, failing_build, rls_gap, workspace_isolation_gap, observability_gap, export_safety_gap, unsafe_error_handling, idempotency_gap, ui_action_safety_gap, prohibited_behavior_detected, terminology_violation, unresolved_known_limitation, unknown

**Severity:** low | medium | high | critical

**Status:** open | resolved | accepted | waived | blocked | archived

### Remediation Item

**Types:** code_fix, test_fix, docs_fix, migration_fix, route_fix, export_safety_fix, rls_policy_fix, observability_fix, ui_safety_fix, known_limitation_documentation, future_sprint_item

**Statuses:** created | in_progress | completed | rejected | blocked | archived

### Hardening Export

Formats: `markdown` | `json` | `csv`

Safety validation is mandatory before export is stored. Blocked fields are checked and rejected. Non-goals are always included.

### Hardening Event

Append-only audit trail of all hardening actions. Event types correspond to all hardening run lifecycle transitions and check recordings.

---

## API Routes

All routes under `/api/agents/execution/runtime-hardening/`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /runs | Create hardening run |
| GET | /runs | List hardening runs |
| GET | /runs/[hardeningRunId] | Get hardening run |
| POST | /runs/[hardeningRunId]/status | Update run status |
| POST | /runs/[hardeningRunId]/archive | Archive run |
| POST | /layer-integration | Run layer integration audit |
| GET | /layer-integration | List layer audits |
| POST | /route-contracts | Run route contract audit |
| GET | /route-contracts | List route audits |
| POST | /database-contracts | Run database contract audit |
| GET | /database-contracts | List DB audits |
| POST | /rls-policies | Run RLS audit |
| GET | /rls-policies | List RLS audits |
| POST | /workspace-isolation | Run workspace isolation check |
| GET | /workspace-isolation | List workspace isolation checks |
| POST | /observability | Run observability coverage check |
| GET | /observability | List observability checks |
| POST | /export-safety | Run export safety check |
| GET | /export-safety | List export safety checks |
| POST | /idempotency | Run idempotency guard check |
| GET | /idempotency | List idempotency checks |
| POST | /error-handling | Run error handling check |
| GET | /error-handling | List error handling checks |
| POST | /ui-dashboard | Run UI dashboard check |
| GET | /ui-dashboard | List UI dashboard checks |
| POST | /ci-smoke | Run CI smoke check |
| GET | /ci-smoke | List CI smoke checks |
| POST | /readiness-gates | Evaluate production readiness gate |
| GET | /readiness-gates | List readiness gates |
| POST | /readiness-decisions | Record readiness decision |
| GET | /readiness-decisions | List readiness decisions |
| POST | /blockers | Record blocker |
| GET | /blockers | List blockers |
| POST | /blockers/[blockerId]/status | Update blocker status |
| POST | /remediation-items | Record remediation item |
| GET | /remediation-items | List remediation items |
| POST | /remediation-items/[remediationItemId]/status | Update remediation status |
| POST | /exports | Generate export |
| GET | /exports | List exports |
| GET | /exports/[exportId] | Get export |
| GET | /exports/[exportId]/download | Download export |
| GET | /events | List events |
| GET | /summary | Get run summary |
| GET | /data | Get all data for run |

---

## Prohibited Behavior

The following behaviors are permanently prohibited:

- Calling `openai`, `anthropic`, `gemini`, or any LLM provider
- Creating embeddings or vector indexes
- Training or fine-tuning models
- Calling external APIs (`fetch()` to external hosts)
- Sending emails, Slack messages, or any communications
- Creating Jira tickets or GitHub issues
- Creating calendar events or webhooks
- Executing governance adapters
- Activating policies without gate approval
- Rolling back policies without gate approval
- Completing project handoffs without PMO and incoming PM approval
- Creating beta tenants or demo customers
- Auto-assigning project owners
- Weakening RLS or removing workspace isolation

---

## Testing Guide

```bash
# Run focused hardening tests
node --test tests/agent-end-to-end-governance-runtime-integration-production-hardening.test.mjs

# Run full test suite
npm test

# Typecheck
npm run typecheck

# Build
npm run build

# Terminology check (expect no matches)
BAD_ROOT="$(printf 'F%s' 'ucker')"
BAD_LOWER="$(printf 'f%s' 'ucker')"
grep -RIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  -E "${BAD_ROOT}|${BAD_LOWER}" . || true

# Prohibited behavior check
grep -R "openai\|anthropic\|gemini\|embedding\|embeddings\|fine-tune\|finetune\|training" \
  src/lib/agents src/app/api/agents/execution \
  tests/agent-end-to-end-governance-runtime-integration-production-hardening.test.mjs \
  docs/agent-end-to-end-governance-runtime-integration-production-hardening.md \
  -n || true
```

---

## Known Limitations

1. **File existence checks use `existsSync`**: The layer integration audit and route contract audit check file existence at the path relative to the CWD at runtime. In test environments, paths are relative to the project root.

2. **In-memory registry**: The registry uses in-memory Maps and arrays. In production, these would be backed by Supabase. The migration file defines the schema for future Supabase integration.

3. **RLS audit reads migration file**: The RLS policy audit reads the migration SQL file to check for RLS markers. If the file is not present at runtime, audits will flag findings but not crash.

4. **UI check is passive**: The UI dashboard integration check only checks if the page file exists. It does not render the page or inspect component labels.

5. **CI smoke check requires caller-supplied results**: The CI smoke check records results provided by the caller. It does not run `npm` commands itself.

6. **Production readiness gate does not auto-pass**: The gate status starts as `under_review` when no critical blockers exist, not `passed`. A human PMO decision is required to move to `passed`.

---

## Suggested Next Sprint

**Sprint 7: Beta Onboarding / Demo Data / Tenant Readiness**

After passing the production readiness gate from this sprint, Sprint 7 may implement:

- Demo tenant creation flows
- Demo project data seeding
- Onboarding wizard UI
- Tenant provisioning API
- Beta user invitation flows

Do not implement Sprint 7 here. The production readiness gate from this sprint is the prerequisite signal, not an automatic trigger.
