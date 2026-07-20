# Persistence Migration Strategy

Companion to `05-canonical-persistence-architecture.md` and ADR-PMF-044. Documentary only — **no migration in this document has been executed, and no table, RLS policy, function, or trigger has been created, altered, or dropped by this PR.** All current-state facts below were gathered by direct inspection of `supabase/migrations/*.sql` (151 files, `20260428120000` through `20260828000002`) as of this PR's initial HEAD.

## 1. Current Schema Inventory

| Object type | Count | Source |
|---|---|---|
| Schemas | 1 (`public`) | No `CREATE SCHEMA` anywhere; `auth`/`storage` are Supabase-managed |
| Tables | 423 unique `CREATE TABLE` names | Direct grep across all migrations |
| Views | 0 | No `CREATE VIEW` |
| Materialized views | 0 | No `CREATE MATERIALIZED VIEW` |
| Functions | 73 | `CREATE [OR REPLACE] FUNCTION` |
| Triggers | 60 | Dominated by `*_touch_updated_at`, `*_frozen_guard`, workspace-consistency guards |
| Enum types | 1 (`public.trial_status`) | Every other lifecycle field uses `text` + `CHECK` |
| RLS policies | 885 | `CREATE POLICY` |
| Migration files | 151 | `20260428120000` → `20260828000002` |
| `supabase/schema.sql` | Does not exist | Migrations are the sole source of truth |
| `supabase/functions/` | Does not exist | |

No prerequisite gap: PR1, PR1.1, PR2, PR3, PR4, and ADR-PMF-001 through ADR-PMF-032 were all present and readable at this PR's start, per the environment validation performed before any document in this PR was written.

## 2. Table Classification Matrix (Representative)

This is a representative sample of the 423-table inventory, organized by concept area; it is not an exhaustive per-table listing. Classification values: aligned, partially aligned, conflicting, duplicated, overloaded, historical, orphaned, missing, unclear, candidate for deprecation.

