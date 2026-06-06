# Protocol Consumer Inventory

## Audit baseline

This inventory is a repository-wide static-import audit of the checkout at commit `cf48667` (June 6, 2026 audit date). The scan covers every existing requested scope (`packages/`, `apps/`, `services/`, `runtime/`, `enterprise/`, `operations/`, `assurance/`, `governance/`, `sdk/`, `tests/`, `scripts/`, and `examples/`) plus the repository's actual application root, `src/`. Missing requested roots contain no consumers in this checkout.

The target ownership policy recognizes only these imports as safe:

- `@aoc/protocol/contracts`
- `@aoc/protocol/claims`
- `@aoc/protocol/errors`
- `@aoc/protocol/adapters`

The current package manifest still publishes `@aoc/protocol/actor-model`, `@aoc/protocol/ports`, `@aoc/protocol/ports/*`, and `@aoc/protocol/contracts/*`; it does not yet publish `claims`, `errors`, or `adapters`. This report therefore distinguishes **source-level deep imports** from **currently published subpaths that bypass the target ownership policy**. No import is rewritten by this audit.

## Summary

| Metric | Count | Definition |
| --- | ---: | --- |
| Total consumer files | 23 | Unique source files with a direct or indirect Protocol-related static import |
| Total import occurrences | 42 | Static `import`, `export ... from`, dynamic `import()`, and `require()` occurrences |
| Target-safe imports | 1 | Exact imports from the four approved ownership boundaries |
| Deep imports | 12 | Direct source access through `@/aoc/protocol/*` or an equivalent source path |
| Ownership-boundary bypasses | 23 | `@aoc/protocol/*` package subpaths outside the four approved boundaries |
| Indirect bridge imports | 6 | Imports of PMFreak's compatibility bridge rather than Protocol itself |
| Total violations | 35 | Deep imports plus ownership-boundary bypasses |
| Migration domains | 7 | Verification, revocation, audit/security/observability, registry, policy/governance, authorization/execution, and attestation |

## Consumer surfaces

| Consumer surface | Files | Relationship | Extraction risk |
| --- | ---: | --- | --- |
| `@aoc-enterprise/runtime` | 6 | Direct package imports from legacy Protocol subpaths | High: 15 occurrences depend on paths outside the target policy |
| AOC runtime adapter registry | 1 | Direct package imports from seven legacy `ports/*` subpaths | High: central composition type fan-out |
| PMFreak host integration | 14 | Source aliases, one safe bridge, and compatibility bridges | Critical: host aliases cannot survive package extraction |
| PMFreak SDK | 1 | Indirect compatibility bridge | Low now; medium when the bridge is retired |
| PMFreak application route | 1 | Direct actor-model source alias | High: application code bypasses package exports |

## Complete import inventory

