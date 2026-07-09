# PMFreak AOC Read-Only Integration Surface v1

Integration Surface ID:
`pmfreak.integration.aoc.read_only_surface.v1`

## Purpose

Provides the first read-only integration surface PMFreak exposes to AOC Enterprise.

**PMFreak is the data provider. AOC Enterprise is the downstream consumer.** This repository (`pmfreak`) owns this module because it is the provider-side surface: it exposes PMFreak's own projects, agents, milestones, tasks, risks, evidence references, approval references and action proposals into safe, normalized surface snapshots. It is not the AOC-side connector that will eventually consume those snapshots — that module belongs in the AOC Enterprise repository.

This surface does not create governance decisions.
This surface does not call the PMFreak Agent Passport resolver.
This surface does not call the PMFreak Project Governance Scenario runner.
This surface does not create Control Plane views.
This surface does not create Narrative Exports.
This surface does not mutate PMFreak data.
This surface does not accept writeback from AOC.
This surface does not execute actions.
This surface does not send communications.
This surface does not create invoices.
This surface does not provide legal advice.
This surface does not certify compliance.

## A note on repository state

This PR was scoped against a description of prior "PMFreak demo" layers
(Agent Passport Demo Pack, Project Governance Scenario Pack, Control Plane
View, Narrative Export Pack). At the time this surface was implemented,
none of those layers exist in this repository — there is no
`pmfreak-agent-passport`, `pmfreak-project-governance-scenarios`,
`pmfreak-demo-control-plane-view`, or `pmfreak-demo-narrative-export`
feature module, and no `resolvePMFreakAgentPassportAction`,
`runPMFreakProjectGovernanceScenario`,
`createPMFreakDemoControlPlaneViewModel`, or
`createPMFreakDemoNarrativeExport` function anywhere in `src/`.

That does not change this surface's scope: it is a standalone read-only
boundary that does not call any of those functions (they don't exist to
call), and its runtime code is tested to guarantee that stays true even
after they're built.

This module also was initially implemented framed as an AOC-side
consumer connector (`aoc.integration.pmfreak.read_only_connector.v1`,
`AOC_PMFREAK_*`). That framing was incorrect for this repository — this
repo is PMFreak, the provider, not AOC Enterprise, the consumer — and was
corrected to the provider-side framing documented here. The architecture,
read models, and safety guarantees are unchanged; only the identity of
"who owns/exposes this module" was corrected.

## Layers

```
pmfreak-aoc-read-only-source.ts                 Read-only source interface (PMFreakAocReadOnlySource)
pmfreak-aoc-in-memory-source.ts                 Deterministic in-memory source implementation
pmfreak-aoc-real-source-adapter.ts              Unsupported real-source placeholder (api/database/supabase/unknown)
pmfreak-aoc-read-only-surface-fixtures.ts       Deterministic demo fixture data
pmfreak-read-models.ts                          PMFreak's own read models (project/agent/milestone/task/risk/evidence/approval/action-proposal)
pmfreak-aoc-read-only-surface-client.ts         Surface client — readSnapshot() / getHealth()
pmfreak-aoc-surface-snapshot.ts                 Surface snapshot model + factory
pmfreak-aoc-surface-health.ts                   Health/status model + factory
pmfreak-aoc-surface-errors.ts                   Safe, deterministic surface error model
pmfreak-aoc-redaction.ts                        Redaction / safe-normalization helpers
pmfreak-aoc-no-mutation-guard.ts                Guardrail that rejects forbidden (mutating) operation names
pmfreak-aoc-read-only-claim-safety.ts           Overclaim-phrase guard for surface outputs
pmfreak-aoc-read-only-surface-descriptor.ts     Surface descriptor (capabilities, forbidden ops, safe labels)
pmfreak-aoc-read-only-surface-config.ts         Safe-by-default surface configuration
pmfreak-aoc-read-only-surface-constants.ts      IDs, capability/forbidden-operation/label/disclaimer constants
```

## Where this sits

```
PMFreak AOC Read-Only Integration Surface v1     (this module — lives in the pmfreak repo)
  ↓ exposes
PMFreak read-only project/agent/milestone/task/risk/evidence/approval/action-proposal data
  ↓ later consumed by
AOC PMFreak Read-Only Connector                  (aoc.integration.pmfreak.read_only_connector.v1 — lives in the AOC Enterprise repo, not part of this PR)
```

