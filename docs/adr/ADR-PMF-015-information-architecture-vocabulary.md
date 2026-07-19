# ADR-PMF-015: Information Architecture Vocabulary (Container, Aggregate, Projection, Experience, Boundary)

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1.1 and ADR-PMF-001 through -012 ratified the domain model using structural terms — "aggregate root," "projection," "boundary" — without formally defining those terms as a shared, reusable vocabulary. ADR-PMF-002 calls Workspace "the primary operational, access, and data boundary." ADR-PMF-007 calls Command Center "a projection applied over a domain entity." ADR-PMF-006 calls Project "the central execution aggregate." These words carry real, load-bearing meaning across the ratification set, but until now that meaning existed only implicitly, distributed across twelve separate ADRs, with no single place stating what "aggregate," "projection," "boundary," "container," and "experience" mean as a class, independent of any one entity.

This is the same category of gap ADR-PMF-013 closed for entity names (Enterprise, Workspace, Portfolio, etc.): a ratified domain model with an implicit, undocumented structural vocabulary is exactly as fragile as a ratified domain model with an implicit naming convention. A future engineer reading "Program is an aggregate" and "the Feed is a projection" needs one place that defines what distinguishes those two words from each other, not five ADRs' worth of implication to reverse-engineer.

## Decision

**PMFreak's Information Architecture vocabulary — Container, Aggregate, Projection, Experience, and Boundary — is ratified as a fixed, five-term structural taxonomy that classifies every entity and view already ratified in ADR-PMF-001 through -012.** Every current and future domain concept must be classifiable as exactly one of these (an entity may be more than one simultaneously — e.g., Workspace is both a Container and a Boundary — but each classification is itself unambiguous once stated).

## Domain Rules

1. **Container:** an entity that holds other entities within a defined boundary, without necessarily being the tenancy/access boundary itself. Enterprise, Workspace, PMO, Portfolio, and Program are all Containers relative to their children in the ratified hierarchy.
2. **Aggregate:** an entity with its own lifecycle, identity, and consistency boundary — i.e., a thing with a genuine, independent existence that can be created, read, updated, and deleted on its own terms. Enterprise, Workspace, PMO, Portfolio, Program, and Project are the six ratified Aggregates (per PR1's Aggregate Map, §29, and ADR-PMF-001 through -006).
3. **Projection:** a read-derived view composed from one or more Aggregates, with no independent source of truth and no identity of its own. Command Center, Dashboard, and the Project Intelligence Feed are Projections. A Projection is never an Aggregate; it cannot be independently created, and deleting it deletes no data (only the Aggregate(s) it reads from can be deleted).
4. **Experience:** a user-facing composition of one or more Projections and available actions, scoped to a specific entity. Command Center is PMFreak's primary Experience type — it is simultaneously a Projection (structurally) and an Experience (functionally, from the user's point of view). Dashboard, by contrast, is a Projection but a narrower Experience (summary-only, no actions).
5. **Boundary:** a hard isolation line that data and access never cross implicitly. Workspace is the primary Boundary (ADR-PMF-002); Enterprise groups Workspaces without merging their Boundary (ADR-PMF-001). No Container, Aggregate, Projection, or Experience may claim Boundary status without an explicit ADR ratifying it as such — Boundary is the most consequential of the five terms because it is the one with live RLS/security implications.
6. Every entity ratified by ADR-PMF-001 through -006 (Enterprise, Workspace, PMO, Portfolio, Program, Project) is classified as an Aggregate and, relative to its children, a Container. Only Workspace is additionally classified as a Boundary (ADR-PMF-002); Enterprise, PMO, Portfolio, Program, and Project are not independent Boundaries — they inherit Workspace's Boundary, per the "nothing crosses Workspace" invariant.
7. Command Center, Dashboard, and Project Intelligence Feed are classified as Projections, and Command Center additionally as an Experience. None of the three is ever classified as an Aggregate, a Container, or a Boundary — this restates, in IA-vocabulary terms, ADR-PMF-007's and ADR-PMF-008's rulings that these are never independent entities.
8. A future concept must be classified against this taxonomy before it is added to the Canonical Vocabulary (`02-canonical-product-language.md` §4). A concept that cannot be cleanly classified as a Container, Aggregate, Projection, Experience, or Boundary (or some non-contradictory combination) should be treated as a signal that its domain semantics are not yet settled, and referred back to a domain ADR before a naming decision is made.

## Alternatives Considered

- **Leave the structural vocabulary implicit, as it was across ADR-PMF-001–012.** Rejected: this is the status quo gap this ADR exists to close; PR1.1's own consistency checks (§27) already relied on informal consistency of terms like "aggregate" and "projection" across the ADR set without ever defining them centrally, which is fragile for any future ADR author who has not read all twelve.
- **Merge Projection and Experience into one term.** Rejected: Command Center (an Experience, with actions) and the Project Intelligence Feed (a Projection, read-only) are structurally the same kind of thing (derived, no independent source of truth) but functionally different (one offers actions, the other only presents information). Collapsing them would lose a distinction ADR-PMF-007 and ADR-PMF-008 both rely on implicitly.
- **Define "Boundary" as any entity with RLS enabled**, rather than reserving it for Workspace specifically. Rejected: PR1 confirms 408/409 tables have RLS enabled, including tables scoped to PMO, Portfolio, Program, and Project — but those entities do not each define an *independent* isolation boundary; they inherit Workspace's. Defining Boundary purely by "has RLS" would incorrectly promote every RLS-scoped table to Boundary status, diluting the term's meaning as ADR-PMF-002 uses it.
- **Introduce additional IA terms (e.g., "Repository," "Service," "View Model") beyond the five ratified here.** Rejected for the initial vocabulary: the five terms already cleanly classify every entity and projection ratified through ADR-PMF-012; adding more terms without a concrete unclassifiable concept to justify them would be premature vocabulary expansion, the same anti-pattern this document exists to prevent elsewhere.

