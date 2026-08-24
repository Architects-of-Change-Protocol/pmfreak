# ADR-PMF-076 — Where the PMFreak → Frontera enforcement boundary sits, and why it is not yet built

**Status:** Accepted as a record of an unresolved architectural gap (P0-PKG-06)
**Builds on:** [ADR-PMF-075](ADR-PMF-075-pmfreak-governance-ownership.md) — PMFreak governance ownership
**Evidence:** [P0-PKG-06 enforcement boundary report](../release/p0-pkg-06-frontera-enforcement-boundary.md)

## Context

ADR-PMF-075 settled *ownership*: PMFreak's governance layer is PMFreak's, the canonical
Soberanía contracts are upstream's, and the two are not interchangeable. It left one thing
open, and said so plainly: no PMFreak product file imports `@aoc-enterprise/runtime`. The
Frontera artifact was installed, pinned, loadable and verified — but not depended upon.

`FRONTERA_PACKAGE_INTEGRATION=PASS` therefore meant *installed*, not *used*, and
`THREE_REPOSITORY_INTEGRATION` could not honestly be claimed on the strength of it.

P0-PKG-06 asked whether that gap can be closed: is there a place in PMFreak's product
runtime where Frontera enforcement legitimately belongs, and can the frozen public surface
be driven from it without fabricating anything?

The answer is **yes to the first, no to the second** — and the reason is worth recording,
because it is not a packaging accident.

## Decision

### 1. PMFreak governance stays PMFreak-owned. Frontera authorization stays separate.

Reaffirmed without qualification. The two answer different questions:

> **PMFreak governance:** *Has this product workflow legitimately reached an executable
> Material Action?* — recommendation lifecycle, human decision, approval routing,
> materiality classification, evidence lineage, task lifecycle, outcome tracking.
>
> **Frontera authorization:** *Is this actor, holding this capability, over this resource
> scope, authorized to execute under the sovereign enterprise boundary?*

Both may be required. Neither overwrites the other, neither reinterprets the other's reason
codes, and neither may be renamed into the other. In particular the P0-PKG-05 rename —
PMFreak's `evaluateGovernancePipeline` / `enforceGovernancePipeline` against Frontera's
`evaluateEnforcementPipeline` / `enforceEnforcementPipeline`, same arity, different
contract — stands and must not be aliased back.

### 2. The boundary sits between PMFreak authorization and task dispatch — and only there.

```
governed Material Action  (PMFreak: authorized, can_execute = false)
        |
        v
[ PMFreak-owned anti-corruption adapter ]     <-- the boundary
        |
        v
Frontera authorization / enforcement
        |
        +---- DENY / ERROR / malformed ----> no Task dispatch
        |
        v  ALLOW
PMFreak task dispatch  ->  execution  ->  outcome review
```

Concretely: `src/lib/operational-flow/operational-flow-service.ts`,
`dispatchGovernedMaterialActionToTask`, after `canCreateOperationalEvidence` and before
`rpc dispatch_governed_action_to_internal_task`.

That point is right for three reasons, each verified against the code rather than assumed:

* **It is after PMFreak has finished.** The Material Action is already persisted with
  `governance_state='authorized'` and `can_execute=false`. PMFreak's own governance and
  approval work is complete; authorization is deliberately inert.
* **It is before the only side effect.** The dispatch RPC is where the Task is created.
  Nothing has happened yet that a denial would have to undo.
* **It is the narrowest such point.** Everything upstream is proposal-time; everything
  downstream is inside the RPC's transaction.

Any future implementation must sit exactly there, and must not move PMFreak workflow
semantics across it. Frontera does not become the owner of PMFreak's recommendation,
decision, approval, task or outcome lifecycles.

### 3. Authority composes by conjunction. Frontera can only narrow.

When the boundary is built, it must satisfy:

```
PMFREAK_DENY  + FRONTERA_ALLOW  = DENY
PMFREAK_ALLOW + FRONTERA_DENY   = DENY
PMFREAK_ALLOW + FRONTERA_ALLOW  = eligible to proceed
FRONTERA_ERROR                  = DENY, no dispatch
FRONTERA_MALFORMED_RESULT       = DENY, no dispatch
FRONTERA_INPUT_UNCONSTRUCTIBLE  = DENY, no dispatch
```

