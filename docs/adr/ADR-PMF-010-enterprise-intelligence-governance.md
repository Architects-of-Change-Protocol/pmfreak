# ADR-PMF-010: Enterprise Intelligence Belongs to Enterprise, Under Governed Elevation

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) identifies Enterprise Intelligence as **"the single most consequential open decision in the whole audit... a genuine tension, not just a gap"** (§27). The vision describes a pipeline — evidence → observation → inference → hypothesis → recommendation → decision → pattern candidate → validated pattern → Enterprise Intelligence — explicitly crossing Project → Program → Portfolio → PMO → Workspace → Enterprise with governance at each step (§27's diagram, every edge marked "NOT YET BUILT"). No part of that pipeline exists in the repository today: PR1 found zero grep hits anywhere in the codebase for "pattern candidate," "validated pattern," or any cross-tenant knowledge-elevation mechanism as an implemented concept (§27).

What is implemented instead is the structural opposite of a governed promotion pipeline: hard, RLS-enforced tenant isolation, stated as an absolute in multiple independent architecture documents. `docs/architecture/operational-runtime-memory.md` documents `companyId` as a *"tenant boundary (never crossed)"*, with `assertScopeIsolation()` throwing before every retrieval return on cross-company or cross-workspace access. `docs/architecture/command-center-foundation.md` states *"Agents and memory only ever retrieve from the active Command Center — there is no cross-workspace query path in the RLS policies."* Even the one real learning system that exists, `intervention-efficacy-learning.md` (correlating intervention types with recovery outcomes), is RLS-scoped per workspace/project; there is no org-wide or cross-tenant learning corpus, by design, not by omission (PR1 §27). Workspace-level RLS is independently confirmed live and correct: 408 of 409 tables have RLS enabled, and a live two-workspace smoke test rejected 10/10 attempted cross-tenant operations (PR1 §16).

PR1 also documents a severe aspirational-vs-built gap specific to this area: `docs/architecture/customer-owned-organizational-memory-framework.md` (644 lines) is written as if implementation-ready — a full ~14-table spec, a 9-role permission model, a 0–100 sovereignty score, a full lifecycle with revocation and expiration — but only 2 of its ~14 specified tables actually exist in migrations (`organizational_memory`, `organizational_memory_sources`), a roughly 7:1 spec-to-build ratio (PR1 §12 C-5). PR1 explicitly recommends against treating that document as ground truth for what exists, or building against it verbatim, until product ratifies a scoped v1 (§27).

Separately, `docs/architecture/data-export-sovereignty-architecture.md` frames data sovereignty today strictly as **export/portability rights** — workspace-scoped `export_jobs`, redaction of provider secrets, an internal sovereignty-index metric — not as intelligence-sharing control. PR1 states plainly that "a tenant can get their data out" is not the same claim as "a tenant can control what of their data is learned from elsewhere," and that any future Enterprise Intelligence elevation design must be reconciled with that document, not designed independently of it (PR1 §36).

ADR-PMF-001 already ratified Enterprise as a distinct canonical entity above Workspace and named Enterprise Intelligence as one of the concerns rooted at Enterprise, while explicitly deferring its mechanism to this decision. This ADR resolves that deferral. It closes PR1 §27's open tension by choosing neither of the two extremes PR1 described in isolation — it does not scope Enterprise Intelligence to a single Workspace only, and it does not build the vision's cross-tenant elevation pipeline unconstrained — but instead ratifies that the pipeline exists, conceptually, rooted at Enterprise, strictly subordinate to the isolation guarantees already proven in production. This is a ratification of intent only. No table, migration, route, API, or TypeScript type is created or modified by this document. Implementation is deferred to a future, separately-scoped PR2.

## Decision

**Enterprise Intelligence conceptually belongs to Enterprise and preserves the scope, provenance, and restrictions of each Workspace.**

Enterprise Intelligence incorporates only governed, ratified knowledge, carries full provenance back to its Workspace and Project origin, and must never weaken today's proven Workspace-level RLS isolation. Nothing crosses a Workspace or client boundary automatically. Elevation to Enterprise is an explicit, governed act — never an implicit consequence of data existing at a lower level, and never a byproduct of a query, agent run, or retrieval path.

This reconciles PR1 §27's stated tension rather than picking a side: the vision's evidence → pattern-candidate → validated-pattern pipeline is preserved as the target shape of governed elevation, and the implemented isolation-by-construction model is preserved as the non-negotiable default state of every record until it is deliberately, auditably promoted.

## Domain Rules

1. Evidence originates in Projects. It is never manufactured at a higher level.
2. Patterns may be aggregated at Program, Portfolio, and PMO level, within a single Workspace, without crossing that Workspace's boundary.
3. Knowledge may be elevated to Workspace level as a distinct, explicit act from aggregation — aggregation alone does not constitute elevation.
4. Only ratified knowledge may be elevated to Enterprise. Unratified aggregation, however broad, stops at Workspace.
5. Nothing crosses Workspaces automatically. There is no implicit or query-time cross-workspace read path, at Enterprise Intelligence or anywhere else — this is a continuation, not a relaxation, of the existing `assertScopeIsolation()` guarantee.
6. Nothing crosses clients. Where a Workspace maps to a distinct client relationship (e.g., a consultancy's per-client Workspaces), Enterprise Intelligence must not blend one client's knowledge into another's, regardless of whether both Workspaces share an Enterprise.
7. Elevation to Enterprise requires all six of: evidence, confidence, review, lineage, applicability, and ratification. A record missing any one of the six is not eligible for elevation, regardless of how compelling it appears.
8. Elevated knowledge must support expiration, contradiction, invalidation, revocation, deletion, and scope — as first-class lifecycle states, not as an afterthought bolted onto a static record.
9. Enterprise Intelligence is not a generic vector store. Embeddings may be an implementation detail of retrieval; they are not the governance model, and similarity is not evidence of validity.
10. Enterprise Intelligence is not aggregated chat history. Raw conversational transcript, however voluminous, is not knowledge and does not elevate by virtue of accumulation.
11. Enterprise Intelligence must distinguish, at the type level, between: facts, observations, recommendations, decisions, outcomes, candidate patterns, and ratified patterns. These are not interchangeable, and inference is never conflated with evidence, nor recommendation with decision, nor candidate pattern with ratified pattern.

## Alternatives Considered

- **Scope Enterprise Intelligence to within a single Workspace only** (PR1 §27's option (a) — multiple PMOs/Portfolios/Programs/Projects elevate knowledge only as far as their shared Workspace, never beyond it). Rejected as the final answer, though partially retained as an intermediate stage in Rule 3: this would leave "Enterprise Intelligence" as a misnomer for what is really Workspace Intelligence, and would abandon the vision's stated goal of enterprise-wide organizational learning across a multi-Workspace customer or consultancy, which ADR-PMF-001 already ratified as a real target-state need.
- **Build the full vision pipeline as an unconstrained, always-on cross-tenant elevation mechanism** (PR1 §27's option (b) taken to its most permissive form — any workspace's data can flow to Enterprise once "good enough"). Rejected: this directly contradicts the implemented and RLS-verified isolation model (PR1 §16, §27), turns `assertScopeIsolation()`'s "never crossed" guarantee into a guarantee with an exception, and creates exactly the kind of implicit cross-tenant leakage the current architecture was deliberately built to prevent.
- **Build to the full aspirational `customer-owned-organizational-memory-framework.md` spec verbatim** (~14 tables, 9-role permission model, 0–100 sovereignty score). Rejected: PR1 documents this as a roughly 7:1 spec-to-build gap already (§12 C-5); committing to build it as written, rather than a ratified, deliberately scoped subset, would repeat the same aspiration-outpacing-implementation failure mode this audit exists to correct.
- **Leave Enterprise Intelligence as pure vision language indefinitely**, deferring any decision until a future PR. Rejected: this is the status quo PR1 flagged as the single most consequential open decision in the audit; leaving it open blocks PR2 implementation planning for the entire top of the ratified hierarchy and leaves ADR-PMF-001's reference to Enterprise Intelligence as an Enterprise-rooted concern unresolved.
- **Treat data-export sovereignty as sufficient sovereignty control for intelligence elevation**, and skip designing a separate consent/ratification mechanism. Rejected: PR1 §36 is explicit that today's sovereignty architecture is export/portability rights, not intelligence-sharing control — these are different guarantees, and conflating them would let elevation proceed under a sovereignty banner that does not actually cover it.

## Positive Consequences

- Resolves PR1 §27, the audit's single most consequential open decision, with a ratified answer rather than leaving the tension unresolved.
- Gives Enterprise Intelligence a real conceptual root (Enterprise, per ADR-PMF-001) instead of remaining pure aspiration with no owning entity.
- Reconciles the vision's governed-elevation pipeline with the implemented isolation-by-construction model, rather than requiring the product to pick one and abandon the other.
- Provides an explicit six-part gate (Rule 7) that any future elevation design, and any future ADR or PR2 scoping effort, can be validated against — preventing vague or ad hoc "this seems like a pattern" promotions.
- Establishes a lifecycle requirement (Rule 8: expiration, contradiction, invalidation, revocation, deletion, scope) up front, before any schema is designed, avoiding the retrofit problem that the current 2-of-14-table aspirational spec exhibits.
- Forces explicit reconciliation with `data-export-sovereignty-architecture.md` (PR1 §36) rather than allowing a second, competing notion of "sovereignty" to be invented independently.

## Negative Consequences

- Enterprise Intelligence remains fully unimplemented after this ADR; no customer-visible capability is delivered by this decision alone.
- The six-part elevation gate (Rule 7) is deliberately strict, which means a future PR2 implementation will likely be slow to accumulate elevated knowledge, especially for early customers with limited evidence volume — this is an intentional tradeoff against leakage risk, not an oversight.
- Distinguishing facts, observations, recommendations, decisions, outcomes, candidate patterns, and ratified patterns at the type level (Rule 11) is real modeling and engineering work; a future implementation cannot shortcut this by reusing the existing undifferentiated `organizational_memory` table as-is.
- Because elevation is explicitly non-automatic (Rule 5), Enterprise Intelligence cannot passively grow from usage alone; it requires a deliberate review/ratification workflow to exist and be staffed, which is itself unscoped by this ADR.

## Risks

- **Aspirational-spec risk:** a future PR2 could treat this ADR's ratification as license to resume building the full 14-table `customer-owned-organizational-memory-framework.md` spec verbatim. Mitigation: this ADR explicitly warns against that (see Migration Implications) and requires any future implementation to be scoped down from that document, not built to it as-is.
- **Isolation-erosion risk:** because this ADR ratifies that knowledge *can* cross Workspace boundaries under governance, an implementer could be tempted to treat "governed" loosely and add a convenience cross-workspace read path "just for Enterprise Intelligence," eroding the `assertScopeIsolation()` guarantee PR1 confirmed as absolute. Mitigation: Rules 5–6 and the Security and Data Implications section below are explicit that elevation is a write-time, reviewed, ratified promotion into a distinct Enterprise-owned store — never a relaxation of read-time isolation.
- **Sovereignty-conflation risk:** a future implementation could assume the existing export-sovereignty architecture already covers intelligence-sharing consent. Mitigation: PR1 §36 and this ADR both state explicitly that these are different guarantees requiring separate design, reconciled together rather than independently.
- **Governance-theater risk:** the six-part gate (Rule 7) could be implemented as a checkbox rather than substantive review, producing elevated "knowledge" that is technically gated but not actually validated. Mitigation is left to PR2's design, but this ADR records the expectation that "review" and "ratification" are meaningful, accountable steps, not automated rubber stamps.

## Security and Data Implications

- This ADR does not alter, weaken, or bypass the existing Workspace-level RLS model. The 408/409-table RLS coverage and the verified 10/10 cross-tenant rejection result (PR1 §16), and the `assertScopeIsolation()` guarantee documented in `operational-runtime-memory.md`, remain the operative tenant-isolation guarantees for all retrieval paths, including any future Enterprise Intelligence retrieval path.
- Elevation to Enterprise, when implemented, must be a distinct write-time operation into an Enterprise-owned store, gated by the six-part rule (Rule 7), not a read-time relaxation of any existing Workspace- or Project-scoped RLS policy. No agent, memory, or retrieval code path should be able to reach across Workspaces by querying Enterprise Intelligence as a side door.
- Client boundary preservation (Rule 6) must hold even when multiple Workspaces share one Enterprise (e.g., a consultancy's per-client Workspaces) — Enterprise ownership of an intelligence corpus does not imply that all contributing Workspaces may see each other's contributions; a future design must specify per-record visibility, not just per-Enterprise ownership.
- Provenance (Rule 1, Rule 7 "lineage") is a security-relevant property, not just an audit convenience: without it, revocation and invalidation (Rule 8) cannot be scoped correctly, since there would be no reliable way to identify which elevated records trace back to a since-revoked or since-corrected source.
- This ADR does not specify the mechanism for reconciling with `data-export-sovereignty-architecture.md` (PR1 §36); that reconciliation is required before implementation but is explicitly Out of Scope here.

## Migration Implications

No migration is executed by this ADR. The following describes what a future, carefully-scoped PR2 effort would need to plan for — it is not authorized, scheduled, or started by this document, and it is explicitly **not** a license to build `customer-owned-organizational-memory-framework.md`'s full ~14-table spec verbatim:

- A scoped-down elevation data model, built from this ADR's rules rather than the aspirational document: at minimum, distinct representations for evidence, observation, candidate pattern, and ratified pattern (Rule 11), each carrying lineage back to originating Workspace and Project (Rule 1, Rule 7), and lifecycle state per Rule 8 (expiration, contradiction, invalidation, revocation, deletion, scope).
- The existing `organizational_memory` and `organizational_memory_sources` tables (the 2 of ~14 that already exist) must be evaluated against this ADR's rules before being reused; they were built against the unratified aspirational spec and may need structural changes, not straightforward extension.
- An explicit elevation workflow (review + ratification, Rule 7) as a first-class process, not just a data model — this implies new application-layer logic and, plausibly, new roles/permissions, not just new tables.
- Reconciliation work with `data-export-sovereignty-architecture.md` (PR1 §36) so that "sovereignty" has one consistent meaning across export/portability and intelligence-elevation consent, rather than two competing definitions.
- RLS and access-control design for any new Enterprise-owned store, additive to — never a replacement for — existing Workspace-scoped RLS, consistent with ADR-PMF-001's Security and Data Implications.
- A recommended sequencing note for PR2 scoping: implement Rules 1–3 (evidence → aggregation → Workspace-level elevation) first, since that is compatible with today's isolation model with the least new surface area, before attempting Rule 4 (Enterprise-level elevation), which requires the full six-part gate and the cross-Workspace/cross-client provenance guarantees to already be correct.

## UX Implications

- No UI, navigation, route, or copy changes are made by this ADR.
- A future implementation must not present candidate patterns, recommendations, or unratified aggregations as if they were ratified Enterprise Intelligence; Rule 11's type distinctions (fact vs. observation vs. recommendation vs. decision vs. outcome vs. candidate pattern vs. ratified pattern) should be visible, not collapsed, wherever elevated knowledge is surfaced to a user.
- Any future review/ratification workflow (Rule 7) implies a UX surface for whoever performs that review — unscoped by this ADR, but a future PR2 design must account for it as real product surface area, not a background batch job with no human-visible step.
- Existing Project Memory, Operational Memory, and chat-history UX (PR1 §23–24) are unaffected by this ADR; none of those systems are redefined, renamed, or repurposed as Enterprise Intelligence by this decision.

## Compatibility Implications

- Backward compatible with the current implementation: no existing table, type, route, or API depends on the absence of Enterprise Intelligence, so ratifying its target shape breaks nothing today.
- Fully compatible with, and additive to, the existing isolation guarantees in `operational-runtime-memory.md` (`assertScopeIsolation()`) and `command-center-foundation.md` (no cross-workspace query path) — this ADR does not ask either document to be revised; it ratifies that any future elevation mechanism must be built to preserve, not relax, what they already guarantee.
- `docs/architecture/customer-owned-organizational-memory-framework.md` is not adopted as-is by this ADR. Its existing 2 built tables remain in place and are not deprecated by this document, but its remaining ~12-table aspirational spec must not be treated as an approved implementation target; any future work must be re-scoped against this ADR's rules first.
- `docs/architecture/data-export-sovereignty-architecture.md` is not superseded or altered by this ADR; this ADR requires future reconciliation with it (Security and Data Implications) rather than treating it as already covering elevation governance.
- Consistent with, and dependent on, ADR-PMF-001 (Enterprise as a distinct canonical entity); this ADR does not stand alone if ADR-PMF-001 were ever reversed, since Enterprise Intelligence's conceptual root would no longer exist.

## Out of Scope

- Any database schema change, migration, table, column, or FK.
- Any TypeScript type, interface, or class for elevation, candidate patterns, or ratified patterns.
- Any route, API endpoint, or UI surface for reviewing, ratifying, or browsing Enterprise Intelligence.
- The specific reconciliation mechanism between this ADR and `data-export-sovereignty-architecture.md` — required before implementation, but its design is deferred to PR2.
- Staffing, roles, or process design for the review/ratification workflow required by Rule 7.
- Any statement about timeline, sprint assignment, or prioritization of Enterprise Intelligence implementation relative to other roadmap items.
- Resolution of any other PR1 open decision (Command Center, Portfolio, Program, etc.) — each is independent of this ADR and addressed, where ratified, by its own decision record.

## Validation

- This decision is validated by ratification: it is recorded as Accepted, with Founder / Product Authority and PMFreak Architecture as decision owners, resolving the tension PR1 §27 explicitly declined to resolve on its own.
- No code, schema, or test changes accompany this ADR, so there is no build, lint, typecheck, or test suite to run against it. The applicable check is documentary: this file follows the mandatory ADR section format, states the ratified decision without presenting it as open, and accurately describes current-state evidence — verified directly against `docs/architecture/operational-runtime-memory.md`, `docs/architecture/command-center-foundation.md`, and `docs/product-architecture/01-canonical-domain-model.md` §27, §12 C-5, and §36 in the course of writing this document — without claiming any elevation pipeline has been implemented.
- Future validation belongs to PR2: once any elevation mechanism exists, it must be validated the same way Workspace isolation was — including an explicit test proving that unratified knowledge cannot reach Enterprise Intelligence, that ratified knowledge retains correct lineage, and that no retrieval path can cross a Workspace or client boundary without going through the elevation gate, analogous to the 10/10 cross-Workspace RLS smoke test cited in PR1 §16.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1, particularly §9, §12 (C-5), §16, §27, and §36, which this ADR directly resolves and builds on.
- `docs/product-architecture/01.1-domain-ratification.md` — the PR1.1 ratification document authored alongside this ADR, recording the full set of founder-ratified domain decisions this ADR is one part of.
- `docs/adr/ADR-PMF-001-enterprise-workspace-separation.md` — ratifies Enterprise as a distinct canonical entity and names Enterprise Intelligence as one of the concerns rooted there; this ADR resolves the mechanism ADR-PMF-001 deferred.
- `docs/architecture/operational-runtime-memory.md` — source of the `companyId` "never crossed" tenant-boundary guarantee and `assertScopeIsolation()` behavior cited in Context and Security and Data Implications.
- `docs/architecture/command-center-foundation.md` — source of the "no cross-workspace query path in the RLS policies" statement cited in Context.
- `docs/architecture/customer-owned-organizational-memory-framework.md` — the aspirational ~14-table spec (2 tables built) that this ADR explicitly warns against building verbatim.
- `docs/architecture/data-export-sovereignty-architecture.md` — the current export/portability-rights framing of sovereignty that any future elevation design must be reconciled with, per PR1 §36.
- `docs/release/rls-tenant-isolation-report.md` — source of the Workspace-level RLS verification cited in Security and Data Implications.
