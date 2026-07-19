# ADR-PMF-029: Enterprise Intelligence Elevation

Status: Accepted
Date: 2026-07-19
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 §27 identified "the single most consequential open decision in the whole audit": the product vision asks for a governed pipeline elevating knowledge from Project through Program/Portfolio/PMO/Workspace to Enterprise, but the *implemented* architecture's actual answer to cross-tenant knowledge leakage is hard, structural RLS isolation with no cross-workspace query path at all — "these two design intents are not simultaneously true today." ADR-PMF-010 (PR1.1) already ratified the domain-level resolution: Enterprise Intelligence is scoped to Enterprise, incorporates only governed/ratified knowledge with full provenance, and "must never weaken Workspace-level RLS isolation." PR4 must now specify the *application-layer* mechanism precise enough that a future PR can build it without re-opening the tension PR1 flagged, or accidentally building the vector-store-as-source-of-truth pattern ADR-PMF-010 already prohibits.

## Decision

**Knowledge only elevates to Enterprise Intelligence through an explicit workflow with a six-part gate: evidence, confidence, review, lineage, applicability, and ratification. Nothing crosses a Workspace boundary at any stage of this pipeline outside this gate, and every gated crossing preserves full Workspace and Project provenance.** Full specification: `04-canonical-application-architecture.md` §30; workflow detail: `04-application-workflows.md` §8, §12.

## Domain Rules

1. The pipeline is: Project Evidence → Candidate Pattern → Aggregation (Program/Portfolio/PMO) → Review → Workspace Ratification → Enterprise Ratification → Enterprise Knowledge.
2. Every stage transition requires the four elevation-gate inputs applicable to it (evidence, confidence, lineage at minimum); ratification (the final stage) additionally requires an explicit ratifying actor and an applicability scope.
3. A Candidate Pattern is never treated as a Ratified Pattern before explicitly passing every stage of the gate (restating PR1.1 invariant 31).
4. Cross-Workspace elevation (§12 of `04-application-workflows.md`) additionally requires explicit, per-record consent from each originating Workspace's data owner before ratification may even be attempted.
5. Elevated knowledge supports expiration, contradiction, invalidation, revocation, deletion, and scope — it is never treated as a permanent, append-only fact store immune to correction.
6. Enterprise Intelligence must never become a generic vector store queried without this gate; semantic retrieval against it still returns provenance back to the specific Enterprise Knowledge Record (§43 of the parent document).

## Alternatives Considered

