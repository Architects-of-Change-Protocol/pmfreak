# 07 — AOC Consumer Architecture

This document defines how PMFreak should consume AOC Protocol, AOC Enterprise, and AOC Assurance as an external party — and audits how far current `src/aoc/*` code already matches or diverges from that shape. **No canonical AOC contract is defined here.** AOC Protocol/Enterprise/Assurance remain external, canonical, and out of PMFreak's ownership.

## A. Required layering (target state)

```
PMFreak Domain
  -> PMFreak Application
    -> PMFreak-owned AOC Ports              (interfaces PMFreak defines, for its own needs)
      -> PMFreak AOC Adapter                (implements the port by calling out)
        -> Public AOC SDK / Contracts       (owned and versioned by AOC, not PMFreak)
          -> External AOC Services          (Protocol / Enterprise / Assurance)
```

Never: `PMFreak Domain -> AOC internals`. Never: `PMFreak -> AOC database`. Never: `PMFreak -> copied AOC runtime`.

## B. Current-state classification (audit result)

**Legacy — implements what should be externally owned, must migrate behind ports once an external AOC provider exists:**

| Path | What it does today | Why it's legacy |
|---|---|---|
| `src/aoc/protocol/contracts/capability-claims.ts` | Issues and cryptographically verifies (HMAC-SHA256/Ed25519) capability claims directly, using Node's `crypto` | This *is* the issuer/verifier, not a client of one |
| `src/aoc/enterprise/runtime/governance-core.ts` | Owns the entire governance policy registry and decision engine (`GOVERNANCE_POLICY_REGISTRY`, `evaluateGovernanceAction`) | Policy authority should live with an external Enterprise provider |
| `src/aoc/enterprise/runtime/delegated-capabilities.ts`, `execution-grants.ts` | Delegation-chain and single-use execution-grant issuance against PMFreak's own Supabase tables (`governance_delegations`, `governance_execution_grants`) | Delegation/grant authority is canonical AOC territory |
| `src/lib/security/trust-domains.ts`, `trust-coordination.ts`, `trust-handshakes.ts` | Trust-domain key lifecycle, revocation registry, verifier-policy engine, owns `PMFREAK_CAPABILITY_CLAIM_SECRET` | Trust-domain and revocation authority is canonical AOC Protocol territory |
| `src/lib/security/agent-attestation.ts` | Issues/verifies agent attestations | Attestation authority is canonical AOC Protocol territory |
| `src/aoc/enterprise/runtime/in-process-authority-adapter.ts` | The *only currently functioning* authority provider | Should become the fallback/dev-only path once external providers are real |
| 14 governance/trust/capability Supabase migrations (capability requests/grants, policy engine, delegation chains, agent identity/scoped-access, trust-domain federated verification, external verifier handshakes, distributed trust coordination, deterministic verification receipts — enumerated in `docs/architecture/aoc-multi-repo-extraction-plan.md:69-83`) | Persistence for the above | Should become local projections/cache of externally-owned state, not primary storage |
| Agent Passport / Assurance concepts | **Do not exist at all yet** | Flagged so they are built against the external contract from day one, never reimplemented locally |

**Legitimate PMFreak-owned consumer-side glue — can stay, is the correct shape for the target architecture:**

| Path | Role |
|---|---|
| `src/aoc/runtime-consumer/*` (`runtime-client.ts`, `runtime-bootstrap.ts`) | The intended consumption boundary — correct shape, currently points at the in-process adapter instead of an external provider |
| `src/aoc/runtime/adapters/registry.ts`, `src/lib/aoc/adapters/*` | Port-implementation registration pattern — correct shape, today's adapters wrap local implementations rather than remote calls |
| `src/lib/aoc/compatibility/legacy-*-map.ts`, `src/lib/aoc/bootstrap.ts` | PMFreak-specific payload mapping/bootstrap glue |
| `src/lib/agents/agent-tool-approval-policy.ts`, `agent-execution-state-machine.ts`, `src/lib/governance-actions/*` | PM-workflow-specific approval/execution semantics that legitimately sit *above* whatever authority decision an external AOC provider returns |
| `src/lib/ai/*` (providers, guardrails, egress-policy, usage-accounting) | PMFreak's own AI operational concerns (cost, concurrency, provider routing) — orthogonal to AOC identity/governance ownership |
| `src/sdk/*` | PMFreak's own developer-facing SDK surface, though `types.ts`/`client.ts` compatibility DTOs should be retargeted to canonical external contract types once they exist |

