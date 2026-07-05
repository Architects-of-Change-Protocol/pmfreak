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

## Sprints 4-6 (summary)

Sprints 4-6 extended the same chain, each following the pattern established above (pure functions,
`fingerprint`-keyed idempotency, an `explain*` function, a governed state machine, never any
persistence/execution):

- **Sprint 4 — Communications Playbook** (`communication-draft-engine.ts`, `communication-templates.ts`,
  `communication-state.ts`, `communication-types.ts`). Converts a `PlaybookRecommendation` into a
  `CommunicationDraft` (template auto-selected by text/severity pattern matching), never sent —
  every draft's lifecycle stops at `copied`/`sent_manually`, which the caller performs outside this
  module.
- **Sprint 5 — Operational Intelligence** (`operational-intelligence-engine.ts`,
  `operational-intelligence-state.ts`, `operational-intelligence-types.ts`,
  `operational-intelligence-mappers.ts`). Classifies a `PlaybookRecommendation` into zero or more
  `OperationalDraft`s (risk/issue/dependency/decision), plus pure mappers into the real RAID/decision-
  governance input shapes (`operationalDraftToRaidItemInput`, `operationalDraftToDecisionInput`) —
  the caller decides if/when to actually create the real object.
- **Sprint 6 — Closure & Billing Intelligence** (`closure-billing-engine.ts`, `closure-billing-state.ts`,
  `closure-billing-types.ts`, `closure-billing-mappers.ts`). Builds a governed closure checklist from
  `ProjectContextFacts` + the Project Constitution draft, detects closure/billing blockers, and
  produces a `ClosureBillingAssessment` with `readyForClosure`/`readyForBilling` — never closes a
  project or marks an invoice issued.

## Sprint 7 — Audit Trail + Demo-Ready Integration Polish

Sprint 7 closes the MVP with three additions: a pure **Audit Trail** layer, a **Governance
Snapshot** orchestrator that chains every prior sprint into one evaluation, and **demo project
scenarios** that exercise the whole chain end-to-end.

### MVP architecture (end-to-end)

```
ProjectContextFacts (Sprint 1)
        │
        ▼
Rules Engine (Sprint 1) ──────────────────────────► PlaybookRuleEvaluation[]
        │
        ▼
Project Constitution Generator (Sprint 2) ────────► ProjectConstitutionDraft
        │
        ▼
Recommendation Engine (Sprint 3) ─────────────────► PlaybookRecommendation[]
        │                     │
        ▼                     ▼
Communications Playbook   Operational Intelligence
(Sprint 4)                (Sprint 5)
CommunicationDraft[]      OperationalDraft[]
        │                     │
        └─────────┬───────────┘
                   ▼
Closure & Billing Intelligence (Sprint 6) ────────► ClosureBillingAssessment
                   │
                   ▼
Audit Trail (Sprint 7) ───────────────────────────► PlaybookAuditEvent[]
                   │
                   ▼
Governance Snapshot (Sprint 7) ───────────────────► PlaybookGovernanceSnapshot
```

Every arrow is a pure function call; nothing in this diagram writes to a database, sends a real
message, or executes an action. The Governance Snapshot is the single entry point that runs the
whole chain and returns everything in one governed, explainable, demo-ready object.

### Audit Trail (`playbook-audit-types.ts`, `playbook-audit-engine.ts`, `playbook-audit-mappers.ts`)

A `PlaybookAuditEvent` records that the engine *evaluated or generated* something — never that it
*executed* something. Twelve event types cover every module (Sprints 1-7):
`playbook_rules_evaluated`, `project_constitution_draft_generated`, `recommendation_generated`,
`recommendation_state_changed`, `communication_draft_generated`, `communication_draft_state_changed`,
`operational_draft_generated`, `operational_draft_state_changed`,
`closure_billing_assessment_generated`, `closure_billing_blocker_detected`,
`closure_billing_next_action_recommended`, `governance_snapshot_generated`.

