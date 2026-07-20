# ADR-PMF-033: Relational Canonical Write Model

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4 established 25 bounded contexts, 21+ aggregate roots, a command/query/event catalog, and a mixed consistency model (ADR-PMF-032) that requires six areas — authorization, Workspace ownership, Project membership, Decision status, Recommendation approval, Action creation — to be strongly consistent, with everything else (projections, search, health, notifications) eventually consistent. PR5 must decide what physically stores the strongly-consistent write side of that model, without prescribing a specific schema, table set, or migration.

The repository already runs on Supabase (managed PostgreSQL) for its current, pre-canonical schema (154 migrations at time of writing). Three broad options exist for the canonical write model: (a) continue as a relational canonical write model on PostgreSQL/Supabase, with explicit constraints and separately maintained derived read models; (b) adopt full event sourcing, treating an append-only event log as the sole source of truth and deriving all current-state views from it; (c) adopt a polyglot/multi-database architecture, splitting bounded contexts across different storage engines chosen per context.

This decision fixes the initial persistence style so PR6 (API contracts) and PR9+ (implementation) do not each have to re-litigate it, while leaving table names, exact column types, and schema organization as open, later decisions.

## Decision

**PMFreak's canonical write model is relational, on PostgreSQL via Supabase, with explicit foreign keys and constraints enforcing domain invariants, Workspace-scoped operational records, append-only authority/audit records where required, a transactional outbox for durable event publication, explicitly persisted workflow state, and derived (rebuildable) read models, search indexes, and vector indexes.** This is not full event sourcing: domain events are recorded where needed for integration and audit, but current aggregate state is read from relational tables, not reconstructed by replaying an event stream. This is not a multi-database or per-bounded-context micro-database architecture at this stage — no such split is introduced without concrete evidence of a scaling, isolation, or compliance requirement that a single relational database cannot satisfy within a modular monolith.

## Persistence Rules

