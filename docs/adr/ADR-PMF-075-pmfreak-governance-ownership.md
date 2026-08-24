# ADR-PMF-075 — PMFreak governance ownership and the Soberanía anti-corruption boundary

**Status:** Accepted (P0-PKG-05)
**Supersedes the boundary question left open by:** [P0-PKG-04 blocker report](../release/p0-pkg-04-blocker-symbol-ownership.md)
**Machine-readable record:** [`governance-ownership.lock.json`](../../governance-ownership.lock.json)

## Context

PMFreak contained two directories — `src/aoc/protocol` and `src/aoc/enterprise` — that
looked like local copies of the canonical Soberanía Protocol and Frontera packages. They
carried the canonical vocabulary, were published under `@pmfreak/aoc-*-internal` aliases,
and their file headers described themselves as application-neutral protocol code awaiting
"future extraction" into standalone packages.

They were not copies of anything. P0-PKG-04 inventoried the 44 symbols the active build,
test and runtime graph imported from them and found that **27 do not exist upstream at
all**, publicly or privately. Of the 17 reachable by name, **only 3 were shape-compatible**.
The other 14 were name collisions with divergent semantics — the dangerous case, because
code compiles against a contract that means something else.

That inventory settled what the directories actually were: **PMFreak's own governance
layer, misfiled under someone else's name**. The file that made this unmistakable is
`governance-core.ts`, which held the route-level authority policy registry, PMFreak role
names (`owner`, `admin`, `external_stakeholder`) and a direct write to PMFreak's
`governance_approval_requests` table — all inside a module titled "AOC Enterprise Runtime".

P0-PKG-04 correctly declined to resolve this inside a packaging increment and closed
BLOCKED. This ADR records how P0-PKG-05 resolved it.

## Decision

Three explicit categories now exist, and every symbol sits in exactly one.

### 1. Canonical upstream contracts

Imported from `@aoc/protocol` and `@aoc-enterprise/runtime` through declared public exports
only. Authoritative, external, never redefined locally.

Exactly three symbols qualified: `WorkspaceId`, `ProjectId`, `AgentId`. Each is `= string`
on both sides, publicly exported, not deprecated, not branded, with no optionality,
nullability or serialization difference. PMFreak's duplicate declarations were deleted.

### 2. PMFreak-owned governance domain

Relocated to `src/lib/governance/authority/`, imported as `@/lib/governance/authority/*`.
No alias, no package identity, no ambiguity about who owns it.

```
src/lib/governance/authority/
├── actor-model.ts          PMFreak actor, permission, action and decision vocabulary
├── capability-claims.ts    PMFreak claim issuance, hashing, verification
├── persistence/records.ts  PMFreak persistence projections
├── ports/                  PMFreak dependency-inversion ports
└── runtime/                PMFreak governance evaluation and enforcement
```

`Aoc*`-prefixed names were renamed to say what they are, not merely to drop a substring.
`AocTrustLevel` became `GovernanceRiskLevel` because its only consumer was
`GovernancePolicy.riskLevel` — it never expressed a trust level. `AocGovernanceAction` and
`AocGovernanceDecisionState` were merged into `GovernanceAction` and
`GovernanceDecisionState`: the runtime already declared those as aliases of the prefixed
originals, so the two names had always denoted one type.

### 3. Anti-corruption boundary

The ports in `src/lib/governance/authority/ports/` are PMFreak's, and the adapters in
`src/lib/aoc/adapters/` implement them over PMFreak infrastructure:

```
PMFreak governance domain
        │
        ▼
PMFreak-owned port          (src/lib/governance/authority/ports)
        │
        ▼
PMFreak adapter             (src/lib/aoc/adapters)
        │
        ▼
Supabase / audit store / key material
```

The mistake was never *having* these ports. It was placing them under
`src/aoc/protocol/ports` so they read as upstream contracts.

## Why upstream was not widened

Not one of the 44 symbols was class-E-only — there is no case of "PMFreak needs a
capability upstream forgot". Every gap is an ownership question, so widening Protocol or
Frontera would have moved PMFreak's product decisions into a shared contract. Neither
upstream repository was modified.

## Why the deprecated upstream aliases were not adopted

Four PMFreak ports have publicly reachable upstream counterparts, but only through aliases
upstream itself marks `@deprecated`, pointing at differently-shaped providers. Each was
compared on method surface, input and output shape, error model and failure semantics:

| PMFreak port | Upstream alias target | Why not adopted |
|---|---|---|
| `AccessVerificationPort` | `ExecutionAuthorizationProvider` | Four-method domain surface that throws on denial vs. one canonical-request method returning `AdapterResult<…>` |
| `PolicyEvaluatorPort` | `PolicyDecisionProvider` | Five-state outcome with matched policy/grant provenance vs. three-state canonical verdict |
| `TrustDomainPort` | `TrustRegistryProvider` | Seven-method key-lifecycle surface, including a synchronous env/vault-backed secret resolver |
| `TrustCoordinationPort` | `RevocationLookup` | Resolves revocation across four correlated identifiers at once |

