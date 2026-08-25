# P0-PKG-06 — PMFreak → Frontera enforcement boundary

**Status: READY_FOR_ACCEPTANCE — the product-runtime boundary is built, real and
fail-closed. Local DB + Founder browser acceptance remain to be executed in an
environment that can run the stack.**

```
PROTOCOL_PACKAGE_INTEGRATION          = PASS
FRONTERA_PACKAGE_INTEGRATION          = PASS
FRONTERA_PRODUCT_RUNTIME_CONSUMPTION  = PASS      <- closed by Phase C
PMFREAK_GOVERNANCE_OWNERSHIP_BOUNDARY = PASS
PMFREAK_FOUNDER_JOURNEY               = NOT_RUN   (environment)
THREE_REPOSITORY_INTEGRATION          = NOT_CLAIMED
```

`THREE_REPOSITORY_INTEGRATION` stays **NOT_CLAIMED** for one reason and one only:
the Founder browser journey has not been re-run. The definition is not being
downgraded to fit what this container can do.

## How to read this document

This increment happened in three phases and the record keeps all three. The
first phase's conclusion was **BLOCKED**, and that is not edited out — it is why
the upstream work that unblocked it exists.

```
Phase A   boundary located; Frontera 1.0.0 could not supply independent
          durable authority                                    -> BLOCKED
Phase B   Frontera P0-PKG-07 (PR #112) shipped the durable
          Kernel Authority Runtime as @aoc-enterprise/runtime@1.1.0
Phase C   PMFreak consumes 1.1.0 at the real dispatch boundary  -> PASS
```

Sections 1–7 below are **Phase A, unchanged**. Phase B and Phase C follow them.

---


## 1. Provenance — frozen artifacts as at Phase A

> **Superseded in Phase C.** The Frontera row below describes 1.0.0, the artifact
> Phase A analysed. The artifact in the tree today is 1.1.0 — see Phase B.

Both artifacts verify byte-for-byte against the values frozen in P0-PKG-04.

| | `@aoc/protocol` | `@aoc-enterprise/runtime` |
|---|---|---|
| version | `0.2.0-rc.0` | `1.0.0` |
| source repo | `Soberania-Protocol/Soberania_Protocol` | `Soberania-Protocol/Soberania-Enterprise` |
| source commit | `dde34517d956156a0c735c18a805763a5e712879` | `11edd06e7d6ea38ae0bc037e91854444b84a50a7` |
| tarball | `vendor/aoc-protocol-0.2.0-rc.0.tgz` | `vendor/aoc-enterprise-runtime-1.0.0.tgz` |
| expected SHA-256 | `dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5` | `53d9e6ce4f3ba8fd82bbd90ebe5bc53f8bffb597b0d11bfd22d9a1ba5245a2de` |
| **actual SHA-256** | **identical** | **identical** |
| exports fingerprint | `a67d65b17dcb34c7…` verified | `2b0ee1e3afee7c02…` verified | 
| resolved path | `node_modules/@aoc/protocol/dist/contracts/index.js` | `node_modules/@aoc-enterprise/runtime/dist/src/index.js` |

`npm ci` installed cleanly with no `--force` and no `--legacy-peer-deps`.

---

## 2. The PMFreak execution path, traced

The Founder journey's governed Material Action reaches execution through exactly this
chain. Every hop was read, not inferred from names.

```
Recommendation
  -> src/app/api/operational-flow/route.ts POST  operation="record_decision"
     -> operational-flow-service.ts : recordHumanDecision
        (Decision persisted; creates NO Material Action — P2-14 STEP 10)

  -> route.ts POST  operation="propose_material_action"
     -> operational-flow-service.ts : proposeGovernedMaterialAction
        -> aoc-governance-request-client : createPMFreakMaterialActionProposal
        -> aoc-governance-request-client : evaluatePMFreakMaterialActionGovernance
        -> rpc persist_governed_material_action
        (governance_state='authorized', can_execute=false — authorization is inert)

  -> route.ts POST  operation="dispatch_material_action_to_task"     <-- BOUNDARY
     -> operational-flow-service.ts : dispatchGovernedMaterialActionToTask
        -> canCreateOperationalEvidence(scope.role)        [last in-process gate]
        ===================== FRONTERA_ENFORCEMENT_BOUNDARY_CANDIDATE =====================
        -> rpc dispatch_governed_action_to_internal_task   [security definer, atomic]
             re-checks: membership, actor match, proposal digest, evaluation freshness,
             governance_state IN (authorized, not_required), policy+grant refs present,
             source decision eligible, evidence lineage, project dispatchable
             advisory xact lock + unique expression index -> exactly one Task
  -> Task -> Execution -> Outcome (non-achieved) -> Observation
```

**The candidate boundary is real and it is narrow.** It sits in
`src/lib/operational-flow/operational-flow-service.ts:365`
(`dispatchGovernedMaterialActionToTask`), after PMFreak's role gate and before the
dispatch RPC — the one point where PMFreak has finished its own governance and approval
work but has not yet created the Task.

Two properties of that point matter for everything below:

* **Idempotency lives inside the RPC**, not in TypeScript. The advisory transaction lock
  and the `execution_tasks_governed_action_uidx` unique expression index are what make one
  governed Action yield at most one Task. Anything placed *before* the RPC that has a
  persistent side effect becomes a second, unprotected side-effect boundary.
* **Everything PMFreak holds there is PMFreak-owned.** `scope.workspaceId`,
  `scope.projectId`, `scope.userId`, `scope.role`, `actionId`, `expectedProposalDigest`.
  No canonical Protocol value is in scope. The proposal's `grantReference` is the literal
  string `` `workspace-role-grant:${role}:${userId}` ``.

---

## 3. Selecting the Frontera operation

The frozen artifact exposes **two distinct** authorization surfaces, not one. Both were
read in full and one was executed.