That is, `FINAL_EXECUTION_AUTHORITY = PMFREAK_PRECONDITIONS AND FRONTERA_AUTHORIZATION`.
A Frontera ALLOW may never rescue a PMFreak DENY, and no configuration, outage or missing
credential may produce a bypass. There is no `catch { allowAnyway() }`, no
*Frontera-unavailable → proceed*, no *missing-config → allow*.

### 4. `AocKernel` is the correct Frontera surface. `orchestrateAuthorization` is not.

This is the substantive technical finding, and it is the opposite of what the operation
names suggest.

`evaluateEnforcementPipeline`, `enforceEnforcementPipeline` and `orchestrateAuthorization`
are one function — `enforce…` is an `export … as …` alias of `evaluate…`, which delegates
to `orchestrate…`. Its entire decision is
`capabilityAllowed && delegationValid && agentAllowed && policy.allowed`, where **all four
operands come from adapters the caller supplies**. A host that implements all six adapters
receives back its own answers, ANDed. It also requires a canonical `CapabilityToken`, a
`ConsentGrant[]` and an `orgId` — none of which PMFreak has or can honestly produce.

`AocKernel.evaluate()` (`@aoc-enterprise/runtime/kernel`, with
`createDefaultKernelProviders()` from `@aoc-enterprise/runtime/enterprise`) is a real
decision engine: recognition, authority graph, approval runtime, external-agent handshake
and a 13-policy enforcement chain, all inside Frontera. It needs no capability token, no
consent grants and no organization id in its request. Executed against the frozen artifact
it denies fail-closed by default and discriminates resource scope and action type
correctly.

**If and when the boundary is built, it is built on `AocKernel`.**

### 5. It is not built yet, because Frontera's authority has no durable home in PMFreak.

`AocKernel`'s authority comes from a recognition world — actors, trust domains, passports,
capability tokens. `createDefaultKernelProviders()` builds that world **empty and
in-memory, per process**, and Frontera states that seeding it is a deployment concern it
will not fabricate on an operator's behalf.

So there are two wirings, and PMFreak can take neither today:

* **Seed per request from PMFreak's own roles.** PMFreak becomes issuer, subject, registry
  and questioner in the same call. The kernel cannot deny anything PMFreak has not already
  denied, so it enforces nothing — while emitting reason codes a reader would take as
  evidence of independent sovereign authorization. That is a false provenance claim, and
  the registration side effects would land ahead of the dispatch RPC's idempotency
  protection. **Rejected on principle, not on effort.**

* **Seed from durable, operator-controlled state.** This is the real boundary and the one
  worth building. It requires PMFreak to persist enterprise actors, trust domains,
  passports and capability tokens and rehydrate them per process — new tables, new RLS, a
  migration. P0-PKG-06 is explicitly not authorized to add persistence.

Hence: **no adapter was written, no capability token was invented, no cast was used, and no
module was made to import Frontera for the sake of a gate.**

## Consequences

* `FRONTERA_PRODUCT_RUNTIME_CONSUMPTION` is **BLOCKED**, and
  `THREE_REPOSITORY_INTEGRATION` remains **NOT_CLAIMED**. `FRONTERA_PACKAGE_INTEGRATION`
  keeps its narrow, honest meaning: installed, pinned, loadable, public-export verified.
* The next decision is a founder/architecture one, not a packaging one:

  > Does PMFreak acquire a durable, operator-seeded enterprise recognition registry as its
  > own increment — or does `THREE_REPOSITORY_INTEGRATION` stop requiring in-process
  > Frontera enforcement on the Material Action path?

* A second, independent gap is recorded upstream: `@aoc/protocol` exports `CapabilityToken`
  as a type with no issuer, and `@aoc-enterprise/runtime` consumes it as input everywhere.
  Nothing in either artifact distinguishes an issued token from a fabricated one. Until
  that is resolved, any host minting its own is asserting authority the Protocol never
  granted it.
* No upstream repository was modified, no export widened, no deep or private import used.

## Why no upstream modification was needed to reach this conclusion

The gap is a *contract* gap, visible entirely from the frozen public surfaces and provable
by executing them. Changing either upstream to make PMFreak's case work would have decided,
inside a PMFreak increment, a question that belongs to Protocol and Frontera. It is
specified in the P0-PKG-06 report instead, as input to a Frontera increment.
