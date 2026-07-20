# ADR-PMF-040: Ratified Enterprise Knowledge Persistence

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

ADR-PMF-010 and ADR-PMF-029 established Enterprise Intelligence as a governed knowledge aggregate rooted at Enterprise, reached only through a six-part elevation gate (evidence, confidence, review, lineage, applicability, ratification), and require that Workspace and Project provenance be preserved even after elevation, that nothing crosses Workspaces or clients automatically, and that elevation is never an implicit byproduct of a query or retrieval path. The current-state inventory found only two of roughly fourteen aspirational tables built (`organizational_memory`, `organizational_memory_sources`), no `enterprises` table at all, and no elevation pipeline — this is a target the current schema does not yet implement. PR5 must define the persistent shape of this governed pipeline precisely enough that PR6/PR9+ can build it without either weakening the cross-Workspace isolation guarantee or accidentally treating a Workspace-local pattern candidate as if it were already Enterprise knowledge.

## Decision

**Enterprise Intelligence is persisted as ratified, versioned, revocable Enterprise Knowledge Records, reached only via an explicit elevation pipeline (Project Evidence → Pattern Candidate → aggregation → review → Workspace ratification → Enterprise ratification), with every record retaining traceable provenance back to its originating Workspace(s) and Project(s).** No query path, retrieval mechanism, or aggregation job may create or promote an Enterprise Knowledge Record as a side effect — ratification is always an explicit, attributable governed act.

## Persistence Rules

1. `enterprise_pattern_candidates` (+ `_evidence`, `_reviews`) hold pre-ratification state — a candidate pattern is never queryable by the same code path that serves ratified Enterprise Knowledge, and is never labeled to end users or agents as authoritative.
2. `enterprise_knowledge_records` (+ `_versions`, `_scope`, `_contradictions`, `_revocations`) hold ratified knowledge, carrying at minimum: `knowledge_record_id`, `enterprise_id`, `status`, `knowledge_type`, `title`, `canonical_content`, `confidence`, `applicability`, `effective_from`, `effective_until`, `ratified_at`, `ratified_by`, `revoked_at`, `revoked_by`, `revocation_reason`, `version`.
3. Every Enterprise Knowledge Record preserves its originating Workspace(s) and Project(s) via explicit provenance references — elevation never discards or generalizes away the source, even though the record now belongs conceptually to the Enterprise.
4. Ratification (`RatifyEnterpriseKnowledge`) is a single, explicit command that can only execute once the six-part gate (evidence, confidence, review, lineage, applicability, ratification) is satisfied and recorded — no default-pass path exists for any of the six.
5. Cross-Workspace elevation additionally requires explicit, recorded per-Workspace consent from each originating Workspace's data owner before ratification is attempted (per PR4 Workflow 12); this consent is itself a persisted, auditable record, not an implicit assumption.
6. Revoked or expired Enterprise Knowledge Records are excluded from default retrieval by agents or product surfaces, the same way revoked Project Memory Records are (ADR-PMF-039 rule 7) — revocation must take effect at the retrieval layer, not merely as a status flag no one checks.
7. Enterprise Knowledge never aggregates data from Workspaces belonging to different Enterprises — `enterprise_id` scoping (ADR-PMF-034) applies to Enterprise Knowledge Records exactly as it applies to any other Enterprise-scoped record; the elevation gate governs crossing *Workspace* boundaries within one Enterprise, never crossing Enterprise boundaries.
8. Enterprise Intelligence is not a generic vector store: any derived search/vector index over Enterprise Knowledge Records is a projection governed by ADR-PMF-041, never a substitute for the ratified record itself.

## Alternatives Considered

- **Automatic elevation based on pattern frequency or similarity threshold, with no explicit ratification step.** Rejected: this is precisely what ADR-PMF-010/029 and PR1.1 invariant 32 ("only governed knowledge may be elevated to Enterprise") forbid — a frequency or similarity threshold is a signal that a candidate might be worth reviewing, never itself sufficient authorization to cross the Workspace boundary.
- **Store Enterprise Knowledge without retaining per-Workspace provenance, on the theory that once ratified it "belongs" only to the Enterprise.** Rejected: PR1.1 invariant 5 ("Enterprise Intelligence preserves Workspace and Project provenance") and ADR-PMF-010 explicitly require the source to remain traceable — discarding it would make later contradiction/revocation/audit impossible to reason about correctly.
- **Treat the two existing current-state tables (`organizational_memory`, `organizational_memory_sources`) as already the canonical Enterprise Intelligence model.** Rejected: the current-state inventory shows no `enterprises` table exists at all and no elevation pipeline exists; declaring these two tables canonical would violate this PR's restriction against declaring implemented what is only a target.

## Positive Consequences

