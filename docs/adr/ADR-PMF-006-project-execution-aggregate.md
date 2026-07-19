# ADR-PMF-006: Project Is the Central Execution Aggregate

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited every
candidate aggregate in PMFreak's domain and found Project to be, in its own
words, "the best-designed, most consistent entity in the system" (§20).
Unlike Command Center (a decorative label on five unrelated objects, §9/§22),
PMO (three historically-layered representations only recently reconciled,
§12 C-1), Portfolio (zero structural implementation, §18), or Program
(structurally isolated from the rest of the hierarchy, §19), Project already
behaves the way the ratified canonical hierarchy in PR1.1 requires, with only
naming cleanup outstanding.

The evidence PR1 gathered is concrete: `projects.workspace_id` is `NOT NULL`;
`projects.pmo_id` is nullable, and a DB trigger
(`enforce_project_pmo_same_workspace`) keeps a Project's optional PMO
consistent with its mandatory Workspace whenever one is set (§20, §29, §32).
Every subsystem that attaches cleanly to a single domain concept attaches to
Project specifically: `execution_tasks`, `project_milestones`,
`project_evidence`/`project_evidence_content`, `project_memory_snapshots`,
project-scoped `context_conversations`, and `raid_items.project_id` (§20,
§23). Project has **no** current relationship to Portfolio or Program,
because neither exists as a connected concept yet (§18, §19) — this makes
Rules 3–4 below vacuous today; they become live once ADR-PMF-004 and
ADR-PMF-005's connections are implemented in a future PR. Project's one real
outstanding defect is naming, not architecture: the same row is called
"Project" (majority), "Context"/"Operational Context" (`/projects` page), and
"Initiative" (onboarding wizard) (§9, §11, §20, D-19) — a copy-only fix out
of scope here.