### 3a. The `orchestrateAuthorization` family — rejected

`evaluateEnforcementPipeline`, `enforceEnforcementPipeline` and `orchestrateAuthorization`
are **the same operation**. Proven from the installed artifact, not assumed:

```js
// dist/src/runtime/authorization/index.d.ts
export { evaluateEnforcementPipeline as enforceEnforcementPipeline } from '../enforcement/authorization-pipeline.js';
// dist/src/runtime/enforcement/authorization-pipeline.js
async function evaluateEnforcementPipeline(input, deps) { return orchestrateAuthorization(input, deps); }
```

Its whole decision, from `authorization-evaluator.js`:

```js
const allowed = capabilityAllowed && delegationValid && agentAllowed && policy.allowed;
```

All four operands come from adapters the **caller** supplies
(`CapabilityRegistryAdapter`, `DelegationStoreAdapter`, `AgentAccessEvaluatorAdapter`,
`PolicyDecisionAdapter`), as do `IdentityResolverAdapter` and `AuditSinkAdapter`. If
PMFreak implements all six, Frontera contributes no authority — it is a Frontera-shaped
AND-gate over PMFreak's own answers.

It is also unsatisfiable. `AuthorizationGrantInput` has seven required fields:

| Frontera field | Type | PMFreak source at the boundary | Classification | Lossless | Authority-sensitive | Persistence-sensitive |
|---|---|---|---|---|---|---|
| `requestId` | `string` | `actionId`, or `decision:{id}` correlation | DERIVABLE_LOSSLESS | yes | no | no |
| `actorId` | `string` | `scope.userId` | DIRECT | yes | yes | no |
| `capability` | `@aoc/protocol` `CapabilityToken` | **none** | **NOT_AVAILABLE / UNSAFE_TO_DERIVE** | — | yes | — |
| `consentGrants` | `@aoc/protocol` `ConsentGrant[]` | **none** | **NOT_AVAILABLE** | — | yes | — |
| `access` | `EnterpriseScopedAccessRequest` | `principalId`=userId, `resource`={`targetResourceType`,`targetResourceId`}, `requestedScope`=[`intendedOperation`], `requestedAt`=now | DERIVABLE_WITH_EXPLICIT_ADAPTER | no (`action` unset) | yes | no |
| `tenantId` | `string` | `scope.workspaceId` | DERIVABLE_LOSSLESS | yes | yes | no |
| `orgId` | `string` | **none** | **NOT_AVAILABLE** | — | yes | — |

Three required fields cannot be produced:

**`capability: CapabilityToken`.** The canonical shape requires `tokenId`, `issuer`,
`subject`, `resource: ResourceRef`, `scope: string[]`, `expiresAt`, and
`proof: { proofType: 'jwt'|'mTLS'|'detached-signature'|'custom', issuedAt }`. Searched
exhaustively:

* `@aoc/protocol@0.2.0-rc.0` exports `CapabilityToken` as a **type only**. There is no
  mint, issue, build or validate function for it anywhere in the public surface.
* `@aoc-enterprise/runtime@1.0.0` never issues one either — `createCapabilityClaim`,
  `issueDelegatedCapability` and `issueExecutionGrant` all take `capability: CapabilityToken`
  as *input*.
* PMFreak holds no value of that shape: `grep -rn "tokenId" src/` and
  `grep -rn "proofType" src/` both return **zero** hits.

The nearest PMFreak artifact is `grantReference = "workspace-role-grant:pm:<uuid>"` — a
formatted string derived from a workspace role. Converting it into a `CapabilityToken`
would be exactly the fabrication P0-PKG-06 forbids: minting an authorization artifact out
of a role name and stamping a `proof` on it that no key ever signed.

PMFreak *does* have a genuinely signed capability artifact — `CapabilityClaim` in
`src/lib/governance/authority/capability-claims.ts`, HMAC-SHA256/Ed25519 over a canonical
JSON profile. It does not rescue this, for two independent reasons. It is **not on this
path** (it is issued by `issueExecutionGrant` on the `governance_approval_requests` flow;
the operational-flow module imports only `./authority`, `./types`, `node:crypto` and the
PMFreak material-action contract). And its shape is PMFreak-owned, recorded NO_EQUIVALENCE
by P0-PKG-05: structured `issuer`/`subject` objects against canonical `CanonicalId`
strings, no `tokenId`, optional `resourceType`/`resourceId` against required
`resource.kind`/`resource.id`, and `proof.algorithm ∈ {HMAC-SHA256, Ed25519}` against
`proof.proofType ∈ {jwt, mTLS, detached-signature, custom}` — two vocabularies, and the
claim `version` strings are persisted values that must not change.

**`consentGrants: ConsentGrant[]`.** PMFreak has no consent-grant concept on any governed
path. The only `consent` in the codebase is OAuth connector consent and founder-program
discovery consent — unrelated semantics. An empty array would be *honest*, but it does not
rescue the other two fields.

**`orgId: string`.** PMFreak's tenancy root is the workspace; there is no organization
above it and no `organizations` table. `orgId` is not decorative — the contract threads it
into `hasCapability`, `validateDelegation`, `evaluateAgentAccess`, `evaluatePolicy` and the
audit envelope, as the organizational scope each adapter authorizes *within*. Setting
`orgId = workspaceId` collapses two scopes Frontera keeps distinct. That is semantic loss
on an authority-sensitive field.

**Verdict: rejected.** Unsatisfiable without fabrication, and semantically empty even if
fabricated.

### 3b. The `AocKernel` family — semantically correct, and it works

`@aoc-enterprise/runtime/kernel` exports `createAocKernel`, and
`@aoc-enterprise/runtime/enterprise` exports `createDefaultKernelProviders`. Both are
**declared public export keys**. This is the surface the Phase-4 comparison was for, and it
is a genuinely different thing from 3a — the kernel's own docstring says it "remains the
only component in Soberanía Enterprise that produces a decision."

