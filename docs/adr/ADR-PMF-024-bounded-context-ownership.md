# ADR-PMF-024: Bounded Context Ownership

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1's aggregate map (`01-canonical-domain-model.md` §29) and PR1.1's cardinality/invariant contracts already establish which entity owns which data at the domain level. What remains unresolved is an *application-layer* rule: when two contexts both have a legitimate reason to touch the same data — e.g., Project Management needs to know a Project's Portfolio assignment, and Portfolio Management owns that assignment — which one is allowed to write it. Without this rule fixed explicitly, the same failure mode that produced three PMO representations at the domain layer (PR1 §12 C-1) recurs at the application layer as soon as two use cases need to mutate related state: each context's application service reaches directly into the other's tables, because no rule says it may not.

## Decision

**Every mutable domain concept has exactly one owning bounded context with exclusive mutation authority. All other contexts consume that concept through a Command directed at the owning context, a Query against a read model, or a consumed Domain/Integration Event — never through direct persistence access.** This is recorded exhaustively in `04-canonical-application-architecture.md` §12 (Aggregate Ownership) and `04-bounded-context-catalog.md` (per-context Ownership field).

## Domain Rules

1. Every aggregate listed in `04-canonical-application-architecture.md` §12 has exactly one owning context.
2. A cross-context mutation (e.g., Portfolio Management linking a Project) is expressed as a Command against the owning context of the *relationship* being changed, which may write a link on both sides within its own transaction boundary — it never becomes two independent writes issued by two different contexts against the same row.
3. Read consumers may combine data from multiple contexts in a projection (§9.5, §42) without becoming an owner of any of it.
4. No repository (§18) may be imported or called by a context other than its owner.
5. An Agent never owns an aggregate (`04-canonical-application-architecture.md` §12 rule 4) — this rule applies without exception, including to Agent Orchestration's own output, which is a Proposal, not an owned aggregate mutation.

## Alternatives Considered

- **Shared ownership for closely related aggregates** (e.g., letting both Project Management and Portfolio Management write the Project↔Portfolio link). Rejected: shared write ownership is indistinguishable, over time, from no ownership — it reproduces PR1's three-PMO-representations problem by a different mechanism.
- **A generic "relationship service" owning all cross-entity links.** Rejected: this would create an unbounded catch-all context with no coherent ubiquitous language, violating the "one domain concept, one owner" principle in the opposite direction (an owner of everything is effectively an owner of nothing coherent).
- **Database-enforced ownership only** (e.g., foreign keys and RLS as the sole mechanism, no application-layer rule). Rejected: PR1 shows the current codebase already has strong DB-level enforcement (RLS on 408/409 tables) and *still* produced ownership ambiguity, because ownership is an application/domain-layer concept a database constraint alone cannot express (a FK does not say who is allowed to write, only what the reference must satisfy).

## Positive Consequences

- Makes "who can I ask to change this" answerable in one lookup (`04-canonical-application-architecture.md` §12) for any future engineer or PR.
- Directly prevents recurrence of the PMO/Portfolio-naming-collision failure mode at the application layer.
- Gives PR5 an unambiguous mapping from aggregate to schema/migration ownership.

## Negative Consequences

- Cross-context use cases (e.g., "assign a Project to both a Program and update its Portfolio in one user action") require explicit orchestration (a workflow or a sequence of Commands) rather than a single ad hoc multi-table write — more design work up front for compound operations.
- Strict ownership can feel like friction during early implementation when a "quick" cross-context write would be faster to code than the correct Command-based path.

## Risks

- **Enforcement risk:** like ADR-PMF-023, this rule is not physically enforced until fitness functions (§53 of the parent document) exist; until then it depends on code review discipline.
- **Granularity risk:** some aggregates (e.g., the Stakeholder record, which sits close enough to its parent Project that an earlier catalog draft mistakenly exposed its command through Project Management instead of its actual owner) sit close enough to a parent aggregate that the ownership line requires care to get right the first time; `04-bounded-context-catalog.md` §11 now correctly assigns `AddProjectStakeholder` to Stakeholder and Communication Management, its owning context, with no cross-context exposure exception. PR5 must resolve any similar ambiguity found during schema design against this ADR's rules, not by inventing a new exception.

## Security and Data Implications

- Because only the owning context's repository may write an aggregate, authorization for a mutation is always evaluated in exactly one place — this closes off a class of bugs where two code paths enforce inconsistent authorization for the same effective write.

## Application Implications

- Application services (§17 of the parent document) expose only their own context's Commands/Queries; this ADR is the rule that makes that restriction meaningful rather than arbitrary.

## Persistence Implications

- PR5's schema design must assign every table (or table group) to exactly one owning context's repository, mirroring §12 and §18 of the parent document.

## API Implications

- PR6's endpoint design inherits this rule directly: an endpoint that would require writing to two contexts' aggregates in one call must instead be modeled as an orchestrated workflow or a sequence of two Commands, never a single handler with dual persistence access.

## UX Implications

None directly — this is an internal architecture rule invisible to end users, though it shapes what compound actions (§25 of the parent document, long-running workflows) look like when a UI action spans contexts.

## Migration Implications

None executed by this ADR. A future PR auditing the current codebase's direct cross-feature Supabase access against this rule is listed as a gap in `04-canonical-application-architecture.md` §52.

## Compatibility Implications

The current codebase's direct, unmediated persistence access from feature code is not compliant with this ADR; it is recorded as a current-state gap (§52 of the parent document), not retroactively grandfathered as an acceptable pattern going forward.

## Out of Scope

Defining the specific workflow/orchestration mechanism for every cross-context use case (deferred to `04-application-workflows.md` and future PRs); choosing an ORM or repository implementation technology.

## Validation

Validation criteria: (1) every row in `04-canonical-application-architecture.md` §12 names exactly one owning context; (2) every repository in §18 lists a "forbidden cross-context access" rule; (3) no bounded context in `04-bounded-context-catalog.md` lists another context's aggregate under its own "Ownership" field.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §12, §17, §18, §48
- `docs/product-architecture/04-bounded-context-catalog.md`
- `docs/product-architecture/01-canonical-domain-model.md` §12 (naming-collision evidence)