Every event's `id`/`fingerprint` is a deterministic sha256 of
`(workspaceId, projectId, eventType, relatedEntityType, relatedEntityId)` — re-auditing the same
artifact always yields the same event id, which is what `dedupePlaybookAuditEvents` relies on.
`createPlaybookAuditEvent` is the validated, generic entry point; the domain-specific
`auditXxx(...)` helpers (`auditRulesEvaluation`, `auditConstitutionDraftGenerated`,
`auditRecommendationGenerated`, `auditCommunicationDraftGenerated`, `auditOperationalDraftGenerated`,
`auditClosureBillingAssessmentGenerated`, `auditClosureBillingBlockerDetected`,
`auditClosureBillingNextActionRecommended`, `auditGovernanceSnapshotGenerated`) each take the
already-fingerprinted domain object (recommendation, draft, assessment, blocker, next action) and
reuse its own fingerprint/id rather than inventing a parallel one.

`playbookAuditEventToPlatformEventInput` is a **pure mapper** to the existing
`platform-events` module's `CreatePlatformEventInput` shape (`src/lib/platform-events/types.ts`) —
it never calls `createPlatformEvent`, never touches Supabase. Event types are namespaced
`PLAYBOOK_<EVENT_TYPE>`; everything not covered by an existing `PlatformEventCategory` (most
Playbook Engine events) is recorded under the existing `"governance"` category, matching how
`domain-events.ts` already records constitution/decision lifecycle events. Wiring this mapper's
output into an actual `createPlatformEvent(...)` call — i.e. *materializing* the audit trail into
real `platform_events` rows — is explicitly **future work**, not part of this sprint.

### Governance Snapshot (`governance-snapshot-types.ts`, `governance-snapshot-engine.ts`)

`generatePlaybookGovernanceSnapshot(context, options?)` is the integration orchestrator: it calls
Rules Engine → Project Constitution Generator → Recommendation Engine → Communications Playbook →
Operational Intelligence → Closure & Billing Intelligence → Audit Trail, in that order, and returns
a single `PlaybookGovernanceSnapshot` containing every intermediate artifact
(`rulesEvaluationSummary`, `constitutionDraft`, `recommendations`, `communicationDrafts`,
`operationalDrafts`, `closureBillingAssessment`, `auditEvents`, `nextBestActions`) plus two
roll-ups (`approvalRequiredSummary`, `missingEvidenceSummary`) and a `demoSummary` narrative.
Recommendations/communication drafts/audit events are all deduplicated by fingerprint before
landing in the snapshot (reusing `mergePlaybookRecommendations`/`mergeCommunicationDrafts`/
`dedupePlaybookAuditEvents` — no new dedup logic invented). The whole snapshot's own
`id`/`fingerprint` is a deterministic sha256 over every contained artifact's fingerprint, so
re-running the same `ProjectContextFacts` through the same playbook always reproduces the same
snapshot id.

`explainPlaybookGovernanceSnapshot(snapshot)` renders the human-readable explanation: what was
evaluated, which rules activated, what was generated at each stage, what blockers were detected,
what evidence was used/missing, what needs human approval, and the governed closing sentence that
nothing was executed automatically — the snapshot is a read-only demo artifact unless a future
sprint adds a materialization step.

### Demo scenarios (`demo-scenarios.ts`)

Four hand-picked `ProjectContextFacts` fixtures exercise the full chain:

| Scenario | Theme | Demonstrates |
|---|---|---|
| `pending_reception_billing_blocker` | Public infrastructure project | Technically complete but client reception/sign-off pending → `missing_reception` billing blocker, `reception_request`/`billing_enablement_follow_up` communication drafts, a `dependency` operational draft, `readyForBilling: false`. |
| `security_hardening_client_validation` | Security/hardening project | Reception obtained but client validation and the closure checklist are missing → `missing_validation`/`missing_acceptance` blockers, an `information_request` communication draft, `readyForClosure: false`. |
| `web_software_uat_evidence_pending` | Web/software project | Technical evidence (UAT/content) and reception both pending → `missing_evidence` blocker, `information_request` draft, a `dependency`(`client`) operational draft, not ready for closure/billing. |
| `ready_for_billing` | Fully compliant project | Every checklist item satisfied → `readyForBilling: true`, `readyForClosure: true`, but the only next actions are governed, `approvalRequired: true` suggestions (`start_internal_billing_process`, `start_administrative_closure`) — no invoice is ever issued automatically. |

`generateDemoGovernanceSnapshot(scenarioId, options?)` is a thin wrapper that resolves a scenario id
to its fixture and runs it through `generatePlaybookGovernanceSnapshot`.