Its input asks for none of the three impossible fields:

```ts
KernelEvaluationRequest {
  requestId, requestedAt,
  actor:  { id, trustDomainId, principalId?, type? },
  action: { type, resourceScope, capability?: string, riskLevel?, sideEffectType?, ... },
  target?, organization?, context?, correlationId?, idempotencyKey?, expiresAt?
}
```

`action.capability` is an **optional plain string**. `organization` is optional. There are
no consent grants. Tenancy is `trustDomainId`. PMFreak can produce every one of these from
values it already holds at the boundary.

It was executed in-process against the frozen artifact. Reproduce from the repository root:

```js
const ent  = require('@aoc-enterprise/runtime/enterprise');
const kern = require('@aoc-enterprise/runtime/kernel');
const p = ent.createDefaultKernelProviders();
const r = p.recognitionRuntime;
const issuer = r.registerActor({ type: 'organization', displayName: 'PMFreak Issuer' });
const td     = r.createTrustDomain({ name: 'pmfreak', issuerActorId: issuer.id,
                 acceptedIssuerIds: [issuer.id],
                 acceptedActorTypes: ['human','organization','ai_agent'] });
const actor  = r.registerActor({ type: 'human', displayName: 'Founder',
                 issuerId: issuer.id, trustDomainId: td.id });
const pass   = r.issuePassport({ type: 'identity', subjectActorId: actor.id,
                 issuerActorId: issuer.id, trustDomainId: td.id });
const tok    = r.issueCapabilityToken({ subjectActorId: actor.id, principalActorId: actor.id,
                 issuerActorId: issuer.id, trustDomainId: td.id, capability: 'dispatch',
                 actions: ['external_write'], resourceScopes: ['project:p1'] });
const k = kern.createAocKernel({ recognitionProvider: p.recognitionProvider,
                                 clock: p.clock, idGenerator: p.idGenerator });
await k.evaluate({ requestId: 'a', actor: { id: actor.id, trustDomainId: td.id },
                   action: { type: 'external_write', resourceScope: 'project:p1',
                             capability: 'dispatch' },
                   requestedAt: new Date().toISOString(),
                   context: { passportId: pass.id, capabilityTokenId: tok.id } });
```

Observed, verbatim:

| Probe | `status` | `reasonCodes` |
|---|---|---|
| unseeded world | `denied` | `RECOGNITION_ACTOR_UNKNOWN`, `POLICY_ACTION_PROHIBITED` |
| actor + token, **no passport** | `denied` | `RECOGNITION_PASSPORT_INVALID`, `POLICY_ACTION_PROHIBITED` |
| fully seeded, matching scope | **`allowed`** | `ACTION_ALLOWED` |
| fully seeded, `resourceScope: project:OTHER` | `denied` | `AUTHORITY_SCOPE_EXCEEDED` — *"Resource project:OTHER is outside the capability token's resource scopes."* |
| fully seeded, `type: authority_mutation` | `denied` | `AUTHORITY_SCOPE_EXCEEDED` — *"Action authority_mutation is not granted by this capability token."* |
| **second `createDefaultKernelProviders()`, same ids** | `denied` | `RECOGNITION_ACTOR_UNKNOWN` |

This is a real, fail-closed enforcement engine. It discriminates scope and action
correctly, denies by default, and never throws for a governance outcome.

---

## 4. Why Phase A was BLOCKED

Read the last row of that table again.

`createDefaultKernelProviders()` builds, in its own words, "a real, **empty** (no
actors/trust domains/tokens registered) world" that is **in-memory and per-process**. A
second instance in the same process does not recognize an actor the first one registered.
Frontera is explicit about whose job seeding is:

> "Seeding real governance data is a deployment/operations concern, not something this
> Enterprise Host may fabricate on an operator's behalf."

That leaves exactly two ways to wire the kernel into
`dispatchGovernedMaterialActionToTask`, and both are blocked.

**Option 1 — seed the world per request, in-process.** PMFreak registers the issuer,
creates the trust domain, registers the actor, issues the passport and issues the
capability token from its own workspace role, then asks the kernel whether that actor holds
that capability. **The answer is determined by what PMFreak wrote microseconds earlier.**
PMFreak would be issuer, subject, registry and questioner at once. It cannot deny anything
PMFreak has not already decided to deny, so it enforces nothing — while writing
`FRONTERA_ALLOW` reason codes into the audit trail that a reader would take to mean an
independent sovereign authorization occurred. That is worse than no integration: it is a
false provenance claim, and it is precisely the architecture blocker P0-PKG-06 names —
*integration would exist only to satisfy a dependency claim*.

It fails a second, independent test too. Actor registration, passport issuance and token
issuance each emit audit events into the recognition runtime's trail. Placing them before
the dispatch RPC creates a **second side-effect boundary ahead of the idempotency
decision**, which the advisory lock and unique index do not cover.

**Option 2 — seed the world from durable state.** This is the architecture Frontera
intends, and it would be a real boundary: an operator-controlled enterprise registry that
PMFreak does not write, so the kernel can genuinely deny an actor PMFreak believes is fine.
It requires PMFreak to persist enterprise actors, trust domains, passports and capability
tokens, and to reconstitute the world on process start. PMFreak has **none** of those
tables. Creating them means new tables, new RLS policies and a migration.

P0-PKG-06 is not authorized to add persistence. Per its own stop conditions, that is where
this increment ends:

```
DATABASE_SCHEMA_CHANGED = NO
MIGRATION_ADDED         = NO
RLS_CHANGED             = NO
```

### The smallest unresolved decision