1. Every aggregate root's authoritative current state is stored in relational tables in the canonical write model; no aggregate's current state is authoritative only inside an event log.
2. Domain events are persisted where PR5's event architecture requires them (outbox, audit, workflow correlation) — they are a durability and integration mechanism, not a replacement for relational current-state storage.
3. Constraints that enforce ratified domain invariants (foreign keys, unique constraints, check constraints) are expressed declaratively in the schema wherever PostgreSQL can express them; they are not left solely to application code.
4. Read models, search indexes, and vector indexes are derived and rebuildable from the canonical write model; they are never the only copy of a fact.
5. A single PostgreSQL database (via Supabase) hosts the canonical write model initially; splitting bounded contexts across separate database instances is deferred pending concrete evidence (per ADR-PMF-023's modular-monolith decision, which this ADR is consistent with).

## Alternatives Considered

- **Full event sourcing as sole source of truth.** Rejected for the initial model: PR4's aggregates (Project, Decision, Recommendation, Action, Outcome, Project Memory Record, Enterprise Knowledge Record) are read far more often as "current state" than as "history of changes," and event sourcing would require every read path to either replay events or maintain a permanently-authoritative snapshot anyway — duplicating the relational model's job while adding replay complexity with no offsetting benefit given today's evidence. Event history for records that need it (Decision, Audit) is met instead by append-only/versioned relational records (ADR-PMF-036), not a general event store.
- **Polyglot multi-database architecture split by bounded context.** Rejected at this stage: no bounded context in PR4's catalog has demonstrated a workload profile (write volume, latency, consistency need) that a single well-indexed PostgreSQL database cannot serve. Introducing multiple databases now would add operational and transactional-boundary complexity (cross-database transactions are not atomic) without evidence of need, contradicting ADR-PMF-023's extraction-only-with-evidence principle.
- **Document-store (schemaless) canonical write model.** Rejected: PR4's invariants (Project always has exactly one Workspace; Decision always has an authority actor; Recommendation never silently becomes a Decision) are exactly the kind of structural, relational guarantees a schemaless store cannot enforce declaratively — every one of them would have to be re-implemented and re-verified in application code, which principle "Strong Integrity for Domain Invariants" (§8.3) explicitly rejects as the primary enforcement mechanism.

## Positive Consequences

- Keeps the persistence style aligned with the tooling PMFreak already operates (Supabase/PostgreSQL), avoiding a wholesale platform migration alongside a domain-model migration.
- Lets PR5 rely on PostgreSQL's native constraint system (foreign keys, unique constraints, check constraints) to mechanically enforce a meaningful subset of PR1.1's ratified invariants, rather than trusting application code alone.
- Keeps the strong/eventual consistency split from ADR-PMF-032 straightforward to implement: strongly-consistent aggregates map to transactionally-written relational tables; eventually-consistent projections map to separately maintained, asynchronously refreshed structures.

## Negative Consequences

- A single relational database is a scaling ceiling that will eventually need addressing (via read replicas, partitioning, or selective extraction) as data volume grows — this ADR defers that, it does not solve it permanently.
- Relational modeling of a domain with governed lifecycle states (Recommendation → Decision → Action → Outcome) requires careful column/table design to avoid collapsing distinct lifecycle stages into a single mutable row, which section 8.3 and later sections of the persistence architecture must get right.

## Risks

- **Schema drift risk:** without disciplined migration practice (ADR-PMF-044), the relational schema could drift from the canonical domain model the same way the current 154-migration history already has (see `05-persistence-migration-strategy.md` for the current-state inventory).
- **Constraint-avoidance risk:** teams under delivery pressure may push invariant enforcement into application code "temporarily," eroding the "Strong Integrity for Domain Invariants" principle this ADR depends on.

## Security and Data Implications

- A single relational database with Row Level Security (ADR-PMF-042) is easier to reason about for tenant isolation than a polyglot architecture where each store would need its own isolation mechanism.
- Declarative foreign keys and constraints reduce (but do not eliminate) the risk of orphaned or cross-tenant records reaching a queryable state.

## Application Implications

- Repository implementations (per PR4 §18) are built against a relational persistence port; the "swap test" from ADR-PMF-031 still applies — application code must not assume PostgreSQL-specific behavior leaks past the persistence port.
- Command handlers write to the canonical write model transactionally; query handlers read from projections/read models (ADR-PMF-032 rule 4), never bypassing that split because the underlying store happens to be the same database.

## API Implications

- PR6 may define API contracts independent of storage engine; this ADR does not constrain API shape, only what backs it.

## UX Implications

None directly; this is a backend storage decision invisible to end users.

## Migration Implications

- No migration is executed by this ADR. The 154 existing migrations remain as current state pending the phased strategy in `05-persistence-migration-strategy.md`.
- Because the canonical write model stays relational and stays on PostgreSQL/Supabase, the migration path is schema evolution (expand-contract, ADR-PMF-044), not a storage-engine migration.

## Operational Implications

- Backup, recovery, and observability tooling already built around Supabase/PostgreSQL remains applicable; no new operational surface (e.g., a second database technology) is introduced by this ADR.

## Compatibility Implications

- Existing Supabase-based tooling (RLS, generated types, migration files) remains structurally compatible with this decision; nothing about this ADR requires replacing that tooling.

## Out of Scope

- Exact table names, column types, schema organization (single schema vs. multiple), and specific index definitions — deferred to `05-canonical-data-model.md` (conceptual) and PR9+ (implementation).
- Whether any individual bounded context is later extracted to its own service or database — left open per ADR-PMF-023, to be justified with evidence if it arises.

## Validation

Validation criteria: (1) every aggregate root in PR4 §12 has a designated canonical relational storage unit in `05-canonical-persistence-architecture.md` §13; (2) no document produced under PR5 claims an event log as the sole source of truth for any aggregate's current state; (3) no document produced under PR5 introduces a second database engine or a per-bounded-context database without an explicit evidence-based justification.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §12, §18, §24
- `docs/adr/ADR-PMF-023-modular-monolith-initial-architecture.md`
- `docs/adr/ADR-PMF-032-mixed-consistency-model.md`
- `docs/product-architecture/05-canonical-persistence-architecture.md` §9–10
