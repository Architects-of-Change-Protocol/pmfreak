# P0-PKG-06 — PMFreak → Frontera enforcement boundary

**Status: BLOCKED — no legitimate product-runtime boundary can be built from the frozen
artifacts without either fabricating a canonical authorization artifact or adding
persistence this increment is not authorized to add.**

P0-PKG-05 left one honest gap: `FRONTERA_PACKAGE_INTEGRATION=PASS` meant *installed and
loadable*, not *depended upon*. No PMFreak product file imports `@aoc-enterprise/runtime`.
P0-PKG-06 set out to close that by finding the real place in PMFreak's Material Action
path where Frontera enforcement belongs, and proving the frozen public surface can be
driven from it.

The audit is complete. The boundary **location** is not the problem — it exists, it is
narrow, and it is exactly where the architecture says it should be. The problem is that
neither frozen artifact can be driven from it honestly:

```
FRONTERA_PACKAGE_PROVENANCE          = PASS  (preserved, re-verified from this commit)
FRONTERA_PRODUCT_RUNTIME_CONSUMPTION = BLOCKED
THREE_REPOSITORY_INTEGRATION         = NOT_CLAIMED
```

Nothing was fabricated to move that line. No adapter was written, no capability token was
invented, no `as unknown as` cast was used, no PMFreak module was made to import Frontera
for the sake of a gate. This increment is **documentation and analysis only** — the diff
contains no runtime, application, schema or dependency change.

---

## 1. Provenance — frozen artifacts, re-verified from this commit

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

## 4. Why this is BLOCKED anyway

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

## 6. Verification from this commit

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