> **Does PMFreak acquire a durable, operator-seeded enterprise recognition registry —
> actors, trust domains, passports and capability tokens, persisted and reconstituted per
> process — as its own increment; or does the definition of
> `THREE_REPOSITORY_INTEGRATION` change to stop requiring in-process Frontera enforcement
> on the Material Action path?**

Everything else follows from that answer. It is a founder/architecture decision, not a
packaging one, which is why it is handed forward rather than guessed at.

---

## 5. Upstream gap specification

Recorded for a future Frontera increment. **Neither upstream repository was modified.**

```
required capability/surface =
  Either (a) a public, documented conversion from a host's own signed authorization
  artifact into @aoc/protocol's CapabilityToken, or (b) a documented persistence/
  hydration contract for the AocKernel recognition world (actors, trust domains,
  passports, capability tokens) so a host can reconstitute an operator-seeded world
  from its own durable storage.

current nearest public surface =
  (a) @aoc/protocol/contracts exports CapabilityToken as a TYPE with no issuer.
      @aoc-enterprise/runtime consumes it as input in every operation that mentions it.
  (b) @aoc-enterprise/runtime/enterprise exports createDefaultKernelProviders(), which
      builds an in-memory, per-process, deliberately empty world, plus
      createInMemoryGovernanceStore / createSqliteGovernanceStore — which persist
      DECISION TRACES, not the recognition world itself.

missing semantic =
  (a) provenance: who may issue a CapabilityToken, under what trust anchor, with what
      proof, such that a consumer's issuance is canonical rather than self-asserted.
  (b) continuity: how an operator-seeded recognition world survives a process boundary.

why existing export is insufficient =
  (a) a consumer can only construct a CapabilityToken object literal. Nothing in either
      artifact distinguishes an issued token from a fabricated one, so a host that mints
      its own is asserting authority the Protocol never granted it.
  (b) without hydration, every ALLOW the kernel returns traces back to a registration the
      calling process performed itself, which is not an independent authorization.

minimum upstream change required =
  (a) a Protocol-owned issuing/verifying surface for CapabilityToken (issuer identity,
      proof binding, verification), OR an explicit statement that hosts are the issuers
      and what that obliges them to.
  (b) a Frontera-owned export that serializes and rehydrates the recognition world, or a
      RecognitionProvider port a host can back with its own store.

why PMFreak cannot safely adapt around it =
  every available adaptation requires PMFreak to assert, in canonical vocabulary, an
  authorization fact it has no standing to assert — a token it did not receive, a consent
  grant that does not exist, an organization scope it does not model, or a recognition
  world it seeded for itself moments before asking about it.
```

### Separately: Frontera license metadata (unchanged, out of scope)

`@aoc-enterprise/runtime@1.0.0` still declares no `license` field, nor do its four bundled
private workspaces. Confirmed again here (`require('@aoc-enterprise/runtime/package.json').license === undefined`).
Recorded as upstream packaging debt, exactly as P0-PKG-05 left it. Not this increment's
problem and not fixable from PMFreak.

---

## 6. Verification (Phase A)

Everything below ran from the committed state, on Node v22.22.2 / npm 10.9.7.

| Gate | Result |
|---|---|
| `npm ci` | PASS — no `--force`, no `--legacy-peer-deps` |
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors, 620 warnings (baseline) |
| `npm test` | PASS — **13,308 tests, 0 fail, 17 skipped** (13,300 + 8; identical to the P0-PKG-05 baseline) |
| `npm run build` | PASS |
| `npm run check:governance` (full chain) | PASS |
| `check:aoc-boundaries` / `check:governance-boundary` | PASS |
| `check:governance-ownership` | PASS — 44/44 decisions resolved |
| `check:governance-collisions` | PASS |
| `check:packaged-aoc-artifacts` | PASS — both SHA-256 and both exports fingerprints verified; `src/aoc/protocol` and `src/aoc/enterprise` both report `absent (removed)` |
| `check:package-purity` | PASS — no PMFreak source inside either frozen artifact |
| `check:release-readiness` | PASS |
| **Frontera product-consumer gate** | **NOT ADDED** — see below |

**No product-consumer gate was added.** The gate P0-PKG-06 specifies must prove
`FRONTERA_PRODUCT_CONSUMERS >= 1`. There are zero, and adding a gate that asserts zero, or
importing Frontera into a module to make it one, are both dishonest. The gate belongs in
whichever increment produces a real consumer.

### 6a. Database and browser acceptance — not executable here

Unchanged from P0-PKG-05 and re-confirmed: this container cannot run Supabase. Every
container image blob returns `403 Forbidden` through the agent proxy
(`pkg-containers.githubusercontent.com`, `production.cloudfront.docker.com`). The proxy
documentation classifies this as report-don't-work-around, and no bypass was attempted.
Chromium and Playwright are present; the missing piece is the database and auth stack.

```
P2-13 seed / check:p2-13-db / check:p2-14-db      NOT_RUN  (environment)
check:operational-flow-db / check:fresh-db-migrations  NOT_RUN  (environment)
Founder browser journey (17 checkpoints)          NOT_RUN  (environment)
```

This is **not** what blocks P0-PKG-06, and the two must not be conflated. Even on a fully
capable stack, the Founder journey would traverse no Frontera boundary, because none
exists to traverse. The architectural question is upstream of the acceptance question.

---

## 7. Invariants — all preserved

Nothing in this increment touches behaviour, so every invariant holds by construction; the
gate battery above confirms it.

```
Recommendation        != Decision                    preserved
Decision              != Material Action             preserved
Action                != Task                        preserved
Task completion       != Outcome achievement         preserved
DEMO_FIXTURE          != LIVE                        preserved
correlation           != causation                   preserved
PMFreak governance    != Frontera authorization      preserved and reinforced
evaluateGovernancePipeline != evaluateEnforcementPipeline   distinction preserved
```

