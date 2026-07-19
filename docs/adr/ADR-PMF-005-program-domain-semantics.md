# ADR-PMF-005: Program Is a Coordination and Benefits Entity Belonging to PMO

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited PMFreak's implementation of "Program" and found a real, well-built, well-tested capability with zero structural connection to the rest of the domain. The `programs`, `program_epics`, `program_sprints`, and `program_cards` tables (source: `20260628000000_programs.sql`, per `src/lib/db/database-contract.ts:2493–2496`) implement a document-to-backlog pipeline — `program_roadmap_sources` → `program_roadmap_parse_results` → `program_materializations` → `program_epics`/`program_sprints`/`program_cards` — that parses a roadmap document into an Epic/Sprint/Card backlog (PR1 §19, §29–31). This capability is active, tested, and reachable from the main sidebar today (`src/lib/workspace/navigation-hierarchy.ts:26`, `{ label: "Programs", href: "/programs", tier: "utility", visibleByDefault: true }`) — it is not navigationally orphaned.

What it does not have is any foreign-key relationship to `projects` or `pmos`. `programs.workspace_id` is its only tenancy anchor, confirmed by PR1 at both the database layer (`database-contract.ts`) and the TypeScript layer (`ProgramRow` carries no `project_id` or `pmo_id` field). PR1 classified this as **Category F — feature incomplete, not duplication** (§9, §19, §29–31, §33 D-17): the capability is good; its place in the hierarchy was simply never built. PR1 explicitly declined to resolve the resulting fork, framing it as PMFreak's own D-17 decision: does "Program" here mean the PMI-Program reading — a set of related Projects, requiring a new relationship layered on top of the untouched roadmap-parsing capability — or does the roadmap-parsing tool keep the name and the PMI meaning get expressed elsewhere? PR1 states both are legitimate and does not choose (§19, §33).

This ADR is that choice. It ratifies the PMI-Program reading and formalizes Program's place in the canonical hierarchy `Enterprise → Workspace → PMO → Portfolio → Program → Project` (established by ADR-PMF-001 and the companion PMO/Portfolio ADRs), while explicitly preserving the existing Epic/Sprint/Card roadmap-parsing capability as Program-scoped tooling underneath the entity, not as a replacement for it. This is a ratification of intent only. No schema, migration, route, API, or TypeScript type is created, modified, or superseded by this document. Implementation is deferred to a future, separately-scoped PR2.

## Decision

**Program is an entity that coordinates related Projects to produce joint benefits that would not be obtained by managing those Projects in isolation.**

Program belongs, in the target model, to exactly one PMO and may optionally belong to a Portfolio within that same PMO. It may contain multiple Projects, and a Project may belong to at most one primary Program. Program is not a synonym for Portfolio and not a synonym for Initiative (PR1 §20 already establishes "Initiative" as an unrelated onboarding-wizard synonym for Project). Program cannot cross Workspaces, and cross-PMO Program is out of scope for the initial model.

The existing `programs`/`program_epics`/`program_sprints`/`program_cards` tree is not renamed, redefined, demoted, or replaced by this decision. It remains the real, tested document-to-backlog capability PR1 found it to be, and it becomes Program-scoped tooling that operates underneath the now-connected Program entity — analogous to how Epic/Sprint/Card already operate strictly within a single `program_id` today (PR1 §21, §331–333). Nothing about that tree's internal behavior changes.

## Domain Rules

