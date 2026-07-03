# Playbook Engine Foundation

## Overview

The Playbook Engine turns a delivery methodology into evaluable rules so that the LLM operates,
explains, and documents *within* the playbook instead of improvising project management decisions.
This document covers the Foundation layer — the seed playbook, its types, and the pure Rules Engine.

This is Sprint 1 of the Playbook Engine MVP. Later sprints build on this foundation:

1. **Seed Playbook + Types** (this document)
2. Project Constitution Generator — derives a draft `project-constitution` record from the playbook
3. Recommendation Engine v1 — persists governed recommendations from rule evaluations (draft/reviewed/approved)
4. Communications Playbook — generates draft communications (never sent automatically)
5. Risk/Issue/Dependency/Decision Intelligence — layers playbook rules over `raid` and `decision-governance`
6. Closure & Billing Intelligence
7. Audit Trail + demo-ready polish

---

## Architecture

```
Project Context (ProjectContextFacts)
        │
        ▼
Seed Delivery Playbook (phases + rules)
        │
        ▼
Rules Engine (evaluatePlaybookRules) — pure, no persistence
        │
        ▼
PlaybookRuleEvaluation[] — fired / not_fired / indeterminate, evidence used + missing
```

The Rules Engine is intentionally pure: it takes a `DeliveryPlaybook` and a `ProjectContextFacts`
object and returns evaluations with no side effects, no database access, and no invented data.
Downstream sprints (Recommendation Engine, Communications Playbook) are responsible for turning
these evaluations into governed, persisted, human-approvable artifacts.

---

## Data Model

### `ProjectContextFacts`

All fields except `projectId`, `workspaceId`, and `metadata` are nullable. `null`/`undefined` means
"unknown" — it is never treated as `false` and never invented.

| Field                        | Type                     | Description                                    |
|------------------------------|--------------------------|-------------------------------------------------|
| `phase`                      | `PlaybookPhaseKey \| null` | Current declared delivery phase                |
| `hasApprovedCharter`         | `boolean \| null`        | Project charter formally approved                |
| `hasApprovedConstitution`    | `boolean \| null`        | Project Constitution formally approved           |
| `hasScopeBaseline`           | `boolean \| null`        | Scope baseline approved                          |
| `hasWbs`                     | `boolean \| null`        | Work Breakdown Structure exists                  |
| `hasScheduleBaseline`        | `boolean \| null`        | Schedule baseline approved                       |
| `hasBudgetBaseline`          | `boolean \| null`        | Budget baseline approved                         |
| `hasRiskRegister`            | `boolean \| null`        | RAID register initialized                        |
| `hasStakeholderMap`          | `boolean \| null`        | Stakeholder map exists                           |
| `hasCommunicationsPlan`      | `boolean \| null`        | Communications plan documented                   |
| `hasClosureChecklistStarted` | `boolean \| null`        | Closure checklist started                        |
| `hasFinalInvoiceIssued`      | `boolean \| null`        | Final invoice issued                             |
| `hasClientSignoff`           | `boolean \| null`        | Client sign-off recorded                         |
| `openCriticalRisks`          | `number \| null`         | Count of open critical risks                     |
| `openHighRisks`              | `number \| null`         | Count of open high risks                         |
| `openIssues`                 | `number \| null`         | Count of open issues                             |
| `overdueTasks`               | `number \| null`         | Count of overdue tasks                           |
| `daysSinceLastStatusUpdate`  | `number \| null`         | Days since last status report                    |
| `scheduleVarianceDays`       | `number \| null`         | Schedule variance in days (positive = behind)    |
| `budgetVariancePercent`      | `number \| null`         | Budget variance percentage                       |

### `DeliveryPlaybook`

A `DeliveryPlaybook` has an `id`, `name`, `version`, `description`, an ordered list of `phases`, and
a flat list of `rules`. Each `PlaybookPhase` declares `entryEvidence`/`exitEvidence` fact keys used to
describe what evidence is expected before/after the phase (informational for the MVP; not enforced
as a gate yet).

### `PlaybookRule`

```typescript
export type PlaybookRule = {
  id: string;
  scope: PlaybookRuleScope;       // a PlaybookPhaseKey, or "any" for cross-cutting rules
  title: string;
  description: string;
  severity: PlaybookRuleSeverity; // "low" | "medium" | "high" | "critical"
  conditions: PlaybookFactCheck[]; // AND-combined
  evidenceFacts: PlaybookFactKey[];
  recommendationTemplate: string;
};
```

### `PlaybookRuleEvaluation`

```typescript
export type PlaybookRuleEvaluation = {
  ruleId: string;
  scope: PlaybookRuleScope;
  title: string;
  description: string;
  severity: PlaybookRuleSeverity;
  status: "fired" | "not_fired" | "indeterminate";
  evidenceUsed: { fact: PlaybookFactKey; value: boolean | number }[];
  evidenceMissing: PlaybookFactKey[];
  recommendationTemplate: string | null; // populated only when status === "fired"
};
```

---

## Seed Delivery Playbook

`SEED_DELIVERY_PLAYBOOK` (`seed-playbook.ts`) covers five phases — Iniciación, Planificación,
Ejecución, Monitoreo & Control, Cierre — with 17 seed rules spanning charter/constitution
governance, planning baselines, execution health (risks, issues, schedule/budget variance),
a cross-cutting stale-status rule, and closure gates (sign-off, invoicing, closure checklist).
This is static seed content for the MVP; the editable Playbook Registry (multiple methodologies,
per-workspace customization) is explicitly out of scope.

---

## Rules Engine

### `evaluatePlaybookRules(playbook, context)`

Evaluates every rule scoped to the context's current phase (plus any `"any"`-scoped rules) and
returns one `PlaybookRuleEvaluation` per applicable rule.

```typescript
const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, {
  projectId: "...",
  workspaceId: "...",
  phase: "ejecucion",
  openCriticalRisks: 2,
  // ... other facts, or omit/null when unknown
});
```

### `evaluatePlaybookRule(rule, context)`

Evaluates a single rule. A rule can only be `fired` or `not_fired` when **every** fact its
conditions depend on is present in the context; if any required fact is missing, the rule is
reported as `indeterminate` and `recommendationTemplate` is `null` — the engine never guesses.

**Evaluation rules:**
- `fired` — all conditions evaluated true against known facts. `recommendationTemplate` is populated.
- `not_fired` — all conditions evaluable, but at least one is false.
- `indeterminate` — one or more condition facts are `null`/`undefined`. Reported in `evidenceMissing`.

---

## Capability Explanation

`explainPlaybookEngineCapability()` returns a pure introspection object (`purpose`, `scope`,
`limits`, `phases`, `ruleCount`, `governingPrinciples`) describing what this layer does and does
not do, following the same pattern as `explainProjectConstitutionCapability()`.

---

## Module Structure

```
src/lib/playbook-engine/
├── index.ts        — public exports (barrel)
├── types.ts         — ProjectContextFacts, DeliveryPlaybook, PlaybookRule, PlaybookRuleEvaluation, ...
├── seed-playbook.ts  — SEED_DELIVERY_PLAYBOOK (phases + rules)
├── rules-engine.ts   — evaluatePlaybookRule, evaluatePlaybookRules (pure)
└── explain.ts         — explainPlaybookEngineCapability (pure)
```

No database migration or `platform-events` emission is introduced in this sprint — nothing is
persisted yet. Persistence and audit events begin in the Project Constitution Generator and
Recommendation Engine sprints.
