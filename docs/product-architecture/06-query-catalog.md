# PR6 Companion — Query API Catalog

Status: Documentary architecture (no implementation)
Parent: `06-canonical-api-contracts.md`

Purpose: give every Query already catalogued in `04-command-query-event-catalog.md` a wire contract — endpoint, filters, response DTO, authorization, and consistency expectation. Every Query below is side-effect free (ADR-PMF-025) — none writes state, including telemetry writes that could be mistaken for harmless (§2 of the parent document). This document does not add, rename, or redefine a single Query; it exposes exactly the Queries PR4 ratified.

**Universal rules, binding for every Query below (not repeated per row):**
- Authorization is evaluated before the read executes; an unauthorized caller receives `AuthorizationError` for scope it cannot resolve at all, and a redacted result (never an error) for fields within an otherwise-authorized resource it lacks field-level visibility into (§8 of the parent document).
- Results are always shaped as a Response, Summary, Projection, Search, or Feed DTO (`06-canonical-api-contracts.md` §9) — never a raw aggregate or table row.
- Collection-returning Queries follow the pagination/filtering/sorting rules in `06-canonical-api-contracts.md` §10–12 by default; only resource-specific deviations are noted per row.
- Consistency is inherited unchanged from PR4 §24 — **Strong**: authorization, Workspace ownership, Project membership, Decision status, Recommendation approval, Action creation. **Eventual**: Command Center projections, Search, Health aggregation, Enterprise Intelligence read-side projections. **Strong/durable**: Audit.

---

## 1. Overview Queries

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetEnterpriseOverview` | `GET /enterprises/{enterpriseId}` | — | Enterprise Response DTO | Enterprise Administrator | Strong |
| `GetWorkspaceOverview` | `GET /workspaces/{workspaceId}` | — | Workspace Response DTO | Workspace member | Strong |
| `GetPMOOverview` | `GET /pmos/{pmoId}` | — | PMO Response DTO | Workspace member with PMO visibility | Strong |
| `GetPortfolioOverview` | `GET /portfolios/{portfolioId}` | — | Portfolio Response DTO | Workspace/PMO member with Portfolio visibility | Strong |
| `GetProgramOverview` | `GET /programs/{programId}` | — | Program Response DTO | Workspace/PMO member with Program visibility | Strong |
| `GetProjectOverview` | `GET /projects/{projectId}` | — | Project Response DTO | Project member | Strong |

## 2. Health Queries

Health Queries are always aggregations across a scope's owned/child records and are always Eventual — a Health response never claims Strong consistency even where its inputs individually are.

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetProjectHealth` | `GET /projects/{projectId}/health` | — | Project Health Projection DTO | Project member | Eventual |
| `GetPortfolioHealth` | `GET /portfolios/{portfolioId}/health` | — | Portfolio Health Projection DTO | Workspace/PMO member with Portfolio visibility | Eventual |
| `GetProgramHealth` | `GET /programs/{programId}/health` | — | Program Health Projection DTO | Workspace/PMO member with Program visibility | Eventual |
| `GetPMOHealth` | `GET /pmos/{pmoId}/health` | — | PMO Health Projection DTO | Workspace member with PMO visibility | Eventual |
| `GetEnterpriseHealth` | `GET /enterprises/{enterpriseId}/health` | — | Enterprise Health Projection DTO | Enterprise Administrator | Eventual |

## 3. Command Center, Feed, and Memory

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetProjectCommandCenter` | `GET /projects/{projectId}/command-center` | `widgets` (widget-selection filter) | Command Center Projection DTO | Project member | Eventual |
| `GetProjectIntelligenceFeed` | `GET /projects/{projectId}/feed` | `date_range`, `source_type`, `pipeline_stage` | Feed DTO (paginated) | Project member; individual feed items respect their own source-record authorization | Eventual |
| `GetProjectMemory` | `GET /projects/{projectId}/memory` | `validation_status`, `confidence_threshold` | Project Memory Record Response DTO (paginated) | Project member; redacts rather than errors on field-level restriction | **Strong for Approved records**, Eventual for candidate/derived retrieval-index views |

## 4. Search

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `SearchWorkspace` | `GET /workspaces/{workspaceId}/search?q=` | `q` (required), resource-type filter | Search DTO (paginated) | Workspace member; results filtered to caller's authorized scope and classification ceiling before return | Eventual |
| `SearchProject` | `GET /projects/{projectId}/search?q=` | `q` (required), resource-type filter | Search DTO (paginated) | Project member | Eventual |

Neither Query returns an embedding under any circumstance (`06-canonical-api-contracts.md` §13, PR5 principle 12).

## 5. Recommendation, Decision, Action, Outcome

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `ListRecommendations` | `GET /projects/{projectId}/recommendations` | `status`, `confidence`, `created_after`/`updated_after` | Recommendation Summary DTO (paginated) | Project member | Strong (Recommendation approval status) |
| `GetRecommendationDetails` | `GET /recommendations/{id}` | — | Recommendation Response DTO | Project member | Strong |
| `ListDecisions` | `GET /projects/{projectId}/decisions` | `status`, `created_after`/`updated_after` | Decision Summary DTO (paginated) | Project member | Strong (Decision status) |
| `GetDecisionDetails` | `GET /decisions/{id}` | — | Decision Response DTO | Project member | Strong |
| `ListActions` | `GET /projects/{projectId}/actions` | `status` | Action Summary DTO (paginated) | Project member | Strong (Action creation) |
| `ListOutcomes` | `GET /projects/{projectId}/outcomes` | `status` | Outcome Summary DTO (paginated) | Project member | Strong |

## 6. Agent

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetAgentRun` | `GET /agent-runs/{id}` | — | Agent Run Response DTO | Requesting actor who started the run, or Workspace Owner/Admin | Strong |
| `ListAgentRuns` | `GET /workspaces/{workspaceId}/agent-runs` | `status`, `agent_id`, `created_after`/`updated_after` | Agent Run Summary DTO (paginated) | Workspace member with Agent Run visibility; results scoped to caller's own runs unless holding elevated visibility | Strong |

## 7. Enterprise Intelligence

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetEnterpriseIntelligence` | `GET /enterprises/{enterpriseId}/knowledge` | `applicability_scope`, `ratification_status` | Enterprise Knowledge Record Response DTO (paginated) | Enterprise Intelligence governance capability; redacts rather than errors on field-level restriction | Eventual (read-side projection) |
| `GetKnowledgeLineage` | `GET /knowledge/{id}/lineage` | — | Lineage Projection DTO | Enterprise Intelligence governance capability; redacts rather than errors on field-level restriction | Eventual |

## 8. Audit

| Query | Endpoint | Filters | Response | Authorization | Consistency |
|---|---|---|---|---|---|
| `GetAuditTrail` | `GET /workspaces/{workspaceId}/audit` and `GET /enterprises/{enterpriseId}/audit` | `actor`, `action_type`, `date_range`, `target` | Audit Record Response DTO (paginated, keyset per `06-canonical-api-contracts.md` §10) | Restricted to Compliance/Security/Workspace-Admin-equivalent roles; redacts rather than errors on field-level restriction; export of this Query's results is itself audited (PR5 §23) | Strong/durable |

---

## Validation Notes

Every Query name, filter set, and consistency classification in this catalog is taken verbatim or directly derived from `04-command-query-event-catalog.md` and PR4 §24's consistency model. Endpoint paths and the specific redaction/authorization statements are this PR's original contribution — the wire contract PR4 deliberately left unspecified. No Query in this catalog writes state under any condition.
