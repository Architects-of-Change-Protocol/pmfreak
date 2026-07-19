# ADR-PMF-017: Canonical Information Architecture

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`01-canonical-domain-model.md`) and PR1.1 (`01.1-domain-ratification.md`) established what PMFreak's domain *is* — the ratified Enterprise → Workspace → PMO → Portfolio → Program → Project hierarchy, its cardinalities, and the entities that hang off Project (Task, Milestone, Risk, Issue, Dependency, Decision, Recommendation, Action, Outcome). PR2 (`02-canonical-product-language.md`) established the single binding vocabulary for every one of those concepts. Neither PR answered a question the founder's brief for this PR poses directly: how does a user actually experience this domain — what screens exist, what appears first, what can be hidden, and how does a user move from one entity to another without the navigation itself reintroducing the confusion PR1 spent forty-plus sections documenting?

That confusion was concrete and severe before ratification: "Command Center" applied to five different objects simultaneously; "Portfolio" meant six unrelated things; the primary "create" call-to-action in the whole product created an entity whose name never appeared in its own UI. PR1.1 and PR2 fixed the *naming* and *domain* layers of this. Nothing yet fixes the *experience* layer — the actual screen inventory, the actual navigation graph, the actual disclosure rules a design or implementation PR would need in order to avoid recreating the same category of ambiguity in a different form (e.g. a screen that mixes two entities' data, or a navigation path that implies a relationship the domain model doesn't have).

This ADR ratifies the resolution of that gap: `docs/product-architecture/03-canonical-information-architecture.md`, together with its three companion documents (`03-screen-catalog.md`, `03-navigation-contracts.md`, `03-user-journeys.md`), as PMFreak's binding Information Architecture.

## Decision

**PMFreak's screens, navigation, and disclosure are governed by a single canonical Information Architecture, built strictly on top of the ratified domain model and vocabulary, and binding on every design and implementation PR from PR4 onward.** The IA is organized around ten principles (Domain before Screens, Navigation follows Domain, Progressive Disclosure, One Screen One Purpose, One Entity One Home, Context before Action, Create before Manage, Read before Configure, Experience over Navigation, Enterprise without Complexity), twelve Experience Layers, and a fifty-screen canonical inventory in which every screen traces to exactly one ratified entity or projection, and every ratified entity has exactly one Home screen.

This ADR does not reopen, reinterpret, or change anything ratified in PR1, PR1.1, or PR2. It is purely additive: it answers "how does a user reach and use what those PRs ratified," never "what does PMFreak's domain contain."

## Alternatives Considered

- **Defer Information Architecture until implementation (PR4) and let screen/navigation decisions emerge organically from engineering.** Rejected: this is precisely the pattern that produced the Command Center five-object collision PR1 found — screens and routes were built incrementally, by different sprints, without a governing IA, and drifted from the domain and from each other. A ratified IA before implementation is the direct, evidenced fix.
- **Let each entity's screen inventory be designed independently, PR by PR, as each entity (Portfolio, Enterprise, etc.) gets implemented.** Rejected: this would repeat the exact "layered on top of, or beside" pattern PR1's Executive Summary identifies as the root cause of the domain confusion, just at the experience layer instead of the domain layer. A single, complete IA — even for entities not yet implemented — is required so every future implementation PR builds toward the same structure.
- **Treat navigation/screens as purely a design concern outside the ADR process.** Rejected: PR1 already established that naming/structural ambiguity at any layer (domain, vocabulary, or experience) becomes user-facing and hard to unwind once implemented; the ADR process is exactly the mechanism this codebase uses to make a decision binding and checkable, and this decision is at least as consequential as the vocabulary decisions ADR-PMF-013 through -016 already ratified this way.

## Positive Consequences

- Gives PR4 (and every subsequent implementation PR) a single, checkable answer to "does this screen belong, and where" — every screen traces to a ratified entity (§32 of the IA document validates this exhaustively).
- Prevents the experience-layer equivalent of PR1's findings before any code is written, rather than discovering it after implementation the way PR1 had to.
- Establishes progressive disclosure as an architectural contract (§7 of the IA document) rather than an ad hoc per-feature decision, directly extending ADR-PMF-012's domain-level ruling into a concrete, five-plus-four-segment screen-visibility model.
- Gives design and engineering a shared, binding vocabulary for IA concepts themselves (Home, Command Center, Layer, Projection) consistent with ADR-PMF-015's structural vocabulary.

## Negative Consequences

- The screen inventory includes screens for entities that do not exist in the schema today (Enterprise, Portfolio) — these cannot be built until the corresponding domain-layer PRs land, meaning parts of this IA are aspirational by necessity, the same way parts of PR1.1's ratified hierarchy were.
- A fifty-screen canonical inventory is a large surface for a future PR4 to hold consistent; enforcement discipline (linting, review checklists) will be needed to keep implementation from drifting from this IA the way `navigation-hierarchy.ts` and `derived-lens-metadata.ts` drifted from each other in the current codebase (PR1 §11).

## Risks

- **Premature-lock risk:** ratifying a full IA before any of Portfolio/Program/Enterprise is schema-backed risks over-specifying screens whose real data shape isn't known yet. Mitigated by keeping this IA's per-screen contract (Purpose/Parent/Entity/Projection) minimal and implementation-agnostic — it specifies *what* and *where*, never *how* a screen is built.
- **Drift risk:** without enforcement tooling, a future implementation PR could add a screen that doesn't trace to this inventory, recreating exactly the drift this ADR exists to prevent. Flagged as an open follow-up for PR4, not resolved by this ADR.

## UX Implications

This is, in its entirety, a UX/experience-architecture decision. It specifies twelve Experience Layers, a fifty-screen inventory, a navigation model, a progressive-disclosure model, entry/creation flows, a Command Center architecture, ownership/visibility matrices, and journey maps — all detailed in `03-canonical-information-architecture.md`. No UI, route, or component is changed by this ADR itself.

## Implementation Implications

No implementation is performed by this ADR. PR4 and subsequent implementation PRs must build screens, routes, and navigation that conform to this IA; any implementation PR that introduces a screen not in the canonical inventory, or a navigation edge not in the Navigation Edge Contract (`03-navigation-contracts.md` §1), is non-conformant and must be reconciled with this ADR (either by updating the implementation, or by a future ADR amending the IA — this document is not immutable, but it is binding until superseded).

## Future Evolution

As Portfolio, Program's FK connections, and Enterprise move from ratified-but-unimplemented to real schema, this IA's screens for those entities move from aspirational to buildable without requiring a new IA decision — the screens, their ownership, and their navigation rules are already specified. Future ADRs may extend this IA (e.g. formally ratifying Government/Portfolio Office as plan tiers, per the Open Questions in `03-canonical-information-architecture.md` §34) but may not contradict it without explicitly superseding this record.

## Compatibility Implications

Backward compatible: no existing route, component, or screen is renamed, removed, or altered by this ADR. Existing architecture documentation (`docs/architecture/command-center-foundation.md`, `docs/architecture/workspace-pmo-project-hierarchy.md`) is not required to be rewritten retroactively; any *new* screen or navigation work must conform to this IA going forward.

## Out of Scope

- Visual design, layout, component structure, and exact widget composition (PR4).
- Executing any of the screen/route renames or splits this IA implies (e.g. splitting the current mixed-scope `/command-center` route) — future implementation PRs.
- Mobile-specific navigation collapse rules (flagged as an open question, `03-canonical-information-architecture.md` §34).
