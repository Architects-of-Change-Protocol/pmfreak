# ADR-PMF-018: Navigation Contracts

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 documented, with direct code citations, that PMFreak's current navigation has no single source of truth: sidebar labels come from `navigation-hierarchy.ts`, breadcrumb labels come from `derived-lens-metadata.ts`, and per-page `<h1>` banners are a third, independent source — and these three disagree with each other on multiple routes simultaneously (PR1 §11, e.g. the `/command-center` route showing a 3-way mismatch between sidebar "Execution," breadcrumb "Delivery Status," and page banner "Command Center"). PR1 also found that breadcrumbs and navigation currently make claims the domain model doesn't support — e.g. `/portfolio`'s breadcrumb reading "Project Controls" while its `<h1>` reads "Portfolio," for a screen whose actual data has no PMI-Portfolio semantics at all.

ADR-PMF-017 ratified the canonical screen inventory those navigation labels must eventually point at. This ADR ratifies the second half of that problem: the actual *rules* governing how a user moves between screens — which entity-to-entity transitions are valid, what a breadcrumb is allowed to show, what happens on creation and on access revocation, and what context must survive a navigation action. Without this ADR, a future implementation PR would have a screen inventory but no contract for how those screens connect — leaving exactly the kind of "three uncoordinated sources of navigation truth" gap PR1 found room to recur.

## Decision

**PMFreak navigation is governed by a single Navigation Edge Contract, a single Breadcrumb Contract, and a fixed, closed set of permitted redirects — documented exhaustively in `docs/product-architecture/03-navigation-contracts.md` — and no other navigation rule, label source, or redirect exists outside that contract.** Every entity-to-entity navigation edge must correspond to a ratified relationship in the domain model (`01.1-domain-ratification.md`); no navigation UI may imply a relationship the domain model does not have. Breadcrumbs always reflect a screen's actual ancestry, never a hypothetical or decorative one, and Command Center is always the breadcrumb's terminal node, never a mid-trail level (consistent with ADR-PMF-014 Rule 4). Only three redirect classes are permitted: post-authentication, post-creation (always to the created entity's own Home, never a management screen), and access-revocation.

## Alternatives Considered

- **Leave breadcrumb/label logic as an implementation-time decision per screen.** Rejected: this is the exact status quo PR1 documented as broken — three uncoordinated sources producing simultaneous disagreement on the same route. A single ratified contract is the direct fix.
- **Allow navigation shortcuts that "feel faster" even where they'd imply an unratified relationship** (e.g. a direct Project → Portfolio link regardless of whether the Project has a primary Portfolio). Rejected: this reintroduces the "Portfolio = six unrelated meanings" defect at the navigation layer instead of the naming layer — a navigation edge that doesn't correspond to a real relationship is exactly as ambiguous as a word that doesn't correspond to a real entity.
- **Permit arbitrary redirects (e.g. redirecting incomplete profiles, onboarding nudges, feature announcements) alongside the three listed classes.** Rejected for this ADR's scope: an open-ended redirect policy is how the current PMO-before-Project onboarding block (`getting-started-flow.tsx:359-371`, cited in ADR-PMF-006/007) came to exist in the first place. Closing the set to exactly three classes makes "is this redirect allowed" a mechanically checkable question.

## Positive Consequences

- Closes the specific 3-way and 2-way label-disagreement defects PR1 found, by giving breadcrumb, sidebar, and page-heading labels one shared source of truth (the canonical screen names in ADR-PMF-017's inventory) instead of three independently-maintained ones.
- Makes "is this navigation link valid" mechanically checkable: does the edge appear in the Navigation Edge Contract table. This is testable in the same way ADR-PMF-014's "is Command Center entity-qualified" rule is testable.
- Directly outlaws the current onboarding redirect that blocks Project creation behind PMO creation, by closing the permitted-redirect set to three classes, none of which is "gate a lower-level creation behind a higher-level one."
- Gives Guests, Consultants, and Enterprise-segment users an explicit, asymmetric navigation contract (§6, §2.3 of the Navigation Contracts document) instead of leaving cross-tenant/cross-client navigation behavior to be inferred per screen.

## Negative Consequences

- Some navigation conveniences that exist informally in the current product (e.g. any implicit "jump to related item" links that don't correspond to a ratified edge) will need to be removed or reworked once implementation catches up to this contract — this ADR does not itself remove anything, but flags that a conformance gap will need remediation.
- The closed three-class redirect set is stricter than many SaaS products' typical onboarding-nudge patterns; product marketing/growth flows that would normally rely on ad hoc redirects will need a different mechanism (e.g. in-context banners) rather than navigation redirects.

## Risks

- **Enforcement risk:** like ADR-PMF-017, this contract has no automated enforcement mechanism specified yet; a future implementation PR could add a non-conformant navigation edge without a lint rule catching it. Flagged as an open follow-up, not resolved here.
- **Migration-sequencing risk:** because several edges in the Navigation Edge Contract (PMO↔Portfolio, PMO↔Program, Portfolio↔Program) reference entities not yet in the schema (Portfolio) or not yet FK-connected (Program), those edges cannot be implemented until the corresponding domain-layer migrations land — this ADR ratifies the *rule*, not the current buildability of every edge.

## UX Implications

Every breadcrumb, sidebar link, quick action, and redirect in the product must conform to this contract once implemented. The user-visible effect is a navigation experience where breadcrumbs, headings, and links agree with each other by construction — not by per-screen review — and where no user is ever redirected into a creation flow they didn't choose.

## Implementation Implications

No route, component, or redirect is changed by this ADR. A future implementation PR must: consolidate `navigation-hierarchy.ts` and `derived-lens-metadata.ts` (or their successors) into a single label source keyed to this contract; remove the PMO-before-Project onboarding redirect; audit all breadcrumbs for mid-trail Command Center placement and unqualified entity claims.

## Future Evolution

As Portfolio and Program's FK connections are implemented, their corresponding Navigation Edge Contract rows become buildable without a new navigation decision — the edges are already specified. Any future navigation edge not in this contract requires a superseding or amending ADR before implementation, mirroring the discipline ADR-PMF-013 established for vocabulary changes.

## Compatibility Implications

Backward compatible: no existing route or redirect is altered by this ADR itself. Existing navigation code remains as-is until a future implementation PR brings it into conformance.

## Out of Scope

- Automated conformance tooling/linting for navigation edges (flagged as a future follow-up).
- The exact visual treatment of breadcrumbs, sidebars, or quick actions (PR4).
- Mobile navigation collapse behavior (flagged as an open question in the parent IA document).