| Consumer | Location | Import | Import type | Dependency classification |
| --- | --- | --- | --- | --- |
| PMFreak SDK | `src/sdk/types.ts:1` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak SDK | `src/sdk/types.ts:3` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak host integration | `src/lib/aoc/actor-context.ts:1` | `@/aoc/protocol/actor-model` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/index.ts:1` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak host integration | `src/lib/security/capability-claims.ts:1` | `@/aoc/protocol/contracts/capability-claims` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/security-audit.ts:4` | `@/aoc/protocol/ports/security-audit` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/trust-coordination.ts:4` | `@/aoc/protocol/ports/trust-coordination` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/trust-domain.ts:11` | `@/aoc/protocol/ports/trust-domain` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/agent-attestation.ts:6` | `@/aoc/protocol/ports/agent-attestation` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/agent-attestation.ts:7` | `@/aoc/protocol/ports/access-verification` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/access-verification.ts:11` | `@/aoc/protocol/ports/access-verification` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/access-verification.ts:12` | `@/aoc/protocol/ports/access-verification` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/policy-evaluation.ts:9` | `@/aoc/protocol/ports/policy-evaluation` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/adapters/privileged-db.ts:4` | `@/aoc/protocol/ports/privileged-db` | Direct source alias | Deep import — High |
| PMFreak host integration | `src/lib/aoc/compatibility/legacy-policy-map.ts:1` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak host integration | `src/lib/aoc/compatibility/legacy-delegation-map.ts:1` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak host integration | `src/lib/aoc/compatibility/legacy-audit-map.ts:1` | `@/lib/aoc/protocol/types` | Host compatibility bridge | Indirect — Low |
| PMFreak host integration | `src/lib/aoc/protocol/types.ts:8` | `@aoc/protocol/contracts` | Public ownership export | Safe |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/delegated-capabilities.ts:5` | `@aoc/protocol/ports/policy-evaluation` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/delegated-capabilities.ts:6` | `@aoc/protocol/actor-model` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/execution-grants.ts:5` | `@aoc/protocol/contracts/capability-claims` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:5` | `@aoc/protocol/ports/access-verification` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:6` | `@aoc/protocol/ports/agent-attestation` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:7` | `@aoc/protocol/ports/capability-verification` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:8` | `@aoc/protocol/ports/policy-evaluation` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:9` | `@aoc/protocol/ports/privileged-db` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:10` | `@aoc/protocol/ports/security-audit` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:11` | `@aoc/protocol/ports/trust-coordination` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/context.ts:12` | `@aoc/protocol/ports/trust-domain` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/composition.ts:5` | `@aoc/protocol/ports/capability-verification` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/policy-engine.ts:5` | `@aoc/protocol/ports/policy-evaluation` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/governance-core.ts:2` | `@aoc/protocol/actor-model` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/governance-core.ts:6` | `@aoc/protocol/ports/security-audit` | Published subpath outside target policy | Ownership bypass — Medium |
| @aoc-enterprise/runtime | `src/aoc/enterprise/runtime/governance-core.ts:7` | `@aoc/protocol/ports/access-verification` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:10` | `@aoc/protocol/ports/security-audit` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:11` | `@aoc/protocol/ports/privileged-db` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:12` | `@aoc/protocol/ports/access-verification` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:13` | `@aoc/protocol/ports/agent-attestation` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:14` | `@aoc/protocol/ports/policy-evaluation` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:15` | `@aoc/protocol/ports/trust-domain` | Published subpath outside target policy | Ownership bypass — Medium |
| AOC runtime adapter registry | `src/aoc/runtime/adapters/registry.ts:16` | `@aoc/protocol/ports/trust-coordination` | Published subpath outside target policy | Ownership bypass — Medium |
| PMFreak application route | `src/app/api/sdk/policies/evaluate/route.ts:4` | `@/aoc/protocol/actor-model` | Direct source alias | Deep import — High |

## Ownership analysis

| Finding | Evidence | Severity | Why it matters | Required migration |
| --- | --- | --- | --- | --- |
| Host code imports Protocol source through the root `@/*` alias | 12 occurrences across 10 files | High | These imports work only while Protocol remains inside this repository and will break first during extraction. | Retarget symbols to the approved package ownership exports after those exports contain the required symbols. |
| Enterprise runtime bypasses target ownership exports | 15 occurrences across 6 files | High | Enterprise is the largest direct consumer and is coupled to legacy files (`actor-model`, `ports/*`, and a contract leaf). | Migrate `RuntimeContext` first, then governance, policy, grants, and delegated capabilities to `contracts`, `claims`, `errors`, and `adapters`. |
| Runtime adapter registry bypasses the adapters boundary | 7 occurrences in one central file | High | One file aggregates seven old ports, so an export change has broad compile impact. | Replace legacy port imports with `@aoc/protocol/adapters` once parity is confirmed. |
| Root TypeScript aliases resolve package syntax to Protocol source | `tsconfig.json` maps `@aoc/protocol` and `@aoc/protocol/*` to `src/aoc/protocol` | Medium | Even syntactically safe imports can be source-coupled in root compilation. Package-isolated builds remain the release guard. | Remove source alias resolution only after all consumers build against package exports. |
| Compatibility bridge hides transitive consumers | 6 occurrences target `@/lib/aoc/protocol/types` | Low | These consumers are not direct violations, but deleting the bridge would break SDK and compatibility maps. | Keep the bridge until its five consumer files migrate or receive a stable SDK-owned contract. |
| Protocol imports implementation code | None found | None | Protocol purity remains intact in this checkout. | Preserve the purity checks. |
| Runtime imports enterprise implementation | None found in Protocol consumer paths | None | Runtime-consumer uses an enterprise bridge, but the Protocol-facing runtime adapter registry does not import enterprise code. | Continue routing authority calls through the documented runtime-consumer boundary. |
| Governance imports persistence directly | No Protocol-layer violation found | None | Persistence is supplied through `PrivilegedDbPort`; the host policy adapter owns Supabase access. | Keep persistence implementation in the host and migrate the port to the approved adapters boundary. |
| Observability imports Protocol internals | One host security-audit adapter imports a Protocol source alias | High | The implementation is correctly host-owned but its type dependency is source-coupled. | Use `@aoc/protocol/adapters` and implement the target event-sink interfaces. |

## Adapter adoption opportunities

The requested adapter names are target interfaces; none is declared verbatim in the current checkout. “Current consumer” below maps each target seam to the closest current port or call site rather than claiming that the named interface already exists.

| Target adapter | Current consumers / closest seam | Potential implementers | Priority |
| --- | --- | --- | --- |
| `VerificationKeyResolver` | `TrustDomainPort.resolveVerificationKey`; capability verification flow | `PmfreakTrustDomainAdapter` | Immediate |
| `VerificationProvider` | `CapabilityClaimPorts`; `src/lib/security/capability-claims.ts` | PMFreak capability-claims wrapper plus `PmfreakTrustDomainAdapter` | Immediate |
| `RevocationLookup` | `TrustCoordinationPort.getRevocationReason` | `PmfreakTrustCoordinationAdapter` | Immediate |
| `RegistryLookup` | No dedicated interface; trust-domain lookup is the nearest seam | `PmfreakTrustDomainAdapter` or a new host registry adapter | Immediate |
| `TrustRegistryProvider` | `TrustDomainPort` trust/key resolution methods | `PmfreakTrustDomainAdapter` | Immediate |
| `CapabilityLookup` | No dedicated interface; policy/grant lookup occurs in the host policy adapter | `PmfreakPolicyEvaluatorAdapter` or a capability-store adapter | Medium |
| `AttestationLookup` | `AgentAttestationPort.verifyAgentAttestation` | `PmfreakAgentAttestationAdapter` | Immediate |
| `CredentialStatusLookup` | No current dedicated seam or direct consumer | Future credential-status runtime provider | Long-term |
| `AuditEventSink` | `SecurityAuditPort.logEvent`; enterprise runtime audit context | `PmfreakSecurityAuditAdapter` | Immediate |
| `SecurityEventSink` | `SecurityAuditPort.logEvent`; access and governance flows | `PmfreakSecurityAuditAdapter` | Immediate |
| `ProtocolEventSink` | No dedicated interface; Protocol events currently share security audit | Event router backed by PMFreak telemetry | Medium |
| `PolicyDecisionProvider` | `PolicyEvaluatorPort`; delegated capabilities and policy engine | `PmfreakPolicyEvaluatorAdapter` | Immediate |
| `GovernanceDecisionProvider` | Enterprise `governance-core` and runtime authority port | In-process or external runtime authority adapter | Medium |
| `ExecutionAuthorizationProvider` | Runtime authority and execution-grant bridges | In-process or external runtime authority adapter | Immediate |
| `ObservabilityEventSink` | No dedicated interface; security telemetry is the current sink | PMFreak telemetry adapter | Medium |

## Audit limitations

- Static string-literal imports are included; computed module paths are not inferable and were not found by supplemental text search.
- Documentation references and generated/build output are excluded from consumer counts.
- Package manifest dependencies are contextual evidence, not import occurrences. The root and enterprise manifests both declare `@aoc/protocol`.
- Severity is extraction risk, not evidence of a current runtime defect.