1. A Program belongs to exactly one PMO (Program → PMO, N:1, required in the target model).
2. A PMO may contain multiple Programs (PMO → Program, 1:N).
3. A Program may optionally belong to a Portfolio (Program → Portfolio, N:1, optional), and that Portfolio must belong to the same PMO as the Program (Portfolio → PMO, N:1, required, per the companion Portfolio ADR).
4. A Program may contain multiple Projects (Program → Project, 1:N).
5. A Project may exist without a Program. Program is not a mandatory containment level.
6. Initially, a Project may belong to at most one primary Program (Project → Program, N:1, optional, max one primary).
7. No many-to-many Project–Program relationship is enabled in the first model. Future many-to-many evolution, if ever ratified, requires its own ADR (per the ratified invariant that the initial model contains no many-to-many relationships).
8. Program cannot cross Workspaces. A Program's Projects, its PMO, and its optional Portfolio must all resolve to the same Workspace.
9. Cross-PMO Program is out of scope for the initial model. A Program does not span multiple PMOs.
10. Program must manage benefits, dependencies, outcomes, coordination, shared risks, and cross-cutting decisions across its member Projects. This is a target-state responsibility of the entity; the mechanism is future work and is not designed or implemented by this ADR.
11. Program is not a synonym for Portfolio. Portfolio is a strategic grouping for investment prioritization (per the companion Portfolio ADR); Program is an operational coordination grouping for joint benefit realization. They are distinct entities even where a Program optionally sits inside a Portfolio.
12. Program is not a synonym for Initiative. "Initiative" remains, per PR1 §20, an unrelated UI synonym for Project used in the onboarding wizard.
13. Program must not be deleted, renamed away from "Program," or treated as dead code on account of its current disconnection from Project/PMO. Its current state is classified as a valid, real capability with incomplete integration (PR1 Category F), not as duplication or abandoned scaffolding.
14. The existing Epic/Sprint/Card roadmap-parsing tree remains Program-scoped tooling beneath the entity ratified by this ADR. It is not itself the PMI-Program relationship; it coexists with, and operates underneath, the new Program↔PMO/Portfolio/Project relationships described above.

## Alternatives Considered

- **Keep "Program" as the roadmap-parsing tool's name and express the PMI grouping-of-Projects concept under a different name.** Rejected: this was the other live branch of PR1's D-17 fork. It would require inventing an entirely new term for a concept PMI practitioners already call "Program," creating exactly the kind of naming drift PR1 spent its audit cataloguing (Command Center's five meanings, Portfolio's six). Reusing the existing well-known term, once correctly connected, is the lower-drift path.
- **Collapse Program into Portfolio**, treating "coordinated group of Projects" and "strategic grouping for prioritization" as one concept. Rejected: this was the sibling-branch audit's collapse-and-simplify position, which PR1's own mandate explicitly rejected (PR1 §1, "finish connecting them to the real hierarchy, not delete them"). It would also erase a real PMI distinction the product vision requires — benefit coordination and investment prioritization are different management disciplines even when the same Projects participate in both.
- **Allow Program to cross PMOs or Workspaces** to support cross-functional or cross-tenant program structures. Rejected for the initial model: PR1 §17 and §19 confirm Project↔PMO already stays within a single Workspace, and D-09 in PR1's decision backlog recommends mirroring that constraint for Program to avoid a new cross-tenant surface before any of the existing single-tenant relationships have even shipped. Cross-PMO Program remains explicitly Out of Scope (Rule 9) rather than foreclosed forever.
- **Allow a Project to belong to multiple Programs (many-to-many) from the start.** Rejected: the ratified invariant set forbids any many-to-many relationship in the initial model across the entire domain, not just Program↔Project specifically. A single "primary Program" per Project (Rule 6) is simpler to build, simpler to secure with RLS, and simpler for users to reason about; multi-Program membership can be proposed later via its own ADR if real customer need emerges.
- **Delete the Program capability** as unreachable/isolated code, per the sibling-branch audit's recommendation. Rejected outright by rule 13 and by PR1's own framing (§19: "the clearest case in the entire audit of 'do not delete, do connect'"). The capability is tested, active, and valuable; the correct fix is integration, not removal.

## Positive Consequences

- Resolves PR1's own D-17 decision point (§19, §33), the single named fork blocking any FK work on `programs`.
- Gives Program a coherent PMI-aligned meaning — coordination of related Projects for joint benefit — that was previously absent; today the word only describes a document-parsing tool, which does not match its name.
- Preserves a real, tested capability (the Epic/Sprint/Card tree) exactly as-is, avoiding any regression risk to functionality PR1 confirmed is active and well-built.
- Closes the "structural island" gap PR1 flagged as the clearest Category F finding in the whole audit, giving future implementation work (PR2) an unambiguous target instead of an open question.
- Establishes a clean layering: Program (entity, coordination/benefits) sits above Epic/Sprint/Card (Program-scoped tooling), which PR1 already found to be a correct, if undocumented, boundary (§337: Sprint/Epic vocabulary "should stay scoped to Program specifically... and never be presented as mandatory").

## Negative Consequences

