# ADR-PMF-070: Command Center Experience — Fixed Four-Zone Composition

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`03-canonical-information-architecture.md` §11 ratifies six Command Centers (Enterprise, Workspace, PMO, Portfolio, Program, Project) as projections, and `07-canonical-frontend-architecture.md` §11 / ADR-PMF-065 already fix that a Command Center composes Query results rather than owning independent state. Neither document fixes the Command Center's *visual* shape — without that, six independently-designed Command Centers, one per entity level, would each drift toward "a grid of charts," the exact dashboard failure mode `08-ux-principles.md` and ADR-PMF-069 exist to reject, and toward six different layouts a user relearns at every entity boundary.

## Decision

**Every Command Center — regardless of entity — is composed of the same four zones in the same fixed order: Attention Required, AI Recommendations, Pending Decisions, Execution Health.** Full specification: `08-command-center-experience.md` §1–§2.

## Frontend Rules

1. The four-zone order is identical across all six Command Centers; only the Queries composed into each zone vary per entity level (`08-command-center-experience.md` §2's table).
2. A Command Center never fabricates zone content when its underlying Query returns nothing for that entity level — the zone renders its Empty state; zone *presence* is structural, zone *population* is data-dependent.
3. Every item within a zone is a rendering of a record with its own canonical home screen (Risk, Issue, Recommendation, Agent Proposal) — a Command Center never becomes the only place a piece of data lives, and every zone item links to its home screen (restating ADR-PMF-065 at the UX layer).
4. One composed Query failing degrades only its own zone (`DependencyUnavailable` on the Health rollup, for instance) — the other three zones render normally; a Command Center never blanks entirely because one source failed.
5. Each zone independently implements Loading (skeleton matching populated shape), Populated, Empty (stated positive, not a bare "nothing here"), and Error/Degraded (scoped retry) states.

## Alternatives Considered

- **Let each of the six Command Centers define its own zone layout, tailored to its entity's specific needs.** Rejected: this reproduces exactly the drift this ADR exists to prevent, and breaks the "PMFreak scales from an Independent PM's Workspace to a multi-Workspace Enterprise without re-learning its primary surface" property the fixed shape provides.
- **A three-zone model, merging AI Recommendations into Pending Decisions.** Rejected: a Recommendation is content to evaluate; a pending-approval count is a call to action — merging them re-introduces the Recommendation/Decision visual conflation ADR-PMF-030 and ADR-PMF-069 forbid.
- **Blank the entire Command Center on any single zone's data failure (all-or-nothing rendering).** Rejected: per `07-command-query-and-error-experience.md`'s Degraded state, a composite view with one failing source should degrade gracefully, not become unusable — an Executive checking "do I need to intervene" should not lose the entire Executive Brief because one lower-priority Query timed out.

## Positive Consequences

- Gives every Command Center a checkable conformance test: does it implement the four zones, in order, per §1–§2? A future PR's Command Center screen is reviewable against this ADR directly.
- Makes the composition-not-ownership rule (ADR-PMF-065) concrete and testable at the UX layer — every zone item's link-to-home-screen requirement is a specific, verifiable property.

## Negative Consequences

- Requires every entity level's Command Center to define a Query mapping into all four zones even where an entity level has thin data (e.g., a newly-created Workspace with no Projects yet) — mitigated by the Empty-state requirement (Frontend Rule 2), not by omitting the zone.

## Risks

- **Zone starvation risk:** an entity level whose Attention Required and Pending Decisions zones are persistently empty could make the Command Center feel like dead weight — mitigated by the Empty state's requirement to state a positive ("No open risks — this project is on track") rather than a neutral absence, keeping the zone informative even when empty.

## Security and Data Implications

- None beyond the existing tenancy/authorization rules each composed Query already enforces (`05-tenancy-rls-and-data-security.md`, `06-api-security-model.md`) — this ADR fixes composition and layout, not data access.

## Application Implications

- None — no new Query, Command, or projection is introduced; this ADR composes Queries `06-query-catalog.md` already ratifies into a fixed visual shape.

## Frontend Implications

- Establishes the canonical shape `08-command-center-experience.md` specifies in full and `08-user-journeys.md` assumes at every persona's primary landing surface.

## Migration Implications

- The current, non-canonical `/command-center` implementation referenced in `docs/ux/command-center-conversational-shell-audit.md` (crowded, same-weight metric cards, no deterministic zone separation) is explicitly superseded by this shape — it is legacy current-state UX debt evaluated against this ADR during migration (`07-frontend-migration-strategy.md`), not a prior authority PR8 must remain consistent with.

## Compatibility Implications

- Compatible with any charting/visualization library chosen later (`08-design-system.md` §6, open) and with `08-information-visualization.md`'s question-first visualization standard, which governs content *within* the Execution Health and Attention Required zones, not the four-zone shape itself.

## Out of Scope

- Exact widget-level layout within each zone (card size, grid columns) — implementation-time decision.
- Exact Query composition per entity level beyond the illustrative table in `08-command-center-experience.md` §2.

## Validation

Validation criteria: (1) every Command Center screen in `03-screen-catalog.md` maps to the four-zone shape with no additional or missing top-level zone; (2) every zone item in a future implementation links to its record's canonical home screen per Frontend Rule 3.

## References

- `docs/product-architecture/08-command-center-experience.md`
- `docs/adr/ADR-PMF-065-command-centers-projection-compositions.md`
- `docs/product-architecture/03-canonical-information-architecture.md` §11
