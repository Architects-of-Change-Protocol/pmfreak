# ADR-PMF-050: API Authentication and Authorization Contract

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4 §34 already ratified a multi-layer authorization model (identity, Enterprise membership, Workspace membership, role, entity relationship, action permission, data classification, policy, ownership, delegated authority, time-bound access) and two binding rules with direct API consequences: an Agent inherits the scope of its requesting actor and never a broader one, and service accounts have explicit, auditable identity, never a shared credential. ADR-PMF-030 separately fixed that `ApproveRecommendation`, `RecordDecision`, `CreateActionFromDecision`, and `RecordOutcome` must be four distinct endpoints, and ADR-PMF-027 fixed that an Agent identity may call only four specific Commands. None of these has yet been stated as a binding API-layer authentication/authorization contract — leaving room for a future implementation to authenticate correctly but authorize loosely, or vice versa.

## Decision

**Every request authenticates to exactly one of: a human actor (Supabase Auth), a service account (explicit, auditable, never shared), or an Agent identity (scoped, at token-mint time, to exactly the four ADR-PMF-027 Commands and to its requesting actor's own scope). Authorization is evaluated by the existing PR4 §34 multi-layer model, invoked — never reimplemented — by the API command/query port, and fails closed on any ambiguity. The human-authority boundary (ADR-PMF-030) and the Agent Command boundary (ADR-PMF-027) are enforced at the API layer as a second, independent check, not solely trusted to policy evaluation.**

## API Rules

1. Every authenticated request resolves to exactly one actor type (human, service account, Agent identity) — never left ambiguous or defaulted.
2. An Agent identity's token is scoped at mint time to `RequestAgentRun`, `CancelAgentRun`, `ApproveAgentProposal`, `RejectAgentProposal` only, and to the requesting actor's own Workspace/Project scope — the API command port rejects any other Command call from an Agent-identity token independent of policy evaluation.
3. `ApproveRecommendation`, `RecordDecision`, `CreateActionFromDecision`, `RecordOutcome`, `ApproveMemoryRecord`/`RejectMemoryRecord`, and `RatifyEnterpriseKnowledge`/`RevokeEnterpriseKnowledge` reject any Agent-identity-authenticated caller outright, regardless of any policy grant that might otherwise apply.
4. Authorization failure evaluated before validation's information-revealing side effects — same ordering PR4 §38 and ADR-PMF-049 already fix — is applied consistently across every Command and Query.
5. `enterprise_id` membership alone never authorizes a Workspace-scoped request; Workspace membership is the operative boundary for Workspace-scoped resources.
6. Support Access (elevated platform-support authorization) is always explicit, time-bound, and audited — the API layer never exposes an implicit or silent superuser bypass.

## Alternatives Considered

- **Trust policy evaluation alone to enforce the Agent Command boundary, without a separate API-layer check.** Rejected: PR5's defense-in-depth principle (ADR-PMF-042) is explicit that each layer in the authorization chain independently fails closed — relying solely on policy evaluation for a rule as consequential as "no Agent ever autonomously records a Decision" would violate that principle by collapsing two layers into one.
- **Give Agent identities the same token shape as service accounts, distinguished only by a role flag.** Rejected: an Agent's scope is dynamically derived from its requesting actor at run-request time (PR4 §34) — a static role flag cannot express that relationship; a distinct, run-scoped token type is required.
- **Allow a single composite endpoint for "review and decide" to reduce round trips.** Rejected: ADR-PMF-030's binding API implication explicitly prohibits this; this ADR does not reopen that decision.

## Positive Consequences

- Gives the human-authority and Agent-scope boundaries a concrete, testable enforcement point independent of the (currently three-way-fragmented, PR4 §34 current-state gap) underlying authorization models.
- Makes an Agent's blast radius mechanically bounded to four Commands, verifiable without inspecting policy configuration.

## Negative Consequences

- A second, API-layer enforcement point for the same rule policy evaluation also enforces is deliberate redundancy — it costs a small amount of duplicated logic in exchange for defense-in-depth.

## Risks

- **Token-scope drift risk:** if a future implementation mints an Agent token without properly restricting its claim set, the API-layer check (rule 2) is only as good as that claim being present and correctly read — this ADR names the requirement but does not itself implement the token-minting logic.
- **Consolidation-dependency risk:** the three-parallel-authorization-models current-state gap (PR4 §34) means the "existing application-layer authorization check" this ADR invokes is not yet a single coherent thing — this ADR is designed to be insulated from that consolidation, but the consolidation itself remains unresolved, tracked as migration-strategy work.

## Security and Data Implications

- This ADR is itself a security control — it directly implements PR5's defense-in-depth API-layer implication (ADR-PMF-042: "must not expose any direct-database-access pattern... relying on RLS as the sole authorization mechanism").
- Least-privilege scoping for service accounts and Agent identities (rule 2, `06-api-security-model.md` §7) bounds the damage of a compromised credential of either kind.

## Application Implications

- Application-layer authorization logic (PR4 §34) is invoked, not duplicated, by this ADR's API-layer checks — the two must never diverge in their conclusions, and any divergence is itself a defect.

## Frontend Implications

- PR7 authenticates end users via Supabase Auth exactly as today; no new authentication flow is introduced by this ADR for the human-actor path.

## Migration Implications

- None executed by this ADR. Service-account and Agent-identity token issuance is PR9+ implementation work; consolidating the three parallel authorization models is separate migration-strategy work outside this ADR's scope.

## Compatibility Implications

- Fully compatible with the current Supabase Auth session/JWT mechanism for human actors; adds new token types for service accounts and Agent identities without changing the existing human authentication flow.

## Out of Scope

- OIDC/SSO, Personal Access Tokens — both remain open (`06-canonical-api-contracts.md` §33).
- Consolidating the three parallel authorization models into one.

## Validation

Validation criteria: (1) `06-api-security-model.md` §2.3–2.4 states the human-authority and Agent-Command boundaries as API-layer-enforced, not policy-only; (2) no `06-*` document proposes an Agent-callable endpoint outside the four ADR-PMF-027 Commands; (3) every authorization statement in `06-api-resource-catalog.md`/`06-command-catalog.md`/`06-query-catalog.md` is traceable to PR4 §34's model.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §34
- `docs/adr/ADR-PMF-027-governed-ai-agent-execution.md`
- `docs/adr/ADR-PMF-030-human-authority-domain-mutation.md`
- `docs/adr/ADR-PMF-042-defense-in-depth-rls.md`
- `docs/product-architecture/06-api-security-model.md`
