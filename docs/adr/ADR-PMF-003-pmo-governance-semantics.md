# ADR-PMF-003: PMO Is an Organizational and Governance Entity, Not an Alias for Workspace

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited the current implementation of PMO and found three historically-layered, only partly-reconciled representations of the concept:

1. **An enum value**, `workspaces.command_center_type = 'company_pmo'`, added 2026-07-02 as part of the "Command Center Foundation" model. That model's own design note states explicitly: *"PMO is one type of Command Center, not the universal container."* This treats PMO as a type tag on the Workspace row itself — not a distinct entity.
2. **A JSON configuration blob**, `PmoTenant`, stored in `workspace_governance.governance_jsonb`, 1:1 with Workspace, with no independent identity of its own.
3. **A real, first-class child table**, `pmos`, added 2026-08-28, with `workspace_id NOT NULL` and referenced by `projects.pmo_id` (nullable). A DB trigger, `enforce_project_pmo_same_workspace`, already enforces that a Project's `pmo_id`, if set, must share the Project's `workspace_id` — added specifically to close a cross-workspace assignment bug found during validation.

PR1 documents this as Contradiction C-1: two competing models of "PMO" are live in production simultaneously, with nothing in the schema or code reconciling them, so a Workspace's `command_center_type` tag and its actual population of `pmos` rows can silently disagree. PR1 also flags, as open decision D-05, whether a default PMO should be a mandatory, invisible backfill for every Project, or whether a permanently-unassigned ("zero-PMO") state should be a first-class, ratified option — noting that `ensureDefaultPmo` today backfills every existing Project to a default PMO as a practical matter, without that permanence being product-ratified.

This ADR resolves both the conceptual question (what PMO *means*) and the D-05 policy question (whether a default PMO may be assumed) as a single ratified decision. It formalizes decision D-03 from the founder's ratified canonical hierarchy: PMO takes its place between Workspace and {Portfolio, Program, Project} in the target-state hierarchy Enterprise → Workspace → PMO → Portfolio → Program → Project, with optional shortcuts Workspace→Project and PMO→Project.

## Decision

**PMO is the organizational entity responsible for governing how Projects, Programs, and Portfolios are administered, supervised, and improved.** It is not a synonym, alias, or interchangeable label for Workspace, and it is not a synonym for Command Center.

Of the three current representations, only the `pmos` table (representation 3 above) is a genuine entity going forward. The `command_center_type = 'company_pmo'` enum value and the `PmoTenant` JSON blob are ratified, effective immediately at the decision level, as **PMO configuration inputs** — data that informs how a PMO is created or configured — not as independent PMOs or alternate sources of PMO identity. This ADR does not execute that reconciliation in code or data; it fixes the target semantics that a future implementation PR (PR2) must converge on.

## Domain Rules

1. A Workspace may contain multiple PMOs.
2. A PMO belongs to exactly one Workspace (`pmos.workspace_id NOT NULL`, already enforced).
3. A PMO may contain Portfolios, Programs, and direct Projects.
4. A Project may exist without a PMO. `pmo_id` remains nullable by design; "unassigned" is a legitimate, addressable state, not an error condition.
5. A default, invisible PMO must **not** be created as a universal technical requirement. Silently backfilling every Project into a hidden default PMO, as a blanket technical rule applied to all tenants regardless of their onboarding path, is not permitted going forward.
6. A default PMO may only exist as the result of an **explicit onboarding or configuration decision** — e.g., a tenant or segment that opts into "PMO required" behavior at setup time — not as an implicit side effect of Project creation.
7. A PMO administers: standards, templates, practices, governance, reporting, metrics, escalation, knowledge, portfolio oversight, and program oversight. This is the functional definition of what "governing" means for rule statement above; it distinguishes PMO from a passive grouping label.
8. PMO does not mean Workspace. Workspace is the tenant/security root; PMO is a governance entity scoped inside it.
9. PMO does not mean Command Center. Command Center is a UI/operational experience surface, never an organizational entity in its own right (see PR1 §22); it must not be used as a stand-in name for PMO, nor should PMO be described as "the Command Center."
10. PMO must evolve toward a clearly persistent, independently-governed entity — the `pmos` table, not the enum or the blob — as its sole source of identity. This PR does not implement that evolution; it fixes the direction so PR2 has an unambiguous target.

## Alternatives Considered