## Positive Consequences

- Gives every future domain or naming ADR a shared, defined vocabulary to reason in, rather than re-deriving "is this a projection or an aggregate" informally each time.
- Makes explicit, for the first time, that Command Center's Experience/Projection duality and Workspace's unique Boundary status are deliberate, ratified classifications — not incidental phrasing.
- Provides a concrete test (Rule 8) for classifying any future concept before it enters the Canonical Vocabulary, reducing the chance of a future concept being named before its structural role is settled.
- Retroactively documents, rather than changes, the structural reasoning already implicit across ADR-PMF-001 through -012 — no existing ADR's classification is altered by this document.

## Negative Consequences

- Adds one more piece of ratified vocabulary a new contributor must learn, on top of the entity names (ADR-PMF-013) and the domain rules (ADR-PMF-001–012) themselves.
- The taxonomy is retrofitted onto already-Accepted ADRs; while this document does not change their content, a careful reader must now cross-reference two documents (the original ADR and this one) to see a concept's full classification.
- "Boundary" reserved exclusively for Workspace (Rule 6) is a stricter reading than some engineers might assume from "the table has RLS enabled" — this could require correcting an informal misconception in code review discussions, though it corrects rather than changes ratified policy.

## Risks

- **Term-inflation risk:** a future contributor could be tempted to invent a sixth IA term for a concept that could actually be classified using the existing five with more careful thought. Mitigation: Rule 8 requires classification against the existing five before any addition, and any genuinely new term requires its own superseding ADR, per ADR-PMF-013's governance rule.
- **Boundary-conflation risk:** because RLS is enabled on far more than just `workspaces`-rooted tables, an engineer could misread "Boundary" as applying to any RLS-protected table. Mitigation: Rule 6 states explicitly that only Workspace holds independent Boundary status; PMO/Portfolio/Program/Project inherit it.
- **Retrofitting-drift risk:** because this taxonomy is applied after the fact to twelve already-written ADRs, a subtle inconsistency between how one of those ADRs used a term informally and how this document now defines it formally is possible. This document does not amend those ADRs' text; where an apparent inconsistency is found in the future, this document's formal definitions govern going forward, and the informal historical phrasing in the older ADR is superseded for classification purposes only, not for its domain ruling.

## Security and Data Implications

This ADR reinforces, rather than changes, the security model already ratified in ADR-PMF-002: only Workspace is classified as a Boundary, meaning only Workspace-level RLS is the operative tenant-isolation guarantee. No future feature may claim "Boundary" status for a Container, Aggregate, Projection, or Experience without a dedicated ADR — this closes a conceptual loophole where a future contributor might informally treat, say, "PMO" as a security boundary because it is RLS-scoped, when in fact it inherits Workspace's boundary and is not an independent one.

## Migration Implications

None. This is a vocabulary-definition ADR with no code, schema, or migration surface.

## UX Implications

None directly. This vocabulary is primarily an engineering/architecture naming tool; it does not itself specify user-facing copy. Where it indirectly matters to UX is in confirming that Dashboard (Projection only) and Command Center (Projection + Experience) are different in kind, which the Button/Navigation rules in `02-canonical-product-language.md` already build on.

## Compatibility Implications

Fully backward compatible. No ADR-PMF-001 through -012 classification is altered; this document only makes each one's existing, implicit classification explicit and centrally referenceable.

## Out of Scope

- Reclassifying any entity differently than its originating ADR (ADR-PMF-001 through -012) already implies.
- Introducing any new IA term beyond the five ratified here.
- Any code, schema, or route change.
- Defining Dashboard's own full entity contract (covered in `02-canonical-product-language.md` §7; this ADR only fixes its IA classification as a Projection, narrower than Command Center's Experience).

## Validation

- This decision is validated by ratification: it restates and centralizes, without altering, the structural classifications already implicit in ADR-PMF-001 through -012 (Aggregate: Enterprise/Workspace/PMO/Portfolio/Program/Project; Boundary: Workspace only; Projection: Command Center/Dashboard/Project Intelligence Feed; Experience: Command Center).
- No code, schema, or test changes accompany this ADR; the applicable check is documentary: every classification stated in Domain Rules 6–7 was checked against its originating ADR's own language (ADR-PMF-001 "aggregate root," ADR-PMF-002 "primary operational, access, and data boundary," ADR-PMF-006 "central execution aggregate," ADR-PMF-007 "not an aggregate root... a projection," ADR-PMF-008 "a projection... not an aggregate") before being restated here, and no contradiction was found.
- Future validation: any new concept proposed for the Canonical Vocabulary (`02-canonical-product-language.md` §4) should be checked against Rule 8 (classifiable as Container/Aggregate/Projection/Experience/Boundary) before being added.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1 §29 (Aggregate Map), the original source of the Aggregate classification this ADR formalizes.
- `docs/adr/ADR-PMF-002-workspace-boundary.md` — source of the Boundary classification.
- `docs/adr/ADR-PMF-007-command-center-operational-experience.md` — source of the Projection/Experience classification for Command Center.
- `docs/adr/ADR-PMF-008-project-intelligence-feed.md` — source of the Projection classification for the Project Intelligence Feed.
- `docs/adr/ADR-PMF-013-canonical-product-language.md` — establishes the naming-authority governance process this ADR's vocabulary additions follow.
- `docs/product-architecture/02-canonical-product-language.md` — §13 (Information Architecture Vocabulary), the companion document section this ADR ratifies as binding.
