# PMO Beta Onboarding / Demo Data / Tenant Readiness

Sprint #7 — Final sprint in the 7-sprint governance/core readiness plan.

## Overview

This module provides deterministic, non-destructive record-keeping for beta readiness planning. It records plans, demo data bundles, onboarding checklists, tenant validations, readiness gates, and decisions — all without calling external APIs, LLMs, or sending communications.

## Non-Goals

- Does NOT call LLMs or AI providers
- Does NOT call external APIs
- Does NOT execute adapters
- Does NOT activate policies
- Does NOT rollback policies
- Does NOT complete handoffs
- Does NOT send emails, Slack messages, or any communications
- Does NOT create Jira tickets or GitHub issues
- Does NOT create calendar events
- Does NOT create embeddings
- Does NOT train models
- Does NOT mutate external systems
- Does NOT create production tenants or production customers
- Does NOT send beta invitations (records invitation readiness only)
- All demo data uses fictional names only — no real customer data

## Core Models

### BetaReadinessPlanRecord
Top-level plan tracking readiness for a specific scope (internal_demo, controlled_beta, partner_beta, sales_demo, pmo_demo, full_beta_readiness).

### DemoDataBundleRecord
Contains generated fictional demo data organized by bundle type. All project/PM/client names are fictional.

### DemoProjectScenarioRecord
A fictional project scenario with fictional project name, PM name, and client name. Types: implementation_project, migration_project, security_project, compliance_project, troubled_project, handoff_project, executive_dashboard_project.

### DemoGovernanceScenarioRecord
A fictional governance scenario with fictional policy title. Types: policy_change_request, approval_pack, implementation_planning, dry_run_gate, activation_rollback, runtime_hardening, full_governance_path.

### DemoHandoffScenarioRecord
A fictional handoff scenario with fictional from/to PM names. Types: workload_rebalance, vacation_coverage, pm_departure, client_escalation, troubled_project_reassignment, senior_pm_takeover.

### BetaOnboardingChecklistRecord
Tracks 13 checklist items: workspace_created, demo_data_loaded, sample_projects_ready, sample_governance_ready, dashboard_ready, exports_ready, docs_ready, admin_ready, beta_users_defined, invitation_records_ready, safety_checks_passed, known_limitations_reviewed, support_path_defined.

### BetaUserReadinessRecord
Tracks readiness for beta user roles: beta_admin, pmo_director, project_manager, executive_viewer, delivery_lead, demo_viewer, support_admin. Uses fictional user labels only.

### BetaInvitationReadinessRecord
Records that invitation templates are prepared for manual sending. Does NOT send invitations.

### BetaAdminReadinessRecord
Tracks workspace isolation, RLS, export safety, docs review, and support path definition.

### TenantReadinessValidationRecord
Individual validation checks: workspace_isolation, rls_policies, export_safety, no_production_data, no_external_api_calls, no_communications_sent, demo_data_fictional_only.

### BetaReadinessGateRecord
Aggregates open/critical blocker counts and tracks gate status.

### BetaReadinessDecisionRecord
Records gate decisions: approve_for_controlled_beta, approve_with_warnings, reject, request_remediation, block, archive.

### BetaReadinessBlockerRecord
Records blockers with types like production_data_detected, rls_gap, external_api_risk, etc. Severities: low, medium, high, critical.

### BetaReadinessRemediationItemRecord
Tracks remediation items: demo_data_fix, docs_fix, checklist_fix, export_safety_fix, rls_fix, workspace_scope_fix, ui_fix, test_fix, build_fix, known_limitation_documentation, support_process_fix, future_sprint_item.

### BetaReadinessExportRecord
Safe exports (markdown, json, csv) excluding raw payloads, secrets, tokens, credentials, real customer identifiers, real emails, real phone numbers.

### BetaReadinessEventRecord
Audit log of all plan activities (19 event types).

## API Routes

All routes under `/api/agents/execution/beta-readiness/`:

| Route | Methods | Purpose |
|-------|---------|---------|
| `/plans` | GET, POST | Create and list readiness plans |
| `/demo-bundles` | GET, POST | Generate and list demo data bundles |
| `/checklists` | GET, POST | Run and list onboarding checklists |
| `/gates` | GET, POST | Evaluate and list readiness gates |
| `/blockers` | GET, POST | Record and list blockers |
| `/remediation-items` | GET, POST | Record and list remediation items |
| `/exports` | GET, POST | Generate and list exports |
| `/tenant-validations` | GET, POST | Run and list tenant validations |
| `/events` | GET | List events |
| `/summary` | GET | Build readiness summary |
| `/data` | GET | Get all plan data |

## Export Safety

All exports exclude:
- Raw payloads and safe payloads
- Passwords, secrets, tokens, API keys
- Credentials and private keys
- Stack traces and CI logs
- Real customer identifiers
- Real emails and phone numbers
- Personal identifiers

## Database Tables

18 tables created in migration `20260815000000_agent_beta_onboarding_demo_data_tenant_readiness.sql`:
- agent_beta_readiness_plans
- agent_beta_workspace_readiness
- agent_demo_data_bundles
- agent_demo_project_scenarios
- agent_demo_governance_scenarios
- agent_demo_handoff_scenarios
- agent_beta_onboarding_checklists
- agent_beta_onboarding_checklist_items
- agent_beta_user_readiness
- agent_beta_invitation_readiness
- agent_beta_admin_readiness
- agent_tenant_readiness_validations
- agent_beta_readiness_gates
- agent_beta_readiness_decisions
- agent_beta_readiness_blockers
- agent_beta_readiness_remediation_items
- agent_beta_readiness_exports
- agent_beta_readiness_events

All tables have RLS enabled with workspace-scoped policies. No public access. No `USING (true)` policies.

## Known Limitations

1. Beta invitation sending is manual — this module records invitation readiness only and does not dispatch invitations.
2. Support path definition requires manual configuration and is recorded as `not_applicable` in automated checks.
3. Demo data uses a fixed set of fictional names. Additional fictional names can be added to the `FICTIONAL_*` arrays in the service file.
4. Export safety validation uses string matching — content is checked but not deeply inspected for PII patterns.
5. Checklist evaluation is deterministic — some items (invitation_records_ready, support_path_defined) are marked `not_applicable` pending manual setup.

## Observability

Source type: `agent_beta_onboarding_demo_data_tenant_readiness`

Event types (19):
- beta_readiness_plan_created
- beta_workspace_readiness_recorded
- demo_data_bundle_created
- demo_data_bundle_validated
- demo_project_scenario_created
- demo_governance_scenario_created
- demo_handoff_scenario_created
- beta_onboarding_checklist_created
- beta_onboarding_checklist_item_recorded
- beta_user_readiness_recorded
- beta_invitation_readiness_recorded
- beta_admin_readiness_recorded
- tenant_readiness_validation_recorded
- beta_readiness_gate_created
- beta_readiness_decision_recorded
- beta_readiness_blocker_recorded
- beta_readiness_remediation_recorded
- beta_readiness_export_created
- beta_readiness_plan_archived
