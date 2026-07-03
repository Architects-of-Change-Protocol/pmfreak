# Playbook Engine Foundation

## Overview

The Playbook Engine turns a delivery methodology into evaluable rules so that the LLM operates,
explains, and documents *within* the playbook instead of improvising project management decisions.
This document covers the Foundation layer — the seed playbook, its types, and the pure Rules Engine.

This is Sprint 1 of the Playbook Engine MVP. Later sprints build on this foundation:

1. **Seed Playbook + Types** (this document)
2. **Project Constitution Generator** (Sprint 2) — derives a draft `project-constitution` record from the
   playbook; see `generateProjectConstitutionDraftFromPlaybook` and `explainProjectConstitutionDraftGeneration`
   in `constitution-generator.ts`. Pure, no persistence, never auto-approves.
3. **Recommendation Engine v1** (Sprint 3) — converts fired rule evaluations into governed, explainable
   recommendations with an approval-aware status lifecycle; see `generatePlaybookRecommendations` and
   `explainPlaybookRecommendation` in `recommendation-engine.ts`. Pure, no persistence yet, never auto-executes.
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
├── index.ts                  — public exports (barrel)
├── types.ts                   — ProjectContextFacts, DeliveryPlaybook, PlaybookRule, PlaybookRuleEvaluation, ...
├── seed-playbook.ts            — SEED_DELIVERY_PLAYBOOK (phases + rules)
├── rules-engine.ts              — evaluatePlaybookRule, evaluatePlaybookRules (pure)
├── explain.ts                    — explainPlaybookEngineCapability (pure)
├── constitution-generator.ts      — generateProjectConstitutionDraftFromPlaybook,
│                                      explainProjectConstitutionDraftGeneration (pure, Sprint 2)
├── recommendation-engine.ts        — generatePlaybookRecommendations, explainPlaybookRecommendation,
│                                      mergePlaybookRecommendations (pure, Sprint 3)
└── recommendation-state.ts          — status transition helpers (markRecommendationViewed,
                                        acceptRecommendation, approveRecommendation, ...) (pure, Sprint 3)
