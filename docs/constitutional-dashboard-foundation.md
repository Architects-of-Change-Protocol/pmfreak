# Constitutional Dashboard Foundation

## What It Is

The Constitutional Dashboard Foundation is a deterministic, auditable, and exportable composition layer that surfaces existing constitutional artifacts — Executive Briefs, Governance Briefs, Operational Briefs, and Portfolio Briefs — into structured dashboard views.

Every widget on a constitutional dashboard is traceable to:

- A source Brief
- A source Context Package
- Evidence
- Timeline entries
- Lineage records

Dashboards are **not stored**. They are computed on demand from existing brief artifacts and are fully reproducible from the same inputs.

---

## What It Is Not

| Claim | Reality |
|-------|---------|
| AI | No. Zero AI. |
| Machine Learning | No. |
| Embeddings | No. |
| Semantic Search | No. |
| Vector Search | No. |
| Prediction | No. |
| Recommendation generation | No. |
| Scoring | No. |
| Ranking | No. |
| Prioritization | No. |
| Autonomous reasoning | No. |
| Autonomous decision making | No. |
| Invented conclusions | No. |

Dashboards only **compose** what already exists in brief artifacts. They never invent, infer, rank, score, or prioritize knowledge.

---

## Constitutional Hierarchy

```
Constitutional Intelligence
↓
Constitutional Context Engine
↓
Constitutional Brief
├── Executive Brief
├── Governance Brief
├── Operational Brief
└── Portfolio Brief
          ↓
Constitutional Dashboard
```

The Constitutional Dashboard sits at the top of the artifact composition stack. It aggregates and composes the four brief types without adding any new knowledge.

---

## Dashboard Types

### `executive`

Composes Executive Briefs into a dashboard focused on executive-level visibility.

Widgets included:
- Executive Brief widgets
- Evidence Summary widget
- Timeline widget
- Contradictions widget

### `governance`

Composes Governance Briefs into a dashboard focused on authority, delegation, capability, trust, and policy oversight.

Widgets included:
- Governance Brief widgets
- Evidence Summary widget
- Timeline widget
- Contradictions widget
- Unknowns widget

### `operational`

Composes Operational Briefs into a dashboard focused on execution, milestones, dependencies, risks, blockers, and escalations.

Widgets included:
- Operational Brief widgets
- Evidence Summary widget
- Timeline widget
- Contradictions widget
- Unknowns widget

### `portfolio`

Composes Portfolio Briefs into a dashboard focused on projects, programs, workstreams, cross-project dependencies, risks, and escalations.

Widgets included:
- Portfolio Brief widgets
- Evidence Summary widget
- Timeline widget
- Contradictions widget
- Unknowns widget

### `workspace`

Composes all four brief types into a unified constitutional dashboard covering the full workspace.

Widgets included:
- Executive Brief widgets
- Governance Brief widgets
- Operational Brief widgets
- Portfolio Brief widgets
- Evidence Summary widget
- Timeline widget
- Contradictions widget
- Unknowns widget
- Knowledge Domains widget

No ranking. No prioritization. No scoring. Only composition.

### `mixed`

Allows explicit dashboard composition using whichever brief types are provided. Only supplied artifacts are composed. No inference.

---

## Widget Model

Every widget (`ConstitutionalWidget`) contains:

| Field | Description |
|-------|-------------|
| `id` | Deterministic widget identifier derived from type and source brief(s) |
| `widgetType` | One of the 9 supported widget types |
| `title` | Human-readable title |
| `summary` | Count-based summary derived from source brief data |
| `sourceBriefs` | IDs of source briefs that produced this widget |
| `evidence` | Evidence items surfaced from source brief sections |
| `lineage` | Lineage entries from source brief sections |
| `metadata` | Structured metadata (counts, context, etc.) |

### Widget Types

| Widget Type | Source |
|-------------|--------|
| `executive_brief` | ExecutiveBrief |
| `governance_brief` | GovernanceBrief |
| `operational_brief` | OperationalBrief |
| `portfolio_brief` | PortfolioBrief |
| `evidence_summary` | Derived from brief evidence counts |
| `timeline` | Composed from brief timeline highlights |
| `contradictions` | Surfaced from brief contradictions |
| `unknowns` | Surfaced from brief unknowns |
| `knowledge_domains` | Aggregated from executive brief knowledge domains |