**Boundary tooling already in place (real, but enforcing internal layering, not external consumption):** `scripts/lint-aoc-boundaries.mjs`, `scripts/check-aoc-dependency-direction.mjs`, and `tests/consumer-boundary-audit.test.ts` (currently report-only — `PROTOCOL_CONSUMER_AUDIT_ENFORCE=1` is not set anywhere; a live run today reports 23 consumer files, 12 deep imports, 23 ownership-boundary bypasses). This tooling is a good foundation for enforcing the target architecture once extraction begins — it should be flipped to enforcing mode as part of the migration, not before an external provider exists to migrate to.

## C. PMFreak-owned ports (conceptual design)

Each port is PMFreak's own interface, designed for PMFreak's needs — not a mirror of any AOC-internal API.

| Port | Business need | Method(s) | Timeout | Retry | Fail behavior | Local cache | Fallback | Required launch stage |
|---|---|---|---|---|---|---|---|---|
| `AgentIdentityPort` | Resolve/register the identity of an AI agent acting on a workspace's behalf | `resolveIdentity`, `registerIdentity` | 2s | 2x, exponential backoff | **Fail closed** — no identity, no agent action | Identity resolution, short TTL (≤5min) | None — block the action | Required for B2B (agent actions attributable); not required for pilot (single in-process actor model is acceptable short-term) |
| `AgentPassportPort` | Issue/inspect a portable credential for an agent's capabilities | `getPassport`, `refreshPassport` | 2s | 2x | **Fail closed** for issuance; **degraded read-only** for inspection using last-cached passport | Cached passport, short TTL | Deny new capability grants; allow continued use of already-verified low-risk actions | Required for Enterprise; deferred for pilot/B2C/B2B |
| `RevocationStatusPort` | Check whether an agent/credential has been revoked before allowing a material action | `checkRevocation` | 1s | 1x (fast-fail preferred over slow retry for a synchronous gate) | **Fail closed always** — never fail-open for revocation | Positive (not-revoked) cache, very short TTL (≤60s) | Block the action; queue for human review | Required from pilot onward for any agent action beyond advisory/draft |
| `PolicyEvaluationPort` | Ask whether a proposed governance action is permitted | `evaluatePolicy` | 2s | 2x | **Fail closed** for material/high-impact actions; **degraded (human-approval-required)** for advisory actions | Policy decision cache, short TTL | Route to human approval queue | Required from pilot onward — this maps directly onto the existing `agent-tool-approval-policy.ts` decision point |
| `EvidencePublisherPort` | Publish evidence bundles for agent recommendations/decisions/approvals/overrides | `publishEvidence` | 5s | 3x, exponential backoff, DLQ after exhaustion | **Fail open with outbox** — never block the user-facing action on evidence publication | Outbox table of unpublished evidence | Local PMFreak audit log remains authoritative until publish succeeds | Required for B2B (auditability); deferred for early pilot |
| `EntitlementPort` | Check AOC-specific capability entitlement (distinct from PMFreak plan entitlement, see `06-billing-and-entitlements.md`) | `getEntitlements` | 2s | 2x | **Fail closed** for material actions gated by AOC entitlement; **degraded** for informational display | Entitlement snapshot, medium TTL (≤15min) | Deny the specific AOC-gated capability; PMFreak-native features unaffected | Required once any AOC capability is sold as part of a plan; not required today (no AOC capability is sold yet) |
| `AocUsagePort` | Reserve/commit/reverse usage against AOC Enterprise's consumption ledger | `reserveUsage`, `commitUsage`, `reverseUsage` | 3s (reserve, sync); async for commit | Reserve: 2x sync; Commit: outbox + retry + DLQ | **Reserve fails closed** (don't let the user proceed without a confirmed reservation for material/billable AOC consumption); **Commit is async, outbox-backed** | Local consumer-side ledger (see `06-billing-and-entitlements.md` §C) | On commit failure, retry via outbox; never re-derive amounts client-side | Required once any AOC-metered capability is sold |
| `AssuranceStatusPort` | Read the current assurance tier/score for a tenant or agent, for display and for gating "high assurance" features | `getAssuranceStatus` | 2s | 2x | **Degraded/stale-allowed** — assurance is informational unless a specific feature is contractually gated on a minimum tier, in which case fail closed for that feature only | Assurance snapshot, cache with an explicit "stale as of" timestamp always shown | Show "assurance status unavailable," do not silently show a stale status as current | Required for Enterprise; deferred otherwise |
| `TenantStatusPort` | Check whether the calling tenant is suspended/active at the AOC Enterprise level (distinct from PMFreak's own subscription status) | `getTenantStatus` | 1s | 1x fast-fail | **Fail closed** — suspension checks never fail-open | Very short TTL (≤60s) or no cache | Block all AOC-gated actions; PMFreak-native features unaffected | Required once PMFreak registers as an AOC Enterprise tenant/product |
| `HealthReportingPort` | Report PMFreak's own product health to AOC Enterprise for managed-lifecycle/health-reporting requirements | `reportHealth` | 5s | 3x, DLQ after exhaustion | **Fail open** — never block PMFreak operation on this port's success | Outbox | Retry via outbox; alert internally if repeatedly failing | Required for Enterprise managed-lifecycle participation; deferred otherwise |

## D. AOC capability matrix

| AOC capability | PMFreak use case | Trigger | Sync/Async | Material? | Fail behavior | Local projection | Required for |
|---|---|---|---|---|---|---|---|
| Register agent identity | New AI-driven workflow actor created | Workspace/agent provisioning | Sync | Yes | Fail closed | Cached identity record | B2B |
| Issue passport | Grant an agent a portable capability credential | Agent onboarding | Sync | Yes | Fail closed | Cached passport (short TTL) | Enterprise |
| Get passport status | Display/verify current agent capabilities | Any agent action, UI display | Sync (gate) / Async (display) | Gate: yes: Display: no | Gate: fail closed; Display: degraded | Cached | Enterprise |
| Verify passport | Confirm passport validity before a material action | Pre-action check | Sync | Yes | Fail closed | Short-TTL cache | Enterprise |
| Revoke passport | Kill an agent's capability immediately | Security incident, offboarding | Sync (must propagate fast) | Yes | Fail closed | Invalidate cache immediately | Enterprise |
| Evaluate policy | Should this governance action proceed? | Every agent action above "advisory" | Sync | Yes | Fail closed (material) / human-approval (advisory) | Decision cache, short TTL | Pilot onward |
| Record recommendation | Log an AI recommendation for audit | Every AI recommendation generated | Async | No | Fail open + outbox | Local audit table (authoritative until published) | B2B |
| Record decision | Log a human decision on a recommendation | Human accepts/rejects | Async | No | Fail open + outbox | Local audit table | B2B |
| Record human approval | Log an approval gate outcome | Approval-gated action approved | Async | No | Fail open + outbox | Local audit table | B2B |
| Record override | Log a human override of an AI/policy decision | Override event | Async | No | Fail open + outbox | Local audit table | B2B |
| Create evidence bundle | Package evidence for a decision/action | Post-action | Async | No | Fail open + outbox, DLQ | Outbox | B2B |
| Verify evidence | Confirm evidence bundle integrity | Audit/compliance review | Sync (on-demand) | No | Degraded (show "unverified" state) | Cache | Enterprise |
| Get entitlements | Check AOC-specific capability access | Feature gate for an AOC-sold capability | Sync | Yes (for gated feature only) | Fail closed for gated feature | Snapshot cache | Whenever an AOC capability is first sold |
| Reserve usage | Pre-commit to metered AOC consumption | Before a billable AOC-mediated action | Sync | Yes | Fail closed | Reservation record | Whenever AOC usage is billed |
| Commit usage | Finalize metered consumption after success | Post-action | Async | No (already reserved) | Fail open + outbox + retry | Consumer-side ledger | Whenever AOC usage is billed |
| Reverse usage | Release a reservation on failure/cancellation | Action failed/cancelled | Async | No | Fail open + outbox + retry | Consumer-side ledger | Whenever AOC usage is billed |
| Get assurance status | Display/gate on assurance tier | UI display, gated feature check | Sync (gate) / Async (display) | Gate: yes for gated features only | Degraded for display; fail closed for gated feature | Snapshot with staleness timestamp | Enterprise |
| Report product health | Managed-lifecycle participation | Periodic (cron-like) | Async | No | Fail open + outbox | N/A | Enterprise |

## E. Failure modes — explicit fail-open vs. fail-closed policy

**Never fail-open for:** revocation, authorization/policy evaluation on material actions, tenant suspension checks, verified evidence *claims* (i.e., never present unverified evidence as verified), and financial settlement (usage reservation before a billable action).

| Condition | Behavior |
|---|---|
| AOC Protocol unavailable | Fail closed for revocation/policy/passport-verification gates; degraded (cached, staleness-labeled) for informational reads |
| AOC Enterprise unavailable | Fail closed for tenant-suspension and usage-reservation checks; queue-and-continue for usage commit/health reporting |
| AOC Assurance unavailable | Degraded — show "assurance status unavailable," never a stale status presented as current, unless a specific feature is contractually gated on a minimum tier (then fail closed for that feature only) |
| Entitlement cannot be checked | Fail closed for the specific AOC-gated feature; PMFreak-native plan entitlements are unaffected (separate system, see `06-billing-and-entitlements.md`) |
| Revocation cannot be checked | Fail closed — block the action, require human approval to proceed |
| Passport cannot be verified | Fail closed for the gated action; allow continued display of last-known-good status with explicit staleness label |
| Evidence cannot be published | Fail open (don't block the user), queue via outbox, alert if the queue grows unbounded |
| Usage cannot be reserved | Fail closed — do not allow the billable action to proceed without a confirmed reservation |
| Usage commit fails | Queue-and-continue via outbox; the action already happened and was reserved, so blocking the user now would be wrong — reconcile asynchronously |
| Assurance is stale | Show explicit staleness; fail closed only for features contractually requiring a fresh, minimum-tier assurance status |
| Tenant is suspended | Fail closed immediately for all AOC-gated actions; PMFreak-native (non-AOC) features continue to function unless PMFreak's own subscription is also suspended (separate concern) |
| Credential expired | Fail closed, force re-issuance flow |
| Version mismatch | Fail closed with an explicit "upgrade required" signal, do not attempt best-effort compatibility parsing of an unknown contract version |

## F. Outbox and resilience design

**Synchronous (must complete before the user-facing action proceeds):** revocation check, policy decision, entitlement check (for AOC-gated features), passport verification, usage reservation (when material/billable).

**Asynchronous (queue-and-continue, transactional outbox pattern):** evidence publication, health reporting, usage commit, analytics, assurance sync, decision/recommendation/approval/override records.

Required infrastructure for the async path: a transactional outbox table (write the outbound event in the same transaction as the local action that triggered it), retry with exponential backoff, a dead-letter queue for exhausted retries, idempotency keys (PMFreak already has a proven pattern for this — see the Stripe webhook idempotency design in `06-billing-and-entitlements.md`), correlation IDs threading from the originating PMFreak action through to the AOC-side record, and a reconciliation job that periodically diffs the local outbox/ledger against AOC Enterprise's reported state (without treating PMFreak's copy as authoritative). None of this infrastructure exists yet for AOC consumption specifically — it should be built new, but it can directly reuse the idempotent-event-processing pattern already proven and tested in the billing webhook path (`src/lib/billing.ts:241-343`) rather than inventing a new one.
