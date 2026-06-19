# Project Constitutional Decision Governance

Sprint 4 — EPIC 1: Project Constitution

---

## Overview

Constitutional Decision Governance transforms project decisions into governed, auditable, and traceable institutional assets. Every relevant decision is recorded formally, associated with a legitimate authority, linked to verifiable evidence, and explicitly related to the active Constitution.

---

## Architecture

The system is composed of:

- **Migration** — 4 new tables with RLS, composite FK workspace isolation, and status/type check constraints
- **Database Contract** — Row types and selectable columns for all 4 tables
- **Platform Events** — `ConstitutionalDecisionEventType` (12 events) added to `PlatformEventType` union
- **Types** — `decision-types.ts` — all input/output types, result type, enums
- **State Machine** — `decision-state-machine.ts` — transition validation, terminal states
- **Service** — `decision-service.ts` — all 17 capabilities
- **Impact Analysis Engine** — `decision-impact-analysis.ts`
- **Amendment Integration Engine** — `decision-amendment-integration.ts`
- **Explain Capability** — `decision-explanation.ts`
- **Tests** — `tests/project-constitutional-decision-governance.test.mjs`

---

## Data Model

### constitutional_decisions

Primary entity. Records every formal decision.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace (RLS scope) |
| constitution_id | uuid | Owning constitution |
| title | text | Decision title |
| description | text | Optional description |
| decision_type | text | One of 12 types |
| context | text | Background context |
| problem_statement | text | Problem being resolved |
| recommended_option | text | Recommended alternative |
| selected_option | text | Final selected alternative name |
| decision_authority | text | One of 8 authorities |
| status | text | State machine status |
| created_by | uuid | Author |
| approved_by / approved_at | uuid / timestamptz | Approval metadata |
| executed_by / executed_at | uuid / timestamptz | Execution metadata |
| cancelled_by / cancelled_at | uuid / timestamptz | Cancellation metadata |
| deleted_at | timestamptz | Soft delete |

### constitutional_decision_options

Alternatives evaluated before deciding.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| decision_id | uuid | Parent decision |
| name | text | Option name |
| advantages / disadvantages | text | Trade-off analysis |
| estimated_cost / effort | text | Cost and effort estimates |
| selected | boolean | Only one true per decision |

### constitutional_decision_evidence

Information used to make the decision.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| decision_id | uuid | Parent decision |
| evidence_type | text | One of 10 types |
| reference_id | text | External reference (optional) |
| description | text | Evidence description |
| created_by | uuid | Who attached it |

### constitutional_decision_links

Relations to constitutional entities.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| decision_id | uuid | Parent decision |
| link_type | text | One of 8 link types |
| linked_entity_id | uuid | Referenced entity |

---

## State Machine

```
draft ──────────────┬──────────────────► cancelled (terminal)
  │                 │
  ▼                 │
proposed ───────────┤──────────────────► rejected (terminal)
  │                 │
  ▼                 │
approved ───────────┘
  │
  ▼
executed (terminal)
```

### Valid Transitions

| From | To |
|---|---|
| draft | proposed, cancelled |
| proposed | approved, rejected, cancelled |
| approved | executed, cancelled |
| rejected | — (terminal) |
| executed | — (terminal) |
| cancelled | — (terminal) |

---

## Decision Types

`scope` · `schedule` · `cost` · `quality` · `risk` · `resource` · `architecture` · `governance` · `constitutional` · `technical` · `vendor` · `operational`

---

## Decision Authorities

`sponsor` · `project_manager` · `steering_committee` · `governance_board` · `product_owner` · `client` · `architect` · `technical_lead`

---

## Evidence Types

`document` · `email` · `meeting` · `risk` · `issue` · `change_request` · `file` · `link` · `chat` · `approval`

---

## Link Types

`objective` · `constraint` · `amendment` · `risk` · `issue` · `milestone` · `deliverable` · `constitution_version`

---

## Capabilities

