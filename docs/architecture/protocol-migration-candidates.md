# Protocol Migration Candidates

## Prioritization method

Candidates are ordered by extraction breakage risk, number of consumers, centrality, and whether a host implementation already exists behind a Protocol-owned port. This is a migration plan only: no implementation moves and no imports are rewritten in this change.

## Immediate candidates

| Priority | Domain | Current implementation / wiring | Target adapter seams | Why first | Preconditions |
| ---: | --- | --- | --- | --- | --- |
| 1 | Verification and trust keys | `src/lib/aoc/adapters/trust-domain.ts`; `src/lib/security/capability-claims.ts` | `VerificationKeyResolver`, `VerificationProvider`, `TrustRegistryProvider` | Claim verification is extraction-critical and currently source-coupled. | Confirm contracts/claims exports provide every consumed type and helper. |
| 2 | Revocation | `src/lib/aoc/adapters/trust-coordination.ts` | `RevocationLookup` | One clear host implementation already backs a narrow port. | Preserve claim, key, delegation, and grant revocation semantics. |
| 3 | Audit, security, and observability | `src/lib/aoc/adapters/security-audit.ts` | `AuditEventSink`, `SecurityEventSink`, `ProtocolEventSink`, `ObservabilityEventSink` | Governance and capability flows share one source-coupled sink; event loss would be high risk. | Define event ownership and compatibility mapping before splitting sinks. |
| 4 | Registry lookup | `src/lib/aoc/adapters/trust-domain.ts` and trust-domain security services | `RegistryLookup`, `TrustRegistryProvider` | Registry behavior is currently folded into a broad trust-domain port. | Separate lookup from signing-secret and policy responsibilities. |
| 5 | Policy decisions | `src/lib/aoc/adapters/policy-evaluation.ts` | `PolicyDecisionProvider` | The host implementation owns persistence and policy evaluation and already conforms to a port. | Keep Supabase and host RBAC types outside Protocol. |
| 6 | Authorization and execution | enterprise authority adapters, governance core, and execution-grant bridges | `GovernanceDecisionProvider`, `ExecutionAuthorizationProvider` | Runtime-consumer and enterprise behavior depend on these seams; extracting them incorrectly changes authority. | Freeze decision/error contracts and retain fail-closed behavior. |
| 7 | Attestation and access verification | `src/lib/aoc/adapters/agent-attestation.ts`; `access-verification.ts` | `AttestationLookup`, authorization adapters, Protocol errors | Both implementations directly import Protocol source and are part of the central adapter registry. | Move error ownership to `@aoc/protocol/errors` without changing error translation. |

### Immediate migration sequence

1. Establish symbol-parity matrices for current `actor-model`, `ports/*`, and `contracts/capability-claims` exports against the four approved boundaries.
2. Migrate `src/aoc/enterprise/runtime/context.ts` because it is the highest-fan-out consumer.
3. Migrate `src/aoc/runtime/adapters/registry.ts` to the adapters barrel.
4. Migrate host adapter implementations one domain at a time, beginning with verification and revocation.
5. Migrate the capability-claims runtime wrapper to `claims`.
6. Migrate enterprise governance, policy, delegation, and execution-grant leaf modules.
7. Remove the two application source aliases (`actor-context` bridge and SDK policy route) only after actor contracts have a stable owner.

## Medium-term candidates