| Current table(s) | Current purpose | Canonical concept | Classification | Recommended disposition |
|---|---|---|---|---|
| `workspaces`, `workspace_memberships` | Tenant root + membership | Workspace | Aligned | Extend with `enterprise_id` in Phase 1/2 |
| *(none — does not exist)* | — | Enterprise | Missing | Create in Phase 2 as new, additive aggregate |
| `pmos` (2026-08-28, newest migration) | Governance entity | PMO | Aligned, but new and not yet fully backfilled (`projects.pmo_id` nullable) | Continue; complete backfill in Phase 4 |
| `personal_portfolios` (+`_projects`,`_attention_items`,`_snapshots`) | Per-user saved-project watchlist | Not the canonical Portfolio | Conflicting-by-name / candidate for rename ("Saved Projects") | Keep as distinct feature; do not repurpose as Portfolio |
| *(none — no domain-sense Portfolio exists)* | — | Portfolio | Missing | Create in Phase 2 |
| `programs` (+ `program_epics`,`_sprints`,`_cards`,`_roadmap_sources`,`_materializations`) | Program coordination + roadmap tree | Program | Aligned but isolated — no FK to `projects`/`pmos` | Reconcile FKs in Phase 1/4, do not delete |
| `projects` | Central execution aggregate | Project | Aligned (best-implemented entity); historical `user_id`→`workspace_id`→`pmo_id` evolution well-documented | Continue; add optional Portfolio/Program links |
| `workspace_memberships` (RBAC) + `capability_grants`/`_requests`/`_policies`/`_revocation_registry` + `authority_delegations`/`_escalations`/`_registrations` | Three parallel authorization models | Membership / entitlements | Overloaded | Consolidate around RBAC base + capability layer for fine-grained grants; migration-unit-scoped |
| `company_id text` (via `current_company_id()`) on `company_subscriptions`, `company_usage`, `project_memories`, `operational_memory_entries`, `governance_audit_events`, `quota_reservations`, `abuse_rate_limits`, `dashboard_task_lifecycle_records` (2026-08-22, one of the newest) | Legacy pre-Workspace tenant key | Should be `workspace_id uuid` | Conflicting / historical (still live in newest migrations) | High-priority Phase 1 reconciliation — this is not fully resolved even in current code |
| `task_drafts` → `execution_tasks` | Workspace/project-scoped, RAID-linked task model | Task | Aligned | Continue as canonical Task lineage |
| `dashboard_task_lifecycle_records`/`_events` (2026-08-22) | Tenant/adapter/external-task-id-scoped dispatch tracker, text-keyed | Overlaps Task concept | Duplicated | Evaluate for consolidation or explicit re-scoping as an integration-adapter concept, not Task itself |
| `project_milestones` | Milestone | Milestone | Aligned | Continue |
| `raid_items` (`category in (risk\|assumption\|issue\|dependency)`, sourced from `vault_operational_signals`) | Unified RAID model | Risk/Issue/Dependency | Aligned for its lineage | Candidate as canonical RAID base |
| `risk_issue_records` (`type in (risk\|issue\|impediment\|change\|decision_needed)`, sourced from `operational_signals`) | Second, independently designed risk/issue model | Risk/Issue | Duplicated / conflicting with `raid_items` | Reconcile — two vocabularies and two upstream "signal" tables with no cross-reference found |
| `constitutional_decisions`, `operational_decisions` (+`_records`), `project_decisions`, `decision_outcomes`/`_effectiveness` | Four independent Decision families | Decision | Duplicated / overloaded | Highest-priority consolidation candidate; no cross-referencing FK found between families |
| `recommended_actions`, `constitutional_recommendations`, `pmo_recommendations`, `playbook_recommendations`, `governance_signal_recommendations` | Five independent Recommendation families | Recommendation | Duplicated | Consolidate under canonical `recommendations` |
| `governance_actions`, `pmo_intervention_actions`, `agent_action_conversions` (+ pipeline) | Independent Action models per subsystem | Action | Duplicated (aligned within each subsystem) | Consolidate under canonical `actions`, preserving subsystem-specific detail as extension data |
| `decision_outcomes`, `operational_outcome_effects`/`_observations`, `agent_execution_outcomes` (+ pipeline), `vault_intervention_outcomes`, `constitutional_recommendation_outcomes` | Outcome recurring independently per subsystem | Outcome | Duplicated / historical accretion | Consolidate under canonical `outcomes` |
| `ai_agents` (+`_scopes`,`_permissions`), early `agent_runs`/`agent_outputs` (2026-06-11) | First two generations of agent modeling | Agent / Agent Run | Historical / orphaned (superseded, never dropped) | Candidate for deprecation once current generation's coverage is confirmed equivalent |
| `agent_tool_registry`/`_tools`/`_requests`/`_approvals`, `agent_execution_requests`/`_results`/`_evidence_items`, `agent_execution_finalizations`, `agent_execution_dispatch_gates`/`_locks`/`_idempotency`/`_attempts`, `agent_execution_outcomes`/`_learning_signals`, `agent_pmo_*` (~180 tables, 2026-07-26 → 2026-08-14) | Current, actively-developed agent execution runtime | Agent Run / Tool Invocation / Proposal | Aligned (current generation) | Continue as the canonical lineage; evaluate `agent_pmo_*` breadth for consolidation opportunities during Phase 0 inventory |
| `organizational_memory` (+`_sources`) | 2 of ~14 aspirational Enterprise Intelligence tables | Enterprise Intelligence | Partially aligned — no elevation pipeline exists | Build out full pipeline in Phase 2, treating these as one possible input source, not the finished model |
| `project_memories` (legacy `company_id`), `personal_pm_memory`, `agent_memory_records` | Memory-adjacent tables lacking full governance metadata | Project Memory | Partially aligned | Add governance metadata (status, lineage, evidence links, confidence) in Phase 2; do not declare these already-canonical |
| *(none — no pgvector, no vector columns, no embeddings anywhere)* | Deliberately absent, per explicit migration comments ("No AI, no embeddings, no automatic learning") | Search/vector derivation | Missing by design, not a gap | Introduce only per ADR-PMF-041, only when a concrete need is demonstrated |
| `vault_documents`, `project_evidence`/`_content`, `evidence_items`, `agent_execution_evidence_items` | ~6 independent Evidence-adjacent table families | Evidence | Duplicated (aligned for storage boundary via single service-role-gated bucket) | Consolidate schema, keep the storage-boundary pattern |
| `governance_audit_events` (legacy `company_id`), `workspace_audit_events`, `capability_audit_events`, `security_events`, `agent_audit_events`, `agent_pmo_*_audit_events`, `platform_events` | Multiple audit-log families | Audit Record | `platform_events` = aligned/canonical candidate; others = historical/overlapping | Converge on `platform_events`-style append-only model; migrate/retire narrower audit tables with evidence |
| *(none — no generic notification/activity-feed table)* | — | Notification | Missing | Create in Phase 2 |
| `company_subscriptions`/`company_usage` (legacy `company_id` PK), `billing_webhook_events`, `quota_reservations`, `founder_*` (9 tables) | Billing/entitlements | Billing and Entitlements | Conflicting tenant key (never migrated to `workspace_id`) | High-priority Phase 1 reconciliation, same root cause as the general `company_id`/`workspace_id` split |
| *(none — no generic integrations/connections table; only Stripe as flat columns)* | — | Integration | Missing | Create in Phase 2 if/when a second real integration is built |
| `pmfreak-documents` (single Storage bucket, service-role-gated) | Object storage | Object storage references | Aligned (fail-closed boundary) | Continue; add generic metadata/reference table if multiple buckets are ever needed |
| Mixed `status='archived'` / `archived_at` (3 files) / `deleted_at` (13 files, concentrated in `constitutional_*`/`program_*`) | Three competing archival conventions | Archive/soft-delete | Unclear/inconsistent | Consolidate convention during migration, per ADR-PMF-043, table by table with evidence |
| `project_discovery.version`, one operational-evidence table, `project_constitution_amendment_governance.version`, `program_roadmap_sources.version` | Optimistic concurrency, 4 subsystems only | Version/concurrency control | Partially aligned | Extend to Project, Decision, Recommendation, Action per §14 of the main architecture document |

