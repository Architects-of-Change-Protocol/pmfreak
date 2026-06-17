# Decision Effectiveness Foundation

## What Effectiveness Means

Decision effectiveness is the ability to answer, with evidence:

> Which decisions consistently produced good outcomes?

Effectiveness in PMFreak is **structured intelligence**, not a score. It is a set of factual measurements and explicit classifications derived from observable events: when a decision was approved, when it was implemented, what outcomes were recorded, what patterns emerged.

Effectiveness is:

- **Inspectable** — every field can be read and understood without a model
- **Explainable** — every metric traces to a source timestamp, count, or record
- **Exportable** — the full record can be exported as JSON and shared outside the system
- **Reproducible** — given the same inputs, the same metrics are always computed
- **Auditable** — every state change emits a governance event with `learningEligible: false`

## What Effectiveness Does Not Mean

Effectiveness is **not** a score. It is not:

- An `effectiveness_score` from 0 to 100
- A `success_probability` prediction
- A `risk_probability` assessment
- A ranking or leaderboard of decisions
- A machine-learning recommendation
- An AI-generated insight

The absence of scoring is intentional and constitutional. Scores are black-box outputs that hide the reasoning. PMFreak provides the raw, inspectable measurements instead, so teams can apply their own judgment.

## Difference Between Metrics and Scoring

| Concept | Metrics (PMFreak) | Scoring (Not in PMFreak) |
|---------|-------------------|--------------------------|
| Definition | Factual measurements | Derived numeric aggregate |
| Source | Observable timestamps and counts | Model or formula |
| Reproducibility | Always deterministic | May vary by model version |
| Explainability | Every field has a clear source | "Black box" |
| Auditability | Every change is a governance event | Often not tracked |
| Transparency | Full export available | Usually opaque |

PMFreak collects:

- `approval_duration_seconds` — time from decision creation to approval
- `implementation_duration_seconds` — time from approval to implementation
- `time_to_outcome_seconds` — time from decision creation to outcome/closure
- `evidence_count` — number of evidence items linked to the decision
- `outcome_count` — number of outcomes recorded
- `pattern_count` — number of organizational patterns correlated

These are facts. No weighting. No aggregation into a score.

## Decision → Implementation → Outcome → Pattern

Every effectiveness record traces the full lifecycle:

```
Decision
  │
  ├── created_at          (when the decision was proposed)
  ├── approved_at         (when it was approved)
  │
  └── Implementation
        │
        ├── implemented_at  (when it went into effect)
        │
        └── Outcome
              │
              ├── outcome_status  (success / partial_success / failure / unknown)
              ├── recorded_at     (when the outcome was observed)
              │
              └── Pattern
                    │
                    └── organizational_patterns.id  (correlated, not derived)
```

The lineage is always traceable. No step is hidden or inferred.

## Outcome Classification

Outcome classifications are explicit, not computed:

| Classification | Meaning |
|----------------|---------|
| `success` | All recorded outcomes have `outcome_status = success` |
| `partial_success` | At least one outcome succeeded; at least one did not |
| `failure` | All recorded outcomes have `outcome_status = failure` |
| `unknown` | No outcomes recorded, or outcomes are inconclusive |

Classifications are stored explicitly in `outcome_classification`. They are not recalculated on read. If the classification needs to change, the record must be archived and recreated — preserving audit integrity.

## Effectiveness Statuses

| Status | Meaning |
|--------|---------|
| `candidate` | Newly created; under review; can be updated |
| `validated` | Confirmed effective record; **immutable** |
| `archived` | Superseded or retired; cannot be re-activated |

Validated records are immutable by database trigger. To update a validated record, it must be archived and a new record created. This preserves the audit trail.

## Observations

Every effectiveness record can accumulate observations. Each observation:

- Points to a specific source (`source_type`, `source_id`)
- Provides a human-readable `summary`
- Is classified by `observation_type`
- Records the `recorded_at` timestamp

Observations allow teams to build an evidentiary log over time without modifying the core effectiveness record.

## Capability Vocabulary

The following capability names are defined for future governance integration:

- `DECISION_EFFECTIVENESS_CREATE` — create a new effectiveness record
- `DECISION_EFFECTIVENESS_READ` — read effectiveness records and observations
- `DECISION_EFFECTIVENESS_EXPORT` — export a full effectiveness package as JSON
- `DECISION_EFFECTIVENESS_ARCHIVE` — archive an effectiveness record
- `DECISION_EFFECTIVENESS_INSPECT` — inspect the full lineage and evidence

> Capability enforcement is prepared but not fully wired yet. These names are reserved for future AOC protocol integration.

## Audit Events

Every state change emits a platform event with `learningEligible: false`:

| Event | Trigger |
|-------|---------|
| `DECISION_EFFECTIVENESS_CREATED` | New effectiveness record created |
| `DECISION_EFFECTIVENESS_UPDATED` | Candidate record updated |
| `DECISION_EFFECTIVENESS_ARCHIVED` | Record archived |
| `DECISION_EFFECTIVENESS_OBSERVATION_RECORDED` | Observation added |

All events include `correlation_id` (the decision ID) and `causation_id` to enable full lineage reconstruction from the event stream.

## Cross-Workspace Isolation

Row-level security (RLS) is enabled on all tables. All policies require `is_workspace_member(workspace_id)`. A user cannot read or write effectiveness records belonging to a workspace they are not a member of.

## What This Is Not

- **Not AI** — no language model is involved in any computation
- **Not ML** — no model is trained or applied
- **Not a dashboard** — no aggregated views or trend charts
- **Not a recommendation engine** — no suggested actions
- **Not a forecaster** — no future-state predictions
- **Not a ranker** — decisions are not ordered by score

PMFreak can explain, with evidence, how effective a decision was — without using AI, prediction, scoring, or black-box logic.
