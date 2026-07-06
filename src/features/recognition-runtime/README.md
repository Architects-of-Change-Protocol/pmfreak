# AOC Recognition Runtime

Recognition Runtime answers one question:

> **Can this action be recognized?**

It is the foundation layer of the AOC (Agent Operating Contract) sprint
series. Two more layers build on top of it:

1. **Recognition Runtime** (this module) — can this actor, with this
   passport and this capability token, perform this action against this
   resource scope, right now?
2. **Authority Graph & Delegation Runtime** (future sprint) — where did the
   authority behind this action come from, and is the delegation chain
   valid?
3. **Approval Runtime** (future sprint) — when an action requires human
   approval, who can approve it, and does that approval count?

Recognition Runtime does not answer questions 2 or 3. It only decides
whether an `ActionRequest` is recognized, denied, or needs more evidence /
human approval before it can be recognized. `require_human_approval` and
`require_more_evidence` are decision *outcomes*, not workflows — a future
Approval Runtime sprint is expected to plug into the seam those outcomes
create, not the other way around.

## What it is not

- Not a generic workflow engine.
- Not a legal system.
- Not an AI agent framework.
- Not a UI.
- Not an LLM-based decision maker — every decision is a deterministic
  function of registered state and a fixed policy order.

## Domain models

| Type | Purpose |
| --- | --- |
| `TrustDomain` | The boundary an actor and its credentials belong to (e.g. "Datasys Agent Republic"). |
| `Actor` | A human, agent, organization, or system registered inside a trust domain. |
| `Passport` | Proof that an actor has been recognized within a trust domain. Capability tokens are only meaningful against a valid passport. |
| `RecognitionCapabilityToken` | The canonical capability token type. Grants a specific `capability` over a `resourceScope`, issued against a passport. Do not rename or redefine this type in later sprints. |
| `RecognitionRequirementRule` | Declares that an action/resourceScope pattern needs evidence and/or human approval before it can be recognized. |
| `ActionRequest` | What gets verified: actor X wants to do action Y against resourceScope Z, backed by this passport/token, with this evidence. |
| `RecognitionDecision` | The verdict: an `outcome`, a `reasonCode`, a human-readable `reason`, and the full list of policies evaluated along the way. |
| `AuditEvent` | A deterministic, hash-chained record of every mutation and every verification. |

## Recognition outcomes

```ts
type RecognitionOutcome =
  | "allow"
  | "deny_unrecognized_actor"   // actor was never registered anywhere
  | "deny_rogue_actor"          // actor is registered elsewhere / flagged rogue
  | "deny_revoked"              // actor, passport, or capability token was revoked
  | "deny_expired"              // passport or capability token has expired
  | "deny_out_of_scope"         // capability token doesn't cover this action/resourceScope
  | "require_more_evidence"     // a matching requirement rule needs evidence first
  | "require_human_approval"    // a matching requirement rule needs a human decision
  | "policy_violation";         // structurally invalid request (missing passport/token reference, unknown/suspended trust domain, mismatched ownership)
```

## Policy evaluation order

`RecognitionVerifier` runs policies in a fixed order and stops at the first
failure. The order is deliberate: identity questions (does this trust
domain/actor/passport/token exist and is it legitimate) are answered before
scope questions, and scope questions are answered before evidence/approval
questions.

1. `trust_domain_validity` — trust domain exists and is active
2. `actor_recognition` — actor is registered and not suspended/revoked
3. `rogue_actor` — actor isn't impersonating this trust domain or flagged rogue
4. `passport_validity` — passport is referenced, exists, owned by this actor, active, unexpired
5. `capability_validity` — capability token is referenced, exists, owned by this actor and passport, active, unexpired
6. `capability_scope` — the token's capability and resourceScope actually cover this action
7. `evidence_requirement` — required evidence types (if any) are attached
8. `approval_requirement` — human approval (if required) has been obtained

If every policy passes, the outcome is `allow`.

## Revocation

Revoking an actor cascades: every passport issued to that actor is revoked,
and every capability token issued against those passports is revoked with
it (`RevocationService`). A capability token can never outlive the
passport or actor it depends on. Revoking a passport directly cascades the
same way to its tokens.

## Determinism

- No `Date.now()` anywhere in the runtime. Every service takes an injected
  `RecognitionRuntimeClock` (`{ now(): string }`).
- No random IDs. Every service takes an injected `RecognitionRuntimeIdGenerator`
  (`{ nextId(prefix): string }`).
- No nondeterministic hashing. `AuditEvent.eventHash` is a SHA-256 of a
  canonical (key-sorted) JSON representation of the event, chained to the
  previous event's hash.
- `RecognitionVerifier.verify()` never throws for business-rule failures —
  it always returns a `RecognitionDecision`. Exceptions are reserved for
  genuine programmer errors (duplicate ids, mutating a reference that was
  never created).
- No LLMs anywhere in this module.

`fixtures/deterministic-context.ts` provides a `createDeterministicContext()`
helper used by every test: a monotonic clock that advances one second per
call, and a per-prefix sequential id generator.

## Demo scenario

Datasys Agent Republic (`fixtures/datasys.fixture.ts`):

- **Victor Valverde** (human) holds `update_project_status` over
  `project:HMP-14665`. His request is fully recognized: `allow`.
- **PMFreak Closure Agent** (agent) wants to `send_client_follow_up` on
  `project:HMP-14665`. That action pattern requires `project_context` and
  `draft_action` evidence and always requires human approval:
  - Without evidence → `require_more_evidence`.
  - With evidence attached → `require_human_approval` (Recognition Runtime
    MVP has no way to satisfy this on its own — this is exactly the seam
    the Approval Runtime sprint plugs into).
- **Unknown External Agent** was never registered → `deny_unrecognized_actor`.
- Victor attempting to reuse his `project:HMP-14665` authority against
  `project:GCH-15992` → `deny_out_of_scope`.

See `tests/recognition-runtime-demo-scenarios.test.ts` (repo root
`tests/`, not this directory — see below) for the executable version of
this walkthrough.

## Test layout

This repository's test runner (`npm test` → `tsx --test tests/*.test.mjs
tests/*.test.ts`) only picks up files directly under the top-level
`tests/` directory, so — unlike the domain/services/policies/runtime
source layout — this module's tests live at `tests/recognition-runtime-*.test.ts`,
not under `src/features/recognition-runtime/tests/`. They import the real
source modules directly (no reimplementation, no mocking of this module's
own code).