```

No database migration or `platform-events` emission is introduced in this sprint — nothing is
persisted yet. Persistence and audit events begin in the Recommendation Engine sprint.

---

## Project Constitution Generator (Sprint 2)

`generateProjectConstitutionDraftFromPlaybook(context, playbook, sourceFacts?)` derives a draft
Project Constitution and returns a `PlaybookEngineResult<ProjectConstitutionDraft>`. It reuses
`ConstitutionStatus` from `src/lib/project-constitution` (the module owning the real
draft → proposed → approved → active → suspended → closed → archived lifecycle and its
persistence) instead of inventing a parallel status type — the draft always starts in `"draft"`,
and nothing in this generator moves it further along that lifecycle or persists it.

**Why most content fields default to "pending"**: `ProjectContextFacts` (Sprint 1) only carries
evidence *flags* (e.g. `hasStakeholderMap: boolean | null`) and counts — it never carries the
actual text of an objective, a stakeholder list, or a scope statement. So the generator can only
genuinely derive one field from the playbook itself: `evidenceRequirements` (built from the
current phase's `entryEvidence`/`exitEvidence` fact keys). Every other field — `objective`,
`scopeIn`, `scopeOut`, `deliverables`, `acceptanceCriteria`, `stakeholders`, `constraints`,
`initialRisks`, `initialDependencies`, `communicationRules`, `changeRules`, `closureRules`,
`billingRules` — is wrapped in a `ProjectConstitutionDraftField<T>` (`{ value, status, note }`)
and defaults to one of:

- `"pending_definition"` — no upstream signal exists at all; a human must author it.
- `"requires_validation"` — the playbook already has evidence the artifact exists elsewhere
  (e.g. `hasRiskRegister: true`), so the field must be imported and reviewed, not started from
  zero. `billingRules` always defaults here regardless of evidence, since financial rules require
  human validation before they can govern a project.
- `"not_available"` — Sprint 1's fact model has no related evidence flag at all (e.g. dependencies,
  change control), so the generator cannot even signal whether the artifact exists.
- `"provided"` — real content was supplied via the optional `sourceFacts` parameter and is used
  verbatim; the generator never fabricates values for fields `sourceFacts` didn't supply.

`explainProjectConstitutionDraftGeneration(draft)` reports, for a specific generated draft, which
fields were used from context/`sourceFacts`, which were derived from the playbook, which are
pending/requiring-validation/not-available, and states explicitly that the draft is never
auto-approved — any lifecycle transition requires an explicit human action through
`project-constitution`'s existing state machine.

### Rules Engine: suggested actions

`PlaybookRule` gained an optional `suggestedActions: PlaybookSuggestedAction[]` field
(`{ action, description, approvalRequired }`), propagated onto `PlaybookRuleEvaluation` only when
a rule fires (mirroring `recommendationTemplate`'s never-invented-when-not-fired discipline). The
seed rule `pb-init-constitution-missing` now suggests two actions: `generate_project_constitution_draft`
(`approvalRequired: false` — drafting is safe to do automatically) and `approve_project_constitution`
(`approvalRequired: true` — approval always requires a human).

---

## Recommendation Engine v1 (Sprint 3)

The governing principle for this sprint: PMFreak never says "I think you should do X." It says
*"according to the playbook, this rule fired on this evidence, this is missing, and this is the
recommended action."* `generatePlaybookRecommendations(context, playbook)`
(`recommendation-engine.ts`) is the layer that turns `PlaybookRuleEvaluation[]` (Sprint 1) into
that governed, explainable, actionable shape.

### Reuse decisions

Before adding new architecture, the existing `recommended-actions/`, `task-drafts/`,
`governance-actions/`, and `decision-governance/` modules were reviewed:

- `recommended-actions` (RAID-derived) has its own status vocabulary
  (`proposed | accepted | rejected | deferred | converted_to_task`) tied to `raid_item_id` and a
  Supabase-backed `recommended_actions` table — it doesn't cover the
  `requires_approval → approved → executed` approval gate this sprint needs, and is scoped to a
  different source domain (RAID items, not playbook rules).
- `governance-actions` and `decision-governance` are heavier, DB-backed state machines for a
  different bounded context (organization-wide governance actions / formal decisions).
- The `requires_approval` / `approved` vocabulary itself is already an established convention
  across the repo (e.g. `agent-action-conversion-types.ts`), so the new
  `PlaybookRecommendationStatus` enum reuses that language instead of inventing new words for the
  same concept.

Rather than force-fit or duplicate any of those, `PlaybookRecommendation` is a new, small type
scoped to playbook-rule-derived recommendations, but it **reuses** `PlaybookRuleSeverity` (as
`PlaybookRecommendationSeverity`) and `PlaybookSuggestedAction` (as `PlaybookRecommendationAction`)
from Sprint 1/2 rather than declaring parallel types for the same shape.

### `generatePlaybookRecommendations(context, playbook)`

Pure function, no persistence, no event emission, no execution:

1. Calls `evaluatePlaybookRules(playbook, context)` (Sprint 1).
2. Only `"fired"` evaluations become a `PlaybookRecommendation`. `"not_fired"` evaluations are
   dropped (nothing to recommend). `"indeterminate"` evaluations are never turned into a
   recommendation — they're reported separately as `indeterminateRuleIds`, preserving the
   "never invent data" discipline from Sprint 1.
3. Each recommendation carries: `playbookRuleId`, `ruleName`, `title`, `detectedSituation`,
   `phase`, `severity`, `status`, `confidence`, `evidenceUsed`, `missingEvidence`,
   `recommendedAction`, `suggestedActions`, `approvalRequired`, `hasApprovalSensitiveActions`,
   `explanation`, `createdAt`/`updatedAt`, plus `id`/`fingerprint`/`workspaceId`/`projectId`/
   `playbookId`/`playbookVersion` for identity and idempotency.

**Confidence** is never invented: it's `round(evidenceUsed.length / (evidenceUsed.length +
missingEvidence.length) * 100)` — a deterministic measure of how much of the rule's declared
evidence was actually known, derived purely from the evaluation itself.

**`approvalRequired` / `hasApprovalSensitiveActions`**: both are `true` when any of the rule's
`suggestedActions` has `approvalRequired: true` (e.g. `pb-init-constitution-missing`'s
`approve_project_constitution`). They're kept as two fields with the same value today so a future
sprint could introduce approval requirements not tied to a specific suggested action without a
breaking rename.

### Idempotency: `fingerprint`

`id` and `fingerprint` are both `sha256(workspaceId:projectId:playbookId:playbookVersion:ruleId)`.
Re-evaluating the exact same context twice yields byte-identical fingerprints/ids — this is the
entire idempotency mechanism available in this sprint, since there is no persistence layer yet
(a future materialization layer would use `fingerprint` as its uniqueness/upsert key, mirroring
`recommended_actions.fingerprint`).

`mergePlaybookRecommendations(previous, next)` is a pure helper for combining a freshly generated
recommendation set with a previously known one: it dedupes by `fingerprint`, keeps at most one
recommendation per fingerprint, and — critically — preserves the previous recommendation's
`status` (a human's `viewed`/`accepted`/`dismissed`/... decision must never be silently reset by
re-evaluation) while refreshing the evidence-derived fields from the latest evaluation.

### `explainPlaybookRecommendation(recommendation, playbook?)`

Returns a `PlaybookRecommendationExplanation` with `detectedCondition`, `activatedRule`,
`evidenceUsed`, `missingEvidence`, `recommendedAction`, `requiresHumanApproval`,
`availableConversions` (which statuses this recommendation could structurally move to next), and
`futureCapabilities` (plain statements that task-draft and communication-draft conversion are not
implemented yet). `narrative` assembles all of this into the single governed sentence PMFreak is
allowed to say, e.g.:

> Según el playbook 'Playbook de Entrega Estándar PMFreak' (v1), la regla
> 'pb-init-constitution-missing' (Constitución de proyecto no generada) se activó por:
> hasApprovedConstitution = false. No falta evidencia adicional para esta regla. La acción
> recomendada es: Generar y someter a aprobación la Constitución del Proyecto antes de iniciar la
> planificación detallada. Esta recomendación incluye al menos una acción que requiere aprobación
> humana antes de ejecutarse.

### Status lifecycle (`recommendation-state.ts`)

```
new → viewed → accepted → requires_approval → approved → executed
                   │                                  ↘
                   ├──────────────────────────────→ dismissed (terminal)
                   ├──→ converted_to_task (terminal)
                   ├──→ converted_to_draft (terminal)
                   └──→ executed (terminal, only when approvalRequired is false)
