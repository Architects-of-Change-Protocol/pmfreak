# ADR-PMF-034: Workspace-Scoped Operational Persistence

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-002 ratified Workspace as PMFreak's operational, data, and access boundary, and PR1.1's invariants (1–5) require that every Project belongs to exactly one Workspace and that no operational entity crosses a Workspace without an explicit contract. ADR-PMF-001 separately established Enterprise as a distinct root that does not itself grant cross-Workspace access. PR5 must translate this into a persistence-level rule: which records must physically carry a Workspace scope, how Enterprise relates to that scope, and what "no cross-Workspace access" means for storage rather than just domain semantics.

Without an explicit persistence rule, it would be possible to build canonical tables that omit `workspace_id` on the assumption that it can always be derived by joining through a parent (e.g., deriving a Task's Workspace by joining Task → Project → Workspace). PR1.1 and ADR-PMF-002 do not permit that ambiguity to be silently resolved by whichever join happens to be convenient at implementation time.

## Decision

**Every operational persistent record belongs to exactly one Workspace, and that Workspace must be identifiable without depending solely on multi-hop joins for sensitive-scope resolution (RLS, authorization, cross-tenant integrity checks). Enterprise is an explicit parent of Workspace and does not itself grant automatic cross-Workspace persistence access — Enterprise-scoped records and Enterprise Intelligence records are the only records governed differently, and only through the explicit elevation gate (ADR-PMF-029).** Controlled duplication of `workspace_id` onto child records (Task, Milestone, Risk, Issue, Recommendation, Decision, Action, Outcome, Project Memory Record, Agent Run, Evidence, etc.) is accepted and preferred over relying exclusively on joins for tenant-scope resolution.

## Persistence Rules

1. Every Workspace has an `enterprise_id` (nullable only for the deferred case of a Workspace with no explicit Enterprise, if that case is ever authorized; not nullable once Enterprise is generally required).
2. Every Project has a `workspace_id` that is `NOT NULL`.
3. Every PMO, Portfolio, and Program has a `workspace_id`, either directly stored or reachable through exactly one authoritative parent hop (PMO), never through an ambiguous or optional chain.
4. Every Project-scoped operational record (Task, Milestone, Risk, Issue, Stakeholder, Document, Evidence, Recommendation, Decision, Action, Outcome, Project Memory Record, Agent Run) carries both `workspace_id` and `project_id`, even though `workspace_id` is technically derivable by joining through `project_id` — this duplication exists specifically to make Row Level Security policies and composite integrity constraints (§18 of the persistence architecture) independent of join correctness.
5. `enterprise_id` membership does not, by itself, authorize a query or persistence operation against a Workspace's records — Workspace membership is the operative authorization boundary at the persistence layer, per ADR-PMF-002.
6. Enterprise-level records (Enterprise Knowledge Records, Enterprise-wide policy, billing/entitlements at the Enterprise level) are explicitly classified as Enterprise-scoped, not Workspace-scoped, and are the only records permitted to aggregate information sourced from multiple Workspaces — and only after passing the elevation gate (ADR-PMF-029, ADR-PMF-040).
7. No canonical table may hold operational records without a resolvable Workspace scope; a record with no Workspace scope must be explicitly classified as a system-global or Enterprise-scoped record, never left ambiguous.

## Alternatives Considered

- **Derive Workspace scope purely via joins, with no duplicated `workspace_id` on child records.** Rejected: this makes every RLS policy and every composite integrity constraint on a child table dependent on the correctness of a join through a variable-depth parent chain (Task → Project → Workspace, vs. Portfolio → PMO → Workspace), which is exactly the kind of implicit, easy-to-get-wrong resolution PR1.1's "no cross-Workspace persistence access without explicit contract" invariant is meant to prevent.
- **Grant Enterprise membership automatic read access to all child Workspaces' operational data.** Rejected: this directly contradicts PR1.1 invariant 3 ("No operational entity may cross a Workspace without an explicit contract") and ADR-PMF-001/002's separation of Enterprise (identity/billing/cross-Workspace administration) from Workspace (the actual operational/data boundary) — an administrative relationship is not automatically an operational access grant.
- **Treat Workspace scope as an application-layer-only concern, omitted from the schema.** Rejected: this would leave tenant isolation entirely to code discipline with no database-level backstop, contradicting the defense-in-depth RLS principle (ADR-PMF-042) this ADR is a prerequisite for.

## Positive Consequences

- Makes Row Level Security policies simple and uniform: nearly every policy can filter on a directly-present `workspace_id` column rather than a variable-depth join.
- Makes composite integrity constraints (e.g., "a Task's `workspace_id` must match its Project's `workspace_id`") checkable without needing to traverse the full parent chain at write time.
- Keeps Enterprise's administrative role (ADR-PMF-001) and Workspace's operational-boundary role (ADR-PMF-002) persistently distinct, preventing the kind of conflation PR2's terminology work explicitly forbids ("Enterprise ≠ Workspace").

## Negative Consequences

- Introduces controlled denormalization (`workspace_id` duplicated on many tables) that must be kept consistent with the true parent chain — this requires either database triggers, generated columns, or careful application-layer discipline, and is itself a data-quality rule to check (§57 of the persistence architecture).
- Increases the number of columns that must be populated correctly at every insert path, raising the cost of getting a new table's scope wrong.

## Risks

- **Denormalization drift risk:** a `workspace_id` written once and never re-validated against its parent's current `workspace_id` could go stale if a record were ever re-parented (e.g., a Project moved between Workspaces, which PR1.1 does not currently authorize but which a future ADR might); reconciliation checks (§58 of the persistence architecture) must catch this if it is ever allowed.
- **Enterprise-scope misclassification risk:** a future feature could be built as "Enterprise-scoped" for convenience when it is actually multiple Workspaces' data merged without going through the elevation gate — this is precisely the risk ADR-PMF-029 and ADR-PMF-040 exist to prevent, and this ADR's rule 6 is the persistence-layer enforcement point.

## Security and Data Implications

- This ADR is the structural prerequisite for ADR-PMF-042 (defense-in-depth RLS) — RLS policies cannot fail closed on Workspace scope if Workspace scope is not reliably present on the row being evaluated.
- Directly implements PR1.1 invariants 1–5 and ADR-PMF-001/002 at the storage layer.

## Application Implications

- Repository implementations (PR4 §18) must populate `workspace_id` (and `project_id` where applicable) on every write, sourced from the aggregate's own scope, never from caller-supplied, unvalidated input alone.
- Application-layer authorization (PR4's Identity and Access context) and this persistence-layer scoping are complementary, not redundant — per §8.2, RLS does not substitute for application authorization and vice versa.

## API Implications

- PR6's API contracts must never accept a caller-supplied `workspace_id` for a record whose Workspace is otherwise determined by its parent (e.g., a Task's Workspace is always its Project's Workspace) — the API must derive it server-side, not trust the client.

## UX Implications

- None directly; Workspace scoping is invisible to end users beyond the existing Workspace-switching experience already defined in PR3.

## Migration Implications

- Existing tables that already carry `workspace_id` (per the current-state inventory in `05-persistence-migration-strategy.md`) are aligned with this rule; tables found to be missing Workspace scope are flagged as gaps to close during the expand phase (ADR-PMF-044), not retrofitted in this PR.

## Operational Implications

- Backup/restore and reconciliation tooling can rely on `workspace_id` being present on operational records, simplifying tenant-scoped operations (single-Workspace export, single-Workspace deletion).

## Compatibility Implications

- Consistent with the existing RLS hardening work already present in the current schema (e.g., tenant hardening migrations), which this ADR formalizes as a persistent architectural rule rather than an ad hoc pattern.

## Out of Scope

- The exact SQL for RLS policies (ADR-PMF-042 covers the principle; SQL authoring is implementation, PR9+).
- Whether a future ADR ever permits a Project to move between Workspaces — not authorized here.

## Validation

Validation criteria: (1) every record classified as "operational" in `05-canonical-data-model.md` carries a resolvable Workspace scope; (2) no document produced under PR5 grants Enterprise membership automatic cross-Workspace operational access; (3) the tenancy scope matrix in `05-canonical-persistence-architecture.md` §12 has no row marked "no scope" for an operational record type.

## References

- `docs/adr/ADR-PMF-001-enterprise-workspace-separation.md`
- `docs/adr/ADR-PMF-002-workspace-boundary.md`
- `docs/product-architecture/01.1-domain-ratification.md` §8 (invariants 1–5)
- `docs/product-architecture/05-canonical-persistence-architecture.md` §12
- `docs/adr/ADR-PMF-042-defense-in-depth-rls.md`