- **Collapse PMO into Workspace** (treat "PMO" as purely a Workspace-level label, per the original Command Center Foundation model). Rejected: this is the status quo that produced Contradiction C-1, and it forecloses the founder-ratified target hierarchy, which requires PMO as a distinct governance layer between Workspace and Portfolio/Program/Project. It also cannot express "multiple PMOs per Workspace," which is both already implemented in the schema (`pmos.workspace_id` has no uniqueness constraint) and explicitly required by rule 1 above.
- **Keep all three PMO representations as independently valid, reconciling them only at query time.** Rejected: this preserves ambiguity indefinitely rather than resolving it, and provides no way to prevent a Workspace's enum tag and its `pmos` rows from drifting further out of sync. A single canonical entity with the others demoted to configuration inputs is the only option that gives future code one place to look.
- **Make a default PMO mandatory for every Project (formalize `ensureDefaultPmo` as permanent, universal policy).** Rejected: this forecloses PR1's D-05 question in the direction most costly to reverse (once every Project is opaquely PMO-scoped, undoing that is a data migration, not a policy change), and it directly conflicts with rule 5's requirement that no invisible universal default PMO exist as a technical requirement. It also actively harms the small-team/independent-PM segment PR1 identifies, for whom PMO-level governance overhead is not wanted.
- **Eliminate PMO as a product concept entirely** (per the unmerged sibling-branch audit's general direction of collapsing ambiguous layers). Rejected: PR1 confirms `pmos` is the best-reconciled and most real of the four contested concepts (Command Center, Portfolio, Program, PMO) — it already has a dedicated table, workspace scoping, and an enforced cross-workspace trigger. Discarding it would delete real, working infrastructure to avoid a naming problem that has a cheaper fix.

## Positive Consequences

- Resolves Contradiction C-1 at the decision level: there is now exactly one ratified source of PMO identity (`pmos`), ending the ambiguity between the enum-tag model and the child-entity model.
- Gives Portfolio (ADR-pending) and Program (ADR-pending) an unambiguous, ratified parent in the hierarchy, unblocking their own domain-rule ADRs from having to re-litigate what PMO means.
- Protects the small-team/independent-PM segment: because a default PMO is never a silent universal requirement, a Project can remain legitimately unassigned indefinitely, matching real usage where not every team wants PMO-level governance overhead.
- Gives PMO a clear, positive functional definition (rule 7's list: standards, templates, practices, governance, reporting, metrics, escalation, knowledge, portfolio oversight, program oversight) rather than leaving it as "whatever the enum or blob happens to hold."
- Establishes the precedent, for the remaining hierarchy ADRs in this PR, that a concept with a real table and enforced constraints (like `pmos`) is preserved and clarified rather than deleted — consistent with PR1's overall stance against the sibling-branch audit's collapse recommendation.

## Negative Consequences

- The enum (`command_center_type = 'company_pmo'`) and the JSON blob (`PmoTenant`) remain live, readable, and possibly inconsistent with `pmos` rows until a future PR performs the actual deprecation; this ADR fixes the target semantics but does not eliminate the drift risk in the interim.
- Any UI or backend code path that currently treats `command_center_type = 'company_pmo'` as sufficient evidence of PMO existence is now, by this ADR, using a non-canonical signal; it is not corrected by this document and will continue to behave per legacy semantics until PR2.
- Making "default PMO" an explicit, opt-in configuration decision (rules 5-6) is a stricter bar than the current de facto behavior of `ensureDefaultPmo`, which today runs unconditionally. Until PR2 implements this, the codebase will not yet conform to the ratified rule.

## Risks

- **Reconciliation risk:** a future migration must decide how to handle Workspaces where `command_center_type = 'company_pmo'` is set but zero rows exist in `pmos` (or vice versa — `pmos` rows exist but the enum was never set). This ADR does not resolve that data-level reconciliation; it only rules out the enum/blob as competing sources of truth going forward.
- **Backfill-removal risk:** rules 5-6 imply that at some point, the unconditional `ensureDefaultPmo` behavior must change to be onboarding-decision-gated. Changing this after Projects have already been auto-assigned to default PMOs risks user-visible behavior change (a Project's PMO context could become "unassigned" where it previously had an invisible default) if not handled as a careful, additive migration in PR2.
- **Segment mis-targeting risk:** rule 6 requires "explicit onboarding/configuration decision" to gate a default PMO, but this ADR does not specify what that decision surface looks like (per-tenant setting? per-segment default? onboarding wizard step?). Leaving this underspecified could result in PR2 implementing something inconsistent with the founder's intent if not clarified before implementation begins.

## Security and Data Implications

- `pmos.workspace_id NOT NULL` and the `enforce_project_pmo_same_workspace` trigger already enforce the tenancy invariant this ADR depends on (rule 2: a PMO belongs to exactly one Workspace) — no new enforcement is introduced by this ADR, but its ratification confirms that existing trigger's design was correct and should not be relaxed.
- Because `pmo_id` remains nullable (rule 4) and no universal default PMO is mandated (rule 5), RLS policies and any future PMO-scoped governance queries must continue to treat "Project with `pmo_id IS NULL`" as a valid, first-class state — not an anomaly to be defensively coded around or silently backfilled at query time.
- No RLS policy changes are made or required by this ADR. The Workspace-level tenant isolation PR1 verified (408/409 tables RLS-enabled, live cross-tenant SQL smoke test passed 10/10) is unaffected; PMO remains strictly within, not across, Workspace boundaries.

## Migration Implications

None of the following is executed by this ADR. They describe what a future implementation PR (PR2) would need to do:

- Define and execute a data-reconciliation pass for Workspaces where `command_center_type = 'company_pmo'` and `pmos` population disagree (per the Risks section above).
- Formally mark `workspaces.command_center_type` and `workspace_governance.governance_jsonb`'s `PmoTenant` shape as read-only legacy configuration inputs at the code level, with new PMO creation/edit flows writing to `pmos` as the sole source of truth.
- Design and implement the "explicit onboarding/configuration decision" surface referenced in rule 6, replacing the current unconditional `ensureDefaultPmo` call with a gated version.
- Define a deprecation path and target removal date for direct reads of the enum/blob once all consumers have migrated to `pmos`.
- Audit all current call sites of `ensureDefaultPmo` and any code that infers PMO existence from `command_center_type` rather than querying `pmos` directly.

## UX Implications

- No UI copy, route, navigation, or component is changed by this ADR. It is documentation-only.
- For a future PR2, this ADR establishes that the product must stop describing PMO creation in Command-Center-flavored language (PR1 §11 notes the post-activation screen currently says "Your PMO Brain is active" and invites the user to add a "PMO team" with no stated connection to the "Command Center" the user was just told they created) — future copy should treat PMO as its own named governance entity, distinct from both Workspace and Command Center framing.
- Because a default PMO is no longer permitted as an invisible universal behavior (rule 5), any future onboarding flow that currently gates "Create Project" behind "Create Command Center"/PMO creation (PR1 §11, `getting-started-flow.tsx:359-371`) must be reconsidered in PR2 against rule 4 (a Project may exist without a PMO) and rule 6 (default PMO only via explicit decision) — noted here as a forward implication, not resolved by this ADR.

## Compatibility Implications

- Existing Projects already backfilled to a default PMO via `ensureDefaultPmo` are not altered, reassigned, or unassigned by this ADR. Ratification is forward-looking; it does not retroactively invalidate current data.
- Existing reads of `command_center_type = 'company_pmo'` and `PmoTenant` continue to function unchanged until a future PR implements the deprecation path described above. This ADR creates no immediate compatibility break.
- Any future consumer of PMO identity should be written against `pmos` as specified here; consumers written against the enum or blob as of this ADR's date are now known-legacy and should be flagged for migration in PR2 planning, not treated as equally valid alternatives.

## Out of Scope

- Executing any schema change, data migration, or deprecation of the enum/blob read-paths (future PR2).
- Designing the specific onboarding/configuration surface that gates default-PMO creation (future PR2, per rule 6).
- Resolving Portfolio's and Program's own domain semantics — those are covered by their own ADRs within this PR, using PMO's position in the hierarchy (this ADR) as a fixed input.
- Resolving Enterprise's relationship to Workspace, or Command Center's formal non-entity status — covered by separate ADRs in this PR.
- Any change to `enforce_project_pmo_same_workspace` or other existing RLS/trigger enforcement; this ADR relies on, but does not modify, that enforcement.
- Retroactive reclassification or cleanup of Projects currently attached to a default PMO by legacy `ensureDefaultPmo` behavior.

## Validation

This ADR is a documentation/ratification artifact; it has no code to test. Its validation criteria are:

- Consistency with the founder-ratified canonical hierarchy and cardinalities (Workspace→PMO 1:N; PMO→Workspace N:1 required; PMO→Portfolio 1:N; PMO→Program 1:N; PMO→Project 1:N optional; Project→PMO N:1 optional) — confirmed, this ADR's Domain Rules restate exactly these cardinalities in prose.
- Accuracy of all current-state claims against `docs/product-architecture/01-canonical-domain-model.md` — every factual claim in Context and Domain Rules traces to a specific section of that document (§9, §12 C-1, §17, plus the `enforce_project_pmo_same_workspace` trigger detail from its data-integrity section) and was re-read from the source file before being restated here.
- No contradiction introduced with other D-03-adjacent open items in PR1 (D-05 default-PMO permanence is explicitly resolved by rules 5-6 above, not left open).
- Future PR2 acceptance test (not executed here): a Project can be created and persisted with `pmo_id IS NULL` through the normal creation flow, with no silent backfill to a default PMO, unless the tenant/segment has made the explicit configuration decision described in rule 6.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1 canonical domain model audit; primary current-state evidence source (§9 entity inventory, §12 Contradiction C-1, §17 PMO Definition, §33 D-05).
- `docs/product-architecture/01.1-domain-ratification.md` — PR1.1 ratification document, authored in parallel with this ADR, recording the founder's full set of ratified decisions including D-03.
- `docs/architecture/command-center-foundation.md` — source of the `command_center_type` enum model and its own "PMO is one type of Command Center, not the universal container" statement.
- `docs/architecture/workspace-pmo-project-hierarchy.md` — source of the `pmos` table / Workspace→PMO→Project model.
