# Operational Brief Foundation

## What Is an Operational Brief?

An Operational Brief is a deterministic, auditable, explainable transformation of a `ConstitutionalBrief` designed for **execution and delivery audiences** — project managers, delivery leads, engineers, and coordinators who need visibility into tasks, milestones, dependencies, risks, blockers, escalations, coordination, and delivery status.

An Operational Brief does not invent knowledge. It reorganizes constitutional knowledge that already exists inside a `ConstitutionalBrief` into execution-focused sections. Every statement in an Operational Brief traces back to the source Constitutional Brief, Constitutional Context Package, Evidence Trace, Timeline, Contradictions, and Source Lineage.

---

## What an Operational Brief Is NOT

| Not this | Why |
|---|---|
| AI | No language models, no embeddings, no inference |
| Machine learning | No training data, no predictions, no model calls |
| Scoring | No risk scores, no delivery scores, no priority scores |
| Ranking | No task rankings, no priority lists, no weighted outputs |
| Recommendation engine | No suggestions, no next-steps, no mitigation advice |
| Prediction | No delivery forecasting, no milestone health forecasting |
| Autonomous reasoning | No independent decisions, no inferred conclusions |
| Task generator | No new tasks created from inference |
| Escalation advisor | No escalation paths recommended |
| Risk advisor | No mitigation suggestions generated |
| Persistence layer | No database tables, no migrations, no storage |

---

## Difference Between Brief Types

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
    └── Operational Brief
