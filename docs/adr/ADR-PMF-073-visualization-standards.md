# ADR-PMF-073: Visualization Standards — Question-First Visualization

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

No prior PR fixes a standard for when and why PMFreak shows a chart, graph, or other visual composition. Left unfixed, PR9+ implementation could default to the common enterprise-tool pattern of adding a chart to every screen that has numeric data available — a burndown chart because a project screen conventionally has one, a bar chart because a metric exists — regardless of whether any user actually needs the visual to answer a specific question. This is precisely the "dashboard financiero... wall of sparklines" pattern the sprint brief and `08-ux-principles.md` §1's visual-language goals reject.

## Decision

**Every visualization in PMFreak answers a named question, for a named persona, or it does not ship.** Full specification: `08-information-visualization.md` §1–§5.

## Frontend Rules

1. Before any future PR adds a visualization to a canonical screen, it names the question the visualization answers and the persona who asks it, in the same shape as `08-information-visualization.md` §2's question-to-visualization map.
2. "Why is this project behind" is answered by composing three specific visual forms — a Dependency graph, a resource conflict view, and a timeline deviation view — never a single generic burndown or Gantt chart standing in for the underlying cause (`08-information-visualization.md` §3).
3. `HealthIndicator` and `RiskBadge` (`08-design-system.md` §3) encode their qualitative band redundantly (color plus icon plus label), and a percentage is never shown without its qualitative band (`08-information-visualization.md` §4).
4. Every visualization has a keyboard- and screen-reader-accessible structured equivalent (a list/table of the same underlying data) — a chart or graph is never the only way to access the information it encodes (`08-accessibility-guidelines.md` §2).
5. No 3D, decorative, or novelty chart form is used; every visualization in the canonical question map is a standard, immediately legible form chosen for speed of comprehension (`08-information-visualization.md` §5).

## Alternatives Considered

- **Allow any chart type a future implementation team finds visually appealing, governed only by brand consistency.** Rejected: visual appeal without a named question is exactly the decoration this ADR exists to prevent — `08-ux-principles.md` §2 Principle 9 already states the interface never asks a user to interpret raw data it could have already interpreted, and an appealing-but-unexplained chart fails that test regardless of its aesthetics.
- **Standardize on one universal chart library and let each screen's author choose freely from its full chart-type catalog.** Rejected at the architecture stage: the library choice is legitimately open (`08-design-system.md` §6) and is not this ADR's concern; conflating "which library" with "which visualizations are justified" would let library flexibility smuggle in ungoverned chart proliferation.

## Positive Consequences

- Gives every future visualization a two-part justification test (named question + named persona) that is directly reviewable against `08-information-visualization.md` §2's map, rather than a subjective "does this look good" review.
- Keeps PMFreak's visual language aligned with its stated tone (trustworthy, clear, in control) by structurally ruling out the chart-wall pattern associated with generic financial/analytics dashboards.

## Negative Consequences

- Requires a documented justification step before adding any new visualization, adding friction relative to "just add a chart" — a deliberate trade favoring intentional information design over speed.

## Risks

- **Under-visualization risk:** overly strict application of "no chart without a named question" could suppress a visualization a user would find genuinely useful but that wasn't anticipated in the initial question map — mitigated by `08-information-visualization.md` §2's map being explicitly illustrative, not exhaustive, and extensible by any future PR that derives a new row the same way (question first, persona named).

## Security and Data Implications

- Visualizations respect the same tenancy/authorization boundaries as the Queries they render (`05-tenancy-rls-and-data-security.md`) — this ADR does not alter data access, only presentation justification.

## Application Implications

- None — no new Query, Command, or entity is introduced; visualizations render Query results `06-query-catalog.md` already ratifies.

## Frontend Implications

- Establishes the standard `08-information-visualization.md` specifies in full, consumed wherever `08-command-center-experience.md`'s Execution Health/Attention Required zones or `08-ai-interaction-patterns.md`'s Evidence Panel render a visual composition.

## Migration Implications

- Any current-state chart with no traceable question/persona justification is flagged during migration (`07-frontend-migration-strategy.md`) as a candidate for removal or redesign against this ADR, not carried forward by default.

## Compatibility Implications

- Compatible with any charting/visualization library chosen later (`08-design-system.md` §6, open) — this ADR fixes justification and encoding standards, not implementation technology.

## Out of Scope

- Exact chart library or rendering technology.
- Exhaustive visualization catalog for all fifty canonical screens — `08-information-visualization.md` §2's map is illustrative; full coverage is a PR9+ implementation-time exercise following this ADR's standard.

## Validation

Validation criteria: (1) every visualization named in `08-information-visualization.md` §2 has both a named question and a named persona; (2) `HealthIndicator` and `RiskBadge` specifications confirm redundant, non-color-only encoding per Frontend Rule 3.

## References

- `docs/product-architecture/08-information-visualization.md`
- `docs/product-architecture/08-ux-principles.md` §2 Principle 9
- `docs/product-architecture/08-design-system.md` §3
