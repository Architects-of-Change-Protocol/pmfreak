# PMFreak Governance Event Layer

## What is `platform_events`?

`platform_events` is PMFreak's immutable, append-only event log.

It records structured facts about what happened across the platform: when projects are created, when risks escalate, when AI recommendations are accepted or rejected, when humans make governance decisions, and when project outcomes are documented.

This is the historical memory of the workspace. It is the foundation for:

- **Auditability** — what happened, when, by whom
- **Traceability** — why a decision was made (causation chain)
- **Organizational memory** — recurring patterns across projects
- **Personal PM memory** — how a PM tends to respond to risk signals
- **Learning feature extraction** — structured facts that can feed future ML pipelines without exposing raw data
- **AI recommendation feedback loops** — did the PM accept the AI's suggestion? Did it help?
- **AOC constitutional governance** — governance exceptions, policy triggers, constitutional reviews

---

## Core principle

> **Raw data belongs to the customer. Governance events record what happened. Learning features will later derive minimized patterns from these events.**

`platform_events` is not a raw data store. It never stores full document text, email bodies, contract text, or personally identifiable narrative content. It stores structured references and categorical facts.

---

## Foundational principles

> **Raw data belongs to the customer.**  
> **Events record what happened.**  
> **History is never rewritten.**  
> **Corrections are represented as new events.**

These principles are enforced at every layer of the stack.

---

## Why append-only?

Governance events must be trustworthy. If events can be edited or deleted, they cannot serve as an audit trail or as the basis for organizational memory.

### Database-level enforcement (P0-hardening migration)

`platform_events` has a `BEFORE UPDATE OR DELETE` trigger that fires unconditionally:

```sql
create trigger platform_events_immutability_guard
  before update or delete
  on public.platform_events
  for each row
  execute function public.prevent_platform_event_mutation();
```

This trigger raises an exception for any UPDATE or DELETE attempt, **including from the service role**. It cannot be bypassed by elevated privileges within the database. The only way to change the historical record would require a superuser (`pg_bypass_rls`) or a schema migration — both of which are audited events outside normal application flows.

### RLS enforcement

- No `UPDATE` policy exists on `platform_events`.
- No `DELETE` policy exists on `platform_events`.
- These policies cannot be added without a migration, which is a traceable, reviewed change.

### Application enforcement

The `createPlatformEvent` helper only issues `INSERT` statements. There are no update or delete helpers in this codebase.

### Correction pattern

If a factual error is discovered in an existing event, **do not attempt to mutate it**. The trigger will reject the attempt. Instead, emit a compensating event:

```ts
await createPlatformEvent({
  eventType: "HUMAN_DECISION_RECORDED",
  eventCategory: "decision",
  eventPayload: {
    decision_id: "new-uuid",
    supersedes_event_id: "uuid-of-original-event",   // reference the old event
    correction_reason_category: "data_entry_error",
    decision_type: "rejected",                        // corrected value
    decision_latency_bucket: "same_day",
  },
  // ...
});
```

---

## Project/workspace ownership integrity

Every event that references a `project_id` is validated to ensure that project belongs to the declared `workspace_id`. This is enforced at two layers:

### RLS layer (database)

The INSERT policy verifies the project/workspace relationship:

```sql
with check (
  is_workspace_member(workspace_id)
  and (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.workspace_id = platform_events.workspace_id
    )
  )
)
```

A cross-workspace event (workspace A + project B from workspace C) will be rejected by the database even if the insert is attempted via the service role.

### What this prevents

An attacker or buggy caller cannot create an event that links a project to a workspace it doesn't belong to. This protects the integrity of organizational memory — every event's workspace scope is authoritative.

---

---

## Raw data vs. governance events

| Concept | Raw Data | Governance Event |
|---------|----------|-----------------|
| Where stored | source tables (`risk_issue_records`, `projects`, etc.) | `platform_events` |
| Content | Full vendor contract text, PM notes, email thread | `{ risk_id: "...", severity: "high", category: "vendor_delay" }` |
| Mutability | May be updated | Append-only — never changed |
| Ownership | Customer's data | Platform governance fact |
| Future use | Customer-specific | May feed anonymized learning (when `learning_eligible = true`) |

### What to store in `event_payload`

Good:
```json
{
  "risk_id": "uuid",
  "risk_category": "external_vendor_delay",
  "severity": "high",
  "probability": "medium",
  "impact": "high"
}
```

```json
{
  "recommendation_id": "uuid",
  "recommendation_type": "risk_escalation",
  "confidence_bucket": "high",
  "affected_area": "delivery",
  "proposed_action_type": "escalate"
}
```

```json
{
  "outcome_id": "uuid",
  "success_status": "partial_success",
  "schedule_variance_bucket": "15_30_days",
  "budget_variance_bucket": "0_10_percent"
}
```

### What must never be stored in `event_payload`

- Full email body
- Full contract text
- Raw document content
- Vendor names, customer names, or personal names (unless event is `learning_eligible = false` and `sensitivity_level = confidential`)
- Passwords, secrets, tokens, API keys
- Long narrative descriptions

The helper `createPlatformEvent` rejects any payload containing these keys:
`full_email_body`, `full_contract_text`, `raw_document_text`, `password`, `secret`, `token`, `api_key`, `private_key`, `access_token`, `refresh_token`, `bearer_token`, `authorization`

---

## `correlation_id` and `causation_id`

These two fields support tracing event chains.

### `correlation_id`

Groups all events that belong to the same logical operation.

