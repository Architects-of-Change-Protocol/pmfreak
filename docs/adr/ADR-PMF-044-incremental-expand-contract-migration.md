# ADR-PMF-044: Incremental Expand-Contract Migration

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

The current-state inventory found 423 tables, 885 RLS policies, and significant conceptual duplication accumulated over roughly 150 migrations — at least four independent Decision-record families, five independent Recommendation-record families, two independent Risk/Issue models, two independent Task models, and a legacy `company_id text` tenant key still coexisting with the canonical `workspace_id uuid` key in some of the newest migrations (`dashboard_task_lifecycle_records`, 2026-08-22). Meanwhile, foundational concepts this PR's authority documents assume — `enterprises`, a first-class Portfolio aggregate, an outbox, workflow-state tables — do not exist at all yet. PR5 must define how the canonical persistence architecture (ADR-PMF-033 through 043) is reached from this current state without a disruptive, high-risk, single-cutover rewrite, and without this PR itself executing any part of that migration.

## Decision

**Migration from the current schema to the canonical persistence architecture proceeds incrementally via expand-contract: additive canonical structures are introduced alongside existing tables, data is backfilled and reconciled, reads and writes are migrated in controlled phases per migration unit, and legacy structures are deprecated and removed only after evidence of successful cutover — never as a single big-bang rewrite.** This ADR fixes the phase sequence and its required practices; it does not execute any phase, create any migration, or specify exact per-table sequencing, all of which remain future, evidence-based PR9+ work.

## Persistence Rules

1. Migration proceeds in the following phases, applied per migration unit (a bounded-context-sized or aggregate-sized slice, not the whole schema at once): Phase 0 (Inventory and Freeze) → Phase 1 (Canonical IDs and Scope) → Phase 2 (Additive Canonical Tables) → Phase 3 (Dual Write or Controlled Synchronization) → Phase 4 (Backfill) → Phase 5 (Read Migration) → Phase 6 (Write Migration) → Phase 7 (Legacy Freeze) → Phase 8 (Deprecation) → Phase 9 (Removal after Evidence).
2. Each phase for each migration unit documents: prerequisites, the migration unit's scope, validation criteria, rollback plan, observability requirements, reconciliation approach, data-quality checks, RLS implications, performance considerations, and user impact — a phase is not considered complete without all of these addressed.
3. Expand introduces new columns/tables and permits coexistence with the legacy structure; it never removes or renames an existing column/table as part of the same change.
4. Contract removes legacy dependencies only after the corresponding expand phase's data has been backfilled, dual-write/dual-read has been verified via reconciliation, and an explicit evidence-based decision authorizes the contract step — a legacy table is never dropped merely because a newer alternative exists, only after usage evidence confirms the legacy path is no longer load-bearing.
5. Backfills are batched, ordered, resumable, idempotent, checkpointed, validated, rate-limited, tenant-scoped, audited, dry-run-capable, and produce a reconciliation report — an ad hoc, unbatched, non-resumable backfill script is not an acceptable migration mechanism for canonical data.
6. No migration phase in this ADR is executed by PR5; PR5 documents the strategy only. Execution begins in PR9+.
7. Conceptual duplication identified in the current-state inventory (Decision, Recommendation, Risk/Issue, Task families; the `company_id`/`tenant_id` vs. `workspace_id` tenant-key split) is treated as migration-unit input for Phase 0's inventory, not resolved or renamed by this ADR.
8. Big-bang migration (replacing legacy tables with canonical tables in a single atomic cutover across the whole schema) is prohibited unless a specific migration unit can demonstrate that incremental expand-contract is technically impossible for that unit — and even then, requires an explicit, separately reviewed exception, not a default fallback.

## Alternatives Considered

- **Big-bang migration: design the full canonical schema and cut over in one release.** Rejected: with 423 tables, 885 RLS policies, and multiple duplicated concept families already in production, a single cutover carries unacceptable risk of data loss, downtime, and unrecoverable RLS regressions (the current-state inventory already documents at least two serious RLS incidents from far smaller changes) — incremental expand-contract lets each migration unit be validated independently before the next proceeds.
- **Migrate opportunistically, table by table, with no fixed phase sequence or documentation requirement.** Rejected: this is close to the pattern that already produced the current-state duplication (Decision modeled four times, Recommendation modeled five times) — without a fixed sequence and required per-phase documentation, future migration work risks repeating the same accretion pattern rather than consolidating it.
- **Freeze the legacy schema entirely and build the canonical model as an entirely separate, parallel system, migrating consumers wholesale at the end.** Rejected: this defers all validation to a single late cutover point (functionally similar to big-bang risk) and forgoes the benefit of incremental reconciliation catching problems early, per migration unit, while both models coexist.

