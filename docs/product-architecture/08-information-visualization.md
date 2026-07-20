# PR8 Companion — Information Visualization

Status: Documentary architecture (no implementation)
Parent: `08-canonical-ux-design-architecture.md`
Authority: `08-ux-principles.md` §2 Principle 9, `08-command-center-experience.md`, `08-ai-interaction-patterns.md` §5, ADR-PMF-073

Purpose: fix the standard every chart, graph, or visual composition in PMFreak is judged against, and name the specific visualizations PMFreak's canonical questions require. PR8 does not catalog a chart library — it catalogs the questions PMFreak's screens must answer visually, and the shape of visual that answers each one.

## 1. Every Visualization Answers a Question

No visualization exists because a screen "should have a chart." Each one is designed backward from a question a persona (`08-ux-principles.md` §3) actually asks:

```
Incorrect:                          Correct:

Burndown chart, because             "Why is this project behind?"
every project screen has one.       →
                                     Dependency graph
                                     Resource conflict view
                                     Timeline deviation view
```

Before any future PR adds a visualization to a canonical screen, it must name the question the visualization answers and the persona who asks it, using the same table shape as §2. A visualization with no named question is decoration, not information architecture, and is rejected under `08-ux-principles.md` §2 Principle 9.

## 2. Canonical Question → Visualization Map

| Question | Persona | Visualization | Screen |
| --- | --- | --- | --- |
| Why is this project behind? | PM | Dependency graph + resource conflict view + timeline deviation | Project Command Center, Dependencies register |
| What needs my attention right now? | PM, PMO Manager | Attention Required zone (ranked list, not a chart) | Command Center (`08-command-center-experience.md` §1) |
| Where is the portfolio degrading? | PMO Manager | Health rollup by Program/Project, ranked by trend direction | PMO Command Center |
| Are resources over-allocated? | PMO Manager | Resource conflict view (allocation vs. capacity, by person/team) | PMO Command Center, Resource views |
| Do I need to intervene? | Executive | Strategic risk summary, investment status, Decisions-needed count | Executive Brief |
| Why should I trust this Recommendation? | Any reviewer | Evidence Panel (`08-ai-interaction-patterns.md` §5) | Wherever a Recommendation is shown |
| What changed since I last looked? | PM, PMO Manager | Delta/trend indicator on Health and Attention Required counts | Command Center |
| Is this Agent doing what it should? | Any reviewer, Administrator | Agent Run trace (`08-ai-interaction-patterns.md` §4) | Agent Center, Agent Run view |

This table is illustrative of the standard, not exhaustive of every screen in `03-screen-catalog.md` — a future PR extending it follows the same "question first" derivation, not a copy of an existing row's chart type for an unrelated question.

## 3. Dependency, Resource, and Timeline Visuals (Detail)

Named because "why is this project behind" is the single most common question PMFreak exists to answer better than a traditional PM tool, and because it requires composing three distinct visual forms rather than one chart:

- **Dependency graph** — a directed view of Dependency records (`01-canonical-domain-model.md`) showing which Task/Milestone blocks which; the visual answers "what is the critical path, and what is blocking it" — never merely "here is a list of dependencies."
- **Resource conflict view** — allocation vs. capacity, scoped to the entity in view; answers "who is over-allocated, and on what," derived from the same data `08-command-center-experience.md` §2's PMO Attention Required row surfaces, never a separately-maintained resource model.
- **Timeline deviation view** — planned vs. actual, scoped to Milestones/critical path; answers "how far behind, and since when," not merely "here is a Gantt chart" — the deviation itself is the visual's subject, not incidental to it.

Each of the three is independently reachable from the Project Command Center's Attention Required zone (`08-command-center-experience.md` §1) when a Risk or delay references it, per `08-ux-principles.md` §2 Principle 5 (progressive disclosure, not omission).

## 4. Health and Severity Encoding

`HealthIndicator` and `RiskBadge` (`08-design-system.md` §3) are the two visualizations every other Command Center widget composes from. Both encode a qualitative band (e.g., on-track / at-risk / critical) redundantly — color plus icon plus label — never color alone (`08-accessibility-guidelines.md` §4). A percentage (e.g., "Portfolio 87%") is always shown with its qualitative band, never a bare number a viewer must personally threshold.

## 5. What PMFreak Does Not Do

- Does not add a chart to a screen because a competing product has one.
- Does not visualize a metric with no owner persona/question (§1).
- Does not use 3D, decorative, or novelty chart forms — every visualization in §2's map is a standard, immediately legible form (ranked list, graph, allocation matrix, deviation line) chosen for speed of comprehension over visual novelty (`08-ux-principles.md` §1 visual-language goals: trustworthy, clear, in control — not a "dashboard financiero" wall of sparklines, per the founding brief).
- Does not require a legend to be understood at a glance for the four Enterprise Components in `08-design-system.md` §3 — severity and health are self-labeling (icon + text), not legend-dependent.

## Validation Notes

Every question, persona, and screen reference in §2's map traces to `03-canonical-information-architecture.md`'s screen catalog, `08-ux-principles.md`'s persona table, and `08-command-center-experience.md`'s zone model. No new entity, Query, or screen is introduced; this document fixes visualization selection and encoding standards only. No chart library, code, or component was created or modified to produce it.