## 3. Contradictions and Duplicate Concepts (Consolidated List)

1. **Tenant key split:** `company_id`/`tenant_id` (text) vs. `workspace_id` (uuid) — still coexisting as of the newest migrations (`dashboard_task_lifecycle_records`, 2026-08-22). Highest-priority Phase 1 item.
2. **Decision modeled four times** (`constitutional_decisions`, `operational_decisions`, `project_decisions`, plus scattered `decision_outcomes`/`_effectiveness`), no cross-referencing FK.
3. **Recommendation modeled five times** (`recommended_actions`, `constitutional_recommendations`, `pmo_recommendations`, `playbook_recommendations`, `governance_signal_recommendations`).
4. **Two independent Risk/Issue models** (`raid_items` vs. `risk_issue_records`) with different category vocabularies and different upstream signal tables.
5. **Two independent Task models** (`task_drafts`/`execution_tasks` vs. `dashboard_task_lifecycle_records`/`_events`), the second text-keyed rather than uuid-scoped.
6. **Three parallel authorization models** (RBAC, capability grants, authority delegation) with no unifying entitlements table.
7. **Three agent-modeling generations** (`ai_agents`/early `agent_runs` vs. current `agent_execution_*`/`agent_tool_*`/`agent_pmo_*`), the first two orphaned, never dropped.
8. **Multiple audit-event families** not converged on `platform_events`.
9. **Enterprise entirely missing** as a table, only present as a billing plan-tier string and in filenames.
10. **Portfolio entirely missing** in the domain sense; only a same-named-but-unrelated personal watchlist (`personal_portfolios`) exists.
11. **Mixed archival convention** (`status='archived'` vs. `archived_at` vs. `deleted_at`).

None of these are resolved, renamed, or deleted by this PR — they are inventoried here as Phase 0 input for the migration strategy below.

## 4. Migration Principles

