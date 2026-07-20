# ADR-PMF-036: Append-Only Authority and Audit History

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-030 established that Recommendation, Decision, Action, and Outcome are distinct, human-authorized steps that are never collapsed or auto-derived from one another, and that a Decision is never destructively edited. PR1.1 invariant 27 ("inference is not evidence") and PR4's Audit and Compliance context (append-only, event-subscriber to all contexts, "no update/delete path ever") further require that the historical record of what was decided, by whom, and why is preserved exactly as it happened. PR5 must decide, at the persistence layer, which record types this applies to and what "preserved" means mechanically — since a naive relational design would let any row simply be `UPDATE`d in place, silently destroying the history ADR-PMF-030 depends on.

## Decision

**Decisions, approvals, revocations, audit records, and other authority-bearing records preserve their history through append-only records or versioned records with superseding rows — never through destructive in-place edits to the authoritative fields that record what happened, when, and by whom.** Audit records are strictly append-only (no update or delete path in ordinary operation). Decision, Recommendation review outcomes, Project Memory Record approvals, and Enterprise Knowledge Record ratifications are versioned: corrections and status changes create new versions or superseding records rather than overwriting the original.

## Persistence Rules

1. Audit records (`audit_records`) have no application-level update or delete path; corrections to an audit record's interpretation are made by writing a new audit record that references the one being corrected, never by editing the original.
2. A Decision's authority fields (actor, authority type, rationale, timestamp, effective date) are immutable once recorded; a change in position is recorded as a new Decision that supersedes the prior one, with an explicit supersession reference — never an edit to the original Decision row's authority fields.
3. Recommendation approval/rejection, once recorded, is not silently reversible; a reversal is a new, separately authorized act (per ADR-PMF-030) creating a new record or status transition with its own actor and timestamp, not an edit erasing the prior approval's record.
4. Domain event records and outbox events are immutable once written; a mistaken event is not edited, it is superseded by a corrective event with its own identity and causation reference.
5. Version history for records under this rule is queryable — the prior state of a Decision or ratified Enterprise Knowledge Record must remain reconstructable, not merely implied by an updated_at timestamp.
6. This rule applies to the specific record types enumerated in `05-canonical-persistence-architecture.md` §22 (the mutability classification matrix); it is not a blanket rule that no table may ever be updated — operational, non-authority records (e.g., a Task's status) remain ordinarily mutable per that same matrix.

## Alternatives Considered

- **Ordinary mutable rows for Decision/audit, relying on application code discipline to avoid destructive edits.** Rejected: this places the entire guarantee ADR-PMF-030 depends on behind application-code correctness with no persistence-layer backstop — any bug, migration script, or administrative `UPDATE` statement could silently destroy authority history with no schema-level resistance.
- **Full event sourcing for all authority records, deriving current state purely from an event log.** Rejected for the same reasons as ADR-PMF-033: adds replay complexity without a demonstrated need, when append-only/versioned relational records achieve the same non-destructive-history guarantee more directly.
- **Soft-delete flags alone (a `deleted_at` column) as the append-only mechanism.** Rejected as insufficient by itself: a soft-delete flag prevents removal but does not prevent an in-place `UPDATE` to the row's substantive fields — append-only/versioned design must also prevent field-level destructive edits, not just row deletion.

## Positive Consequences

- Gives ADR-PMF-030's "no destructive edit to Decision rationale" and "Recommendation approved never implies Action automatically" guarantees a persistence-layer mechanism, not just a code-review convention.
- Makes audit and compliance investigations reliable: the historical record cannot have been quietly altered after the fact by a bug or an unreviewed script.
- Aligns with PR4's Audit and Compliance context definition ("append-only... no update/delete path ever").

## Negative Consequences

- Append-only and versioned tables grow monotonically and never shrink through ordinary operation, requiring a deliberate retention/archival strategy (§24, §43 of the persistence architecture) rather than relying on routine deletion to bound table size.
- Querying "current state" from a versioned table requires either a materialized "current version" pointer or a query that selects the latest version — a small but real query-complexity cost versus a naively mutable row.

## Risks

- **Retention pressure risk:** without the separately-documented retention architecture (§24), an ever-growing append-only audit table could become a performance or cost concern, tempting a future engineer to add deletion where this ADR forbids it — retention/archival must be solved without violating append-only semantics (e.g., archival to cold storage that remains queryable, not deletion).
- **Version-pointer bug risk:** an incorrectly maintained "current version" pointer on a versioned table could serve stale data as if it were current — this is a testable data-quality invariant (§57), not a risk this ADR eliminates by itself.

## Security and Data Implications

- Append-only audit is a precondition for meaningful tamper-evidence and for satisfying future compliance/legal-hold requirements (§25) — a mutable audit log cannot support an audit investigation's evidentiary value.
- Decision/Recommendation history being non-destructively preserved is itself a security control against a compromised or malicious actor attempting to erase evidence of an unauthorized action by editing history after the fact.

## Application Implications

- Repository implementations for Decision, Recommendation, Project Memory Record, and Enterprise Knowledge Record must implement "supersede" as their update operation, not `UPDATE ... SET`, for the authority-bearing fields covered by this ADR.
- Command handlers for `RecordDecision`, `RevokeDecision`, `ApproveRecommendation`, `RejectRecommendation` must write new records/versions, never mutate prior ones (directly implementing ADR-PMF-030's separate-command rule at the persistence layer).

## API Implications

- PR6's API contracts for these record types must expose history/version endpoints (e.g., "get Decision history"), not just a single mutable current-state endpoint, since the history is now a first-class, queryable artifact.

## UX Implications

- PR7/PR8 can surface decision history, audit trails, and knowledge-record version history as a genuine product capability (e.g., "why was this decision changed") because the underlying persistence guarantees the history exists and is accurate.

## Migration Implications

- Any current-state table found to store Decision or audit-equivalent data as an ordinarily mutable row (see `05-persistence-migration-strategy.md`'s table classification) is flagged as a gap to close during the expand-contract migration, not retrofitted destructively in this PR.

## Operational Implications

- Backup and point-in-time recovery strategy must account for append-only tables' monotonic growth; archival tooling (moving old audit/version rows to cheaper storage while remaining queryable) becomes an operational necessity as volume grows.

## Compatibility Implications

- PostgreSQL natively supports this pattern (insert-only tables, version-chain tables with a "superseded_by" self-reference); no new database technology is required.

## Out of Scope

- Exact retention periods for audit/version history — left open per §24/§67 as domain-specific, configurable policy, not fixed by this ADR.
- Exact table design (single versioned table with a `version` column vs. a separate `_history` table per aggregate) — left to implementation, provided the non-destructive-history guarantee holds either way.

## Validation

Validation criteria: (1) the mutability matrix in `05-canonical-persistence-architecture.md` §22 marks Decision, Audit Record, Domain Event, Outbox Event, and Enterprise Knowledge Record as append-only or versioned, never plain-mutable; (2) no command in the command catalog (PR4 §13) is documented as performing a destructive in-place edit to a Decision's authority fields; (3) every versioned record type has a documented supersession/version-pointer mechanism in `05-canonical-data-model.md`.

## References

- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
- `docs/product-architecture/01.1-domain-ratification.md` §8 (invariant 27)
- `docs/product-architecture/04-canonical-application-architecture.md` (Audit and Compliance context, §10 item 22)
- `docs/product-architecture/05-canonical-persistence-architecture.md` §22, §38
