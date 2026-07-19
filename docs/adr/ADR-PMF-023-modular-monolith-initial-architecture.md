# ADR-PMF-023: Modular Monolith as Initial Deployment Architecture

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1–PR3 ratified PMFreak's domain, vocabulary, and information architecture, but none of them fixed how the system that implements all three is deployed and organized internally. Inspection of the current codebase (`docs/product-architecture/04-canonical-application-architecture.md` §64) shows a single Next.js application with 60+ feature directories under `src/lib`, route-based organization under `src/app/(protected)/`, and no bounded-context module boundaries, no repository abstraction, and no event infrastructure (confirmed absent — PR1 §33: "no event infrastructure exists in the codebase today"). This is already, in effect, a monolith — the open question this ADR resolves is whether that should be formalized as the *target* architecture, or whether PR4 should instead prescribe a microservices decomposition as the goal to build toward.

Prescribing microservices without evidence of load, deployment-cadence, or isolation need would repeat exactly the mistake PR1 diagnosed in the domain layer: inventing structure the evidence doesn't yet justify (PR1 §12, three coexisting PMO representations; six Portfolio naming collisions) — except this time at the level of physical deployment topology instead of naming. A premature service boundary is harder to walk back than a premature table.

## Decision

**PMFreak's canonical application architecture begins as a modular monolith: one deployable application, internally organized into explicit bounded-context modules (`04-bounded-context-catalog.md`) with hexagonal (ports and adapters) boundaries between them.** This does not preclude future extraction of any module into an independently deployable service; it establishes that no module is extracted without demonstrated evidence (load, security/compliance isolation, independent deploy cadence, scalability/availability divergence, or regulatory data isolation — `04-canonical-application-architecture.md` §8).

## Domain Rules

1. All twenty-five bounded contexts (`04-bounded-context-catalog.md`) run within one deployment unit initially.
2. Module boundaries are enforced logically (import rules, dependency direction, §48 of the parent architecture document), not by network calls, initially.
3. No module may access another module's persistence directly, regardless of both modules sharing a process (§7.3 principle 27, §48).
4. A module may be extracted into an independently deployable service only against one or more of the five evidence conditions listed in the parent document's §8 — never speculatively.
5. Internal domain events (§20 of the parent document) may be delivered in-process initially; the outbox pattern is used wherever a use case's consistency requirements demand it, independent of whether the eventual consumer is in-process or remote.

## Alternatives Considered

- **Microservices from day one**, splitting each bounded context into its own deployable unit immediately. Rejected: no current evidence (load, compliance, independent-cadence) justifies the operational cost of 25 independently deployed services; this would also make PR5's persistence design and PR6's API design dramatically harder to sequence, since cross-service transaction boundaries would need to be solved before a single table is designed.
- **No module boundaries at all**, continuing the current feature-directory organization indefinitely. Rejected: this is the root cause PR1 identified for the domain layer's own confusion (three PMO representations, unreconciled Command Center naming) — without explicit ownership boundaries, the same drift recurs at the application layer.
- **A "modular monolith with a hard extraction date"** (e.g., "Agent Orchestration becomes a service by PR12"). Rejected: pre-committing to an extraction timeline before the evidence exists inverts this ADR's own reasoning; §8's extraction candidates are flagged as *plausible*, not scheduled.

## Positive Consequences

- Gives PR5 a single deployment target to design persistence for, without needing to solve distributed transactions across service boundaries before a single aggregate is designed.
- Preserves optionality: any bounded context can be extracted later without re-architecting the domain/application layers, since the hexagonal boundary (§19 of the parent document) is what would need to become a network boundary, not the business logic itself.
- Matches the evidence: the current codebase is already a single deployable unit; this ADR formalizes a target that current infrastructure can converge toward incrementally rather than requiring a platform rewrite.

## Negative Consequences

- A single deployment unit means every module's release rides on every other module's release cadence until an extraction happens — no independent deploy cycles exist initially.
- Logical, not physical, isolation means a resource-exhaustion or crash in one module can still affect the whole process until/unless a module is extracted.
- Some engineers may read "modular monolith" as license to skip the boundary discipline entirely (since nothing enforces it at the network layer) — this requires fitness functions (§53 of the parent document) to catch, not physical isolation.

## Risks

- **Boundary erosion risk:** without physical process isolation, nothing but code review and fitness functions (§53) prevents modules from silently violating the dependency rules in §48. A future PR must define and run these checks, not merely document them.
- **Extraction-timing risk:** waiting for "demonstrated evidence" before extracting a module could mean waiting too long if evidence accumulates faster than architecture review cycles — this ADR does not define a review cadence for re-evaluating extraction candidates.

## Security and Data Implications

- Workspace isolation (§35 of the parent document) is enforced at the application/policy layer regardless of deployment topology; this ADR does not weaken or strengthen that guarantee, since RLS-equivalent enforcement must hold whether modules are co-located or extracted.
- A shared process means a compromised dependency in one module has a wider blast radius than it would after extraction — this is the primary quantifiable argument for the security-driven extraction candidates flagged in §8 and §10 of the parent document (Agent Orchestration, Audit and Compliance).

## Application Implications

- Every application service (§17 of the parent document) is designed against its context's boundary as if it were already a network boundary, so that extraction later is a deployment change, not a redesign.
- Fitness functions (§53) must be defined in a future PR to make boundary violations visible before they accumulate.

## Persistence Implications

- PR5 designs schema and migrations against the aggregate ownership matrix (§12 of the parent document), not against physical service boundaries — a single database (or a database-per-bounded-context pattern within one deployment) is both compatible with this ADR; PR5 makes that call.

## API Implications

- PR6 designs one API surface (however it is transported) rather than N service-to-service contracts; internal module boundaries are not required to be network-addressable initially.

## UX Implications

None — this ADR does not touch UI, routes, or components.

## Migration Implications

None executed by this ADR. A future PR converging the current feature-directory codebase toward the module structure in §49 of the parent document is explicitly incremental (§7.3 principle 30) and not scheduled here.

## Compatibility Implications

The current single-Next.js-application deployment remains valid under this ADR without any immediate change.

## Out of Scope

Choosing a specific extraction order or timeline; choosing a deployment platform; defining the fitness-function tooling itself (§53 names the checks, not the implementation).

## Validation

This ADR is a documentation/ratification artifact. Its validation criteria: (1) no bounded context in `04-bounded-context-catalog.md` is described as requiring independent deployment as a precondition of existing; (2) the extraction-candidate column in `04-canonical-application-architecture.md` §10 lists only contexts with a stated plausible condition, never an unconditional "yes"; (3) no future PR treats this ADR as authorization to begin a service extraction without first satisfying §8's evidence conditions.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §8–§10, §48, §64
- `docs/product-architecture/01-canonical-domain-model.md` §12 (naming-collision evidence motivating boundary discipline)