```

`PLAYBOOK_RECOMMENDATION_TRANSITIONS` is a static graph (same pattern as
`decision-governance/state-machine.ts`'s `allowedTransitions`), validated by every helper before
mutating status. `dismissed` and `executed` have no outgoing edges — a dismissed recommendation
can never later become executed, and executed never moves again.

The graph alone can't express the approval precondition (it would allow `accepted → executed`
regardless of `approvalRequired`), so `approveRecommendation` and `markRecommendationExecuted` add
an explicit guard: `approveRecommendation` refuses to run when `approvalRequired` is `false`
(approving something that was never sensitive is meaningless), and `markRecommendationExecuted`
requires status `approved` when `approvalRequired` is `true`, or status `accepted` when it's
`false`. None of these helpers execute anything — they're pure status bookkeeping, called only
after a real action (out of scope for this sprint) has already happened elsewhere. This is what
guarantees approval-sensitive actions are never auto-executed.

### What's deliberately not in this sprint

- **No persistence.** No new table/migration. A future sprint would materialize
  `PlaybookRecommendation[]` into storage, most likely following the
  `recommended_actions`/`materialize-recommended-actions.ts` shape (fingerprint-keyed upsert,
  skip-if-already-decided), but that integration is out of scope here.
- **No UI.** No recommendations screen exists yet that this cleanly slots into.
- **No Communications Playbook, no Closure & Billing Intelligence, no Playbook Registry.**
- **No automatic execution, approval, or emails.** `approve_project_constitution` and any other
  approval-sensitive suggested action are never auto-approved or auto-executed by this engine.
