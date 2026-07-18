# ADR-PMF-011: Sprint Is a Methodology-Specific Capability, Not a Universal Entity

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited every
work-breakdown and cadence concept in PMFreak's domain — Sprint, Epic, Card,
and Milestone — and found, in §21 ("Sprint, Iteration, Epic, and Milestone"),
that the current implementation already draws almost exactly the boundary
this ADR ratifies, without anyone having documented it as intentional:

- `program_sprints` and `program_epics` belong only to the isolated Program
  tree (`programs` → `program_epics` → `program_sprints` → `program_cards`),
  never to `projects` directly. PR1 §21 states this plainly: *"this is
  actually the correct boundary (PMFreak does not force Sprint on
  predictive-methodology Projects), it's just invisible because nobody has
  documented it as intentional."*
- `program_cards` (`type` ∈ EPIC/SPRINT/TASK/PROMPT/MILESTONE/DELIVERABLE/
  CUSTOM) is a PMFreak-specific generic work-item abstraction inside the
  Program tree. Its `type='MILESTONE'` card is disconnected from
  `project_milestones` — PR1 §21 flags this explicitly as "two 'Milestone'
  concepts that never meet," a real gap this ADR names but does not fix.
- `project_milestones` is Project-scoped (`project_id`/`workspace_id` NOT
  NULL), carries `forecast_date`/`baseline_date`, and per PR1 §21 "is the
  one that should be considered canonical" — the only one of these four
  concepts already unified and available regardless of methodology.
- A `methodology` field exists on `projects` (added 2026-08-28, alongside
  `pmo_id`), but PR1's session-wide search found it "not... wired to any UI
  gating of Sprint/Epic visibility" and flagged it explicitly as
  "unverified, not confirmed either way" (§21). This ADR treats that as an
  open gap against Rule 7 below, not as confirmed, completed work.
- No generic "Iteration" abstraction or type exists anywhere in the
  codebase today. Sprint is the only implemented concept at that layer of
  the domain, and it is already scoped to Program only.

PR1's own recommendation direction (§21, stated but not executed) already
points the same way this ADR formalizes: *"`project_milestones` should
remain the one PMI-aligned Milestone concept surfaced to all Projects
regardless of methodology; the Program-tree's Sprint/Epic/Card vocabulary
should stay scoped to Program specifically... and never be presented as
mandatory for a predictive/waterfall Project."* This ADR does not invent new
architecture. It ratifies, as founder-decided product policy (D-11), what
PR1 found to already be substantially true and correct, closes the
ambiguity PR1 left open about whether that boundary was intentional, and
puts on record the two concrete gaps (unverified `methodology` gating,
disconnected Card/Milestone "MILESTONE" concepts) that a future
implementation PR must resolve to bring the system fully into line with
this policy.

## Decision

**Sprint is not a universal entity for all Projects.** Sprint is an
optional, agile/hybrid-specific methodological capability — it applies only
to Projects whose methodology is agile or hybrid, and predictive
(waterfall/stage-gate) Projects must never be forced to adopt it.
**Iteration** is ratified as the methodology-neutral abstraction name for
this layer of the domain, to be used if and when a methodology-neutral
generalization of Sprint is actually built; "Iteration" is a vocabulary
decision for future work, not a new entity created by this ADR. **Milestone**
(`project_milestones`) remains the one cross-methodology, PMI-aligned
concept at this layer — it applies to every Project regardless of
methodology and is not a subtype of Sprint/Iteration. **Methodology must be
configurable per Project**, and the existence of that configuration is what
determines whether Sprint/Iteration-flavored capabilities are shown to a
given Project at all.

## Domain Rules

1. Sprint applies to agile or hybrid Projects. It is not applicable, and
   must not be presented as applicable, to predictive-methodology Projects.
2. The general, methodology-neutral abstraction at this layer, if and when
   one is built, is named **Iteration**. "Sprint" remains the correct,
   Scrum-flavored name to show a user working in an agile/Scrum context;
   "Iteration" is the umbrella term used only where methodology-neutral
   language is required (e.g., cross-Project reporting spanning mixed
   methodologies).
