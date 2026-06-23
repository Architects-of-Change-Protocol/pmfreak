# Operational Decision Engine

EPIC 4 — Sprint 4

Transforms Consequence Analyses into structured decision recommendations.

## Architecture

```
Focus Item
↓
Consequence Analysis
↓
Decision Alternatives
↓
Decision Evaluation
↓
Decision Scoring
↓
Decision Confidence
↓
Tradeoff Analysis
↓
Recommended Decision
↓
Decision Support
```

The engine extends the Project Operating System chain:

```
Constitution → Memory → Learning → Recommendation → Signal → Action
→ Commitment → Projection → Reality → Snapshot → Command Center
→ Focus Item → Consequence Analysis → Decision
```

## Alternative Model

Every decision originates from a consequence. The `generateDecisionAlternatives()` function maps the consequence's `focusType` to a set of pre-defined, domain-specific options:

| Focus Type | Alternatives Generated |
|-----------|----------------------|
| `authority` | `create_delegation`, `sponsor_intervention`, `governance_board_review` |
| `commitment` | `reassign_owner`, `extend_deadline`, `breach_commitment` |
| `execution` | `revise_projection`, `increase_resources`, `reduce_scope` |
| `governance` | `governance_review`, `corrective_action`, `escalation` |
| `risk` | `risk_mitigation`, `risk_transfer`, `risk_acceptance` |
| Unknown | Default 3-option fallback |

Each alternative includes: `optionName`, `optionDescription`, `optionType`, `pros[]`, `cons[]`, `estimatedEffort`, `estimatedRisk`.

## Evaluation Model

`evaluateDecisionOptions()` scores each alternative across 4 dimensions:

| Dimension | Weight | Basis |
|-----------|--------|-------|
| `governance_score` | 30% | Option type alignment with governance recovery |
| `execution_score` | 30% | Speed of resolution vs effort cost |
| `risk_score` | 25% | Estimated risk penalty vs impact score bonus |
| `health_score` | 15% | Pro/con balance + severity multiplier |

`overall_score = governance×0.30 + execution×0.30 + risk×0.25 + health×0.15`

All scores are bounded 0–100.

## Scoring Model

`calculateDecisionScore()` returns the maximum `overall_score` across all evaluated alternatives. This represents the quality of the best available decision (not the decision itself).

Scale: 0–100.

## Confidence Model

`calculateDecisionConfidence()` estimates confidence in the recommended decision on a 0.0–1.0 scale:

| Component | Max Weight |
|-----------|-----------|
| Evaluation spread (clear winner) | 0.35 |
| Escalation probability | 0.25 |
| Impact score | 0.20 |
| Alternative count (completeness) | 0.20 |

Result has 3-decimal precision.

## Tradeoff Model

`analyzeDecisionTradeoffs()` converts `pros[]` and `cons[]` from each alternative into structured `DecisionTradeoff` records with:

- `tradeoffType`: `"pro"` or `"con"`
- `description`: human-readable impact description
- `impactScore`: 0–100 severity of the tradeoff

An additional effort-cost `con` is automatically appended for each alternative.

## Decision Support Model

`generateOperationalDecisionSupport()` produces `OperationalDecisionSupport`:

```typescript
{
  decisionId:        string;
  recommendedOption: string;
  because:           string[];   // 2–4 explanatory reasons
  confidence:        number;
  score:             number;
}
```

The `because` array explains why the recommended option was selected in plain language.

## Decision Lineage

`getOperationalDecisionLineage()` reconstructs the 14-layer ancestry chain:

1. `constitution` → `project_constitutions`
2. `memory` → `operational_memory_entries`
3. `learning` → `learning_patterns`
4. `recommendation` → `recommendations`
5. `signal` → `governance_signals`
6. `action` → `governance_actions`
7. `commitment` → `governance_commitments`
8. `projection` → `execution_projections`
9. `reality` → `execution_realities`
10. `snapshot` → `project_os_snapshots`
11. `command_center` → `operational_command_centers`
12. `focus_item` → `operational_focus_items`
13. `consequence_analysis` → `operational_consequences`
14. `decision` → `operational_decisions`