The onboarding wizard currently **blocks** "Create Project" until "Create
Command Center" (a PMO) is completed
(`src/components/pmfreak/activation/getting-started-flow.tsx:359-371`,
tooltip: *"Create a Command Center first to give your projects governance,
objectives, and agent context"*). This directly contradicts the rule ratified
below and is a current-state gap this ADR flags but does not fix.

This ADR introduces no new architecture. It formalizes what PR1 already found
to be almost entirely true, resolves PR1's open question at §20 ("can Project
belong to multiple Programs/Portfolios?"), and puts the onboarding-gating
contradiction on record for a future PR to close.

## Decision

**Project is the central execution aggregate of PMFreak** — the primary unit
of execution and day-to-day operational center of the product. Every Project
belongs to exactly one Workspace, may optionally belong to a PMO, a primary
Portfolio, and a primary Program, and the hierarchy above it must never block
fast Project creation. Command Center, PMO, Portfolio, Program, and
Enterprise all exist to organize, govern, and give context to Projects — none
is an end in itself, and none may become a mandatory precondition for
creating one.

## Domain Rules

1. Every Project belongs to exactly one Workspace — mandatory, already
   enforced (`projects.workspace_id NOT NULL`).
2. A Project may optionally belong to a PMO. Absence of a PMO is a permanent,
   fully supported state (`projects.pmo_id` nullable).
3. A Project may optionally belong to at most one primary Portfolio.
   Multiple simultaneous primary Portfolios are not permitted in this
   initial model, per the ratified "no many-to-many" constraint.
4. A Project may optionally belong to at most one primary Program, for the
   same reason as Rule 3.
5. A Project may exist directly under a Workspace, with no PMO, Portfolio,
   or Program.
6. A Project may exist directly under a PMO, with no Portfolio or Program.
7. A Project may exist inside a Portfolio without a Program.
8. A Project may exist inside a Program.
9. Project owns or coordinates: context, operational memory, schedule,
   tasks, risks, issues, costs, decisions, stakeholders, communications,
   documents, evidence, recommendations, forecasts, and agents. These are
   Project-scoped capabilities first; any rollup to PMO, Portfolio, Program,
   or Enterprise is a derived aggregation over Projects, never a capability
   originating above Project and merely reflected onto it.
10. Project is where the product's first real value is produced. Every other
    level of the hierarchy exists to organize, govern, or aggregate
    Projects — none produces execution value independent of the Projects
    beneath it.
11. The enterprise hierarchy must never prevent quickly creating a Project.
    Creation must be possible with only a Workspace present (which may
    itself be auto-provisioned, per ADR-PMF-002 Rule 11). No onboarding
    flow, wizard, feature gate, or permission check may require PMO,
    Portfolio, or Program creation as a precondition for Project creation.
12. Command Center is never an entity a Project belongs to. It is a
    conceptual projection that operates *over* a Project (or PMO, Portfolio,
    Program); it is not a node in the Project's ownership chain and must not
    gate Project creation, consistent with Rule 11.
13. A Project's optional PMO, if set, must belong to the same Workspace as
    the Project — already enforced by `enforce_project_pmo_same_workspace`
    and ratified as permanent policy, extending by the same logic to any
    future primary Portfolio/Program assignment.

## Alternatives Considered

- **Make PMO, not Project, the unit of execution.** Rejected — this is the
  model the onboarding wizard's gating implicitly assumes, and PR1's
  evidence contradicts it: every operationally meaningful subsystem (tasks,
  milestones, evidence, memory, RAID, chat) attaches to Project, not PMO.
- **Require a primary Portfolio or Program once those concepts exist.**
  Rejected — would break the "Project can exist without Portfolio/Program/
  PMO" invariant already true for PMO, and would reintroduce the
  onboarding-gating problem one level higher.
- **Allow a Project multiple primary Portfolios/Programs (many-to-many).**
  Rejected for the initial model, per the ratified "no many-to-many"
  constraint. Later evolution is possible only via a superseding ADR.
- **Treat Command Center as the true execution surface, Project as data it
  operates on.** Rejected — inverts the ratified 1:1 conceptual/projection
  relationship and resurrects the "Command Center is not an entity"
  confusion (PR1 §22), which Rule 12 forecloses.

## Positive Consequences

- Locks in the most mature part of the domain model as a stable target for
  the rest of the hierarchy.
- Gives future Portfolio/Program FK work a clean invariant: both attach to
  Project as optional relationships, never mandatory, avoiding a large class
  of migration/backfill risk.
- Resolves PR1's open §20 question definitively: at most one primary
  Portfolio and one primary Program, in the initial model.
- Creates an explicit policy basis for fixing the onboarding wizard's
  PMO-gating behavior in a future PR.

## Negative Consequences

- "At most one primary Portfolio/Program" forecloses, for now, designs where
  a Project legitimately spans two Portfolios (e.g., shared infrastructure
  funded by two business units); that would require a superseding ADR.
- Rule 11 commits the roadmap to removing the onboarding wizard's
  Command-Center-before-Project gate — real, if modest, future work this ADR
  does not perform but does obligate.
- Because Project already does almost everything right, this ADR's
  contribution is narrower than the Portfolio/Program/Enterprise ADRs: it
  mainly closes the gap between intent and one piece of current UX behavior,
  and forecloses the many-to-many alternative.

## Risks

- **Ratification without enforcement leaves the contradiction live.** Rule
  11 is violated today by `getting-started-flow.tsx:359-371`; until a future
  PR removes that gate, actual behavior contradicts ratified policy.
- **Future Portfolio/Program ADRs could under-specify "primary."** If
  ADR-PMF-004/005 don't carry forward the "at most one primary, optional
  never mandatory" framing, a future migration could accidentally introduce
  a mandatory or many-to-many relationship. This ADR is binding on the
  Project side of those relationships.
- **Mechanism for "primary" is unspecified.** A nullable FK column
  (analogous to `pmo_id`) versus a join table with an `is_primary` flag is
  left to the future implementation PR, which must not silently reintroduce
  many-to-many semantics via a join-table design.

## Security and Data Implications

No RLS or access-control behavior changes. Project remains scoped by
`workspace_id NOT NULL`, inheriting the Workspace boundary ratified in
ADR-PMF-002; any future primary-Portfolio or primary-Program column on
`projects` must be workspace-consistent with the Project, by the same
pattern `enforce_project_pmo_same_workspace` already establishes (Rule 13).
No new data crosses a Workspace boundary as a result of this decision. Rule 9
does not change what data any owned subsystem may expose — it confirms
Project is their correct scoping anchor, which is already how
`execution_tasks`, `project_milestones`, `project_evidence`,
`project_memory_snapshots`, and `raid_items` are built today.

## Migration Implications

No migration is executed by this ADR. A future implementation PR would need
to, at minimum: (a) add nullable, workspace-consistency-enforced columns or
join structures for a Project's primary Portfolio and primary Program,
mirroring the `pmo_id` + `enforce_project_pmo_same_workspace` pattern, once
ADR-PMF-004 and ADR-PMF-005 are ratified and their tables exist; (b) leave
`projects.workspace_id` and `projects.pmo_id` unchanged, since both already
conform to this ADR; (c) add equivalent trigger/constraint-level enforcement
that a Project's primary Portfolio or Program, if set, belongs to the same
Workspace, extending Rule 13's pattern; (d) remove or rework the onboarding
wizard's PMO-before-Project gate (`getting-started-flow.tsx:359-371`) so
Project creation works directly from a bare Workspace, per Rule 11. None of
this is scoped to or begun by this documentation-only PR.

## UX Implications

Project creation must be reachable with no PMO, Portfolio, or Program in
existence (Rule 11) — a UX requirement, since the current violation is
entirely in the UI layer (`projects.pmo_id` is already nullable at the data
layer). Once Portfolio and Program exist, any UI for assigning a primary
Portfolio/Program must present it as optional and add-later, never a
blocking step in Project creation. This ADR does not perform the
onboarding-wizard fix or resolve the Project/Context/Initiative naming
inconsistency (PR1 §9, §11, §20, D-19; a separate future copy-only PR); it
only fixes the policy those changes must conform to.

## Compatibility Implications

Backward compatible with the current schema and running system:
`projects.workspace_id`, `projects.pmo_id`, and
`enforce_project_pmo_same_workspace` already conform to every rule here —
nothing about existing Project rows, PMO assignments, or RLS policy must
change. The one element this ADR is *not* compatible with is the onboarding
wizard's current PMO-gating logic, named here as a violation for a future PR
to correct, not a constraint this ADR accommodates.

## Out of Scope

- Any code, schema, migration, RLS policy, or route change (documentation
  only).
- Building the Portfolio or Program tables/relationships themselves (covered
  by ADR-PMF-004 and ADR-PMF-005; this ADR only constrains how Project must
  relate to them once built).
- Removing the onboarding wizard's Command-Center-before-Project gate
  (flagged as a Rule 11 contradiction; fixing it is a future PR's job).
- Resolving the Project/Context/Initiative naming inconsistency (already
  resolved in principle by PR1's D-19 in favor of "Project"; execution is a
  separate copy-only PR).
- Designing the mechanical implementation (column vs. join table) of the
  primary-Portfolio/Program relationships.
- Any change to `execution_tasks`, `project_milestones`,
  `project_evidence`, `project_memory_snapshots`, `context_conversations`,
  or `raid_items` beyond confirming Project as their scoping anchor.

## Validation

Validated primarily by evidence PR1 already gathered, plus one named,
currently-open gap:

- `projects.workspace_id NOT NULL` and `projects.pmo_id` nullable, confirmed
  in schema (PR1 §20, §29).
- `enforce_project_pmo_same_workspace` trigger, confirmed live and
  purpose-built to close a cross-workspace assignment bug found during
  validation (PR1 §29, §32).
- `execution_tasks`, `project_milestones`, `project_evidence`/
  `project_evidence_content`, `project_memory_snapshots`, project-scoped
  `context_conversations`, and `raid_items.project_id` all confirmed
  Project-scoped (PR1 §20, §23).
- Known, named violation of Rule 11: `getting-started-flow.tsx:359-371`
  blocks Project creation behind PMO creation. Not resolved by this ADR; the
  acceptance criterion a future onboarding-fix PR must satisfy is Project
  creation succeeding from a bare Workspace, no PMO present.
- Future validation, once Portfolio/Program exist: confirm any new
  primary-Portfolio/Program relationship is workspace-consistent (mirroring
  the existing PMO trigger test) and that no Project ends up with more than
  one primary Portfolio or Program simultaneously.

## References

- `docs/product-architecture/01-canonical-domain-model.md` (PR1) — §9, §11,
  §18, §19, §20, §23, §29, §32.
- `docs/product-architecture/01.1-domain-ratification.md` (PR1.1, authored
  in parallel with this ADR).
- `docs/adr/ADR-PMF-002-workspace-boundary.md` (Workspace boundary this
  ADR's Rule 1 and Rule 13 inherit from).
- `src/components/pmfreak/activation/getting-started-flow.tsx:359-371`
  (current-state contradiction of Rule 11).