3. Sprint may be modeled, in a future implementation PR, as any of: a
   subtype of Iteration; a modality/configuration of Iteration; a
   Scrum-specific label applied to a generic time-boxed structure; or a
   methodological configuration value. This ADR does not select among these
   mechanically equivalent options — that choice belongs to the future
   implementation PR, constrained only by Rules 1, 4, and 7.
4. Predictive-methodology Projects must not be forced to use Sprint. No
   feature gate, onboarding flow, or UI surface may require Sprint/Iteration
   configuration as a precondition for using a predictive-methodology
   Project, consistent with the Project-centrality principle already
   ratified in ADR-PMF-006 Rule 11 (the hierarchy, and by extension any
   methodology-specific capability within it, must never block core Project
   use).
5. Milestone is a cross-cutting capability: it applies to every Project
   regardless of methodology. `project_milestones` is ratified as the
   canonical, single Milestone concept for this purpose. It is not
   optional, not methodology-gated, and not a subtype of Sprint or
   Iteration.
6. Epic must not be mandatory for all Projects. Like Sprint, Epic
   (`program_epics`) is a methodology-specific capability, scoped to
   agile/hybrid Projects, and must never be a required structure for a
   predictive-methodology Project.
7. Methodology must be configurable per Project. The `methodology` field
   already present on `projects` is ratified as the correct location for
   this configuration; whether it is actually read by, and gates, any
   Sprint/Epic-visibility UI is an open implementation gap (see Migration
   Implications), not something this ADR asserts is complete.