**Known limitation carried over from Sprints 4-5:** `selectOperationalDraftTypesForRecommendation`
classifies a draft type purely by regex-matching the *text* of the seed playbook's rule
title/description/recommendation (Sprint 4/5 design). None of the seed playbook's 18 rules
(`seed-playbook.ts`) contain the words that would trigger an `"issue"` classification (e.g.
"entregable", "hito venc-/atras-", "no ha respondido"), so no realistic `ProjectContextFacts`
combination produces an `"issue"`-type `OperationalDraft` today — only `"dependency"` (client
reception) and `"risk"` (critical risks) are reachable. This is not a Sprint 7 regression; it is an
existing gap in the seed playbook's rule text vocabulary, documented here rather than worked around
with an artificial demo fixture.

### Capability explanation (`explain.ts`)

`explainPlaybookEngineCapability()` now documents the whole MVP: it lists all nine modules (Seed
Playbook, Rules Engine, Project Constitution Generator, Recommendation Engine, Communications
Playbook, Operational Intelligence, Closure & Billing Intelligence, Audit Trail, Governance
Snapshot) and states explicitly, in its `limits`: no DB side effects, no automatic emails, no
automatic closure, no automatic billing, no automatic approvals — every sensitive action carries
`approvalRequired: true` and stops there.

### What's implemented (MVP-complete)

- Rules Engine, Project Constitution Generator, Recommendation Engine, Communications Playbook,
  Operational Intelligence, Closure & Billing Intelligence (Sprints 1-6).
- A pure Audit Trail with deterministic, fingerprint-keyed events covering every module.
- A pure mapper from audit events to the shape `platform-events` would need (never calls it).
- A single integration orchestrator (`generatePlaybookGovernanceSnapshot`) chaining all of the
  above, with deduplication, approval/missing-evidence roll-ups, and a demo narrative.
- Four demo scenarios covering pending reception, client validation, UAT/evidence gaps, and a
  fully ready-for-billing project.
- A consolidated capability explanation covering all nine modules.

### What's intentionally not implemented

- **No persistence.** No new tables/migrations; nothing in this sprint (or any prior Playbook
  Engine sprint) writes to the database.
- **No real event emission.** `playbookAuditEventToPlatformEventInput` produces the right shape
  but nothing calls `createPlatformEvent` with it.
- **No UI.** No screen renders a `PlaybookGovernanceSnapshot` yet.
- **No automatic sends, approvals, closure, or billing.** Every communication draft still requires
  a human to copy/send it manually; every recommendation/draft/blocker/next-action that is
  approval-sensitive is marked `approvalRequired: true` and stops there.

### Future work (post-MVP)

- **UI.** A screen to render `PlaybookGovernanceSnapshot`/`explainPlaybookGovernanceSnapshot` for
  PMs, and a recommendations/drafts review queue.
- **Persistence / materialization.** Upsert `PlaybookRecommendation[]`/`CommunicationDraft[]`/
  `OperationalDraft[]`/`ClosureBillingAssessment`/`PlaybookAuditEvent[]` into real tables, most
  likely following the `recommended_actions` fingerprint-keyed upsert pattern already used
  elsewhere in the codebase.
- **Playbook Registry.** Multiple, editable, per-workspace methodologies instead of the single
  static seed playbook.
- **Gmail/email integration.** Actually sending a `CommunicationDraft` once a human approves it.
- **`platform-events` materialization.** Wiring `playbookAuditEventToPlatformEventInput`'s output
  into real `createPlatformEvent(...)` calls once a workspace/project context is available at
  call time.
- **Portfolio intelligence.** Aggregating `PlaybookGovernanceSnapshot`s across many projects for
  portfolio-level reporting.

## Hardening Sprint (post-Sprint-7)

Before UI or persistence work begins, this sprint followed up on the MVP Integration Review
(health 8/10, no critical findings) with a consistency/testability/materialization-readiness pass.
**No new features, no UI, no persistence, no side effects.** Every change below is either a pure
refactor (same behavior, more robust mechanism) or a small, explicit consistency fix — never a
scope expansion.

### What changed