## Positive Consequences

- Provides a concrete, repeatable phase sequence future migration PRs can follow per migration unit, rather than each PR inventing its own migration approach.
- Keeps legacy tables operative and rollback-capable throughout migration, minimizing the risk of an irrecoverable production incident during the transition.
- Creates a natural checkpoint (Phase 9, removal after evidence) that prevents premature deletion of legacy structures that might still be load-bearing in ways not yet fully understood.

## Negative Consequences

- Expand-contract is slower than big-bang migration for any single migration unit, since it requires dual-write/dual-read verification and evidence-gathering before contract can proceed.
- Running legacy and canonical structures side by side (even temporarily, per migration unit) adds operational and cognitive overhead — two representations of overlapping data must both be kept consistent during the transition window for that unit.

## Risks

- **Phase-skipping risk:** time pressure could tempt a future implementation PR to skip reconciliation (Phase 4/5) or jump straight to contract (Phase 7/8) without adequate evidence — this ADR's rule 4 exists specifically to require evidence-gated contract, not a scheduled one.
- **Migration-unit scoping risk:** choosing migration units too large (e.g., "all of Decision Management" in one unit, spanning four current-state table families at once) could recreate big-bang risk within a nominally incremental process — migration units should be sized to allow independent validation and rollback.
- **Indefinite coexistence risk:** without a discipline of periodically revisiting Phase 9 candidates, legacy tables could linger indefinitely "just in case," permanently inflating the 423-table current-state count rather than converging toward the canonical model.

## Security and Data Implications

- RLS implications are an explicit required element of every phase's documentation (rule 2), given the current-state inventory's own history of RLS regressions during schema changes — no migration unit proceeds without an explicit RLS review for that phase.
- Backfill audit requirements (rule 5) ensure that data movement between legacy and canonical structures is itself traceable, consistent with the audit and provenance principles (ADR-PMF-036, §26).

## Application Implications

- Repository implementations may need to support dual-write or dual-read logic during a migration unit's Phase 3–6 window, which is temporary, explicit application-layer complexity that must be removed once that unit reaches Phase 7 (Legacy Freeze).
- Application code must not assume a migration unit's canonical table is fully backfilled or authoritative until Phase 5/6 evidence confirms it.

## API Implications

- PR6's API contracts should be designed to be insulated from which underlying phase a given migration unit is currently in, where feasible, so API consumers are not exposed to internal migration state.

## UX Implications

- Migration should be invisible to end users except through improved consistency and correctness over time; no user-facing behavior change should be introduced without separate product review, even when the underlying storage changes.

## Migration Implications

- This ADR is itself the migration strategy; see `05-persistence-migration-strategy.md` for the current-schema inventory, table classification, and phase-by-phase detail this ADR's rules apply to.

## Operational Implications

- Each migration unit's Phase 3–6 window requires additional monitoring (dual-write consistency, reconciliation job health) beyond what a single-model schema requires — this is accepted, temporary operational cost per unit.

## Compatibility Implications

- Fully compatible with continued production operation throughout migration — no migration unit's expand phase requires downtime, and contract phases proceed only after evidence of safety.

## Out of Scope

- Exact migration unit boundaries and sequencing across the 423 current-state tables — deferred to `05-persistence-migration-strategy.md`'s conceptual sequencing and to PR9+'s concrete planning.
- Exact backfill tooling and reconciliation report format — implementation detail.

## Validation

Validation criteria: (1) `05-persistence-migration-strategy.md` documents all nine phases in this ADR's sequence with the required per-phase elements (rule 2); (2) no document produced under PR5 proposes a big-bang cutover for any migration unit without an explicit, separately justified exception; (3) the current-state table classification matrix explicitly flags every duplicated concept family (Decision, Recommendation, Risk/Issue, Task, tenant-key split) as Phase 0 inventory input.

## References

- `docs/product-architecture/05-persistence-migration-strategy.md`
- Current-state inventory (this PR's Section 7 inspection): `supabase/migrations/` (423 tables, 885 RLS policies, four Decision-record families, five Recommendation-record families, two Risk/Issue models, two Task models, `company_id`/`tenant_id` vs. `workspace_id` split)
- `docs/adr/ADR-PMF-033-relational-canonical-write-model.md`
- `docs/adr/ADR-PMF-034-workspace-scoped-operational-persistence.md`