```

### Constitutional Brief

The foundation. Organizes a `ConstitutionalContextPackage` (selected memories, patterns, effectiveness records, bridge relationships, contradictions, evidence, timeline, knowledge domains) into a structured, auditable brief. Every downstream brief type transforms a Constitutional Brief — never a raw context package.

### Executive Brief

Transforms the Constitutional Brief for **executive consumption**. Focused on high-level key facts, knowledge domains, and chronological timeline highlights. Language is count-based and non-technical. No operational detail.

### Governance Brief

Transforms the Constitutional Brief for **governance and compliance audiences**. Focused on policy adherence, contradictions, unknowns, audit trails, and governance health. Language is precision-oriented and traceable.

### Operational Brief

Transforms the Constitutional Brief for **execution and delivery audiences**. Focused on tasks, milestones, dependencies, risks, blockers, escalations, coordination, and delivery records. Language is operational and count-based. No scoring. No forecasting. No recommendations.

---

## Operational Brief Sections

### Operational Summary

Always present. Provides a count-based summary of all operational content areas available in the constitutional brief. No conclusions. No recommendations. No predictions.

Example output:
> "This operational brief contains 5 execution records, 3 task records, 4 milestone records, 2 dependency records, 1 risk record, and 2 explicit contradictions supported by 18 evidence references."

### Execution Overview

Extracts explicitly available execution information from constitutional brief memories and patterns. No task generation. No next-step generation. No priority assignment.

Sources:
- `relevant_memories` section records
- `relevant_patterns` section records

### Task Overview

Includes only explicitly referenced task records from the constitutional brief. No new tasks created. No task status inferred. No task ownership inferred.

Sources:
- `relevant_effectiveness` section records

### Milestone Overview

Includes only explicitly referenced milestone records from the constitutional brief. No milestone health inferred. No dates forecast. No delivery predicted.

Sources:
- `timeline` section records

### Dependency Overview

Includes only explicitly referenced dependency records from the constitutional brief. No dependency risk inferred. No mitigation suggestions generated.

Sources:
- `bridge_relationships` section records

### Risk Overview

Includes only explicitly referenced risk records from the constitutional brief. No risk scores calculated. No impact predicted. No mitigation recommended.

Sources:
- Constitutional brief `contradictions`

Note: Risk section summary explicitly states "Not scored. Not ranked." to preserve auditability.

### Blocker Overview

Includes only explicitly available blocker information from the constitutional brief. No blockers inferred. No automatic classification.

Sources:
- `outstanding_unknowns` section records

### Escalation Overview

Includes only explicitly referenced escalation records from constitutional brief evidence. No escalation recommended. No escalation path generated.

Sources:
- Evidence trace entries with `recordType === "escalation"` or escalation-related `reasonIncluded`

### Coordination Overview

Includes only explicitly referenced coordination records. No stakeholder responsibility inferred. No coordination recommendations generated.

Sources:
- Pattern-type operational facts with `factType === "coordination"`

### Delivery Overview

Includes only explicitly referenced delivery records. No delivery forecast. No delivery confidence score. No delivery score.

Sources:
- Evidence trace entries with `recordType === "delivery"` or delivery-related `reasonIncluded`

Note: Delivery section summary explicitly states "Not forecasted." to preserve auditability.

### Contradictions

Reused directly from the Constitutional Brief. Not created, not resolved, not judged. Both sides of each contradiction are preserved as-is.

### Timeline Highlights

Reused from the Constitutional Brief timeline. Sorted chronologically. No invented events. No inferred chronology.

### Evidence Summary

Always present. Counts across all operational dimensions:

- `recordCount` — total records across all sections
- `evidenceCount` — total evidence references
- `executionCount` — records attributed to execution facts
- `taskCount` — records attributed to task facts
- `milestoneCount` — records attributed to milestone facts
- `dependencyCount` — records attributed to dependency facts
- `riskCount` — records attributed to risk facts
- `blockerCount` — records attributed to blocker facts
- `escalationCount` — records attributed to escalation facts
- `coordinationCount` — records attributed to coordination facts
- `deliveryCount` — records attributed to delivery facts
- `contradictionCount` — total contradictions

### Unknowns

Reused directly from the Constitutional Brief. Not created. Not inferred. Unknowns are transparency, not failures — they document what knowledge is absent rather than inventing knowledge to fill gaps.

---

## Why No Recommendations?

Recommendations require judgment about what a team _should_ do next. That judgment depends on context, strategy, stakeholder priorities, and organizational knowledge that cannot be reliably derived from a constitutional brief alone. Operational Briefs provide visibility into what is known — not advice about what to do with that knowledge.

## Why No Scoring?

Scores suggest measurable certainty about outcomes. Risk scores, priority scores, and delivery scores all imply predictive confidence that is not warranted by the available data. Scoring also introduces bias: once a score exists, it tends to drive decisions regardless of the underlying data quality. Operational Briefs present raw counts, not derived scores.

## Why No Forecasting?

Forecasting requires assumptions about future behavior that cannot be derived from past records alone. Milestone dates, delivery timelines, and blocker resolution windows depend on team capacity, external dependencies, and organizational conditions that are not encoded in the constitutional brief. Operational Briefs do not forecast.

## Why No AI?

AI introduces non-determinism. An Operational Brief generated today must be identical to an Operational Brief generated tomorrow from the same Constitutional Brief. AI models may produce different outputs for the same input, making audit trails unreliable. Operational Briefs must be fully deterministic, auditable, and explainable without any model inference.

---

## Audit Trail

Every Operational Brief emits three governance audit events via the platform events system:

| Event | When |
|---|---|
| `OPERATIONAL_BRIEF_GENERATED` | On `buildOperationalBrief()` |
| `OPERATIONAL_BRIEF_EXPLAINED` | On `explainOperationalBrief()` |
| `OPERATIONAL_BRIEF_EXPORTED` | On `exportOperationalBrief()` |

All events:
- `learningEligible: false` — Operational briefs do not feed learning systems
- `eventCategory: "governance"` — Categorized as governance events
- `visibility: "workspace"` — Scoped to the workspace
- `rawReferenceTable: "operational_brief"` — Reference anchor (no actual DB table)

---

## Persistence

Operational Briefs are NOT persisted. There is no `operational_briefs` database table. Operational Briefs are deterministic in-memory views of a `ConstitutionalBrief`. Given the same Constitutional Brief as input, the same Operational Brief is produced every time.

---

## Database Contract

The string `-operational-brief` is appended to `DATABASE_CONTRACT_VERSION` to mark that the system understands this type exists as a deterministic view. This does not create any database tables or migrations.
