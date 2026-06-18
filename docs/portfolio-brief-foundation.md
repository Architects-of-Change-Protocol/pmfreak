# Portfolio Brief Foundation

## What is a Portfolio Brief?

A Portfolio Brief is a deterministic, auditable, explainable, and exportable
view of a `ConstitutionalBrief` reorganized for portfolio-level visibility.

It surfaces explicitly documented information across:

- Projects
- Programs
- Workstreams
- Dependencies (cross-project)
- Risks
- Blockers
- Escalations
- Cross-project relationships
- Delivery records

A Portfolio Brief never invents knowledge. Every statement it contains is
traceable to the source `ConstitutionalBrief`, which is itself traceable to the
`ConstitutionalContextPackage`, evidence traces, timelines, contradictions, and
source lineage.

---

## What a Portfolio Brief Is NOT

- **Not AI.** No language model. No inference. No neural network.
- **Not machine learning.** No training data. No probabilistic outputs.
- **Not embeddings.** No vector representations.
- **Not semantic search.** No similarity matching.
- **Not prediction.** No future-state forecasting.
- **Not recommendation generation.** No suggested actions.
- **Not autonomous reasoning.** No independent conclusions.
- **Not autonomous decision making.** No prioritization of what to act on.
- **Not scoring.** No risk scores. No delivery scores. No project health scores.
- **Not ranking.** No ranking of projects, programs, risks, or workstreams.
- **Not prioritization.** No ordering by inferred importance.

---

## Difference Between Brief Types

### Constitutional Brief

The root brief. Transforms a `ConstitutionalContextPackage` into a structured,
auditable knowledge base. Contains memories, patterns, effectiveness records,
bridge relationships, contradictions, evidence traces, timeline, and unknowns.
Everything else is built from this.

### Executive Brief

Built from a `ConstitutionalBrief`. Reorganizes constitutional knowledge for
executive audiences. Focuses on key facts, knowledge domains, and
high-level summaries. No operational detail. No project breakdown.

### Governance Brief

Built from a `ConstitutionalBrief`. Reorganizes constitutional knowledge for
governance and compliance audiences. Focuses on authority, approvals,
delegations, capabilities, trust, and policy records.

### Operational Brief

Built from a `ConstitutionalBrief`. Reorganizes constitutional knowledge for
execution audiences. Focuses on tasks, milestones, dependencies, risks,
blockers, escalations, coordination, and delivery at the operational level.

### Portfolio Brief

Built from a `ConstitutionalBrief`. Reorganizes constitutional knowledge for
portfolio-level audiences: portfolio managers, program directors, and
cross-project stakeholders. Focuses on projects, programs, workstreams,
cross-project dependencies, risks, blockers, escalations, and delivery
visibility across the portfolio.

---

## Architecture Diagram

```
Constitutional Intelligence
↓
Constitutional Context Engine
↓
Constitutional Context Package
↓
Constitutional Brief
├── Executive Brief
├── Governance Brief
├── Operational Brief
└── Portfolio Brief
```

---

## Portfolio Brief Sections

### Portfolio Summary

Always included. A count-based text summary of all portfolio-relevant
information found in the constitutional brief. Uses counts only. No
recommendations. No conclusions. No predictions.

Example:
> "This portfolio brief contains 12 project-related records, 4 cross-project
> dependencies, 3 risk records, 2 blockers, 1 escalation, and 2 explicit
> contradictions supported by 31 evidence references."

### Project Overview

Includes only explicitly referenced project records, project evidence, and
project timeline entries from the constitutional brief.

Does not infer project status. Does not calculate project health. Does not
rank projects.

### Program Overview

Includes only explicitly referenced program records, program evidence, and
program timeline entries from the constitutional brief.

Does not infer program health. Does not forecast program outcomes.

### Workstream Overview

Includes only explicitly referenced workstream records, workstream evidence,
and workstream timeline entries from the constitutional brief.

Does not infer workstream relationships.

### Dependency Overview

Includes only explicitly referenced dependencies, dependency records,
dependency evidence, dependency contradictions, and cross-project dependency
records from the constitutional brief.

Does not infer dependency risk. Does not create dependency scores.

### Risk Overview

Includes only explicitly referenced risks, risk records, risk evidence, risk
contradictions, and risk timeline entries from the constitutional brief.

Does not score risks. Does not predict impact. Does not recommend mitigation.

### Blocker Overview

Includes only explicitly available blocker information from the constitutional
brief (records, evidence, timeline, contradictions).

Does not infer blockers.

### Escalation Overview

Includes only explicitly referenced escalations, escalation records, escalation
evidence, and escalation timeline entries from the constitutional brief.

Does not recommend escalation. Does not infer escalation paths.

### Cross-Project Overview

Shows explicitly documented relationships between projects, programs,
workstreams, dependencies, risks, and blockers from the constitutional brief.

Only uses explicit constitutional relationships. No inferred relationships.

### Delivery Overview

Includes only explicitly referenced delivery records, outcome records, milestone
records, and execution timeline records from the constitutional brief.

Does not forecast delivery. Does not calculate confidence. Does not generate
portfolio health scores.

### Contradictions

Reuses contradictions directly from the `ConstitutionalBrief`. Does not create
contradictions. Does not resolve contradictions. Does not judge contradictions.

### Timeline Highlights

Reuses the constitutional brief timeline sorted chronologically. Does not invent
chronology. Does not infer missing events.

### Evidence Summary

Counts only:
- Total record count
- Evidence count
- Project count
- Program count
- Workstream count
- Dependency count
- Risk count
- Blocker count
- Escalation count
- Contradiction count

### Unknowns

Reuses unknowns directly from the `ConstitutionalBrief`. Does not create
inferred unknowns. Unknowns are transparency, not failures.

---

## Why No Recommendations?

Recommendations require judgment about what matters most. Portfolio Briefs do
not have access to organizational priorities, stakeholder preferences, or
strategic context beyond what is explicitly in the constitutional brief.
Generating recommendations would be fabrication, not organization.

## Why No Scoring?

Scores create the impression of precision that does not exist. A risk score
implies a calculated probability. A project health score implies a measured
state. Neither exists in a Portfolio Brief — only explicitly documented records
from the constitutional brief.

## Why No Ranking?

Ranking projects, risks, or programs implies knowledge of their relative
importance. That knowledge does not come from the constitutional brief. Any
ranking would be invented, not constitutional.

## Why No Forecasting?

Forecasting delivery or program outcomes requires predictions about the future.
The constitutional brief contains only past and present evidence. Forecasting
from it would be fabrication.

## Why No AI?

AI (language models, ML, embeddings, semantic search) introduces probabilistic
outputs that cannot be traced to specific source records. Portfolio Briefs must
be fully traceable to constitutional evidence. AI-generated content breaks that
traceability.

---

## Audit Events

Every Portfolio Brief operation emits a platform event:

| Event | Emitted By |
|---|---|
| `PORTFOLIO_BRIEF_GENERATED` | `buildPortfolioBrief()` |
| `PORTFOLIO_BRIEF_EXPLAINED` | `explainPortfolioBrief()` |
| `PORTFOLIO_BRIEF_EXPORTED` | `exportPortfolioBrief()` |

All events:
- `learningEligible: false`
- `eventCategory: "governance"`
- `visibility: "workspace"`
- `rawReferenceTable: "portfolio_brief"`

---

## No Persistence

Portfolio Briefs are deterministic views. They are not stored in the database.
No tables. No migrations. They are computed on demand from the source
`ConstitutionalBrief` and remain fully reproducible.
