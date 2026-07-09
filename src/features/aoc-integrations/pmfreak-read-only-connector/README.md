# AOC PMFreak Read-Only Connector v1

Connector ID:
`aoc.integration.pmfreak.read_only_connector.v1`

## Purpose

Provides the first read-only integration boundary between AOC Enterprise and PMFreak data.

This connector reads PMFreak projects, agents, milestones, tasks, risks, evidence references, approval references and action proposals into AOC-safe connector snapshots.

This connector does not create governance decisions.
This connector does not call the PMFreak Agent Passport resolver.
This connector does not call the PMFreak Project Governance Scenario runner.
This connector does not create Control Plane views.
This connector does not create Narrative Exports.
This connector does not mutate PMFreak data.
This connector does not write back decisions.
This connector does not execute actions.
This connector does not send communications.
This connector does not create invoices.
This connector does not provide legal advice.
This connector does not certify compliance.

## A note on repository state

This PR was scoped against a description of prior "PMFreak demo" layers
(Agent Passport Demo Pack, Project Governance Scenario Pack, Control Plane
View, Narrative Export Pack). At the time this connector was implemented,
none of those layers exist in this repository — there is no
`pmfreak-agent-passport`, `pmfreak-project-governance-scenarios`,
`pmfreak-demo-control-plane-view`, or `pmfreak-demo-narrative-export`
feature module, and no `resolvePMFreakAgentPassportAction`,
`runPMFreakProjectGovernanceScenario`,
`createPMFreakDemoControlPlaneViewModel`, or
`createPMFreakDemoNarrativeExport` function anywhere in `src/`.

That does not change this connector's scope: it is a standalone read-only
boundary that does not call any of those functions (they don't exist to
call), and its runtime code is tested to guarantee that stays true even
after they're built.

## Layers

```
pmfreak-read-only-source.ts             Read-only source interface (AocPMFreakReadOnlySource)
pmfreak-in-memory-source.ts             Deterministic in-memory source implementation
pmfreak-real-source-adapter.ts          Unsupported real-source placeholder (api/database/supabase/unknown)
pmfreak-read-only-connector-fixtures.ts Deterministic demo fixture data
pmfreak-read-models.ts                  PMFreak connector read models (project/agent/milestone/task/risk/evidence/approval/action-proposal)
pmfreak-read-only-client.ts             Connector client — readSnapshot() / getHealth()
pmfreak-connector-snapshot.ts           Connector snapshot model + factory
pmfreak-connector-health.ts             Health/status model + factory
pmfreak-connector-errors.ts             Safe, deterministic connector error model
pmfreak-redaction.ts                    Redaction / safe-normalization helpers
pmfreak-no-mutation-guard.ts            Guardrail that rejects forbidden (mutating) operation names
pmfreak-read-only-claim-safety.ts       Overclaim-phrase guard for connector outputs
pmfreak-read-only-connector-descriptor.ts  Connector descriptor (capabilities, forbidden ops, safe labels)
pmfreak-read-only-connector-config.ts   Safe-by-default connector configuration
pmfreak-read-only-connector-constants.ts   IDs, capability/forbidden-operation/label/disclaimer constants
```

## Where this sits

```
AOC PMFreak Read-Only Connector v1        (this module)
  ↓ reads
PMFreak source data
  ↓ normalizes
AOC-safe PMFreak connector snapshots
  ↓ later consumed by
Project Snapshot Adapter / Action Intake / Dry-Run Decision Bridge   (not part of this PR)
```

## Source support

- **`in_memory`** — a deterministic fixture source
  (`createInMemoryAocPMFreakReadOnlySource`) used for tests and demo/dev
  mode. Fixtures use fake, demo-scoped IDs only (`project.demo.*`,
  `customer.demo.acme`, `tenant.demo.pmfreak`, etc.) — no real Datasys
  project codes, customer names, emails, contract numbers, or invoice
  numbers.