Example: A scope change flow generates several events — `SCOPE_CHANGE_REQUESTED`, a `HUMAN_DECISION_RECORDED`, and a `SCOPE_CHANGED`. Assign the same `correlation_id` to all three so they can be retrieved together.

```ts
const correlationId = crypto.randomUUID();

await recordScopeChangeRequestedEvent({ ..., correlationId });
await recordHumanDecisionEvent({ ..., correlationId });
```

### `causation_id`

Points to the `platform_events.id` that directly caused this event.

Example: An AI recommendation caused a human decision. Set `causation_id` on the decision event to the recommendation event's `id`.

```ts
const recResult = await recordAiRecommendationCreatedEvent({ ... });

await recordHumanDecisionEvent({
  ...,
  causationId: recResult.ok ? recResult.event.id : null,
});
```

---

## Event categories and types

### Categories

| Category | Description |
|----------|-------------|
| `project` | Project lifecycle events |
| `risk` | Risk creation, escalation, mitigation, closure |
| `dependency` | Dependency blocking, resolution, escalation |
| `scope` | Scope change requests and approvals |
| `recommendation` | AI recommendation lifecycle |
| `decision` | Human decisions and overrides |
| `outcome` | Project outcomes and variance records |
| `governance` | Governance checks, exceptions, policy triggers |
| `document` | Document add, update, review, approval |
| `stakeholder` | Stakeholder changes, delays, escalations |
| `financial` | Budget, PO, invoice events |
| `system` | Workspace creation, imports, integrations |

### Key event types

See `src/lib/platform-events/types.ts` for the full union type `PlatformEventType`.

---

## Usage

### Record an event directly

```ts
import { createPlatformEvent } from "@/lib/platform-events";

const result = await createPlatformEvent({
  workspaceId: "...",
  projectId: "...",
  actorId: user.id,
  actorType: "user",
  eventType: "RISK_CREATED",
  eventCategory: "risk",
  source: "user_action",
  learningEligible: true,
  rawReferenceTable: "risk_issue_records",
  rawReferenceId: risk.id,
  eventPayload: {
    risk_id: risk.id,
    risk_category: risk.category,
    severity: risk.severity,
  },
});
```

### Use domain wrappers (preferred)

```ts
import {
  recordRiskCreatedEvent,
  recordRiskEscalatedEvent,
  recordDependencyBlockedEvent,
  recordAiRecommendationCreatedEvent,
  recordHumanDecisionEvent,
  recordOutcomeRecordedEvent,
} from "@/lib/platform-events";

await recordRiskCreatedEvent({
  workspaceId,
  projectId,
  actorId: user.id,
  riskId: risk.id,
  riskCategory: "external_vendor_delay",
  severity: "high",
  probability: "medium",
  impact: "high",
});
```

### Query events

```ts
import { getPlatformEvents } from "@/lib/platform-events";

const result = await getPlatformEvents({
  workspaceId,
  projectId,
  eventType: "RISK_CREATED",
  fromDate: "2026-01-01T00:00:00Z",
  limit: 50,
});

if (result.ok) {
  console.log(result.events);
}
```

---

## `learning_eligible` flag

When `learning_eligible = true`, this event may be included in future anonymized learning pipelines (pattern extraction, outcome correlation, etc.).

**Default is `false`.** Set to `true` explicitly for events that:
- Contain only categorical/bucketed facts (no free text, no names)
- Are safe for anonymized use across workspaces
- Relate to outcomes, decisions, risk patterns, or AI recommendation responses

**Set to `false`** for:
- Events with `sensitivity_level = confidential` or `restricted`
- Events containing workspace-specific context that should not leave the workspace
- Governance exceptions and policy violations

---

## Table: `platform_events`

See migration `supabase/migrations/20260616000000_platform_events_foundation.sql`.

Note: there is also an existing `governance_events` table (from the `20260611000000_operational_evidence_decision_loop.sql` migration). That table is a narrowly-scoped operational rule-check log for risk/issue records within the evidence-to-decision flow. `platform_events` is the broader event sourcing layer that spans the entire platform.

---

## How this supports future organizational memory

The event log is designed so that future pipelines can:

1. **Derive patterns** — how often does a `RISK_ESCALATED` event follow a `DEPENDENCY_BLOCKED` event in a 3-day window?
2. **Correlate outcomes** — do projects that accepted AI recommendations early have better `budget_variance_bucket` distributions?
3. **Build PM profiles** — what is this PM's typical `decision_latency_bucket` for `risk_escalation` recommendations?
4. **Train sovereign learning models** — federated, per-tenant models trained on anonymized (`learning_eligible = true`) events

None of this is implemented yet. The event log is the prerequisite. Future epics will add:
- Feature extraction pipeline
- Organizational memory tables
- Personal PM memory tables
- Outcome correlation analysis
- AI recommendation feedback loops

---

## Security notes

- RLS is enabled. Workspace members can read and insert events for their workspace only.
- No UPDATE or DELETE policies exist — events are append-only.
- Service role (server-side helpers) can insert without RLS for system-generated events.
- The `createPlatformEvent` helper recursively scans `event_payload` at any nesting depth and rejects events containing forbidden keys (e.g. `token`, `api_key`, `password`, `full_email_body`) before any database write. The error includes the full dotted path to the offending key (e.g. `data.credentials.api_key`).
- The immutability trigger (`prevent_platform_event_mutation`) blocks all UPDATE and DELETE operations at the database level, including from the service role.
