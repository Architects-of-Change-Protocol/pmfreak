# ADR-PMF-020: Command Center Experience Architecture

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-007 ratified what a Command Center *is* at the domain level: a projection applied over a governed entity, never an aggregate root, never independently created. ADR-PMF-014 ratified how it must be *named*: always entity-qualified, never bare, never the label of a creation action. Neither ADR specified the actual experience architecture of the six Command Centers themselves — their audience, their widget composition by category, their navigation behavior, or how they relate to each other as a family of six structurally-identical experiences applied to six different entities.

That gap matters because PR1's single clearest concrete defect — today's `/command-center` route mixing Project-level and cross-PMO Workspace-level data on one screen (PR1 §11) — is not just a naming problem (which ADR-PMF-014 fixed) or a domain problem (which ADR-PMF-007 fixed); it is a structural, experience-layer problem: nothing has yet specified what data each Command Center variant is and isn't allowed to compose. Without that, a future implementation PR reading ADR-PMF-007 and ADR-PMF-014 alone would know Command Center must be entity-qualified but would have no guidance on whether, say, the PMO Command Center is allowed to show raw Project-level Task data (it is not — only PMO-level rollups) or whether the Project Command Center is allowed to show cross-PMO data (it is not, ever).

This ADR closes that gap.

## Decision

**Each of the six Command Centers (Enterprise, Workspace, PMO, Portfolio, Program, Project) is fully specified as a distinct experience instance of the same architectural pattern: a composed, read-plus-action projection whose widgets may only read data from that entity and its descendants in the ratified hierarchy — never from a sibling or ancestor entity, and never from an unrelated entity.** Each Command Center's Purpose, Audience, Widget categories, Context, Navigation behavior, Actions, Projections, Read Models, and Future Evolution path are documented exhaustively in `docs/product-architecture/03-canonical-information-architecture.md` §11, and the shared widget taxonomy is documented in `docs/product-architecture/03-screen-catalog.md` §13. No Command Center widget may compose data outside its own entity's descendant scope — this is the direct, checkable fix for the mixed-scope defect PR1 found.

## Alternatives Considered

- **Leave widget composition scope unspecified, trusting ADR-PMF-007's "projection over a governed entity" language to imply the boundary.** Rejected: PR1's own evidence shows this trust already failed once — the current `/command-center` route was presumably built by someone who also believed Command Center was "a projection over an entity" and still ended up mixing Project- and Workspace-level data. A general principle without a checkable scope rule (§13 of the Screen Catalog: "no widget reads data outside its own entity's descendant scope") is not sufficient on its own, as demonstrated.
- **Allow a single "Universal Command Center" screen that adapts its content based on the entity passed to it, rather than six named experiences.** Rejected: this is architecturally closer to the current defect (one screen, ambiguous scope) than to the fix. Six distinct, entity-qualified experiences — even though they share a common pattern — keep the entity boundary structurally visible in the IA itself, not just in a runtime parameter.
- **Give the PMO Command Center direct access to raw per-Project data (Tasks, Risks) for "at a glance" convenience.** Rejected: this would violate the rollup-only composition rule and reintroduce the exact cross-entity data-mixing PR1 flagged, just moved one level up the hierarchy. PMO Command Center may show Project *health*, never a Project's raw Task list.

## Positive Consequences

- Gives engineering a mechanically checkable rule for the exact defect PR1 evidenced with a file citation: "does this widget's query ever read data outside this entity's descendant scope."
- Establishes the six Command Centers as a genuinely uniform family (same widget taxonomy, same scope rule) rather than six independently-designed screens that happen to share a name — directly reinforcing ADR-PMF-007's "same kind of thing, six variants" ruling at the experience-design layer.
- Clarifies, for the first time, that a Command Center's Future Evolution path depends on its entity's schema readiness (e.g. Portfolio Command Center cannot be built until `portfolios` exists) — giving PR4 and future backend PRs a shared dependency map instead of discovering it ad hoc.

## Negative Consequences

- The strict descendant-only scope rule means some genuinely useful executive "at a glance across everything" views (e.g. a PMO Manager wanting to see the single most overdue Task across all their Projects without drilling in) are not directly satisfied by any single Command Center as specified — they would need a Reports or Health Center screen instead (already in the canonical inventory, ADR-PMF-017), not a scope exception to Command Center itself.
- Six independently-buildable Command Centers, each gated on different entities' schema readiness, means the "Command Center" experience will roll out unevenly across the hierarchy (Project and Workspace Command Centers buildable now; Portfolio and Enterprise Command Centers blocked on schema work) — a predictable but real sequencing cost.

## Risks

- **Scope-creep risk:** without the descendant-only rule being enforced by tooling (e.g. a query-boundary lint), a future engineer under deadline pressure could add "just one more Workspace-level metric" to the Project Command Center, recreating the original defect. Flagged as a follow-up need, not resolved by this ADR.
- **Naming-collision risk (inherited from ADR-PMF-014):** the internal `/pmo-command-center` ops dashboard remains a distinct, non-user-facing surface that must not be confused with the ratified PMO Command Center — this ADR restates that boundary but does not resolve the underlying route-naming collision, which is a future implementation PR's responsibility.

## UX Implications

Every Command Center's widget set, audience, and navigation behavior is now fully specified (§11 of the parent IA document). Users will experience each Command Center as answering "what do I need to know and do right now" strictly for the entity they're viewing — never leaking in adjacent entities' data as a false sense of completeness.

## Implementation Implications

No code is changed by this ADR. A future implementation PR must split the current `/command-center` route strictly along entity lines (Project Command Center gets only Project-descendant data; a genuinely new Workspace Command Center screen, if built, gets only Workspace-descendant PMO/Project rollups) and must not ship any Command Center widget that queries outside its entity's descendant scope.

## Future Evolution

As Portfolio and Enterprise become schema-backed, their Command Centers become buildable against this same specification without a new experience-architecture decision — only the underlying data source changes. Any future widget category not covered by the shared taxonomy (§13, Screen Catalog) requires an explicit addition to that taxonomy, not an ad hoc one-off widget.

## Compatibility Implications

Backward compatible: no existing route or component is changed by this ADR. The current `/command-center` route's mixed-scope behavior remains as-is until a future implementation PR brings it into conformance — this ADR specifies the target, not an immediate migration.

## Out of Scope

- Query-boundary enforcement tooling (flagged as a follow-up).
- Exact widget visual layout and prioritization (PR4).
- Resolving the `pmo_command_center_snapshots`/`operational_command_centers` table-naming collision (schema-layer, future PR).
