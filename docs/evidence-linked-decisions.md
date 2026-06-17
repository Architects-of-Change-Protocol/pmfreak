# Evidence-Linked Decision Governance

PMFreak's Evidence-Linked Decision Foundation promotes important project choices from informal task notes into auditable governance records. The foundation does **not** introduce machine learning, prediction, dashboards, analytics, organizational memory, or personal memory. It establishes structured lineage only.

## Constitutional purpose

A future auditor should be able to answer:

> What evidence existed when this decision was approved?

without reading every uploaded document manually.

The governance chain is:

```text
Evidence
  → Recommendation
    → Human Decision
      → Approval
        → Outcome
```

## Decision Governance

`project_decisions` stores first-class decision records with workspace/project scope, type, status, rationale, optional recommendation linkage, single-approver metadata, creator metadata, lifecycle timestamps, and JSON metadata for non-breaking extensions.

Allowed statuses are `draft`, `pending_review`, `approved`, `rejected`, `implemented`, and `expired`. Allowed types cover risk responses, scope/schedule/budget/resource changes, stakeholder and vendor actions, governance exceptions, dependency resolutions, and `other`.

## Evidence relationships

`decision_evidence_links` keeps evidence outside the decision row. Decisions reference evidence by `evidence_id`, `evidence_type`, and a typed relationship:

- `supports`
- `contradicts`
- `required_for`
- `reviewed_during`
- `triggered_by`

This preserves lineage while avoiding duplicated document content or raw narrative in the decision registry.

## Approval lineage

Approval governance is deliberately simple: a single approver model. Approval captures `approved_by` and `approved_at`. Rejection captures `rejected_by` and `rejected_at`. More complex workflows can be added later without changing the core decision/evidence model.

## Platform event generation

Every lifecycle transition emits an append-only `platform_events` record using the decision category:

- `DECISION_CREATED`
- `DECISION_SUBMITTED`
- `DECISION_APPROVED`
- `DECISION_REJECTED`
- `DECISION_IMPLEMENTED`
- `DECISION_EXPIRED`

Events include the decision id as the raw reference, use `correlation_id` to bind lifecycle events, and accept `causation_id` when one decision event was caused by another platform event.

## Audit reconstruction

`buildDecisionLineage(decisionId)` reconstructs an audit package containing:

- the decision
- linked evidence references
- the source recommendation, when present
- approval/rejection metadata
- linked outcomes
- platform lifecycle events

`exportDecisionAuditPackage(decisionId)` returns a JSON-serializable export shape with the decision, evidence, approvals, outcomes, lineage, and events. No PDF, dashboard, or report generation is included.

## RLS and access model

The foundation follows the existing workspace membership model. Workspace members can read, create, and submit decisions and create lineage links. Approval and rejection use the existing workspace roles (`owner`, `admin`, `pm`) as approvers. No new authorization model is introduced.

## Future extension points

- **Organizational Memory:** can later consume approved decision outcomes as governed source material, but this foundation does not build memory.
- **Personal PM Memory:** can later reference decision participation, but this foundation does not store personal memory.
- **Sovereign Learning:** can later learn from explicitly eligible, governed, tenant-safe outcomes, but this foundation marks decision lifecycle events as non-learning by default.

## Example lifecycle

1. A PM creates a `budget_change` decision titled “Increase contingency budget”.
2. Supporting vendor quote and risk evidence are linked with `supports` and `triggered_by` relationships.
3. The decision is submitted for review, emitting `DECISION_SUBMITTED`.
4. A workspace approver approves it, capturing `approved_by` and `approved_at` and emitting `DECISION_APPROVED`.
5. Implementation closes the lifecycle with `DECISION_IMPLEMENTED`.
6. An auditor exports the audit package and can see the decision, evidence references, approval metadata, outcome links, and all lifecycle platform events.