**1. Test suite: runtime-first, not regex-first.** All 8 `tests/playbook-engine-*.test.mjs` files
previously split their coverage between lightweight static checks (`assert.match` against
`fs.readFileSync(".ts")` source text — real and worth keeping, but shallow) and a single
`execFileSync("npx", ["tsx", "--eval", ...])` subprocess per file bundling 10-20 sequential
assertions into one opaque `node:test` case. Since this repo's own `npm test` script already runs
`tsx --test`, every playbook-engine test file now `import`s the module directly (`../src/lib/
playbook-engine/index.ts`) and expresses each behavioral guarantee as its own named `test()` —
no subprocess, full per-assertion failure reporting, and roughly 5x faster (177 tests run in
~1.1s where 83 tests previously took ~5.8s across all 8 files, once you account for the runtime
tests they replace). The static structural checks were kept (never eliminated), since "exports
exist" and "narrative mentions X" are still legitimate, cheap guards — they are simply no longer
the *primary* signal for behavioral correctness. `tests/playbook-engine-governance-snapshot.test.mjs`
gained an explicit end-to-end smoke test (`generatePlaybookGovernanceSnapshot runs the complete
chain end-to-end`) exercising every stage (Rules Engine → Constitution Generator → Recommendation
Engine → Communications Playbook → Operational Intelligence → Closure & Billing → Audit Trail) in
one assertion block, plus dedicated tests for `missingEvidenceSummary` deduplication,
`approvalRequiredSummary` detection, no-side-effects, audit-event determinism, and "never invents
recipients/owner/dueDate/evidence" across all four demo scenarios.

**2. `owner` vs. `decisionOwner` no longer auto-duplicated.** `DecisionDraft` (`operational-
intelligence-types.ts`) keeps both `owner` (the common field every operational draft has —
"who's tracking this draft") and `decisionOwner` (the decision-specific "who must decide"), but
`buildDraft` (`operational-intelligence-engine.ts`) no longer copies `decisionOwner`'s value into
`owner`. The two now vary independently: `owner` is only ever populated from
`OperationalIntelligenceProjectContext.owner`, `decisionOwner` only from `...decisionOwner`, and
either can be `null` while the other is set. `operationalDraftToDecisionInput`
(`operational-intelligence-mappers.ts`) surfaces `decisionOwner` — never `owner` — into
`metadata.decisionOwner` when mapping a decision draft, since `DecisionRecord` has no structural
owner column of its own; non-decision drafts never carry that metadata key at all.

**3. `approvalRequired` normalized across all four operational draft types.** A new pure helper,
`resolveOperationalDraftApprovalRequirement({ type, severity, recommendationApprovalRequired,
blocking?, escalationRecommended? })` (exported from `operational-intelligence-engine.ts` and the
barrel), replaces four previously inconsistent per-type computations with one policy: a
recommendation's own `approvalRequired` can only ever be *elevated*, never relaxed; `decision`
drafts are always approval-required; `risk` drafts add approval on high/critical severity or
`escalationRecommended`; `issue`/`dependency` drafts add approval on high/critical severity *or*
being currently `blocking` — closing the gap where a blocking, high-severity dependency (e.g. a
pending client sign-off) could previously carry `approvalRequired: false` just because its parent
recommendation happened to have no sensitive suggested action of its own.

**4. Closure/Billing blockers distinguish confirmed-missing from unknown evidence.**
`ClosureBlocker`/`BillingBlocker` (`closure-billing-types.ts`) gained an `evidenceStatus: "missing"
| "requires_validation"` field (a `ClosureBillingBlockerEvidenceStatus`, reusing
`ClosureChecklistItemStatus`'s own two non-terminal values rather than inventing a parallel
vocabulary). `detectClosureBlockers`/`detectBillingBlockers` derive it directly from the checklist
item's status: `"missing"` only when a fact is explicitly known to be `false`/absent,
`"requires_validation"` when it's `null`/unrecorded or the Project Constitution reports the
artifact exists elsewhere unvalidated. `buildClosureChecklist`'s status derivation
(`boolStatus`/`countStatus`/`applicableBoolStatus`/`constitutionFieldStatus`) already followed this
discipline correctly — unknown facts were never read as `false` — but the *blockers* built from
those items previously carried no field saying which case applied, so a UI/comms consumer reading
the blocker list directly (rather than the assessment-level `closureStatus`/`billingStatus`) had no
way to avoid overstating confidence. `explainClosureBillingAssessment`'s blocker summary lines now
say "(evidencia por validar)" for `requires_validation` blockers. `readyForClosure`/`readyForBilling`
were already conservative before this change (an unknown fact yields `"indeterminate"`, never
`"ready"`) and remain unchanged — this was a confidence-labeling fix, not a readiness-logic change.