Authority composition was **not** implemented, because no Frontera call exists to compose
with. The rule it would have had to satisfy is recorded in
[ADR-PMF-076](../adr/ADR-PMF-076-pmfreak-frontera-enforcement-boundary.md) for whichever
increment builds it:

```
PMFREAK_DENY  + FRONTERA_ALLOW = DENY
PMFREAK_ALLOW + FRONTERA_DENY  = DENY
PMFREAK_ALLOW + FRONTERA_ALLOW = eligible to proceed
FRONTERA_ERROR / malformed     = DENY, no dispatch
```

## 8. Upstream impact

```
Protocol modified          = NO
Frontera modified          = NO
Protocol exports widened   = NO
Frontera exports widened   = NO
deep/private upstream imports = NO
packages published         = NO
tags created               = NO
GitHub Releases created    = NO
P2-15 started              = NO
```

---

# Phase B — the upstream gap was closed in Frontera

Phase A's gap specification became **P0-PKG-07** in
`Soberania-Protocol/Soberania-Enterprise`, merged as **PR #112**. Verified live
before anything in PMFreak was touched, from a full clone rather than from the
brief:

```
Soberania-Enterprise main HEAD = 8e7ded3b70855a47eb01bf2a9bc466f098b02438
merge commit message           = "Merge pull request #112 … P0-PKG-07: productionize
                                  durable Frontera authority/recognition for external enforcement"
source commit 74308ad1…        = ancestor of the merge commit (git merge-base --is-ancestor)
package.json at 74308ad1       = @aoc-enterprise/runtime 1.1.0
```

P0-PKG-07 added a whole `src/enterprise/kernel-authority/` module — an
append-only store with digest-chained events, a SQLite implementation, world
hydration, a durable provider set, an operator provisioning service and a
recognition bridge. Exactly the two things Phase A specified as missing:

| Phase A gap | P0-PKG-07 answer |
|---|---|
| (b) continuity — an operator-seeded recognition world that survives a process boundary | `createSqliteKernelAuthorityStore` + `createDurableKernelProviders` + `DurableKernelProviderSet.reload()` |
| (a) provenance — who may issue a credential, such that issuance is not self-asserted | Credentials are provisioned by an **operator** context (`system: true`) and resolved by Frontera; `findActorByExternalSubject` binds an external principal read-only |

Gap (a) was answered in a better way than Phase A proposed. Phase A asked for a
conversion into Protocol's `CapabilityToken`. Frontera instead removed the need
for one: `AocKernel`'s request carries no token at all, and the credentials are
Frontera's own durable records. PMFreak therefore never holds, mints or maps a
canonical capability token — the fabrication risk is not mitigated, it is absent.

## Artifact reproduction — bit-for-bit

The tarball was **not** taken on trust and **not** taken from a registry. It was
rebuilt from the frozen source commit in a detached worktree and hashed before
being vendored:

```
git worktree add <tmp> 74308ad1ee21108b9c1964ddf8f7530ba8c5308f
npm ci && npm run build && npm pack .        # node v22.22.2, npm 10.9.7

reproduced SHA-256 = ab4072b7c34971265ba637e63c7fd21bd8a95a5ef342056d59632f8ff6200e60
expected   SHA-256 = ab4072b7c34971265ba637e63c7fd21bd8a95a5ef342056d59632f8ff6200e60   IDENTICAL
sizeBytes  3375780     fileCount 6362 (npm pack's own "total files")
```

`fileCount` uses the same method that reproduces the recorded 6298 for 1.0.0
exactly, so the two rows are comparable rather than coincidentally similar.

**The exports fingerprint is unchanged at `2b0ee1e3afee…`, and that is correct
rather than suspicious.** The fingerprint digests the export *map*; P0-PKG-07
added its surface to the existing `./enterprise` and `./kernel` subpaths without
introducing a new one. It was recomputed from the installed 1.1.0 manifest, not
copied from the 1.0.0 record.

```
@aoc/protocol             0.2.0-rc.0  UNCHANGED  dbe8a08f432a…  a67d65b17dcb…
@aoc-enterprise/runtime   1.1.0       NEW        ab4072b7c349…  2b0ee1e3afee…
```

Protocol was not modified, not re-versioned and not re-packed. Neither upstream
repository was written to.

---

# Phase C — PMFreak consumes the durable authority world

## The boundary, as built

```
POST /api/operational-flow  { operation: "dispatch_material_action_to_task" }
  route.ts
    -> authorize(projectId, workspaceId, "write")          PMFreak tenancy + role
    -> operational-flow-service.ts : dispatchGovernedMaterialActionToTask
         -> canCreateOperationalEvidence(scope.role)       PMFreak role gate
         ═══════════ FRONTERA ENFORCEMENT BOUNDARY ═══════════
         -> src/lib/integrations/frontera : authorizeFronteraDispatch
              -> createSqliteKernelAuthorityStore(path)              [public export]
              -> store.findActorByExternalSubject({system:false,…})  [read-only]
              -> createDurableKernelProviders({store, organizationId})
              -> createAocKernel(...).evaluate(...)                  [public export]
         -> if (!frontera.allowed) return denied            NO RPC, NO Task
         ═════════════════════════════════════════════════════
         -> rpc dispatch_governed_action_to_internal_task    transaction + idempotency
              advisory xact lock + execution_tasks_governed_action_uidx
  -> exactly one Task
```

`src/lib/integrations/frontera/` is visibly PMFreak-owned. Nothing was placed
under `src/aoc/*`, no canonical namespace was reused, and the barrel deliberately
re-exports only the read/evaluate surface so no product module can obtain
Frontera's provisioning service by importing it.

## Why Frontera is asked on every attempt

The brief prefers skipping the Frontera call for an action PMFreak would itself
refuse. That was implemented and then **deliberately reverted**, because a
pre-check has two defects and asking every time has neither:

* It restates PMFreak governance semantics outside the RPC that owns them — the
  precise duplication ADR-PMF-075 exists to prevent.
* It opens a hole. An action that looked ineligible at read time but passed the
  RPC's own re-check a moment later would dispatch **having never been
  authorized by Frontera at all**. A read cannot be made race-free against a
  transaction it does not participate in.

The cost of the alternative is one read-only evaluation on a rare, high-value
operation. The brief's requirement is stated as "at minimum, the final outcome
must remain DENY and the dispatch RPC must not create a Task", which this
satisfies exactly.

## Mapping matrix — the real `KernelEvaluationRequest`

The obsolete `AuthorizationGrantInput` matrix from Phase A does not apply; that
operation was rejected. This is the contract actually used.

| Frontera field | PMFreak source | Semantics | Classification | Lossless | Authority-sensitive | Persisted source |
|---|---|---|---|---|---|---|
| `requestId` | `input.actionId` | the governed Material Action's identity | DIRECT | YES | no | YES (`material_action_proposals.id`) |
| `actor.id` | `findActorByExternalSubject(...)` → `record.entityId` | **Frontera's** actor id, resolved not assumed | DERIVABLE_WITH_EXPLICIT_ADAPTER | YES | YES | YES (Frontera store) |
| `actor.trustDomainId` | resolved actor record's `trustDomainId` | Frontera's own enforcement boundary | DIRECT (from Frontera) | YES | YES | YES (Frontera store) |
| `action.type` | constant `execute.material-action` | Frontera's documented action for external material-action execution | DIRECT | YES | YES | n/a |
| `action.resourceScope` | `project:${scope.projectId}` | the governed action's project | DERIVABLE_LOSSLESS | YES | YES | YES (`projects.id`) |
| `organization.id` | `scope.workspaceId` | PMFreak's tenancy root | DERIVABLE_LOSSLESS (identity) | YES | YES | YES (`workspaces.id`) |
| `requestedAt` | server clock | evaluation time | DIRECT | YES | no | no |

Nothing is fabricated, and no field is optional-in-Frontera-but-invented-here.
Note what is **absent** compared with Phase A: no `capability`, no
`consentGrants`, no `orgId`-with-no-referent. Those three unsatisfiable fields
were the Phase A blocker and this contract does not ask for them.

### Why each mapping is legitimate

**Organization = workspace.** The workspace is PMFreak's tenancy root:
`workspace_memberships` carries every authority grant, every project belongs to
exactly one workspace, and RLS isolates on it. There is no PMFreak entity above
a workspace, so nothing else is a candidate. It is used as an **identity**, not
a formatted string — a prefix would need parsing back out somewhere, and two
spellings of one tenant boundary is how cross-tenant leaks begin.

**Actor = the authenticated principal, resolved through Frontera.**
`scope.userId` is *not* assumed to be a Frontera actor id. It is presented as
`KernelAuthorityExternalSubject { system: "pmfreak", subjectId: <auth uid> }`
and Frontera returns the actor bound to it, or `null`. `(organizationId, system,
subjectId)` is unique upstream, so the same subject id in two workspaces
resolves to two different actors and never leaks authority between them — proven
by test, not assumed. That the dispatching principal is the right subject is not
guesswork either: the RPC itself refuses when `v_action.proposed_by <> auth.uid()`,
so the dispatcher is necessarily the proposer.

**Action = `execute.material-action`.** Frontera's own documented action for an
external application executing a governed material action
(`AOC_DURABLE_KERNEL_AUTHORITY.md`, "How applications evaluate"). Used because
upstream defines it for this case — not because a PMFreak route or task type was
reshaped to resemble it.

**Resource scope = `project:<projectId>`.** Frontera's grammar is hierarchical
and colon-delimited (`resource === scope || resource.startsWith(scope + ':')`,
`capability-token-service.ts`), and its own tests use the `project:1` form. A
grant on one project therefore cannot reach another — verified by a negative
test, not by reading the code.

**Trust domain comes from Frontera.** Read off the resolved actor record. PMFreak
never invents one and never creates one during dispatch.

## Capability provenance — the Phase A blocker, closed

```
authority store            Frontera-owned SQLite (append-only, digest-chained events)
authority owner            Frontera
actor / passport /
capability / grant         provisioned by an OPERATOR context (system: true)
PMFreak product can
provision                  NO — structurally, see below
fabricated token           NO — PMFreak never holds or constructs a credential
unsafe cast                NO
```

"Structurally" is meant literally. Frontera's `requireKernelAuthorityOperator`
rejects any context without `system: true`, and the product adapter builds
`{ system: false, organizationId }` and nothing else. No organization-scoped
context can reach a write path, so this is a property of the upstream store
rather than a PMFreak convention that could drift. The adapter additionally
never imports `createKernelAuthorityProvisioningService`, and
`check:frontera-consumer` fails if it ever does.

## Authority freshness — no stale ALLOW

Frontera v1's propagation model is single-writer: a world hydrated in one process
does not observe another process's writes until `reload()` or restart. A
long-lived cached provider set would therefore keep answering ALLOW for an actor
an operator had already revoked.

PMFreak opens the store and hydrates the world **per evaluation**, so an
out-of-band revocation is observed on the very next dispatch. This is the point
of the SQLite test below, which crosses a real close/reopen boundary rather than
reusing a handle.

```
single-writer propagation handled by   fresh store + fresh hydration per evaluation
external revocation observed           YES
stale ALLOW after revocation possible  NO
```

Per-workspace isolation follows from the same choice: the provider set is built
for one `organizationId` at evaluation time, so there is no cross-tenant provider
cache to key incorrectly.

## Fail-closed behaviour