- Introduces a new required relationship (Program → PMO) and a new optional relationship (Program → Portfolio, Program → Project, Project → Program) into a domain model that, per PR1, is already carrying naming and connection debt elsewhere (Command Center, Portfolio's six meanings). Rushed implementation without care for Rules 1–14 could add a fifth overloaded term instead of resolving one.
- A future PR2 must add FKs to a table with existing production rows (`programs`, workspace-scoped only today); every existing Program row will need a backfill or an explicit "unassigned to PMO" transitional state, since Rule 1 makes PMO required in the target model but no existing row has one today.
- The Program → Portfolio optionality (Rule 3) is only meaningful once the companion Portfolio ADR's entity actually exists; until Portfolio is implemented, this half of the relationship is inert by construction, similar to how Enterprise Intelligence remains inert until Enterprise exists.

## Risks

- **Premature-FK risk:** a future PR could add `programs.pmo_id` before PMO's own target-state contract (from ADR-PMF-001 and the companion PMO ADR) is fully implemented, producing a partially-wired relationship. Mitigation: PR2 scoping should sequence Program's PMO FK after PMO's own required-relationship guarantees are in place, not before.
- **Backfill risk:** existing `programs` rows have no PMO today; a naive migration that makes `pmo_id` required without a backfill plan would break every existing Program. Mitigation: see Migration Implications — backfill strategy is a required PR2 planning input, not an afterthought.
- **Tooling-vs-entity conflation risk:** engineers unfamiliar with this ADR could read "connect Program to Project" as license to add `program_id` directly onto `program_cards`' sibling concepts or onto Project-level Milestones, reintroducing the "two disconnected Milestone concepts" problem PR1 already found (§145, §333). Mitigation: Rule 14 explicitly scopes this ADR to the Program entity's relationships to PMO/Portfolio/Project, not to the internal Epic/Sprint/Card tree, which is unaffected.
- **Cross-PMO pressure risk:** real customers with cross-functional programs spanning multiple PMOs may push for the Rule 9 constraint to be relaxed sooner than planned. Mitigation: Rule 9 is scoped as "out of scope for the initial model," not "forbidden forever," leaving room for a future ADR without requiring one now.

## Security and Data Implications

- This ADR does not alter, weaken, or bypass the existing Workspace-level Row-Level Security model. `programs` is already Workspace-scoped and RLS-enforced today (PR1 §16, §29); this decision adds relationships within that same Workspace boundary, per Rule 8, and does not introduce any cross-Workspace data path.
- A future implementation must add RLS-relevant checks ensuring a Program's PMO, optional Portfolio, and member Projects all resolve to the same `workspace_id` as the Program itself (Rule 8) — a data-integrity constraint enforced at the application and/or database-constraint layer, not merely a UI convention.
- No new cross-tenant surface is introduced: Program remains reachable only within its owning Workspace's RLS boundary, consistent with how PMO and Project already behave (PR1 §16–17).
- The Epic/Sprint/Card tree's existing RLS policies (`workspace_id` NOT NULL at every level, per PR1 §576) are unaffected by this ADR; no change to their access model is implied.

## Migration Implications

No migration is executed by this ADR. The following is a description of what a future PR2 implementation effort would need to plan for — it is not authorized, scheduled, or started by this document:

- A new required foreign key from `programs` to `pmos` (`programs.pmo_id`, Rule 1), with an explicit backfill strategy for every existing Program row, since no existing row has a PMO today. Plausible approaches (to be decided in PR2, not here) include auto-creating or assigning a default PMO per Workspace, mirroring the auto-creation pattern already used for Workspace and, per ADR-PMF-001, proposed for Enterprise.
- A new optional foreign key from `programs` to `portfolios` (`programs.portfolio_id`, Rule 3), inert until the companion Portfolio ADR's entity is implemented.
- A new relationship — either a nullable `projects.program_id` foreign key or a join table constrained to at-most-one-active-row-per-project — connecting Program to Project (Rules 4–6), enforcing "at most one primary Program per Project" and explicitly not a many-to-many join table (Rule 7).
- A same-Workspace integrity constraint (application-level check and/or database constraint) ensuring Program, its PMO, its optional Portfolio, and its member Projects never resolve to different `workspace_id` values (Rule 8).
- No change to `program_epics`, `program_sprints`, `program_cards`, `program_roadmap_sources`, `program_roadmap_parse_results`, or `program_materializations` is implied by this ADR; that tree's existing schema, FKs, and RLS policies (all already scoped correctly to `program_id`/`workspace_id` per PR1 §576, §621, §638) are undisturbed.

## UX Implications

- No UI, navigation, route, or copy changes are made by this ADR. The existing `/programs` sidebar entry (`navigation-hierarchy.ts:26`) and its "utility" tier placement are unaffected.
- A future implementation would need to surface Program's PMO and optional Portfolio context somewhere in the Program UI (creation flow, detail view) once the new relationships exist — but no such design is specified or required by this document.
- The existing Epic/Sprint/Card roadmap-builder UI is unaffected; per Rule 14 it continues to operate exactly as it does today, underneath the now-connected Program entity.
- This ADR does not resolve PR1's Command Center naming findings, including the fact that `/programs`' page heading currently reads "Executable Programs" (PR1 §189) — any copy reconciliation is future, separately-scoped UX work.

## Compatibility Implications

- Backward compatible with the current implementation: no existing table, type, route, or API depends on Program remaining disconnected from Project or PMO, so ratifying this relationship breaks nothing today.
- The existing `programs`/`program_epics`/`program_sprints`/`program_cards` tree, its RLS policies, and its `workspace_id`-only tenancy anchor remain accurate as current-state fact until a future PR2 implements the FKs described in Migration Implications; this ADR describes target state, not a change already made.
- PR1's classification of Program as "Category F — feature incomplete, not duplication" (§9, §19, §227) remains the accurate current-state description of the codebase as of this ADR's date; this document ratifies the resolution direction for that finding, it does not claim the finding has been acted on.
- This ADR is consistent with, and depends on, ADR-PMF-001's ratified hierarchy (`Enterprise → Workspace → PMO → Portfolio → Program → Project`) and the companion PMO and Portfolio ADRs for the required Program→PMO and optional Program→Portfolio relationships described here.

## Out of Scope

- Any database schema change, migration, table, column, or FK.
- Any TypeScript type, interface, or class change for `Program`, `Project`, or `PMO`.
- Any route, API endpoint, or UI surface change.
- The specific mechanism for benefits tracking, dependency management, outcome measurement, shared-risk coordination, or cross-cutting decision support that Rule 10 names as target-state Program responsibilities — design deferred to PR2 and, where warranted, their own ADRs.
- Relaxing the cross-PMO or cross-Workspace constraints (Rules 8–9) — explicitly deferred, not decided now.
- Enabling many-to-many Project–Program relationships (Rule 7) — explicitly deferred, not decided now.
- Any statement about timeline, sprint assignment, or prioritization of Program implementation relative to other roadmap items, including relative to the companion PMO and Portfolio ADRs it depends on.

## Validation

- This decision is validated by ratification: it is recorded as Accepted, with the Founder / Product Authority and PMFreak Architecture as decision owners, resolving PR1's D-17 decision point (§19, §33), which PR1 explicitly declined to answer.
- No code, schema, or test changes accompany this ADR, so there is no build, lint, typecheck, or test suite to run against it. The applicable check is documentary: this file follows the mandatory ADR section format, states the ratified decision without presenting it as open, and accurately describes current-state evidence — verified directly against `src/lib/db/database-contract.ts:2491–2496` and `src/lib/workspace/navigation-hierarchy.ts:26` in the course of writing this document — without claiming any implementation has occurred.
- Future validation belongs to PR2: once `programs.pmo_id`, `programs.portfolio_id`, and the Project↔Program relationship exist, that work must be validated the same way the Workspace RLS boundary was — including an explicit same-Workspace integrity test confirming a Program's PMO, Portfolio, and member Projects can never diverge in `workspace_id` (Rule 8), and a constraint test confirming a Project can never carry more than one primary Program (Rule 6) or Program more than one PMO (Rule 1).

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1, the audit whose §9, §19, §21, §29–31, §33 (D-17, D-07 through D-09), §227, and §331–333 this ADR directly builds on and resolves.
- `docs/product-architecture/01.1-domain-ratification.md` — the PR1.1 ratification document authored alongside this ADR, recording the full set of founder-ratified domain decisions this ADR is one part of.
- `docs/adr/ADR-PMF-001-enterprise-workspace-separation.md` — establishes the canonical target hierarchy `Enterprise → Workspace → PMO → Portfolio → Program → Project` that this ADR's Program↔PMO/Portfolio/Project rules slot into.
- `src/lib/db/database-contract.ts` — source of the `programs`/`program_epics`/`program_sprints`/`program_cards`/`program_roadmap_sources`/`program_roadmap_parse_results`/`program_materializations` type definitions cited in Context and Migration Implications.
- `src/lib/workspace/navigation-hierarchy.ts` — source of the `/programs` sidebar entry cited in Context and UX Implications.
