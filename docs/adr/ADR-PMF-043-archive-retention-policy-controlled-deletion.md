# ADR-PMF-043: Archive, Retention and Policy-Controlled Deletion

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

The current-state inventory found three competing, inconsistently applied lifecycle conventions across the schema: a `status='archived'` enum-style column (used by the newest hierarchy tables like `pmos` and `context_conversations`), a dedicated `archived_at` timestamp (used in only 3 files), and a `deleted_at` soft-delete timestamp (used in only 13 files, concentrated in one subsystem). No table implements hard deletion with an explicit policy gate, and no legal-hold mechanism exists. PR5 must establish a single, coherent model distinguishing archive, soft delete, and hard delete — since these are materially different operations with different implications for audit, evidence, agent retrieval, and legal exposure — and must do so without retrofitting or renaming any existing column.

## Decision

**Archive, soft delete, and hard delete are three distinct, non-interchangeable lifecycle operations. Archive removes a record from active operation while preserving all relationships and audit history and permitting restoration per policy. Soft delete is a logical hiding mechanism with a possible recovery window and does not by itself satisfy legal retention or deletion requirements. Hard delete is physical removal, gated by policy, blockable by legal hold, and never the default operation for authority-bearing or evidentiary records.** Every aggregate's lifecycle classification (which of these operations applies, and under what authorization) is explicit, not inferred from whichever column happens to be present on its current-state table.

## Persistence Rules

