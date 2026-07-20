# ADR-PMF-065: Command Centers as Projection Compositions

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

`04-canonical-application-architecture.md` §9.5 already warns that "a projection must never become a source of truth by convenience," citing the current `pmo_command_center_snapshots`/`operational_command_centers` split (PR1 §12 C-3) as the incident where exactly that happened — two independently-written stores, neither clearly authoritative. `03-canonical-information-architecture.md` §11 separately ratifies that PMFreak's six Command Centers (Enterprise, Workspace, PMO, Portfolio, Program, Project) are "the same kind of thing applied to six different entities," each composed of widgets, none independently created. PR7 must decide whether the frontend implementation of a Command Center is built as a thin composition over existing Queries, matching that ratified model, or whether it is left free to accumulate its own client-side state — which would risk reproducing PR1's C-3 finding a second time, this time in the browser.

## Decision

**Every Command Center screen composes one or more Query results into widgets; it is never itself a source of truth and never accumulates durable client-side state a Command elsewhere doesn't already own. The Project Intelligence Feed is architected identically — a derived, composite projection, never an independent store of Chat, Evidence, RAID, Decision, or Task state.** Full specification: `07-canonical-frontend-architecture.md` §11.

## Frontend Rules

1. A Command Center Screen's data-fetching consists exclusively of composite/overview Queries already cataloged in `04-canonical-application-architecture.md` §14 (`GetXOverview`, `GetXHealth`, `GetProjectCommandCenter`, `GetProjectIntelligenceFeed`, `ListRecommendations`) — it never introduces a new, Command-Center-specific write path.
2. A Command Center's mutating actions (Approve Recommendation, Record Decision, Close Milestone) dispatch the same cataloged Commands any other screen would use — a Command Center never gets a shortcut/composite mutation unavailable elsewhere (restates ADR-PMF-030's four-distinct-Commands rule).
3. Each widget within a Command Center fails independently — one widget's source Query failing (`DependencyUnavailable`/`IntegrationError`) never blanks the entire screen (`07-command-query-and-error-experience.md` §8's Degraded state).
4. The Project Intelligence Feed's frontend representation holds no independent client-side accumulation of the sources it composes (Chat, Evidence, RAID, Decision, Task) — every render is a fresh (or cache-refreshed) composition from `GetProjectIntelligenceFeed`.

## Alternatives Considered

- **Let each Command Center accumulate its own client-side aggregate state for performance, refreshed independently of the underlying Queries.** Rejected: this is exactly the "projection becomes a source of truth by convenience" failure `04-canonical-application-architecture.md` §9.5 named — an independently-refreshed client aggregate could drift from the Queries it was meant to summarize, with no mechanism to detect the drift.
- **Build a Command Center as a special composite endpoint the frontend treats as authoritative rather than as a projection.** Rejected: `06-canonical-api-contracts.md` §8 already documents `GetProjectCommandCenter`-style Queries as Eventually-consistent projections, not authoritative reads — treating the frontend's consumption of them as anything stronger would misrepresent their actual consistency guarantee to the user.

## Positive Consequences

- Keeps every Command Center screen's correctness verifiable by checking its composing Queries, rather than requiring inspection of independent client-side aggregation logic.
- Makes the Degraded-state model (§8 of `07-command-query-and-error-experience.md`) a natural consequence of composition rather than a bolt-on special case.

## Negative Consequences

- A Command Center screen cannot show data faster than its slowest composing Query resolves, without an explicit per-widget loading state — no client-side shortcut around genuine backend latency.

## Risks

- **Composition-creep risk:** a future implementation under performance pressure could be tempted to cache a Command Center's composed result independently of its source Queries' own caching — mitigated by `07-frontend-state-and-data-architecture.md` §9's rule that cache invalidation follows documented per-Command effects on specific Queries, with no separate Command-Center-level cache layer introduced.

## Security and Data Implications

- No new data-access path is introduced — a Command Center's authorization surface is exactly the union of its composing Queries' authorization checks, keeping the authorization-review surface enumerable (the same fixed-surface benefit ADR-PMF-045 established for the API layer, extended to composite screens).

## Application Implications

- No change to PR4's projection layer (§9.5) or Query catalog; this ADR requires the frontend's consumption pattern to match what PR4 already specifies projections to be.

## Frontend Implications

- Establishes the Command Center composition model every module owning a Command Center screen (`07-frontend-module-boundaries.md` §2) must follow identically.

## Migration Implications

- Today's `/command-center` route (PR1 §11: mixes Project-level and cross-PMO Workspace-level data on one screen) is a named defect against this ADR, to be split along entity lines during migration (`07-frontend-migration-strategy.md`), not preserved as-is.

## Compatibility Implications

- Fully compatible with `06-canonical-api-contracts.md`'s existing composite-Query pattern; no API change required.

## Out of Scope

- The exact widget library/layout implementation of a Command Center screen.

## Validation

Validation criteria: (1) every Command Center screen's data-fetching in `07-canonical-frontend-architecture.md` §11 lists only cataloged Queries; (2) no Command Center screen's specification introduces a Command Center-specific Command or independent cache layer.

## References

- `docs/product-architecture/07-canonical-frontend-architecture.md` §11
- `docs/product-architecture/04-canonical-application-architecture.md` §9.5
- `docs/product-architecture/03-canonical-information-architecture.md` §11
- `docs/adr/ADR-PMF-020-command-center-experience-architecture.md`
- `docs/adr/ADR-PMF-014-command-center-naming.md`
