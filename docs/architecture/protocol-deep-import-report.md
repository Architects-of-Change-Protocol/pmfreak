# Protocol Deep Import Report

## Policy

A deep import is any consumer import that reaches Protocol source directly, including `@aoc/protocol/src/*`, `packages/protocol/src/*`, relative paths resolving into Protocol source, and this repository's equivalent source alias, `@/aoc/protocol/*`. The audit test also reports package subpaths outside `contracts`, `claims`, `errors`, and `adapters` as ownership bypasses, but keeps them separate because they are currently declared in `src/aoc/protocol/package.json`.

## Summary

- **12 deep-import occurrences** across **10 files**.
- **23 additional ownership-boundary bypasses** across **7 files**.
- **No relative `../../protocol/src/*`, `packages/protocol/src/*`, or `@aoc/protocol/src/*` occurrence exists today.**
- **All current source-level violations use `@/aoc/protocol/*`.**
- Report mode is non-blocking. Set `PROTOCOL_CONSUMER_AUDIT_ENFORCE=1` when a future migration has removed all source imports.

## Source-level deep imports

| Consumer | Location | Import | Severity | Recommended fix |
| --- | --- | --- | --- | --- |
| PMFreak actor-context bridge | `src/lib/aoc/actor-context.ts:1` | `@/aoc/protocol/actor-model` | High | Re-export actor contracts from `@aoc/protocol/contracts`, then consume that boundary. |
| Capability-claims runtime wrapper | `src/lib/security/capability-claims.ts:1` | `@/aoc/protocol/contracts/capability-claims` | High | Consume claim symbols from `@aoc/protocol/claims`; verify symbol parity before changing the import. |
| Security audit adapter | `src/lib/aoc/adapters/security-audit.ts:4` | `@/aoc/protocol/ports/security-audit` | High | Implement event-sink types from `@aoc/protocol/adapters`. |
| Trust coordination adapter | `src/lib/aoc/adapters/trust-coordination.ts:4` | `@/aoc/protocol/ports/trust-coordination` | High | Implement `RevocationLookup` from `@aoc/protocol/adapters`. |
| Trust domain adapter | `src/lib/aoc/adapters/trust-domain.ts:11` | `@/aoc/protocol/ports/trust-domain` | High | Implement verification and registry seams from `@aoc/protocol/adapters`. |
| Agent attestation adapter | `src/lib/aoc/adapters/agent-attestation.ts:6` | `@/aoc/protocol/ports/agent-attestation` | High | Implement `AttestationLookup` from `@aoc/protocol/adapters`. |
| Agent attestation adapter | `src/lib/aoc/adapters/agent-attestation.ts:7` | `@/aoc/protocol/ports/access-verification` | High | Consume the corresponding authorization/error types from `adapters` and `errors`. |
| Access verification adapter | `src/lib/aoc/adapters/access-verification.ts:11` | `@/aoc/protocol/ports/access-verification` | High | Consume authorization interfaces from `@aoc/protocol/adapters`. |
| Access verification adapter | `src/lib/aoc/adapters/access-verification.ts:12` | `@/aoc/protocol/ports/access-verification` | High | Consume `AocAccessDeniedError` from `@aoc/protocol/errors`. |
| Policy evaluation adapter | `src/lib/aoc/adapters/policy-evaluation.ts:9` | `@/aoc/protocol/ports/policy-evaluation` | High | Implement `PolicyDecisionProvider` from `@aoc/protocol/adapters`; consume policy data from `contracts`. |
| Privileged DB adapter | `src/lib/aoc/adapters/privileged-db.ts:4` | `@/aoc/protocol/ports/privileged-db` | High | Move the persistence port type behind `@aoc/protocol/adapters`; keep its implementation host-owned. |
| SDK policy route | `src/app/api/sdk/policies/evaluate/route.ts:4` | `@/aoc/protocol/actor-model` | High | Consume actor types through `@aoc/protocol/contracts` or an SDK-owned facade. |

## Public-subpath ownership bypasses

These paths are package exports in the current manifest, so they are not source-level deep imports. They are nevertheless migration blockers under the target four-boundary policy.

| Consumer | Locations | Imports | Count | Severity | Recommended fix |
| --- | --- | --- | ---: | --- | --- |
| `@aoc-enterprise/runtime` | `src/aoc/enterprise/runtime/context.ts`, `composition.ts`, `governance-core.ts`, `policy-engine.ts`, `delegated-capabilities.ts`, `execution-grants.ts` | `actor-model`, `ports/*`, `contracts/capability-claims` | 15 | High | Migrate `RuntimeContext` first, then leaf modules, to the approved ownership exports. |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts` | Seven `ports/*` paths | 7 | High | Replace the registry's type fan-out with imports from `@aoc/protocol/adapters`. |
| Enterprise execution grants | `src/aoc/enterprise/runtime/execution-grants.ts` | `@aoc/protocol/contracts/capability-claims` | 1 | Medium | Consume claims from `@aoc/protocol/claims`. |

The execution-grants occurrence is included in the enterprise aggregate; it is called out separately because it is the only package-level contract leaf import and has a different target boundary.

## Breakage forecast

1. **First to break:** the 10 files using `@/aoc/protocol/*`; the alias points at repository source and cannot resolve in an extracted consumer repository.
2. **Next to break:** `src/aoc/enterprise/runtime/context.ts`; it centralizes eight legacy Protocol imports and propagates their types through the runtime.
3. **Broad compile blast radius:** `src/aoc/runtime/adapters/registry.ts`; it binds all host adapter registrations to seven legacy ports.
4. **Delayed/transitive breakage:** the five files importing `@/lib/aoc/protocol/types`; they survive while the bridge remains but fail if it is removed before SDK/compatibility migration.
5. **Configuration risk:** root `tsconfig.json` source aliases can make package-style imports appear portable while TypeScript is still resolving local source.

## Non-findings

No Protocol source file imports enterprise, runtime implementation, application, SDK, persistence, or observability implementation code. No runtime extraction, import rewrite, export change, or behavior change is part of this report.