Per ADR-PMF-044: incremental expand-contract, never big-bang; each migration unit passes through all nine phases with documented prerequisites, validation, rollback, observability, reconciliation, data quality, RLS review, performance review, and user-impact assessment before contract begins.

## 5. Phase Sequence

**Phase 0 — Inventory and Freeze.** Confirm the current-state inventory (this document) for the specific migration unit; freeze further ad hoc schema changes to the tables in scope pending the migration plan.

**Phase 1 — Canonical IDs and Scope.** Establish canonical identifiers and tenant-scope columns for the migration unit (e.g., resolving the `company_id`/`workspace_id` split for a given table family) without yet introducing new canonical tables.

**Phase 2 — Additive Canonical Tables.** Introduce new canonical tables/columns per `05-canonical-data-model.md`, coexisting with legacy structures — nothing legacy is removed or renamed in this phase.

**Phase 3 — Dual Write or Controlled Synchronization.** New writes go to both legacy and canonical structures (or a synchronization job keeps them consistent), with reconciliation monitoring from the start.

**Phase 4 — Backfill.** Historical data is backfilled into canonical structures per the batched, resumable, idempotent, checkpointed, validated, rate-limited, tenant-scoped, audited, dry-run-capable process required by ADR-PMF-044 rule 5.

**Phase 5 — Read Migration.** Read paths move to the canonical structure, with legacy reads retained as a fallback until confidence is established.

**Phase 6 — Write Migration.** Write paths move fully to the canonical structure; dual-write from Phase 3 is retired once Phase 5/6 evidence confirms parity.

**Phase 7 — Legacy Freeze.** The legacy structure stops receiving any new writes; it remains readable for verification and rollback.

**Phase 8 — Deprecation.** The legacy structure is formally marked deprecated, with a removal timeline communicated and dependent code paths flagged.

**Phase 9 — Removal after Evidence.** The legacy structure is dropped only after evidence (usage telemetry, reconciliation reports, a defined observation window) confirms it is no longer load-bearing.

## 6. Expand-Contract Detail

Expand (Phases 1–2) never removes or renames an existing column/table. Contract (Phases 7–9) proceeds only after backfill and reconciliation evidence from Phases 4–6 — a legacy table is never dropped merely because a newer alternative exists.

## 7. Backfill Architecture

Every backfill: batch size, ordering, resumability, idempotency, checkpoint, validation, failure handling, rate limit, tenant scope, audit, dry run, reconciliation report. No backfill is executed by this PR; this section records the required shape for PR9+.

## 8. Dual Writes

Dual-write logic (Phase 3) is temporary, explicit application-layer complexity, removed once its migration unit reaches Phase 7. It is not a permanent architecture pattern.

## 9. Read Migration / Write Migration

Read migration (Phase 5) precedes write migration (Phase 6) per migration unit, so read-path correctness can be validated against real traffic before the write path — the more consequential change — is cut over.

## 10. Reconciliation

Reconciliation compares: write model vs. projections, database vs. object storage, outbox vs. published events, events vs. inbox consumers, canonical records vs. search index, canonical records vs. vector index, and current schema vs. migrated schema (per migration unit). Each reconciliation produces counts, mismatches, severity, a repair recommendation, and an audit reference.

## 11. Rollback

Every phase for every migration unit has an explicit rollback plan as a required element of its documentation (ADR-PMF-044 rule 2) — rollback is not assumed to be "just revert the migration file" given the presence of backfilled data and dual-write state in Phases 3–6.

## 12. RLS Migration

Given the current schema's own documented RLS incident history (recursion, fail-open billing gap, `SECURITY DEFINER` grant gaps), every migration unit's phases include an explicit RLS review — new canonical tables are built RLS-fail-closed from creation (ADR-PMF-042), and legacy-to-canonical cutover for read/write paths (Phases 5–6) re-verifies RLS coverage before and after.

## 13. Object Migration

Where a migration unit touches Evidence or Document tables, the corresponding object storage references (bucket, path, checksum) are validated for continued correctness — object metadata must never be silently orphaned by a table rename or ID change.

## 14. Search/Vector Rebuild