- **Scope Enterprise Intelligence to within a single Workspace only** (option (a) from PR1 §27's own framing — never actually cross a Workspace boundary at all). Rejected in favor of the alternative PR1.1 already chose: this would make "Enterprise" spanning multiple Workspaces structurally meaningless, contradicting ADR-PMF-001's ratification that Enterprise may contain multiple Workspaces and that organizational learning should be able to accumulate across them.
- **Automatic elevation once a pattern reaches a confidence threshold**, skipping the review/ratification stages for efficiency. Rejected: this is precisely the "elevación automática" this ADR (and ADR-PMF-010) prohibits — confidence is one of six required inputs, not a substitute for the other five.
- **Keep today's hard-isolation-only posture indefinitely and never build elevation.** Rejected: this was evaluated and explicitly not chosen by the founder's ratification (ADR-PMF-010); PR1.1 §10 records the ratified answer as "belongs to Enterprise; incorporates only governed/ratified knowledge with full provenance," not "elevation is permanently out of scope."

## Positive Consequences

- Resolves PR1's flagged tension with a mechanism, not a rhetorical choice: isolation remains the default and the *only* way to cross it is this named, audited, six-part gate — both of PR1 §27's competing design intents are satisfied simultaneously, exactly as ADR-PMF-010 requires.
- Gives a future PR a complete workflow specification (`04-application-workflows.md` §8, §12) to implement against, rather than needing to re-derive the gate's stages from first principles.
- Makes the single highest-risk feature in the entire application architecture (the one deliberate exception to Workspace isolation) the most heavily audited and reviewed one, proportionate to its risk.

## Negative Consequences

- The gate is deliberately slow and human-paced (no automatic timeouts drive a stage forward, per `04-application-workflows.md` §8) — organizational learning will accumulate more slowly than a fully automated pipeline would allow.
- Requiring per-record consent for cross-Workspace elevation specifically (rule 4) adds friction even for consultancies or Enterprises that might reasonably want broader benchmarking across their own client Workspaces.

## Risks

- **Gate-bypass risk:** the single most consequential risk this ADR is written to prevent is a future implementation shortcut that lets a Candidate Pattern skip a stage "just this once" — `04-application-workflows.md` §8/§12 requires each stage to explicitly pass before the next begins, with no default-pass behavior.
- **Consent-scope risk:** rule 4's per-record consent requirement is not yet specified at the UI/consent-flow level (deferred to a future PR) — an ambiguous consent flow could functionally weaken this gate even while nominally satisfying it.
- **Security review risk:** `04-canonical-application-architecture.md` §36 explicitly calls for mandatory security review before any cross-workspace feature ships; this ADR does not substitute for that review.

## Security and Data Implications

- This is the single ADR in this batch with the highest security stakes: it is the one deliberate, governed exception to Workspace isolation (§35 of the parent document). `04-application-workflows.md` §12 explicitly calls out that any implementation of this workflow must undergo dedicated security review before being built.
- Enterprise Knowledge Records must never be queryable as a bypass path back to the raw Workspace-scoped data they were derived from — the elevated record is a new, provenance-preserving artifact, not a window into the source.

## Application Implications

- Enterprise Intelligence's application service (`EnterpriseIntelligenceApplicationService`, §17 of the parent document) exposes exactly `ProposeEnterprisePattern`, `RatifyEnterpriseKnowledge`, `RevokeEnterpriseKnowledge`, `GetEnterpriseIntelligence`, `GetKnowledgeLineage` — no context bypasses this service to read Enterprise Knowledge directly from another Workspace's data.

## Persistence Implications

- PR5 must design the Enterprise Knowledge Record and Pattern (Candidate/Ratified) aggregates to carry every field in §30 of the parent document (scope, provenance, applicable contexts, originating Workspaces, supporting evidence, confidence, review status, ratifier, effective date, expiration, contradictions, revocation, retention, access policy) — omitting any of these fields would make the six-part gate unauditable after the fact.

## API Implications

- PR6 must never expose an endpoint that queries Enterprise Intelligence data scoped by anything other than an authorized Enterprise-level actor's own applicability scope (§34 of the parent document); no Workspace-scoped query may implicitly include Enterprise Intelligence results without the actor's Enterprise-level authorization being separately checked.

## UX Implications

- PR7's Knowledge Center screen (per PR3's screen catalog) must visually distinguish Candidate from Ratified Patterns at all times (restating PR2's Pattern definition: "always shown with its Candidate/Ratified qualifier — never presented as one undifferentiated 'pattern'").

## Migration Implications

None executed by this ADR. Building the elevation pipeline is explicitly future-PR, security-reviewed work (§52 of the parent document: "Enterprise Intelligence: No elevation pipeline exists... Future PR, security-reviewed").

## Compatibility Implications

No elevation pipeline exists today (PR1 §27, confirmed); this ADR does not need to reconcile with or migrate any existing implementation. It must, however, be reconciled with `data-export-sovereignty-architecture.md`'s existing sovereignty framing before implementation, per PR1.1 §18's contract.

## Out of Scope

Designing the specific consent-flow UI for cross-Workspace elevation (flagged as a risk above); choosing a storage mechanism for lineage graphs (§55 of the parent document).

## Validation

Validation criteria: (1) `04-canonical-application-architecture.md` §30's prohibited list and this ADR's rules 3 and 6 match exactly; (2) `04-application-workflows.md` §8's states include every one of the six gate inputs at the appropriate stage; (3) §12's security note explicitly requires dedicated security review before implementation.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §30, §35–§36, §62.8, §62.12
- `docs/product-architecture/04-application-workflows.md` §8, §12
- `docs/product-architecture/01-canonical-domain-model.md` §27 (Enterprise Intelligence Position — the originally-identified tension)
- `docs/adr/ADR-PMF-010-enterprise-intelligence-governance.md` (domain-level ratification this ADR builds on)