| Function | Description |
|---|---|
| `createConstitutionalDecision()` | Create a new decision in draft state |
| `updateConstitutionalDecision()` | Edit a draft decision |
| `addDecisionOption()` | Add an alternative option |
| `selectDecisionOption()` | Select one option (deselects others) |
| `attachDecisionEvidence()` | Attach evidence to a decision |
| `linkDecisionEntity()` | Link to a constitutional entity |
| `proposeDecision()` | Transition draft → proposed |
| `approveDecision()` | Transition proposed → approved (requires selected option) |
| `rejectDecision()` | Transition proposed → rejected |
| `executeDecision()` | Transition approved → executed |
| `cancelDecision()` | Cancel from draft, proposed, or approved |
| `listConstitutionalDecisions()` | Register with status/type/authority/date filters |
| `getDecisionTimeline()` | Ordered timeline of decision events |
| `traceDecisionLineage()` | Full lineage: decision + options + evidence + links + timeline |
| `generateDecisionImpactAnalysis()` | Categorised impact by link type |
| `generateAmendmentFromDecision()` | Create amendment draft from approved decision |
| `explainConstitutionalDecisionGovernance()` | Human-readable governance explanation |

---

## Amendment Integration

An approved or executed decision can generate a Constitution Amendment draft:

```
generateAmendmentFromDecision(input, decision)
  → createAmendment(draft)
  → linkDecisionEntity(linkType: 'amendment')
  → emit CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED
```

The amendment carries a bidirectional link back to the origin decision (Rule 14), maintaining full traceability from decision rationale to constitutional change.

---

## Traceability

The complete lineage can be reconstructed at any time:

```
Decision
  ↓ (evidence)
  Evidence Registry
  ↓ (links)
  Amendment
  ↓ (applied)
  Constitution Version
```

`traceDecisionLineage()` returns the full chain: decision record, all options evaluated, all evidence attached, all constitutional links, and the complete timeline of state transitions.

---

## Workspace Isolation

All tables enforce workspace isolation via:
- `workspace_id` column on every table
- Composite foreign key: `(decision_id, workspace_id)` referencing `constitutional_decisions(id, workspace_id)`
- RLS policies using `public.is_workspace_member(workspace_id)` on every table
- All service operations filter by `workspace_id` on every query

---

## Audit Events

All 12 events are emitted to `platform_events`:

```
CONSTITUTIONAL_DECISION_CREATED
CONSTITUTIONAL_DECISION_UPDATED
CONSTITUTIONAL_DECISION_PROPOSED
CONSTITUTIONAL_DECISION_APPROVED
CONSTITUTIONAL_DECISION_REJECTED
CONSTITUTIONAL_DECISION_EXECUTED
CONSTITUTIONAL_DECISION_CANCELLED
CONSTITUTIONAL_DECISION_OPTION_ADDED
CONSTITUTIONAL_DECISION_OPTION_SELECTED
CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED
CONSTITUTIONAL_DECISION_LINK_CREATED
CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED
```

Each event records: `workspaceId`, `actorId`, `correlationId` (decisionId), `rawReferenceTable`, `rawReferenceId`, and a structured `eventPayload`.

---

## Governance Rules

1. Every decision belongs to a Constitution.
2. Every decision must declare a decision authority.
3. Every decision must register context.
4. Every decision must register a problem statement.
5. Only Draft decisions can be edited.
6. Only Approved decisions can be executed.
7. Executed is a terminal state.
8. Rejected is a terminal state.
9. Cancelled is a terminal state.
10. Every state transition emits an audit event.
11. Workspace isolation is enforced on all operations.
12. A decision cannot be approved without a selected option.
13. Amendments can only be generated from Approved or Executed decisions.
14. Every generated amendment maintains a bidirectional link to the origin decision.

---

## Use Cases

**Recording a scope decision**

1. `createConstitutionalDecision({ decisionType: 'scope', decisionAuthority: 'steering_committee', ... })`
2. `addDecisionOption({ name: 'Reduce scope by 20%', advantages: '...', disadvantages: '...' })`
3. `addDecisionOption({ name: 'Keep scope, extend timeline', ... })`
4. `attachDecisionEvidence({ evidenceType: 'meeting', description: 'Steering committee minutes 2026-06-19' })`
5. `selectDecisionOption({ optionId: '...' })`
6. `proposeDecision()`
7. `approveDecision()`
8. `generateAmendmentFromDecision(...)` — creates amendment draft linked to this decision
9. `traceDecisionLineage()` — reconstructs complete institutional memory

**Impact analysis**

```
generateDecisionImpactAnalysis({ decisionId, workspaceId })
// Returns: affectedObjectives, affectedConstraints, relatedRisks,
//          relatedAmendments, relatedDeliverables, relatedMilestones,
//          totalImpactedEntities
```

---

## Non-Goals

- No UI, pages, or React components.
- No AI, ML, embeddings, scoring, or ranking.
- No memory systems or learning pipelines.