Since no search or vector infrastructure exists yet, migration units that introduce it (per ADR-PMF-041) build the rebuild-from-canonical-record capability from day one, rather than needing to retrofit it later.

## 15. Audit Continuity

Migration must never create a gap in audit coverage — if a migration unit consolidates multiple audit-event families (§3 item 8) toward `platform_events`, the consolidation itself is audited, and no historical audit record is lost or rendered unreachable during the transition.

## 16. Workflow Continuity

Migration units touching subsystems with existing ad hoc state machines (e.g., the governance policy simulation/approval/rollback chain) must ensure in-flight instances are not orphaned when moving toward the canonical `workflow_instances`/`workflow_steps` model (ADR-PMF-038) — either by draining in-flight instances under the old model before cutover, or by an explicit, validated state-mapping step.

## 17. Legacy Deprecation

A migration unit's legacy structure is only deprecated (Phase 8) after Phase 5/6 evidence, never on a fixed calendar schedule alone.

## 18. Removal Criteria

A legacy table is dropped (Phase 9) only when: (a) zero read/write traffic has been observed for a defined window, (b) reconciliation reports show no unresolved mismatches, (c) an explicit sign-off has been recorded, and (d) a rollback snapshot exists in backups for the required retention window.

## 19. Implementation Sequencing (Conceptual Priority Order)

1. Resolve the `company_id`/`workspace_id` tenant-key split (§3 item 1) — this blocks reliable Workspace scoping (ADR-PMF-034) across billing, memory, and audit.
2. Introduce `enterprises` as a new, additive aggregate (§2) — currently entirely missing, and several ADRs (010, 029, 040) assume its existence.
3. Complete the `pmos`/`projects.pmo_id` backfill already in progress (2026-08-28 migration) before building Portfolio/Program FKs on top of it.
4. Consolidate the Decision family (§3 item 2) — highest duplication count, highest governance stakes (ADR-PMF-030, ADR-PMF-036).
5. Consolidate the Recommendation family (§3 item 3).
6. Reconcile the two Risk/Issue models (§3 item 4) and the two Task models (§3 item 5).
7. Build the outbox, inbox/idempotency consolidation, and workflow-state tables (net-new, per ADR-PMF-037/038).
8. Build the Project Memory governance layer on top of existing memory-adjacent tables (§2), then the Enterprise Intelligence elevation pipeline (net-new).
9. Consolidate audit-event families toward `platform_events` (§3 item 8).
10. Evaluate deprecation of the orphaned first-generation agent tables (`ai_agents`, early `agent_runs`) once the current agent-execution generation's coverage is confirmed equivalent.

This sequencing is conceptual priority guidance for PR9+, not an authorized execution plan — each step still passes through the full nine-phase sequence (§5) with its own evidence gates.

## 20. Risks

- Consolidating four Decision families and five Recommendation families risks data loss or misattribution if reconciliation is rushed — this is the highest-risk migration unit in the sequence and should receive the most conservative phase pacing.
- The `company_id`/`workspace_id` split touches billing (real financial data) — any reconciliation error here has direct customer-facing financial consequences, warranting extra validation.
- The current RLS incident history (recursion, fail-open gaps) demonstrates that schema changes in this codebase have previously caused real security regressions — every migration unit's RLS review (§12) must be treated as a hard gate, not a formality.

## 21. Exit Criteria (Overall Migration Program)

The migration program (spanning many PR9+ migration units) is complete when: every aggregate in `05-canonical-data-model.md` has a single canonical storage unit with no unreconciled duplicate; `enterprise_id`/`workspace_id`/`project_id` scoping is uniform and the legacy `company_id`/`tenant_id` key is fully retired; outbox/inbox/workflow-state infrastructure is in production use; Project Memory and Enterprise Intelligence governance pipelines are live; audit is consolidated to a single append-only model; and every table in the classification matrix (§2) has reached a terminal disposition (canonical, deprecated-and-removed, or explicitly retained with documented rationale).

## Scope of This Document

This document creates no migration, alters no table, and executes no phase. It is the evidence base and phase-sequencing reference for PR9+.