Every one of these returns without reaching the dispatch RPC. `authorizeFronteraDispatch`
never throws; every failure resolves to a denial, because the only safe reading of
an exception at this boundary is "do not dispatch".

| Condition | Result | Dispatch RPC calls |
|---|---|---|
| Frontera DENY (wrong project) | `frontera_denied` | **0** |
| Frontera DENY (wrong action) | `frontera_denied` | **0** |
| unknown / unbound external subject | `frontera_actor_unbound` | **0** |
| revoked actor | `frontera_actor_unbound` | **0** |
| revoked capability / authority grant | `frontera_denied` | **0** |
| cross-organization request | `frontera_actor_unbound` | **0** |
| store unavailable / corrupt / config missing | `frontera_unavailable` | **0** |
| provider hydration or reload failure | `frontera_unavailable` | **0** |
| kernel error | `frontera_unavailable` | **0** |
| malformed kernel result | `frontera_malformed_result` | **0** |
| `approval_required` / `indeterminate` | `frontera_denied` | **0** |

There is no `catch { allowAnyway() }`, no "Frontera unavailable → bypass", no
"missing config → allow", and no development bypass. A missing store path is a
denial, not a skip. `check:frontera-consumer` fails the build if a catch block
ever reaches the RPC.

`approval_required` and `indeterminate` are treated as non-allow rather than
rounded up: only an explicit `allowed` proceeds.

## Authority composition

```
PMFREAK_DENY  + FRONTERA_ALLOW = DENY    the RPC still re-checks every PMFreak precondition
PMFREAK_ALLOW + FRONTERA_DENY  = DENY    the RPC is never reached
PMFREAK_ALLOW + FRONTERA_ALLOW = dispatch
FRONTERA_ERROR / malformed     = DENY, no dispatch
```

Frontera can only narrow. A Frontera ALLOW skips, relaxes and pre-satisfies
nothing: the RPC re-runs membership, actor match, proposal digest, evaluation
freshness, `governance_state`, policy/grant references, source-decision
eligibility, evidence lineage and project dispatchability inside its own
transaction afterwards. `PMFreak DENY can be overridden by Frontera = NO`.

## Idempotency

The RPC remains the sole transaction and idempotency boundary. No task creation
was moved into TypeScript and no part of the RPC's logic was reimplemented.

```
one Material Action -> at most one Task    PRESERVED (advisory lock + unique index)
concurrent authorized dispatch             PRESERVED (unchanged RPC)
Frontera denial creates a Task             NO
Frontera failure creates a Task            NO
```

**One behavioural change, characterised rather than glossed.** Frontera is now
consulted before every dispatch attempt, including a retry of an action that
already produced a Task. If an operator revokes authority *after* a successful
dispatch, a subsequent retry returns a Frontera denial instead of replaying the
existing Task. No Task is created, destroyed or duplicated — the exactly-one
invariant is untouched — but the retry's *response* differs from before. This is
the intended reading of fail-closed: an actor whose authority has been withdrawn
should not be able to replay a dispatch. It is recorded here because it is a real
contract change, not because it was discovered late.

## Product consumption proof

```
FRONTERA_PRODUCT_CONSUMERS = 3   (was 0)
```

| file | specifier | export key | purpose |
|---|---|---|---|
| `src/lib/integrations/frontera/enforcement-adapter.ts` | `@aoc-enterprise/runtime/enterprise` | declared | `createSqliteKernelAuthorityStore`, `createDurableKernelProviders`, `KernelAuthorityStore` |
| `src/lib/integrations/frontera/enforcement-adapter.ts` | `@aoc-enterprise/runtime/kernel` | declared | `createAocKernel` |

Reachable product call path:
`/api/operational-flow` → `dispatchGovernedMaterialActionToTask` →
`authorizeFronteraDispatch` → `AocKernel.evaluate()`.

`npm run check:frontera-consumer` proves this structurally rather than by
counting strings. It fails if the Frontera call is removed, moved after the RPC,
stripped of its early return, replaced with the empty in-process world, given a
deep or private import, or if any product file touches the provisioning surface.
**Each of those failure modes has its own negative-control test** in
`tests/frontera-product-consumer-gate.test.ts` — a gate only ever observed to
pass is not evidence.

## Test evidence

`tests/frontera-enforcement-boundary.test.ts` — 10 tests, all against the **real
packaged 1.1.0 runtime**. No test stubs `allowed: true`; the only mock is the
Supabase client, and only so dispatch RPC calls can be counted.

```
ALLOW  -> dispatch RPC called exactly once, Frontera decision id correlated
DENY   (wrong project)            -> 0 RPC calls
DENY   (unknown external subject) -> 0 RPC calls, and the principal stays unbound
DENY   (cross-organization)       -> 0 RPC calls
ERROR  (store unavailable)        -> 0 RPC calls
MALFORMED result                  -> 0 RPC calls
external subject binding          -> Frontera actor id != PMFreak user id
evaluation                        -> provisions nothing, even when it denies
denial                            -> leaks no Frontera reason codes to the caller
SQLite durability                 -> see below
```

The last one is the proof that Phase A's blocker is genuinely closed rather than
relocated:

```
operator process   provision authority in a SQLite store, then CLOSE it
application        fresh store handle, nothing carried in memory -> ALLOW, 1 RPC call
operator process   revoke capability + authority grant out of band, CLOSE
application        fresh store handle -> DENY, 0 RPC calls
```

Authority survives a process boundary, and a revocation written by a different
process is observed on the next dispatch. That is exactly the pair of properties
Phase A found `createDefaultKernelProviders()` could not provide.

## Founder browser acceptance — instrumentation added, run outstanding