- **`api` / `database` / `supabase` / `unknown`** — unsupported in v1.
  `createUnsupportedAocPMFreakRealReadOnlySource(sourceKind)` returns a
  source whose every `list*` method rejects with a safe
  `unsupported_source_kind` connector error. No network calls, no
  credentials, no schema guesses.

  This repository does have a real Supabase-backed database (see
  `src/lib/db/database-contract.ts`, `src/lib/supabase/server.ts`) — this
  app *is* PMFreak's own operational data store. But none of its existing
  tables (`operational_memory_records`, RAID storage, etc.) are a
  documented, stable contract for this connector's read models. Wiring a
  real adapter without inventing a schema mapping requires a reviewed
  source contract first. A future PR that wires a real adapter needs:

  ```
  auth mechanism (service role vs RLS-scoped client)
  read table/endpoint names for: projects, agents, milestones, tasks, risks,
    evidence references, approval references, action proposals
  field-by-field mapping from each table's columns to the corresponding
    Aoc*ReadModel fields in pmfreak-read-models.ts
  tenant/workspace scoping columns
  pagination strategy (respecting config.maxRecords)
  timeout handling (respecting config.timeoutMs)
  error semantics (mapped to AocPMFreakConnectorErrorCode)
  ```

  Until that contract exists and is reviewed, `sourceKind: "api" |
  "database" | "supabase" | "unknown"` stays unsupported by design.

## Safety guarantees

- **Read-only by construction.** `AocPMFreakReadOnlyConnectorConfig.readOnly`
  and `.allowMutations` are typed as the literals `true`/`false` (not
  `boolean`). `createAocPMFreakReadOnlyConnectorConfig` forces them
  regardless of what a caller passes in and records a warning
  (`"readOnly was forced to true."` / `"allowMutations was forced to
  false."`) if the caller attempted to change them.
- **No-mutation guard.** `assertAocPMFreakReadOnlyOperation` /
  `isAocPMFreakForbiddenConnectorOperation` recognize every operation name
  in `AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS` (project/task/milestone/
  risk/evidence/approval CRUD beyond read, invoice creation, email/Slack/
  client communication, action approval/execution, decision writeback) and
  throw. This is a guardrail only — there is no executor or writeback path
  behind it to bypass.
- **Redaction.** `redactAocPMFreakConnectorValue` / `redactAocPMFreakConnectorSnapshot`
  never mutate their input. `safe_demo` redacts obvious emails, token/
  secret/authorization-shaped fields, and connection-string-shaped values.
  `strict` additionally empties `metadata` objects and redacts `sourceUrl`
  fields.
- **Claim safety.** `assertNoAocPMFreakReadOnlyConnectorOverclaim` /
  `evaluateAocPMFreakReadOnlyConnectorClaimSafety` sweep any connector
  output (descriptor, config, snapshot, health) for prohibited overclaim
  phrases (e.g. "production authorized", "invoice-ready certified",
  "customer acceptance certified", "compliance passed", "write access
  enabled", "mutation allowed") before it's considered safe to return.
- **Determinism.** No `Date.now()`, no `Math.random()`, no
  `crypto.randomUUID()`, no `fetch`/`axios`/network calls anywhere in the
  default (in-memory) path. Every function is a pure, offline
  transformation of its inputs — the same source data and config always
  produce the same snapshot.

## What "safe" means here

Reading PMFreak data does not mean AOC has approved an action.
Reading evidence references does not certify evidence.
Reading approval references does not certify approval validity.
Reading billing-related data does not certify invoice readiness.
Reading jurisdiction-related fields does not certify compliance.

`present: true` on an evidence/approval reference only means the connector
observed a reference to it in the source system — never that the
underlying evidence or approval is valid, sufficient, or reviewed.

## What comes next

Next PR: **AOC PMFreak Project Snapshot Adapter v1**

That PR will convert read-only PMFreak connector snapshots into AOC
project-governance snapshot inputs. This connector only reads and
normalizes data — it is not a decision bridge, not an enforcement gateway,
and not a PMFreak action executor.