- Preserves the single hardest guarantee in the entire domain model — no cross-client or cross-Workspace knowledge leakage — with a persistence-layer structure that makes accidental violation (a stray join, a missing filter) visibly wrong rather than silently permissible.
- Gives Enterprise Administration and future compliance/security review a concrete, auditable trail for every piece of knowledge that ever crossed a Workspace boundary, including who consented and who ratified it.
- Keeps candidate patterns (frequent, low-stakes, exploratory) structurally separate from ratified knowledge (rare, high-stakes, authoritative), so the two are never confusable in code or in the UI.

## Negative Consequences

- The elevation pipeline (aggregation → review → Workspace ratification → Enterprise ratification → optional cross-Workspace consent) is materially more engineering and product process than an automatic knowledge-sharing feature would be.
- Because nothing crosses automatically, Enterprise Intelligence will necessarily grow more slowly and require deliberate operational investment (review capacity) to populate — this is an accepted tradeoff, not a defect to "fix" by loosening the gate.

## Risks

- **Consent-bypass risk:** an implementation shortcut that ratifies cross-Workspace knowledge without first recording explicit per-Workspace consent (rule 5) would silently violate the highest-security-stakes workflow in PR4's catalog — this must be a dedicated security review checkpoint before any implementation (per PR4 Workflow 12's own note).
- **Provenance-loss risk:** an aggregation or summarization step that flattens multiple Workspaces' evidence into a single candidate pattern without retaining per-source Workspace/Project references would make rule 3 and PR1.1 invariant 5 unverifiable after the fact.

## Security and Data Implications

- This ADR is the single highest-security-stakes ADR in the PR5 batch, mirroring PR4's own characterization of the Enterprise Intelligence Elevation ADR and its associated workflow — any implementation must undergo dedicated security review before being built, consistent with `05-tenancy-rls-and-data-security.md`.
- `enterprise_id` scoping combined with per-record consent tracking is the persistence-layer backstop for the "no cross-client persistence access" principle (§8.3).

## Application Implications

- The Enterprise Intelligence application service (per ADR-PMF-029) exposes exactly `ProposeEnterprisePattern`, `RatifyEnterpriseKnowledge`, `RevokeEnterpriseKnowledge`, `GetEnterpriseIntelligence`, `GetKnowledgeLineage` — no other context queries `enterprise_knowledge_records` or `enterprise_pattern_candidates` directly.
- Agent Orchestration and Recommendation Management may only consume ratified (not candidate) Enterprise Knowledge, and only within the record's declared `applicability` scope.

## API Implications

- PR6 must design the Enterprise Intelligence API surface so that no endpoint exposes candidate patterns to a consumer expecting ratified knowledge, and so that lineage/provenance data is available to authorized Enterprise-administration callers for audit purposes.

## UX Implications

- PR7/PR8 must give reviewers and ratifiers (PMO/Workspace/Enterprise-level authorized actors) a clear, distinct review surface for candidate patterns versus a separate, clearly-labeled "Enterprise Knowledge" surface for ratified records.

## Migration Implications

- No elevation pipeline exists today; this is new, additive infrastructure built in an expand phase (ADR-PMF-044), not a retrofit of `organizational_memory`. Whether `organizational_memory` becomes an input source, a deprecated precursor, or is otherwise reconciled is a gap analysis for `05-persistence-migration-strategy.md`, not a decision made by this ADR.

## Operational Implications

- Ratification and consent decisions require durable, queryable audit records (ADR-PMF-036) independent of the knowledge record's own version history, so a future compliance review can reconstruct exactly what was known, by whom, and why it was allowed to cross a Workspace boundary.

## Compatibility Implications

- Introduces no new database technology; implementable within the relational canonical write model (ADR-PMF-033).

## Out of Scope

- The exact review/ratification UI workflow — deferred to PR7/PR8.
- The exact algorithm for pattern-candidate aggregation across Programs/Portfolios/PMOs — a product/ML decision outside PR5's scope.

## Validation

Validation criteria: (1) `05-memory-knowledge-ai-persistence.md` documents the full elevation pipeline and six-part gate exactly as stated in ADR-PMF-029 and this ADR; (2) no document produced under PR5 describes an automatic or default-pass elevation path; (3) every Enterprise Knowledge Record's documented schema includes a provenance/originating-Workspace reference and a revocation state.

## References

- `docs/adr/ADR-PMF-010-enterprise-intelligence-governance.md`
- `docs/adr/ADR-PMF-029-enterprise-intelligence-elevation.md`
- `docs/product-architecture/01.1-domain-ratification.md` §8 (invariants 5, 32)
- `docs/product-architecture/04-application-workflows.md` (Workflow 8, Workflow 12)
- `docs/product-architecture/05-memory-knowledge-ai-persistence.md`
