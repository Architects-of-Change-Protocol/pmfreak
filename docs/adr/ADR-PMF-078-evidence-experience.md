# ADR-PMF-078: Evidence Experience — Reusing the Existing Evidence Vault, Not a New Route

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR9's reconnaissance found two real, distinct "evidence" concepts already in the codebase:

1. `project_evidence` / `project_evidence_content` — uploaded source documents (PDF/DOCX/XLSX/PPTX/TXT) with extracted canonical text, already fully wired at `GET/DELETE /api/project-evidence` and `GET /api/project-evidence-content`, and rendered today at `src/app/(protected)/evidence/page.tsx`.
2. `evidence_items` (migration `20260611000000_operational_evidence_decision_loop.sql`), consumed by `src/lib/decision-governance/service.ts` and `src/lib/operational-flow/operational-flow-service.ts` — a richer, governance-oriented evidence model tied into the Decision lineage (`project_decision_evidence_links.evidence_type`/`evidence_id` reference this generically, by type + id, not by a typed foreign key to one specific table).

The plan initially called for a new `GET /api/projects/[id]/evidence` route; on inspection, the first concept already has a complete, working, tested pair of endpoints that return exactly the fields the new `EvidenceViewer` needs.

## Decision

**The Evidence Viewer module (`src/modules/evidence`) consumes the existing `GET /api/project-evidence` and `GET /api/project-evidence-content` endpoints directly — no new Route Handler was added for the document list.** `Decision.evidence` lineage entries (from `decision-governance`) reference evidence generically by `evidence_id`/`evidence_type` and are rendered inside the `EvidenceViewer` platform component alongside — not merged into — the project's uploaded-document list, since the two are genuinely different evidence concepts today (uploaded source documents vs. governance evidence links) and merging them would fabricate a relationship the data doesn't actually assert.

## Frontend Rules

1. `EvidenceViewer` (the platform Enterprise Component) never inlines full document content — every `EvidenceSourceDocument` is a link (`08-ai-interaction-patterns.md` §5), consistent with the existing Evidence Vault page's own pattern of listing metadata and extraction status, not raw text.
2. The Agent Reasoning section of `EvidenceViewer` is omitted, not rendered empty, when a Decision has no `recommendation_id` (no Agent Run informed it) — per `08-ai-interaction-patterns.md` §5's conditional-presence rule.
3. `can("VIEW_EVIDENCE", {projectId})` gates the Evidence screen; a denied view states the explicit reason (`08-accessibility-guidelines.md` §6) rather than a blank page.

## Alternatives Considered

- **Build a new `GET /api/projects/[id]/evidence` adapter route as originally planned.** Rejected once the existing `/api/project-evidence*` routes were found to already return the needed shape — adding a redundant route would violate the same "no inventar APIs" principle this PR otherwise follows for Decisions/Recommendations.
- **Unify `project_evidence` and `evidence_items` into one model for this PR.** Rejected: out of scope: this is a backend data-model consolidation, not a frontend implementation task, and the two concepts currently serve different callers (document upload/extraction vs. governance decision lineage) with no established equivalence.

## Positive Consequences

- Zero new backend surface for the Evidence Viewer's document list — this PR's Evidence module is the thinnest of the five, by design, since the existing implementation already met the need.

## Negative Consequences

- A Decision's linked evidence (`decision-governance`'s `evidence_id`/`evidence_type`) does not currently resolve to a specific `project_evidence` row or document preview — the Decision detail screen shows the evidence link's type/relationship label only, not a live document link, until a future PR establishes that resolution.

## Risks

- **Two "evidence" words, two models risk:** a reader of the code could reasonably assume `project_evidence` and `evidence_items`/`DecisionEvidenceLink` are the same concept. Mitigated by this ADR naming the distinction explicitly.

## Security and Data Implications

- Unchanged — the existing `/api/project-evidence*` routes' authorization is reused as-is.

## Application Implications

- None — no new Query or Command was introduced for evidence.

## Frontend Implications

- Establishes `EvidenceViewer` as the one place any evidence-adjacent claim (Recommendation, Decision) links to, per `08-design-system.md` §5 rule 1 (one component, one meaning).

## Migration Implications

- None — the existing Evidence Vault page (`src/app/(protected)/evidence/page.tsx`) is untouched; the new module renders a second, project-scoped presentation of the same data at `/w/[workspaceId]/p/[projectId]/evidence`.

## Compatibility Implications

- Fully additive.

## Out of Scope

- Resolving `DecisionEvidenceLink.evidence_id` to a live `project_evidence` document preview.
- Consolidating `project_evidence` and `evidence_items` into one canonical Evidence aggregate.
- `DependencyGraph`/visualization components from the sprint brief's Fase 4 list — not built (no dependency-graph data source was in scope for this slice).

## Validation

- Existing `/api/project-evidence*` tests remain the coverage for the data layer; `tests/enterprise-components.test.mjs` covers the `EvidenceViewer` component's disclosure shape.

## References

- `docs/product-architecture/08-ai-interaction-patterns.md` §5
- `src/app/api/project-evidence/route.ts`, `src/app/api/project-evidence-content/route.ts`
- `supabase/migrations/20260605000000_project_evidence.sql`, `20260611000000_operational_evidence_decision_loop.sql`