`tests/e2e/p2-14-founder-story.spec.ts` keeps all **17 canonical checkpoints**;
none was rewritten, reduced or replaced. STEP 12 gained one assertion: the
dispatch response must carry `fronteraDecisionId`, the opaque id minted by
`AocKernel.evaluate()`. It cannot exist unless that evaluation returned
`allowed`, and PMFreak never mints one — so the browser journey either crosses
the real boundary or fails. No production bypass and no fake marker was added.

Run order for an environment that can host the stack:

```
npm run seed:p2-13-founder          # PMFreak DB state
npm run provision:founder-frontera  # OPERATOR-side Frontera authority
npm run test:e2e:p2-14              # the 17-checkpoint journey
```

`scripts/provision-founder-frontera-authority.mjs` provisions the **minimum**
authority for the one actor that actually dispatches: Tenant A's owner, one
action, one project scope, no wildcard. Tenant B is given **no** Frontera
authority at all — it dispatches nothing in the journey, and provisioning it
"just in case" would weaken the isolation the two-tenant scenario exists to show.
It resolves the real authenticated principal id from the seeded stack and fails
loudly rather than inventing an identity.

## Database impact

```
DATABASE_SCHEMA_CHANGED=NO   MIGRATION_ADDED=NO   RLS_CHANGED=NO
EXISTING_SERIALIZED_VALUES_CHANGED=NO   AUDIT_HISTORY_REWRITTEN=NO
EXISTING_EVENT_VOCABULARY_CHANGED=NO
```

No `.sql` file, no migration and no RLS policy is in the diff. Frontera's
authority state lives in Frontera's own SQLite store and was not copied into
Supabase. No PMFreak authority-mapping table was created — Frontera owns the
external-subject binding, which is why none is needed.

## Audit / evidence lineage

The two systems' evidence is kept distinct and correlated, never merged:

```
Recommendation -> Decision -> Material Action        PMFreak evidence (unchanged tables)
        |
        +-- Frontera authorization decision           Frontera's own audit trail
        |   correlated by requestId = Material Action id
        v
      Task -> Execution -> Outcome -> Observation     PMFreak evidence (unchanged)
```

The Frontera decision id is returned on the dispatch response for correlation
and is **not** written to any PMFreak table — durable cross-system evidence would
need a schema change, which this increment is not authorized to make. That
limitation is recorded rather than worked around. Frontera's reason codes and any
infrastructure diagnostic are logged server-side and deliberately not returned to
the client: they are what an operator needs and precisely what an arbitrary
caller should not learn about another system's authority structure.

## Verification (Phase C)

```
PMFREAK_FRONTERA_INTEGRATION_SOURCE_COMMIT = b27e7464da65c8af08bf7b5a7b0052dfb61b9a65
```

Every gate below ran from that commit's tree, Node v22.22.2 / npm 10.9.7. This
document is committed separately and contains no application, runtime, schema or
dependency change, so nothing verified above can have moved beneath it.

| Gate | Result |
|---|---|
| `npm ci` from a deleted `node_modules` | PASS — no `--force`, no `--legacy-peer-deps`; resolves 1.1.0 |
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| `npm test` | PASS — **13,328 tests, 0 fail, 17 skipped** (baseline 13,308; +20 new) |
| `npm run build` | PASS |
| `npm run check:governance` (full chain) | PASS |
| `npm run check:aoc-boundaries` | PASS |
| `npm run check:packaged-aoc-artifacts` | PASS — 1.1.0 SHA-256 and exports fingerprint verified |
| `npm run check:governance-ownership` | PASS — 44/44 |
| `npm run check:governance-collisions` | PASS |
| `npm run check:package-purity` | PASS |
| `npm run check:release-readiness` | PASS |
| **`npm run check:frontera-consumer`** | **PASS — FRONTERA_PRODUCT_CONSUMERS=3** |
| `npm run compliance:check` | PASS — regenerated; `blocked: 0` |

Two gates needed updating for the artifact swap and were updated rather than
weakened: `check-package-exports.mjs` pinned 1.0.0 (now 1.1.0, and it now also
requires `./kernel` and `./enterprise` to be present), and the compliance
inventory/SBOM were regenerated with the repo's own generators.

`check:packaged-aoc-artifacts` also caught something worth recording: the
negative-control test file contained *literal* deep-import and private-workspace
specifiers as fixtures, and the gate flagged them — correctly, since it cannot
tell a fixture from a real import. The fixtures now compose those strings at
runtime, so the gate stays strict and the negative control stays real. The gate
was not relaxed.

## Database and browser acceptance — NOT RUN (environment)

```
DB_ACCEPTANCE=NOT_RUN_ENVIRONMENT
FOUNDER_BROWSER_ACCEPTANCE=NOT_RUN_ENVIRONMENT
```

Unchanged from Phase A and re-confirmed: no Supabase stack is reachable here.
`OPERATIONAL_FLOW_TEST_*` is unset, the Supabase CLI is absent, and container
image blobs return `403` through the agent proxy. The proxy documentation
classifies this as report-don't-work-around; no bypass was attempted.

This is an environment limitation and is **not** being used to describe an
architectural gap. The architectural question Phase A raised is closed, by
execution against the real artifact.

## Upstream impact (Phase C)

```
Protocol modified          = NO      Frontera modified        = NO
Protocol exports widened   = NO      Frontera exports widened = NO
deep/private upstream imports = NO
packages published         = NO      tags created = NO      GitHub Releases = NO
P2-15 started              = NO
```

The Soberania-Enterprise clone was read-only: a detached worktree, a build and a
pack. Nothing was committed or pushed to either upstream repository.

## Known upstream debt (unchanged)

`@aoc-enterprise/runtime@1.1.0` still declares no `license`, and neither do its
four bundled private workspaces — re-confirmed after the swap
(`REVIEW_REQUIRED`, `blocked: 0`), exactly as recorded for 1.0.0. Upstream
packaging debt, not fixable from PMFreak, and not this increment's subject.