| Candidate | Current location | Rationale | Exit criterion |
| --- | --- | --- | --- |
| Enterprise `RuntimeContext` decomposition | `src/aoc/enterprise/runtime/context.ts` | One context couples eight legacy ports and increases migration blast radius. | Context fields are typed only through approved adapters/contracts exports. |
| Governance decision provider | `src/aoc/enterprise/runtime/governance-core.ts` and authority adapters | Governance logic is host/runtime behavior, not Protocol ownership. | Protocol owns decision contracts; enterprise owns evaluation. |
| Capability and grant lookup | policy adapter and enterprise delegated-capability/execution-grant modules | No dedicated `CapabilityLookup` currently exists. | Lookup is explicit, host-implemented, and persistence-neutral at the Protocol boundary. |
| Protocol event routing | security audit adapter and telemetry | Audit, security, Protocol, and observability events currently converge on one port. | Event categories and delivery guarantees are explicit without duplicating emissions. |
| Privileged persistence adapter | `src/lib/aoc/adapters/privileged-db.ts` | Correctly host-owned but imported through a Protocol source alias. | Interface is available through `adapters`; implementation remains outside Protocol. |
| Actor model consumers | enterprise governance/delegation and app route | Actor types currently live in a legacy top-level export. | Actor contracts have one approved owner and all consumers use it. |
| Compatibility bridge retirement | `src/lib/aoc/protocol/types.ts` | Five files depend on this bridge through six imports. | SDK and compatibility maps consume a stable public facade directly. |

## Long-term candidates

| Candidate | Current status | Future work |
| --- | --- | --- |
| `CredentialStatusLookup` | No dedicated interface, implementation, or consumer found | Introduce only when credential status becomes an actual runtime requirement. |
| Dedicated observability sink | Security telemetry currently serves the nearest role | Split from security audit only after event ownership, SLOs, and delivery semantics are defined. |
| External registry providers | Trust-domain adapter is in-process and host-specific | Add external providers after registry contracts and failure semantics stabilize. |
| Source alias removal | Root `tsconfig.json` maps Protocol package names to source | Remove after all builds and tests resolve published package exports. |
| Audit enforcement | New test defaults to report mode | Enable `PROTOCOL_CONSUMER_AUDIT_ENFORCE=1` after deep imports reach zero; later decide whether noncanonical public subpaths should also block CI. |
| Package export contraction | Current manifest still exposes legacy subpaths | Remove legacy exports only in a compatibility-governed release after every consumer migrates. |

## Risk analysis

### Consumers most likely to break

| Rank | Consumer | Risk | Reason |
| ---: | --- | --- | --- |
| 1 | PMFreak host adapters | Critical | Nine adapter/bridge files use direct `@/aoc/protocol/*` source aliases. |
| 2 | Enterprise runtime context | High | Eight Protocol imports in one shared type surface affect most orchestration modules. |
| 3 | Runtime adapter registry | High | Seven Protocol port imports define the central host composition contract. |
| 4 | Capability-claims runtime wrapper | High | It depends on a claim implementation leaf by source alias and participates in signing/verification behavior. |
| 5 | SDK policy route | High | Application route imports actor-model source directly. |
| 6 | SDK and legacy compatibility maps | Medium | They are transitive consumers hidden behind `src/lib/aoc/protocol/types.ts`. |

### Migration hazards

- **False portability:** package imports may resolve to source because of root TypeScript aliases.
- **Barrel parity:** changing an import before every symbol is re-exported from the target barrel will create compile failures.
- **Error identity:** moving `AocAccessDeniedError` can break `instanceof` behavior if duplicate classes are emitted.
- **Event loss or duplication:** splitting audit/security/observability sinks requires an explicit event-routing contract.
- **Authority drift:** governance and execution providers must preserve fail-closed behavior and decision metadata.
- **Persistence leakage:** policy, capability, and registry contracts must not expose Supabase-specific types.
- **Secret leakage:** verification abstractions must not move private-key or HMAC-secret resolution into Protocol.

## Ownership guardrails for extraction PRs

- Protocol may define contracts, claims, errors, and adapter interfaces; it must not import host implementations.
- Enterprise may orchestrate Protocol abstractions but must not import Protocol source.
- Runtime and host packages implement adapters and own persistence, secrets, telemetry, and external services.
- Governance consumes persistence only through an injected adapter.
- Observability consumes public event contracts, never Protocol internals.
- Every migration PR should reduce the report count and must not add a new compatibility bridge without an owner and retirement criterion.