8. The Program tree's Sprint/Epic/Card vocabulary (`program_sprints`,
   `program_epics`, `program_cards`) remains scoped to Program, which is
   itself an optional, document-driven capability (per ADR-PMF-005,
   Program's own ratified domain rules) — never promoted to a mandatory
   Project-level structure by virtue of this ADR.
9. `program_cards` with `type='MILESTONE'` and `project_milestones` are, as
   of this ADR, two distinct, unreconciled representations of "Milestone."
   This ADR ratifies that only `project_milestones` is canonical (Rule 5);
   it does not merge, migrate, or delete the Program-tree `MILESTONE` card
   type, which remains a future implementation task (see Migration
   Implications).

## Alternatives Considered

- **Promote Sprint to a universal, methodology-independent entity required
  of every Project.** Rejected. This directly contradicts the founder's
  ratification that "Sprint is not a universal entity for all Projects" and
  would force agile vocabulary onto predictive/waterfall Projects, which
  PR1 §21 confirms the current implementation correctly avoids.
- **Build a generic "Iteration" table/entity now, in this PR, and migrate
  Sprint onto it.** Rejected. This is a documentation-only ADR; no schema,
  code, or migration work is in scope. "Iteration" is ratified as a
  vocabulary decision for a future, if-needed abstraction — not a
  deliverable of this PR.
- **Treat Epic and Sprint as required substructure of Milestone (i.e., every
  Milestone must decompose into Epics/Sprints).** Rejected. Milestone is
  ratified as cross-cutting and methodology-neutral (Rule 5); requiring
  agile substructure underneath it would reintroduce exactly the
  methodology-forcing behavior Rules 1, 4, and 6 forbid.
- **Reconcile `program_cards.type='MILESTONE'` with `project_milestones` as
  part of this ADR.** Rejected as out of scope for a documentation-only
  ratification PR. The gap is real and is explicitly named (Rule 9,
  Migration Implications) as a future implementation task, not resolved
  here.
- **Leave the methodology boundary undocumented, on the theory that current
  behavior is already correct and no ADR is needed.** Rejected by the
  founder's ratification itself: PR1 found the boundary correct but
  invisible, and an undocumented-but-correct boundary is fragile — the next
  engineer to touch Sprint/Epic code has no ratified rule to check against.
  This ADR exists specifically to close that documentation gap.

## Positive Consequences

- Formalizes, as ratified policy, a boundary PR1 found to already be
  correctly implemented — no architecture needs to change to comply with
  this ADR on the Sprint/Epic/Milestone split itself.
- Gives engineering a citable rule to defend the existing Program-tree
  scoping of Sprint/Epic against future feature requests that might
  otherwise "helpfully" surface Sprint fields on predictive-methodology
  Projects.
- Establishes "Iteration" as the reserved, correct vocabulary for any future
  methodology-neutral generalization, preventing an ad hoc name (e.g.,
  "Cycle," "Cadence Block") from being chosen independently by whichever
  team builds it first.
- Creates an explicit, ratified acceptance criterion — "verify `methodology`
  actually gates Sprint/Epic visibility" — for a future implementation PR,
  converting PR1's "unverified" finding into a concrete, trackable task
  rather than a loose end.
- Names the Card/Milestone reconciliation gap (Rule 9) as ratified policy
  debt, making it easier to prioritize in a future PR rather than
  rediscovering it from scratch.

## Negative Consequences

- This ADR does not resolve the actual `program_cards.type='MILESTONE'` vs.
  `project_milestones` duplication; the two "Milestone" concepts remain
  disconnected until a future implementation PR does the reconciliation
  work. Ratifying the target state does not by itself unify the data.
- Because the `methodology` field's UI-gating behavior is unverified, it is
  possible that, today, some UI path already surfaces Sprint/Epic
  vocabulary to a predictive-methodology Project without any gate at all.
  This ADR does not confirm that gap does not exist; it only says the field
  is the correct place to close it.
- Reserving "Iteration" as vocabulary without building it risks the name
  drifting or being informally repurposed before the abstraction it is
  meant for actually exists, if this ADR is not consulted by whoever
  eventually builds it.

## Risks

- **Ratification without enforcement leaves the `methodology`-gating gap
  live.** Rule 7 states methodology must be configurable per Project and
  that the `methodology` field is the correct location, but PR1 could not
  confirm this session that any Sprint/Epic-visibility UI actually reads
  it. Until a future PR verifies and, if necessary, builds that wiring, the
  product's actual behavior may or may not already comply with Rules 1 and
  4 — this ADR names the uncertainty but does not resolve it.
- **The unreconciled Card/Milestone duplication (Rule 9) could be
  independently "fixed" in two incompatible directions** (e.g., one future
  PR migrates `program_cards.type='MILESTONE'` data into
  `project_milestones`, while another builds a separate sync layer) if this
  ADR's ratification of `project_milestones` as sole-canonical is not
  treated as binding by whichever team picks up the work.
- **A future team could build "Iteration" as a Sprint superset that quietly
  reintroduces mandatory agile concepts** (e.g., defaulting every new
  Project to an Iteration even under a predictive methodology) if Rules 1
  and 4 are not carried forward into that future design's own ADR or spec.

## Security and Data Implications

No RLS, access-control, or tenancy behavior changes as a result of this
ADR. `program_sprints`, `program_epics`, and `program_cards` remain scoped
exactly as they are today (reachable only through the `programs` tree,
`workspace_id`-anchored); `project_milestones` remains scoped exactly as it
is today (`project_id`/`workspace_id` NOT NULL). No new column, table, or
policy is created or modified by this ADR. Any future implementation of
`methodology`-based UI gating (Migration Implications) must not itself
become a security boundary — it is a UX/feature-visibility decision, not a
row-level-security decision, and must not be implemented by, or confused
with, an RLS policy change.

## Migration Implications

No migration is executed by this ADR. A future implementation PR would, at
minimum, need to: (a) verify whether any current UI path already reads
`projects.methodology` to gate Sprint/Epic visibility, and if none does,
build that gating so agile/hybrid Projects can surface Sprint/Epic
capability and predictive Projects do not, per Rules 1, 4, 6, and 7; (b)
reconcile `program_cards.type='MILESTONE'` with `project_milestones` —
either by migrating Program-tree MILESTONE cards into `project_milestones`
records, by establishing an explicit reference between the two, or by some
other ratified mechanism — since this ADR fixes only which one is canonical
(Rule 9), not how the other is retired or linked; (c) if and when a
methodology-neutral generalization is actually needed, introduce it under
the name "Iteration" (Rule 2), rather than extending `program_sprints`
directly or inventing a different name; (d) leave `project_milestones`,
`program_sprints`, `program_epics`, and `program_cards` schema exactly as
they are today, since none currently violates this ADR's rules. None of
this work is scoped to, or begun by, this documentation-only PR.

## UX Implications

Sprint- and Epic-specific UI must remain absent, or explicitly hidden, for
predictive-methodology Projects once methodology gating is verified/built
(Rules 1, 4, 6) — this is a UX requirement the future implementation PR
must satisfy, not a schema one, since `program_sprints`/`program_epics` are
already correctly Program-scoped at the data layer. Milestone UI, by
contrast, must remain available to every Project regardless of methodology
(Rule 5) — no future change may make Milestone visibility conditional on
methodology the way Sprint/Epic visibility is. Any future Project-creation
or Project-settings flow that exposes a `methodology` selector must treat
it as a first-class, per-Project configuration choice (Rule 7), not a
one-time, unchangeable default. This ADR does not design any specific
screen, gating mechanism, or settings UI; it only fixes the policy those
future changes must conform to.

## Compatibility Implications

This ADR is backward compatible with the current schema and running
system. `program_sprints`, `program_epics`, `program_cards`, and
`project_milestones` all already conform to the boundary this ADR ratifies
— PR1 §21 confirms Sprint/Epic are already Program-tree-only and Milestone
is already Project-scoped and unified. Nothing about existing rows, existing
Program trees, or existing Milestone records is required to change. The one
element this ADR does not confirm is compatible is the `methodology`
field's UI-gating behavior, which is unverified rather than known-violating
or known-compliant; a future implementation PR must establish which is
true before this ADR's Rules 1/4/6/7 can be considered fully satisfied in
practice, not just in schema.

## Out of Scope

- Any code, schema, migration, RLS policy, or route change (this is a
  documentation-only PR).
- Building a generic "Iteration" table, type, or UI (Rule 2/3 ratify the
  name and future shape only, not an implementation).
- Verifying or wiring `projects.methodology` to any Sprint/Epic visibility
  gate (named as a future implementation task in Migration Implications).
- Reconciling `program_cards.type='MILESTONE'` with `project_milestones`
  (named as a future implementation task in Migration Implications and
  Rule 9).
- Any change to Program's own domain rules or its relationship to
  Project/PMO/Portfolio (covered by ADR-PMF-005; this ADR only constrains
  the Sprint/Epic/Card/Milestone vocabulary that already lives inside and
  alongside the Program tree).
- Deciding the specific mechanical representation (subtype, modality,
  label, or configuration value) by which Sprint relates to Iteration —
  left to the future implementation PR per Rule 3.

## Validation

This decision is validated primarily by evidence PR1 already gathered, plus
two named, currently-open gaps:

- `program_sprints`/`program_epics` confirmed Program-tree-scoped only,
  with no relationship to `projects` beyond the Program tree's own
  `workspace_id` anchor (PR1 §9, §21).
- `program_cards` confirmed to carry a generic `type` enum including
  MILESTONE, DELIVERABLE, and CUSTOM alongside EPIC/SPRINT/TASK/PROMPT (PR1
  §21).
- `project_milestones` confirmed Project-scoped
  (`project_id`/`workspace_id` NOT NULL) with `forecast_date`/
  `baseline_date`, and confirmed by PR1 §21 as the concept "that should be
  considered canonical."
- `projects.methodology` confirmed to exist in schema (added 2026-08-28)
  but confirmed **not verified** as wired to any Sprint/Epic visibility
  gate this session (PR1 §21) — this is the concrete open item a future PR
  must resolve, in either direction, to close out Rule 7 in practice.
- Known, named gap: `program_cards.type='MILESTONE'` and
  `project_milestones` remain disconnected (PR1 §21, this ADR's Rule 9).
  Not resolved by this ADR; the concrete acceptance criterion for a future
  reconciliation PR is that the two converge on a single canonical
  Milestone representation, consistent with Rule 5.
- Future validation, once Iteration (if ever built) exists: confirm no
  predictive-methodology Project can be forced into Sprint/Iteration
  configuration, and confirm Milestone remains visible and usable
  independent of any methodology setting.

## References

- `docs/product-architecture/01-canonical-domain-model.md` (PR1) — §9, §21.
- `docs/product-architecture/01.1-domain-ratification.md` (PR1.1, authored
  in parallel with this ADR).
- `docs/adr/ADR-PMF-005-program-domain-semantics.md` (Program's own
  ratified domain rules, which this ADR's Rule 8 defers to for the
  Program-tree's scope and optionality).
- `docs/adr/ADR-PMF-006-project-execution-aggregate.md` (Project-centrality
  principle this ADR's Rule 4 extends to methodology-specific
  capabilities).
