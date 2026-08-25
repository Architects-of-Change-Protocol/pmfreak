# P0-PKG-04 — BLOCKED: symbol ownership cannot yet be mapped to the frozen package surfaces

**Status: BLOCKED — execution phase closed.**

**Blocker:** PMFreak still contains active governance symbols whose ownership and public
contract cannot yet be mapped cleanly to the frozen Protocol / Frontera package surfaces.

This report exists to state that blocker precisely. The packaged-artifact integration
itself is complete and verified — see
[`p0-pkg-04-packaged-artifact-integration.md`](./p0-pkg-04-packaged-artifact-integration.md)
for the evidence, all of which stands. What is blocked is restriction #8 of the P0-PKG-04
execution constraints: *migrate the active dependency on the local copied packages to the
root-installed canonical package identity, using only declared public exports.*

That migration cannot be performed in this increment, and the reason is not a packaging
defect. It is that the symbols PMFreak's active code depends on **do not exist in the
frozen upstream public surfaces**, or exist there under the same name with an
**incompatible shape**. Satisfying restriction #8 would require widening Protocol or
Frontera, which restriction #9 of the original brief forbids.

## Why this is a genuine blocker and not a gate-tuning problem

Two facts settle it:

1. **27 of the 44 symbols the active graph imports are not reachable through any declared
   public export** of either frozen artifact — not through a private path either; they do
   not exist upstream at all.
2. Of the 17 that *are* publicly reachable by name, **only 3 are shape-compatible**
   (`WorkspaceId`, `ProjectId`, `AgentId` — all `= string`). The other 14 are **name
   collisions with divergent semantics**. Silently binding PMFreak to those would be worse
   than the missing ones: the code would compile against a contract that means something
   different.

Illustrative collisions:

| Symbol | PMFreak (local) | Frozen upstream |
|---|---|---|
| `CapabilityPermission` | `"read" \| "write" \| "approve" \| …` | `'resource:read' \| 'resource:create' \| 'governance:approve' \| …` |
| `CapabilityResourceType` | `"workspace" \| "project" \| "operational_memory" \| "ai_coprocess" \| …` | `'workspace' \| 'project' \| 'document' \| 'dataset' \| 'policy' \| …` |
| `PolicyDecision` | `"allow" \| "deny" \| "require_approval" \| "expired" \| "no_match"` | `'allow' \| 'deny' \| 'conditional'` |
| `AgentScope` | persisted row object (`agent_id`, `workspace_id`, `status`, …) | `readonly string[]` |
| `CapabilityGrant` | persisted row object | `= CapabilityToken` |
| `AuditEventEnvelope` | snake_case persisted event | camelCase `readonly` canonical envelope |
| `Delegation` | persisted delegation row | `{ delegator, chainDepth, maxDepth, allowedReDelegation }` |
| `evaluateEnforcementPipeline` | `(input, ComposeRuntimeContextOptions)` | `(input: AuthorizationGrantInput, deps: AuthorizationOrchestrationDeps)` |

A further subtlety worth recording: the four PMFreak ports that *do* have publicly exported
upstream counterparts — `AccessVerificationPort`, `PolicyEvaluatorPort`, `TrustDomainPort`,
`TrustCoordinationPort` — reach them only through aliases the upstream package itself marks
`@deprecated`, pointing at differently-shaped providers (`ExecutionAuthorizationProvider`,
`PolicyDecisionProvider`, `TrustRegistryProvider`, `RevocationLookup`). Upstream's providers
expose a single canonical-request method returning `AdapterResult<…>`; PMFreak's ports expose
multi-method domain surfaces (`requireWorkspaceMembership`, `getActiveSigningKey`, …). Binding
to a deprecated alias whose shape does not match is not a migration.

## Complete symbol inventory

44 distinct symbols are imported from the two retained copies by the active build/test/runtime
graph. "Importers (ext.)" counts all importing files, and in parentheses those **outside**
`src/aoc/` — i.e. genuine application code, not intra-copy wiring.

Classification: **A** genuine PMFreak-owned application logic · **B** adapter /
anti-corruption layer · **C** duplicated upstream semantics · **D** PMFreak-specific
extension incorrectly living under `src/aoc/*` · **E** upstream capability genuinely missing.