## Use Cases

### Authority Gap → Decision

Input:
```yaml
focus_type: authority
severity: critical
escalation_probability: 0.84
```

Output:
```yaml
decision_options:
  - create_delegation       # score: 91
  - sponsor_intervention    # score: 63
  - governance_board_review # score: 58

recommended: create_delegation
score: 91
confidence: 0.84
```

### Overdue Commitment → Decision

Input:
```yaml
focus_type: commitment
severity: high
escalation_probability: 0.70
```

Output:
```yaml
decision_options:
  - reassign_owner   # score: 88
  - extend_deadline  # score: 61
  - breach_commitment # score: 31

recommended: reassign_owner
rationale: minimizes execution impact; highest confidence option
```

### Execution Drift → Decision

Input:
```yaml
focus_type: execution
severity: medium
```

Output:
```yaml
decision_options:
  - revise_projection   # score: 72
  - increase_resources  # score: 65
  - reduce_scope        # score: 60

recommended: revise_projection
```

## API

### Generate Decision

```typescript
import { generateOperationalDecision } from "@/lib/operational-decision";

const result = await generateOperationalDecision({
  workspaceId:   "...",
  consequenceId: "...",
  actorId:       "...",
});

if (result.ok) {
  console.log(result.data.decision_score);
  console.log(result.data.recommended_option_id);
}
```

### Get Full Analysis

```typescript
const analysis = await getOperationalDecisionAnalysis({
  workspaceId: "...",
  decisionId:  "...",
});

if (analysis.ok) {
  const { decision, options, evaluations, tradeoffs, recommendation, comparative, support } = analysis.data;
}
```

### Explain a Decision

```typescript
const explanation = await explainOperationalDecisions({
  workspaceId: "...",
  decisionId:  "...",
});

if (explanation.ok) {
  console.log(explanation.data.explanation);
}
```

### List Decisions

```typescript
const decisions = await listOperationalDecisions({
  workspaceId:      "...",
  decisionCategory: "governance",
  decisionStatus:   "recommended",
  minScore:         60,
  limit:            20,
});
```

## Audit Events

| Event | When |
|-------|------|
| `OPERATIONAL_DECISION_GENERATED` | Decision record created |
| `OPERATIONAL_DECISION_EVALUATED` | All options evaluated |
| `OPERATIONAL_DECISION_RECOMMENDED` | Best option selected |
| `OPERATIONAL_DECISION_ACCEPTED` | Human accepts recommendation |
| `OPERATIONAL_DECISION_REJECTED` | Human rejects recommendation |
| `OPERATIONAL_DECISION_ARCHIVED` | Decision archived |
| `OPERATIONAL_DECISION_SCORE_CALCULATED` | Score computed |
| `OPERATIONAL_DECISION_CONFIDENCE_CALCULATED` | Confidence computed |
| `OPERATIONAL_DECISION_TRADEOFF_ANALYZED` | Tradeoffs persisted |
| `OPERATIONAL_DECISION_LINEAGE_GENERATED` | Lineage reconstructed |

## Principles

1. Every decision originates from a consequence — no orphan decisions.
2. Every decision evaluates at least 3 alternatives.
3. Every recommendation is explainable and auditable.
4. PMFreak recommends. Humans decide.
5. Decisions are never executed automatically.
6. Workspace isolation is enforced at both application and database layers.
7. All state changes emit auditable platform events.

## Database Tables

- `operational_decisions` — master decision record with score, confidence, status
- `operational_decision_options` — individual alternatives with pros/cons
- `operational_decision_evaluations` — per-option scores across 4 dimensions
- `operational_decision_tradeoffs` — structured pro/con records per option

All tables use:
- `workspace_id` FK + RLS policy (`is_workspace_member`)
- Composite FK back to parent table (cross-workspace references impossible)
- Indexes on `workspace_id`, `consequence_id`, `decision_category`, `decision_status`, `decision_score`