**5. Structured (rule-id) classification, with regex only as fallback.**
`selectCommunicationTemplateForRecommendation` (`communication-draft-engine.ts`) and
`selectOperationalDraftTypesForRecommendation` (`operational-intelligence-engine.ts`) each gained a
lookup table keyed by the seed playbook's stable `playbookRuleId` — `RULE_ID_COMMUNICATION_TEMPLATE`
and `RULE_ID_OPERATIONAL_DRAFT_BLUEPRINTS` — checked *before* the existing text/severity regex
classification. Every entry reproduces exactly what the regex path already resolved for that rule
id (verified by running the old classifier against every seed rule before writing the tables), so
this is a pure robustness refactor: a future copy-edit to a rule's title/description in
`seed-playbook.ts` can no longer silently change which template or operational draft type it
produces, since the stable id — not the prose — now drives the decision for all 18 known seed
rules. Recommendations from an unrecognized `playbookRuleId` (ad-hoc/manual recommendations, or a
future Playbook Registry rule) still fall through to the text/severity fallback unchanged — regex
is now genuinely only a fallback, not the primary mechanism. One deliberate behavior fix rode along
with this refactor: `selectOperationalDraftTypesForRecommendation` now checks
`recommendation.suggestedActions` first and returns `[]` immediately for any recommendation
suggesting `generate_project_constitution_draft` — previously, `pb-init-constitution-missing`'s own
rule text ("... decisiones futuras ...") happened to match the generic decision-detection regex
and produced a spurious `DecisionDraft`, even though drafting the Project Constitution is already a
non-sensitive, non-RAID action owned by `constitution-generator.ts`. A caller that already knows
the right communication template (e.g. a closure/billing next action) can still always override
auto-selection by passing `generateCommunicationDraftFromRecommendation`'s explicit `templateId`
parameter, which already existed and is now covered by a dedicated test.

**6. Closure & Billing next actions no longer go silent on a real blocker.**
`selectClosureBillingNextBestActions` previously had no case for a `missing_validation` billing
blocker (client validation/acceptance pending) — a project in exactly Demo Scenario B's situation
(security/hardening work awaiting client validation) produced two real, detected blockers but an
*empty* `nextBestActions` array, a functional dead end for both the UI and the demo narrative. A
new `ClosureBillingNextActionType` value, `request_client_validation`, is now generated whenever a
`missing_validation` blocker is open (and no `decision` operational draft already covers it),
recommending the `information_request` communication template and a `decision` operational draft
type, `approvalRequired: true`. This is a bugfix to close a real signal-to-zero-output gap, not new
functional scope — the blocker itself was already being detected; the selector simply failed to
acknowledge it. Demo scenarios A, C, and D were re-verified end-to-end and needed no changes.

### Testing strategy going forward

Prefer a runtime `test()` importing the module directly over a source-text `assert.match` whenever
the two would prove the same thing — the former proves the behavior, the latter only proves a
string exists. Keep `assert.match`/`assert.doesNotMatch` on `fs.readFileSync` output for things that
*are* genuinely about the source shape (e.g. "the mapper file must never mention `supabase`" — a
purity guard no runtime test could otherwise express, since a call that's never made produces no
observable runtime difference). When adding a new seed rule or a new classification pattern, add
both: a rule-id table entry (§5 above) and a runtime test asserting its resolved template/blueprint,
so a future prose edit to that rule has a test to fail against instead of silently drifting.

### Materialization readiness (updated)

Nothing here changes what "materialize this MVP" requires (see the prior section above), but two
things are now cheaper to get right on the first migration:

- `ClosureBlocker`/`BillingBlocker` rows should carry `evidenceStatus` as a real column (not
  re-derived post-hoc from the checklist), so a persisted blocker list keeps the same
  confirmed-vs-unknown distinction the in-memory assessment already has.
- `resolveOperationalDraftApprovalRequirement` is the single place future materialization code
  should call (or mirror) if it ever needs to recompute `approvalRequired` for a stored draft —
  there is now exactly one policy to keep in sync, not four.

### What still needs UI/persistence work (unchanged by this sprint)

This sprint did not build any UI, database migration, `platform-events` emission,
Gmail integration, real materialization, portfolio intelligence, or Lessons Learned Loop — see
"Future work (post-MVP)" above, which still applies unchanged. The Playbook Engine remains 100%
pure: every function in `src/lib/playbook-engine/` takes data in and returns data out, with no
network call, no database access, and no automatically-executed action anywhere in the module.