| Symbol | Defined in | Importers (ext.) | Originated from | Public upstream export? | Equivalent upstream symbol under another name | Class |
|---|---|---|---|---|---|---|
| `AccessVerificationPort` | `src/aoc/protocol/ports/access-verification.ts` | 2 (0) | old local Protocol copy | `@aoc/protocol./adapters` | `ExecutionAuthorizationProvider` (upstream alias is `@deprecated`) | B |
| `AgentAttestationPort` | `src/aoc/protocol/ports/agent-attestation.ts` | 2 (0) | old local Protocol copy | **no** | `AttestationLookup` (different surface) | B + E |
| `AgentId` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `AgentId` (identical: `= string`) | C |
| `AgentScope` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `AgentScope = readonly string[]` (**incompatible**) | C |
| `AocAccessDeniedError` | `src/aoc/protocol/ports/access-verification.ts` | 1 (0) | old local Protocol copy | **no** | `ProtocolError` family | B + E |
| `AocActorContext` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocActorRole` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocGovernanceAction` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocGovernanceDecisionState` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocGovernanceEventType` | `src/aoc/protocol/ports/security-audit.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocPermission` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AocTrustLevel` | `src/aoc/protocol/actor-model.ts` | 1 (0) | old local Protocol copy | **no** | — | A + D |
| `AuditEventEnvelope` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `AuditEventEnvelope` (**incompatible**) | C |
| `CapabilityClaimPorts` | `src/aoc/protocol/ports/capability-verification.ts` | 2 (0) | old local Protocol copy | **no** | — (no upstream claim-signing port bundle) | B + E |
| `CapabilityGrant` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `CapabilityGrant = CapabilityToken` (**incompatible**) | C |
| `CapabilityPermission` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `CapabilityPermission` (**incompatible vocabulary**) | C |
| `CapabilityRequest` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `CapabilityRequest` (**snake_case row vs camelCase contract**) | C |
| `CapabilityResourceType` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `CapabilityResourceType` (**incompatible members**) | C |
| `Delegation` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `Delegation` (**incompatible**) | C |
| `GOVERNANCE_POLICY_REGISTRY` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `GovernanceAction` | `src/aoc/enterprise/runtime/governance-core.ts` | 4 (4) | old local Enterprise copy | **no** | — | A + D |
| `GovernanceActorType` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `GovernanceDecisionState` | `src/aoc/enterprise/runtime/governance-core.ts` | 3 (3) | old local Enterprise copy | **no** | — | A + D |
| `GovernanceDecisionStatus` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `GovernanceEvaluationInput` | `src/aoc/enterprise/runtime/governance-core.ts` | 5 (4) | old local Enterprise copy | **no** | — | A + D |
| `PolicyDecision` | `src/aoc/protocol/contracts/index.ts` | 3 (1) | old local Protocol copy | `@aoc/protocol.` | `PolicyDecision` (**incompatible members**) | C |
| `PolicyEvaluationInput` | `src/aoc/protocol/ports/policy-evaluation.ts` | 1 (0) | old local Protocol copy | **no** | `PolicyDecisionRequest` | B |
| `PolicyEvaluationResult` | `src/aoc/protocol/ports/policy-evaluation.ts` | 1 (0) | old local Protocol copy | **no** | `PolicyDecisionResult` | B |
| `PolicyEvaluatorPort` | `src/aoc/protocol/ports/policy-evaluation.ts` | 2 (0) | old local Protocol copy | `@aoc/protocol./adapters` | `PolicyDecisionProvider` (upstream alias is `@deprecated`) | B |
| `PrivilegedDbPort` | `src/aoc/protocol/ports/privileged-db.ts` | 2 (0) | old local Protocol copy | **no** | — (no upstream persistence port) | B + E |
| `ProjectId` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `ProjectId` (identical: `= string`) | C |
| `SecurityAuditPort` | `src/aoc/protocol/ports/security-audit.ts` | 2 (0) | old local Protocol copy | **no** | `ObservabilityEventSink` (different surface) | B + E |
| `TrustCoordinationPort` | `src/aoc/protocol/ports/trust-coordination.ts` | 2 (0) | old local Protocol copy | `@aoc/protocol./adapters` | `RevocationLookup` (upstream alias is `@deprecated`) | B |
| `TrustDomainPort` | `src/aoc/protocol/ports/trust-domain.ts` | 2 (0) | old local Protocol copy | `@aoc/protocol./adapters` | `TrustRegistryProvider` (upstream alias is `@deprecated`) | B |
| `WorkspaceId` | `src/aoc/protocol/contracts/index.ts` | 1 (1) | old local Protocol copy | `@aoc/protocol.` | `WorkspaceId` (identical: `= string`) | C |
| `claimToAuditMetadata` | `src/aoc/protocol/contracts/capability-claims.ts` | 1 (0) | old local Protocol copy | **no** | — | A |
| `createApprovalRequestFromDecision` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `createCapabilityClaim` | `src/aoc/protocol/contracts/capability-claims.ts` | 1 (0) | old local Protocol copy | **no** | — (not publicly exported upstream) | A + C |
| `enforceEnforcementPipeline` | `src/aoc/enterprise/runtime/index.ts` | 2 (2) | old local Enterprise copy | `@aoc-enterprise/runtime.` | `orchestrateAuthorization` (closest; no `enforce*` counterpart) | B |
| `enforceGovernanceAction` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `evaluateEnforcementPipeline` | `src/aoc/enterprise/runtime/index.ts` | 1 (1) | old local Enterprise copy | `@aoc-enterprise/runtime.` | `evaluateEnforcementPipeline` (same name, signature `(input, deps)` vs local `(input, options)`) | B |
| `evaluateGovernanceAction` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `explainGovernanceDecision` | `src/aoc/enterprise/runtime/governance-core.ts` | 1 (1) | old local Enterprise copy | **no** | — | A + D |
| `hashCapabilityClaim` | `src/aoc/protocol/contracts/capability-claims.ts` | 1 (0) | old local Protocol copy | **no** | — | A + C |

### What the classification says

| Class | Count | Reading |
|---|---|---|
| **A + D** — PMFreak-owned logic sitting under `src/aoc/*` | 17 | The route-level governance policy registry, evaluation and approval flow, plus PMFreak's actor/permission vocabulary. Never upstream's; misfiled, not duplicated. |
| **B** (incl. B + E) — adapter / anti-corruption layer | 13 | Dependency-inversion ports PMFreak defines so its Supabase/audit/crypto infrastructure can be injected. Four have deprecated, differently-shaped upstream counterparts; five have none at all (`B + E`). |
| **C** — duplicated upstream semantics | 11 | Persistence-shaped projections of concepts upstream also models. These are the real migration surface, and the real risk: same names, different meaning. |
| **A + C** / **A** — PMFreak crypto over a shared concept | 2 + 1 | Capability-claim signing and hashing (`A + C`), plus its audit-metadata projection (`A`). Upstream ships `CAPABILITY_CLAIM_VERSION` but no signing surface. |

The single most important line in that table: **not one symbol is class E alone**. There is
no case of "PMFreak needs a capability upstream simply forgot". The blocker is an
**ownership** question — which layer these 44 symbols belong to — not a missing-feature
question. That is why it cannot be resolved by widening upstream, and why it should not be
resolved by a rename that only changes where the same code sits.

## The `@pmfreak/*` alias deviation

Six TypeScript path entries currently resolve to the retained copies. They are the exact
deviation from the strict P0-PKG-04 target, and they are recorded here rather than removed:

| File | Alias | Resolves to |
|---|---|---|
| `tsconfig.json` | `@pmfreak/aoc-protocol-internal` | `./src/aoc/protocol/index.ts` |
| `tsconfig.json` | `@pmfreak/aoc-protocol-internal/*` | `./src/aoc/protocol/*` |
| `tsconfig.json` | `@pmfreak/aoc-enterprise-internal` | `./src/aoc/enterprise/runtime/index.ts` |
| `tsconfig.json` | `@pmfreak/aoc-enterprise-internal/*` | `./src/aoc/enterprise/runtime/*` |
| `src/aoc/enterprise/tsconfig.build.json` | `@pmfreak/aoc-protocol-internal` | `../protocol/dist/index.d.ts` |
| `src/aoc/enterprise/tsconfig.build.json` | `@pmfreak/aoc-protocol-internal/*` | `../protocol/dist/*` |

**Why this is a deviation.** The strict target is that *all* PMFreak compilation consuming
Protocol or Frontera resolves through the installed `node_modules` packages and their
shipped declarations. These six entries resolve into `src/aoc/protocol` and
`src/aoc/enterprise` instead. Two honest qualifications, neither of which dissolves the
deviation:

- **What they resolve to is PMFreak-owned source, not vendored upstream code.** The
  inventory above is the evidence: 27 of 44 symbols have no upstream counterpart, and the
  overlapping ones differ in shape. These directories are PMFreak's own governance layer.
- **But they are indistinguishable from a local copy by path and by name.** They sit at
  `src/aoc/protocol` and `src/aoc/enterprise` and were, until this increment, published
  under the canonical names. No mechanical check can tell "PMFreak-owned code that was
  misfiled" from "a local copy of the canonical package" by location alone — which is
  precisely why the strict target forbids the alias.

So the deviation is real and is not being argued away. It is scoped, recorded, and
mechanically bounded: **the canonical identities `@aoc/protocol` and
`@aoc-enterprise/runtime` cannot resolve through these aliases**, and the gate's negative
controls prove a reintroduced `file:src/aoc/*` or an upstream-name alias fails.

## Evidence that stands (unchanged by this blocker)

Everything below was produced and verified in this increment and is **not** affected by the
ownership blocker:

| Evidence | State |
|---|---|
| `@aoc/protocol` resolution | `0.2.0-rc.0` → `node_modules/@aoc/protocol/dist/contracts/index.js` — never under `src/aoc/` |
| `@aoc-enterprise/runtime` resolution | `1.0.0` → `node_modules/@aoc-enterprise/runtime/dist/src/index.js` — never under `src/aoc/` |
| `file:src/aoc/*` manifest dependencies | **none**, anywhere in the repository; `npm ci` creates no `node_modules/@pmfreak/*` |
| Tarball checksums | SHA-256 `dbe8a08f…d10445e5` and `53d9e6ce…45a2de` verified against the lock |
| Exports fingerprints | `a67d65b1…` (15 keys) and `2b0ee1e3…` (10 keys) verified |
| Frozen integration contract | `aoc.cross-repository-integration@1.0.0`, status `frozen`, verified |
| Negative controls | 14/14 pass, including reintroduced `file:src/aoc/protocol` and `file:src/aoc/enterprise` |
| P2-14 Founder journey | **17/17 checkpoints PASS** (30/30 tests) through the packaged boundaries |
| Tenancy / authority negatives | all pass (cross-tenant both directions, viewer, PM authority, governance, logged-out, DEMO≠LIVE, idempotency, hard refresh, responsive, accessibility) |
| Full validation battery | typecheck, lint, 13,273 tests, build, and the complete governance chain pass |

## Claims

```
PROTOCOL_PACKAGE_INTEGRATION=PASS
FRONTERA_PACKAGE_INTEGRATION=PASS
PMFREAK_FOUNDER_JOURNEY=PASS
THREE_REPOSITORY_INTEGRATION=NOT_CLAIMED
```

`THREE_REPOSITORY_INTEGRATION` is **not** claimed. The artifacts are real, pinned and
executing, and the Founder journey passes across them — but PMFreak's governance layer has
not been shown to sit cleanly on either side of the package boundary, and that is part of
what the claim would assert.

## Recommended follow-up increment (separate, explicitly scoped)

**P0-PKG-05 — Governance layer ownership resolution.** Its question is not packaging; it is:
*for each of the 44 symbols above, which side of the boundary does it belong to?* Proposed
scope, in order:

1. **Decide ownership per class, not per file.** Class A+D (17 symbols) → relocate to
   PMFreak application space under a name that makes the ownership obvious, removing the
   `src/aoc/*` ambiguity. Class B (12) → keep as an explicit, named anti-corruption layer,
   and decide per port whether to re-express it in terms of the upstream provider it
   shadows.
2. **Resolve the class C collisions deliberately** (11 symbols). For each, either adopt the
   upstream contract and migrate the persistence projection behind a mapper, or rename the
   PMFreak type so the collision disappears. Each choice is a behavioural decision with
   database implications — that is why it needs its own increment and its own gates, not a
   rename inside a packaging change.
3. **Take the four deprecated upstream port aliases to Protocol** as a question, not a
   patch: they are marked `@deprecated` and PMFreak's shapes do not match them. Whether
   Protocol should express these capabilities differently is an upstream design decision.
4. **Only then** remove the `@pmfreak/*` aliases and the `src/aoc/{protocol,enterprise}`
   directories, and re-run this increment's gate — at which point
   `THREE_REPOSITORY_INTEGRATION` becomes claimable.

Explicitly **not** in that increment: publication, tagging, registry configuration, and the
P2-15-owned debt (state-changing `GET /logout`, LIVE retry quality-field semantics).

---

## Handoff

The P0-PKG-04 **execution phase closes here, BLOCKED**. The packaged-artifact integration
is preserved in full and is not reverted; the local-copy relocation is explicitly *not*
part of this increment; neither upstream repository was modified; PR #585 is not merged.

The unresolved boundary is handed to a new increment:

> **P0-PKG-05 — PMFreak governance-layer ownership resolution**

Its scope is the four-step plan in the previous section, and its entry condition is this
document's 44-symbol inventory and classification. `THREE_REPOSITORY_INTEGRATION` becomes
claimable at the end of P0-PKG-05, not before.

---

## Addendum — resolved by P0-PKG-05

**Everything above is the P0-PKG-04 record and is left exactly as it was written.** Its
measurements were true when taken and remain the entry condition for the increment that
resolved them. This addendum records what happened next; it does not revise the history.

The progression:

```
P0-PKG-04:
  packaged artifacts integrated
  Founder journey passed
  ownership blocker discovered
  status at that point = BLOCKED

P0-PKG-05:
  ownership blocker resolved
  old pseudo-upstream layer eliminated
  Founder journey revalidated
  three-repository integration = claimable
```

All 44 symbols now carry a final disposition in
[`governance-ownership.lock.json`](../../governance-ownership.lock.json), validated
mechanically by `npm run check:governance-ownership`:

| Disposition | Count |
|---|---|
| `CANONICAL_UPSTREAM` | 3 |
| `PMFREAK_DOMAIN` | 18 |
| `PMFREAK_PORT` | 10 |
| `PMFREAK_PERSISTENCE_PROJECTION` | 8 |
| `PMFREAK_IMPLEMENTATION` | 5 |
| `PMFREAK_ADAPTER` | 0 |
| `REMOVED_DEAD` | 0 |
| **TOTAL** | **44** (0 unresolved) |

The four conclusions this report reached all held up under the resolution:

- **27 symbols have no upstream counterpart** — confirmed. They are PMFreak's, and are now
  named and located as PMFreak's.
- **Only 3 of 17 name-reachable symbols are shape-compatible** — confirmed against the
  installed artifact. Those three (`WorkspaceId`, `ProjectId`, `AgentId`) were adopted from
  `@aoc/protocol`; the other 14 were renamed rather than bound.
- **The four ports reach upstream only through `@deprecated`, differently-shaped aliases** —
  confirmed. None was adopted. Each remains a PMFreak-owned port.
- **No symbol is class-E-only** — confirmed. Neither upstream repository was modified and no
  public export was widened.

The `@pmfreak/*` alias deviation recorded above is closed: all six entries are gone, and
`src/aoc/protocol` and `src/aoc/enterprise` are absent. The reasoning behind each decision
is in [ADR-PMF-075](../adr/ADR-PMF-075-pmfreak-governance-ownership.md).

One thing this report did not surface, because it was scoped to the two directories: three
further canonical-name collisions existed elsewhere in the graph
(`CapabilityPermission` and `CapabilityResourceType` in `src/lib/security/capability-flow.ts`,
and an `AgentId` in `src/lib/pmo/pmo-tenant-types.ts` that was a fixed union of agent role
keys). The P0-PKG-05 collision gate found them on its first run. They are now renamed.