**A deprecated alias with an incompatible shape is not semantic equivalence.** Binding to
one would have produced code that compiles and means something else — precisely the defect
this increment exists to remove.

## How the class-C collisions were resolved

No mapper was invented. Nothing in the active graph converts a PMFreak record into a
canonical contract, so writing conversions would have manufactured a boundary that does not
exist. Each collision was resolved by naming instead.

| Concept | PMFreak meaning | Canonical meaning | Strategy |
|---|---|---|---|
| `CapabilityPermission` → `CapabilityPermissionCode` | Bare persisted permission codes | Namespaced governance vocabulary (`resource:read`, `governance:approve`) | C4 — NO_EQUIVALENCE, no total mapping either way |
| `CapabilityResourceType` → `GovernedResourceType` | PMFreak product resources (`operational_memory`, `ai_coprocess`, `copilot`) | Generic resource classes (`document`, `dataset`, `policy`) | C4 — only `workspace`/`project` coincide |
| `PolicyDecision` → `PolicyEvaluationOutcome` | Five states incl. `require_approval`, `expired`, `no_match` | Three states (`allow`, `deny`, `conditional`) | C4 — `require_approval` carries approval routing `conditional` does not; `expired`/`no_match` are evaluator outcomes, not verdicts |
| `AgentScope` → `AgentScopeRecord` | Persisted `ai_agent_scopes` row | `readonly string[]` | C2 — different categories of object |
| `CapabilityGrant` → `CapabilityGrantRecord` | Persisted `capability_grants` row | Alias of `CapabilityToken` (signed, self-describing) | C2 |
| `CapabilityRequest` → `CapabilityRequestRecord` | snake_case storage row | camelCase contract, wider status vocabulary | C2 |
| `AuditEventEnvelope` → `AuditEventRecord` | snake_case persisted audit row | camelCase readonly canonical envelope | C2 |
| `Delegation` → `DelegationRecord` | Full delegation lifecycle row | Four-field chain-policy descriptor inside a token | C2 |

One rename was not a collision with a *type* but with a *function*: PMFreak's
`evaluateEnforcementPipeline` / `enforceEnforcementPipeline` became
`evaluateGovernancePipeline` / `enforceGovernancePipeline`. Frontera exports both original
names with the same arity but a different contract. Shared name plus shared arity made a
silent mis-binding possible; the rename removes it.

## What persistence means here

A **persistence projection** is a TypeScript description of a row PMFreak stores. Renaming
one renames a type, never a column, a stored value or an event name. This increment changed
no schema, added no migration, altered no RLS policy, rewrote no audit history and changed
no serialized governance vocabulary. Claim version strings, the `aoc-local` default trust
domain, the deprecated `pmfreak-capability-claim-v*` accepted values and every audit event
type are byte-identical, because they are persisted and must stay verifiable.

## Consequences

`src/aoc/protocol` and `src/aoc/enterprise` are gone, along with all six
`@pmfreak/aoc-*-internal` aliases. `src/aoc/` now holds only PMFreak's genuine integration
layer (`runtime-consumer/`, `runtime/adapters/`) and impersonates no package.

Three gates keep this from regressing, each with negative controls:

- `check:aoc-packages` — no manifest, alias or directory may impersonate a canonical name, and neither removed tree may return
- `check:governance-collisions` — a canonical name may be *imported* freely but never *declared* locally
- `check:governance-ownership` — all 44 decisions present, unambiguous, and true of the source

The collision gate found three ambiguities beyond the original 44, in code that never lived
in the pseudo-upstream trees: `CapabilityPermission` and `CapabilityResourceType` in
`capability-flow.ts` (narrower duplicates of PMFreak's own vocabularies) and an `AgentId` in
`pmo-tenant-types.ts` that was a `"scope" | "timeline" | …` union, not an identifier. All
three were renamed. That the gate found them on its first run is the argument for having it.

The local package publication path was removed: the `build:aoc` scripts, the reproducibility
and publish-readiness checks, and the two GitHub workflows that would have published PMFreak
source under the canonical names `@aoc/protocol` and `@aoc-enterprise/runtime`.

## Known limitation

PMFreak imports exactly one symbol from the canonical packages: `canonicalizeJSON` from
`@aoc/protocol/canonical`, plus the three identifier aliases adopted here. **No PMFreak
source imports `@aoc-enterprise/runtime` at all.** The artifact is installed, checksum-pinned,
loaded and gate-verified, but the active graph does not consume a symbol from it. P0-PKG-05
deliberately did not manufacture a consumption point: the nearest Frontera surfaces are
differently shaped, and binding to them to make the dependency look real is the exact defect
this ADR removes. Closing that gap is a genuine follow-up, not something this increment
should fake.