1. Archive is expressed via an explicit status transition (e.g., `status='archived'`, or an `archived_at` timestamp where a table's design calls for one) that removes a record from default active-scope queries while leaving all foreign keys, audit records, and history intact and queryable by an authorized actor.
2. Soft delete (`deleted_at`) is reserved for records where a recovery window is a genuine product requirement; it is never used as a substitute for archive (which implies restorable, still-active-relationship semantics) or as a substitute for the audit/legal retention guarantees hard deletion review requires.
3. Hard delete is physical row removal, permitted only after: scope validation, identity verification, dependency analysis, legal hold check, an explicit deletion plan, and approval (the pipeline in §50 of the persistence architecture) — it is never a default operation triggered by a simple user action without passing this pipeline for records classified as requiring it.
4. Decisions, Audit Records, Evidence, and other append-only/versioned authority records (per ADR-PMF-036) are never hard-deleted by ordinary operation; if a legal or regulatory requirement ever mandates removal, it follows the explicit deletion pipeline (§50) with legal-hold and audit-preservation checks, not a routine delete path.
5. Enterprise and Workspace are normally archived, never directly hard-deleted, before any hard-deletion process (if ever authorized) proceeds — an active Enterprise or Workspace is not eligible for hard deletion.
6. Soft-deleted or archived records must not leak into agent retrieval, search, or default product queries — this is the same "revocation must take effect at retrieval" requirement as ADR-PMF-039/041, applied to archive/soft-delete states generally.
7. Embeddings and search-index entries for a hard-deleted canonical record must be deleted as part of the same deletion process (never left orphaned); this is a required step in the deletion pipeline, not an optional cleanup.
8. Retention periods, deletion windows, and archive-duration values are domain-specific, configurable policy, not hardcoded architectural constants — this ADR defines the categories and gates, not the exact numbers (which remain open per §67).
9. The current schema's mixed convention (`status='archived'` vs. `archived_at` vs. `deleted_at`) is not resolved by this ADR into a single column name; that is an implementation-time consolidation decision for the migration strategy (ADR-PMF-044), evaluated per table rather than mandated uniformly here.

## Alternatives Considered

- **A single universal `deleted_at` soft-delete column applied uniformly to every table, with no distinct archive concept.** Rejected: this conflates "no longer active but fully relied upon by history/relationships" (archive) with "logically hidden pending possible removal" (soft delete), which have different authorization, retention, and query-visibility implications — collapsing them would either over-restrict archived records' continued relational use or under-protect soft-deleted records' eventual removal.
- **Hard delete as the default for any record a user requests removed, with soft delete/archive as an opt-in enhancement.** Rejected: this is backwards relative to legal, audit, and evidentiary requirements (§25, §38) — hard deletion must be the exception requiring a gated process, not the default behavior for records whose removal could conflict with retention or legal-hold obligations.
- **Standardize immediately on one column convention (`status` enum vs. `archived_at` vs. `deleted_at`) across all 423 current-state tables.** Rejected as out of scope for this PR: this document is exclusively conceptual/documentary and creates no migrations; per-table consolidation is deferred to the phased migration strategy, where it can be done incrementally with evidence, not declared unilaterally here.

## Positive Consequences

- Gives every future table design (and every current-state table under later migration) a clear decision tree: is this record ever expected to be restored with intact relationships (archive), temporarily hidden pending permanent removal (soft delete), or subject to an explicit gated removal process (hard delete)?
- Protects the audit, decision, and evidence guarantees established in ADR-PMF-036 and the evidence/decision ADRs from being inadvertently undermined by a convenient but destructive deletion shortcut.
- Creates a natural seam for legal hold (§25) to attach to, since hard deletion is already gated by an explicit pipeline rather than happening ad hoc per table.

## Negative Consequences

- Three distinct lifecycle concepts (versus one universal soft-delete flag) is more conceptual surface for engineers to learn and apply correctly per table.
- Deferring column-naming consolidation to the migration phase means the inconsistency identified in the current-state inventory persists for some additional time rather than being resolved immediately — an explicit, accepted tradeoff given this PR's documentary-only scope.

## Risks

- **Misclassification risk:** a future table could be built with a soft-delete column when its actual semantics call for archive (or vice versa), reintroducing the same ambiguity the current-state inventory found — reviewers must check new table designs against this ADR's decision tree.
- **Hard-delete pipeline bypass risk:** without enforcement tooling, a developer under time pressure could implement a simple `DELETE` statement for a record this ADR classifies as requiring the full pipeline — this is a review-discipline risk this ADR documents but does not mechanically prevent by itself; fitness-function checks (§65) are the intended future backstop.

## Security and Data Implications

- Legal hold (§25) can only meaningfully block a hard delete if hard delete is already a distinct, gated operation — this ADR is the structural prerequisite for §25's legal-hold guarantee.
- Archive and soft-delete states must be excluded from RLS-visible "active" query scopes by default (working with ADR-PMF-042), so an archived/soft-deleted record does not inadvertently remain visible to ordinary queries.

## Application Implications

- Repository implementations expose distinct operations (`archive()`, `softDelete()`, `requestHardDeletion()`) rather than a single generic `delete()` call, so the calling code's intent is explicit and reviewable.
- Command handlers for archive operations (`ArchiveWorkspace`, `ArchiveProject`, per PR4's command catalog) are already modeled as distinct, explicit commands — this ADR extends the same explicitness to soft-delete and hard-delete operations wherever they exist.

## API Implications

- PR6 must expose distinct API operations for archive vs. deletion request, never overload a single "delete" endpoint to mean different things for different record types.

## UX Implications

- PR7/PR8 must present archive, soft delete (where applicable), and hard-delete-request as visibly distinct actions with different confirmation and consequence messaging — a "delete" button must not silently perform an irreversible hard delete for a record this ADR classifies as archive-only.

## Migration Implications

- The current schema's mixed `status='archived'` / `archived_at` / `deleted_at` convention is inventoried, not changed, by this ADR; per-table consolidation (if pursued) happens under the expand-contract strategy (ADR-PMF-044) with evidence and validation at each step.

## Operational Implications

- Backup/restore processes must account for archived and soft-deleted records remaining in the database (they are not physically removed), while hard-deleted records require coordinated removal from backups per the retention/backup policy (§24, §48) — an area explicitly left as an open decision (§67) rather than resolved here.

## Compatibility Implications

- Consistent with PostgreSQL's native capabilities; no new technology required for any of the three lifecycle operations.

## Out of Scope

- Exact retention periods, exact archive-duration values, exact deletion-window values — left open per §67.
- Column-naming consolidation across the 423 current-state tables — deferred to the migration strategy.

## Validation

Validation criteria: (1) `05-canonical-persistence-architecture.md` §23 contains a mutability/lifecycle matrix classifying archive vs. soft-delete vs. hard-delete per aggregate, consistent with this ADR's rules; (2) no document produced under PR5 describes hard deletion as the default operation for Decision, Audit Record, or Evidence; (3) the legal-hold model in §25 explicitly references the hard-delete pipeline this ADR defines.

## References

- `docs/product-architecture/05-canonical-persistence-architecture.md` §23–25, §50
- `docs/adr/ADR-PMF-036-append-only-authority-audit-history.md`
- Current-state inventory: soft-delete/archival column usage across `supabase/migrations/`