---

## Evidence Summary

The `DashboardEvidenceSummary` provides counts only — no interpretation:

| Field | Description |
|-------|-------------|
| `briefCount` | Number of source briefs |
| `widgetCount` | Number of widgets in the dashboard |
| `evidenceCount` | Total evidence items across all widgets |
| `contradictionCount` | Total contradictions surfaced from briefs |
| `unknownCount` | Total unknowns surfaced from briefs |

---

## Timeline Summary

The `timelineSummary` field on every dashboard:

- Collects all timeline highlights from all source briefs
- Sorts them **chronologically** (ascending by timestamp)
- Does **not infer** chronology
- Does **not synthesize** timeline entries
- Does **not create** new timeline events

---

## Contradictions

Contradictions are **surfaced** from source briefs, not created or resolved by the dashboard layer.

Rules:
- Reuse contradictions as-is from source briefs
- Do not create new contradictions
- Do not resolve contradictions
- Do not suppress contradictions

---

## Unknowns

Unknowns are **surfaced** from source briefs, not inferred by the dashboard layer.

Rules:
- Reuse unknowns as-is from source briefs
- Do not infer new unknowns
- Do not resolve unknowns

---

## Export

`exportConstitutionalDashboard()` produces a JSON export containing:

- `dashboard` — the full ConstitutionalDashboard
- `widgets` — all widgets
- `briefReferences` — all source brief references
- `evidenceSummary` — aggregated evidence counts
- `timelineSummary` — chronologically sorted timeline
- `contradictions` — all surfaced contradictions
- `unknowns` — all surfaced unknowns
- `exportedAt` — export timestamp
- `format: "json"` — always JSON

**No PDF. No UI. JSON only.**

---

## Auditability

Every dashboard operation emits a platform audit event:

| Event | When |
|-------|------|
| `CONSTITUTIONAL_DASHBOARD_GENERATED` | Dashboard is built |
| `CONSTITUTIONAL_DASHBOARD_EXPLAINED` | Dashboard is explained |
| `CONSTITUTIONAL_DASHBOARD_EXPORTED` | Dashboard is exported |

All events:
- `learningEligible: false`
- `eventCategory: "governance"`
- `visibility: "workspace"`
- `rawReferenceTable: "constitutional_dashboard"`
- `rawReferenceId: dashboard.id`

---

## Explanation

`explainConstitutionalDashboard()` returns a `ConstitutionalDashboardExplanation` containing:

- `dashboard` — the dashboard being explained
- `widgetReasons` — why each widget is included
- `sourceBriefs` — source brief references
- `evidence` — aggregated evidence from widgets
- `lineage` — aggregated lineage from widgets
- `unknowns` — surfaced unknowns

The explanation answers: **Why does this dashboard contain these widgets?**

---

## Health

`getDashboardHealth()` returns a `DashboardHealth` snapshot:

| Field | Description |
|-------|-------------|
| `widgetCount` | Total widgets |
| `briefCount` | Total source briefs |
| `timelineCount` | Total timeline entries |
| `contradictionCount` | Total contradictions |
| `unknownCount` | Total unknowns |
| `coverageMetrics` | Boolean flags for each brief type coverage |

---

## Why No AI

Constitutional Dashboards are **governance artifacts**, not intelligence products. Their value comes from:

1. **Determinism** — same inputs always produce the same dashboard
2. **Traceability** — every displayed item traces to a source brief
3. **Auditability** — every operation is logged
4. **Human authority** — humans interpret dashboards, not AI

Introducing AI would compromise all four properties.

---

## Why No Scoring

Scoring implies a judgment about relative importance. The Constitutional Dashboard Foundation has no mandate to make such judgments. All briefs are equally valid artifacts of constitutional knowledge.

---

## Why No Prioritization

Prioritization requires a model of what matters more. The dashboard layer only presents what exists. Humans decide what to prioritize from the composed view.

---

## Persistence

Dashboards are **not persisted**. There are no database tables, no rows, no migrations. Dashboards are deterministic views computed from existing brief artifacts and can be reproduced at any time from the same inputs.

This is a constitutional guarantee: dashboards cannot contain knowledge that is not already in a source brief.