The AOC-side connector is a separate module in a separate repository. It
will call into this surface (directly or via a future transport) to read
normalized PMFreak data; it is not implemented here.

## Source support

- **`in_memory`** — a deterministic fixture source
  (`createInMemoryPMFreakAocReadOnlySource`) used for tests and demo/dev
  mode. Fixtures use fake, demo-scoped IDs only (`project.demo.*`,
  `customer.demo.acme`, `tenant.demo.pmfreak`, etc.) — no real Datasys
  project codes, customer names, emails, contract numbers, or invoice
  numbers.
- **`api` / `database` / `supabase` / `unknown`** — unsupported in v1.
  `createUnsupportedPMFreakAocRealReadOnlySource(sourceKind)` returns a
  source whose every `list*` method rejects with a safe
  `unsupported_source_kind` surface error. No network calls, no
  credentials, no schema guesses.

  This repository does have a real Supabase-backed database (see
  `src/lib/db/database-contract.ts`, `src/lib/supabase/server.ts`) — this
  app *is* PMFreak's own operational data store. But none of its existing
  tables (`operational_memory_records`, RAID storage, etc.) are a
  documented, stable contract for this surface's read models. Wiring a
  real adapter without inventing a schema mapping requires a reviewed
  source contract first. A future PR that wires a real adapter needs:

  ```
  auth mechanism (service role vs RLS-scoped client)
  read table/endpoint names for: projects, agents, milestones, tasks, risks,
    evidence references, approval references, action proposals
  field-by-field mapping from each table's columns to the corresponding
    PMFreak*ReadModel fields in pmfreak-read-models.ts
  tenant/workspace scoping columns
  pagination strategy (respecting config.maxRecords)
  timeout handling (respecting config.timeoutMs)
  error semantics (mapped to PMFreakAocSurfaceErrorCode)
  ```

  Until that contract exists and is reviewed, `sourceKind: "api" |
  "database" | "supabase" | "unknown"` stays unsupported by design.

## Safety guarantees

- **Read-only by construction.** `PMFreakAocReadOnlySurfaceConfig.readOnly`
  and `.allowMutations` are typed as the literals `true`/`false` (not
  `boolean`). `createPMFreakAocReadOnlySurfaceConfig` forces them
  regardless of what a caller passes in and records a warning
  (`"readOnly was forced to true."` / `"allowMutations was forced to
  false."`) if the caller attempted to change them.
- **No-mutation guard.** `assertPMFreakAocReadOnlyOperation` /
  `isPMFreakAocForbiddenSurfaceOperation` recognize every operation name
  in `PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS` (project/task/milestone/
  risk/evidence/approval CRUD beyond read, invoice creation, email/Slack/
  client communication, action approval/execution, decision writeback) and
  throw. This is a guardrail only — there is no executor or writeback path
  behind it to bypass.
- **Redaction.** `redactPMFreakAocSurfaceValue` / `redactPMFreakAocSurfaceSnapshot`
  never mutate their input. `safe_demo` redacts obvious emails, token/
  secret/authorization-shaped fields, and connection-string-shaped values.
  `strict` additionally empties `metadata` objects and redacts `sourceUrl`
  fields.
- **Claim safety.** `assertNoPMFreakAocReadOnlySurfaceOverclaim` /
  `evaluatePMFreakAocReadOnlySurfaceClaimSafety` sweep any surface
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

Exposing PMFreak data through this surface does not mean AOC has approved an action.
Exposing evidence references does not certify evidence.
Exposing approval references does not certify approval validity.
Exposing billing-related data does not certify invoice readiness.
Exposing jurisdiction-related fields does not certify compliance.

`present: true` on an evidence/approval reference only means this surface
observed a reference to it in PMFreak's own source data — never that the
underlying evidence or approval is valid, sufficient, or reviewed.

## What comes next

Next: **AOC PMFreak Read-Only Connector** (`aoc.integration.pmfreak.read_only_connector.v1`) — a separate module in the AOC Enterprise repository that consumes the snapshots this surface produces.

This surface only exposes and normalizes PMFreak's own data — it is not a decision bridge, not an enforcement gateway, and not a PMFreak action executor. Any project-governance snapshot adapter, dry-run decision bridge, or enforcement gateway that consumes this surface's output belongs downstream, in AOC Enterprise, not here.
