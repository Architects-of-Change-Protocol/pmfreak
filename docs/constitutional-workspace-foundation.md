# Constitutional Workspace Foundation

## What It Is

The Constitutional Workspace is the top-level constitutional container in PMFreak. It organizes all constitutional artifacts belonging to a workspace into a single, deterministic, auditable, explainable, and exportable structure.

It sits directly above the Constitutional Dashboard Foundation in the constitutional artifact hierarchy.

## What It Is Not

The Constitutional Workspace is **not**:

- AI or machine learning
- An embeddings or vector search system
- A semantic search engine
- A prediction or recommendation engine
- A scoring or ranking system
- A prioritization engine
- An autonomous reasoning or decision-making system

It only **organizes** existing constitutional artifacts. It does not generate knowledge. It does not create conclusions. It does not summarize beyond what its supplied artifacts already contain.

## Why No AI, No Scoring, No Prioritization

Constitutional workspaces must remain deterministic and auditable. Every item displayed must remain traceable to evidence, context packages, briefs, dashboards, and lineage. Introducing AI, scoring, or prioritization would break traceability and make the workspace non-auditable.

## Artifact Hierarchy

```
Evidence
  ↓
Memory
  ↓
Patterns
  ↓
Effectiveness
  ↓
Context (Context Packages)
  ↓
Briefs (Constitutional, Executive, Governance, Operational, Portfolio)
  ↓
Dashboards (Executive, Governance, Operational, Portfolio, Workspace, Mixed)
  ↓
Constitutional Workspace
```

Every layer feeds upward. The workspace sits at the apex and organizes all artifacts below it.

## Workspace Model

### `ConstitutionalWorkspace`

| Field | Description |
|---|---|
| `id` | Deterministic ID derived from workspaceId + generatedAt |
| `workspaceId` | Tenant workspace identifier |
| `generatedAt` | ISO timestamp of workspace generation |
| `workspaceSummary` | Aggregate counts across all artifact types |
| `evidenceSummary` | Evidence and context package counts |
| `knowledgeSummary` | Memory, pattern, and effectiveness counts by type |
| `briefSummary` | Brief counts by brief type |
| `dashboardSummary` | Dashboard counts by dashboard type |
| `governanceSummary` | Governance artifact counts by governance type |
| `contradictions` | Contradictions reused from supplied briefs and dashboards |
| `unknowns` | Unknowns reused from supplied briefs and dashboards |
| `lineage` | Explains why each artifact appears in the workspace |
| `metadata` | Extensible metadata |

## Workspace Summary

`ConstitutionalWorkspaceSummary` provides aggregate counts for:

- `evidenceCount` — number of evidence records
- `memoryCount` — total memories (organizational + personal)
- `patternCount` — total patterns (organizational + personal)
- `effectivenessCount` — total effectiveness records
- `contextPackageCount` — number of context packages
- `briefCount` — number of briefs
- `dashboardCount` — number of dashboards
- `contradictionCount` — number of contradictions (reused, not created)
- `unknownCount` — number of unknowns (reused, not inferred)

## Knowledge Summary

`WorkspaceKnowledgeSummary` breaks knowledge by scope:

- `memoryCount`, `organizationalMemoryCount`, `personalMemoryCount`
- `patternCount`, `organizationalPatternCount`, `personalPatternCount`
- `effectivenessCount`, `organizationalEffectivenessCount`, `personalEffectivenessCount`

## Brief Summary

`WorkspaceBriefSummary` counts briefs by type:

- `constitutionalBriefCount`
- `executiveBriefCount`
- `governanceBriefCount`
- `operationalBriefCount`
- `portfolioBriefCount`

## Dashboard Summary

`WorkspaceDashboardSummary` counts dashboards by type:

- `executiveDashboardCount`
- `governanceDashboardCount`
- `operationalDashboardCount`
- `portfolioDashboardCount`
- `workspaceDashboardCount`
- `mixedDashboardCount`

## Governance Summary

`WorkspaceGovernanceSummary` counts governance artifacts by type:

- `authorityArtifactCount`
- `delegationArtifactCount`
- `capabilityArtifactCount`
- `trustArtifactCount`
- `policyArtifactCount`

## Contradictions

Contradictions are **reused** from supplied briefs and dashboards. The workspace:

- Does **not** create contradictions
- Does **not** resolve contradictions
- Does **not** score contradictions

## Unknowns

Unknowns are **reused** from supplied briefs and dashboards. The workspace:

- Does **not** infer unknowns

## Lineage

Every artifact in the workspace has a `WorkspaceLineage` entry explaining exactly why it appears:

| Field | Description |
|---|---|
| `artifactType` | Type of artifact (evidence, memory, pattern, etc.) |
| `artifactId` | ID of the artifact |
| `sourceType` | Type of the source (organizational_memory, personal_pattern, etc.) |
| `sourceId` | ID of the source record |
| `reasonIncluded` | Human-readable explanation of why this artifact is in the workspace |

## Export

`exportConstitutionalWorkspace()` produces a **JSON-only** export containing:

- `workspace` — the full ConstitutionalWorkspace
- `summaries` — all summary objects
- `contradictions` — reused contradictions
- `unknowns` — reused unknowns
- `lineage` — full lineage for every artifact
- `exportedAt` — export timestamp
- `format: "json"` — always JSON

No PDF. No UI rendering.

## Explanation

`explainConstitutionalWorkspace()` returns:

- `workspace` — the ConstitutionalWorkspace
- `workspaceSummary` — aggregate counts
- `artifactReasons` — per-artifact explanations answering "Why does this workspace contain this artifact?"
- `lineage` — full lineage
- `contradictions` — reused contradictions
- `unknowns` — reused unknowns

## Health

`getWorkspaceHealth()` returns counts and coverage metrics. No scores.

`WorkspaceHealth` fields:

- `evidenceCount`
- `memoryCount`
- `patternCount`
- `effectivenessCount`
- `briefCount`
- `dashboardCount`
- `contradictionCount`
- `unknownCount`
- `coverageMetrics` — boolean flags for presence of each artifact type

## Auditability

All workspace operations emit governance audit events:

| Event | Emitted By |
|---|---|
| `CONSTITUTIONAL_WORKSPACE_GENERATED` | `buildConstitutionalWorkspace()` |
| `CONSTITUTIONAL_WORKSPACE_EXPLAINED` | `explainConstitutionalWorkspace()` |
| `CONSTITUTIONAL_WORKSPACE_EXPORTED` | `exportConstitutionalWorkspace()` |

All events carry:

- `learningEligible: false`
- `eventCategory: "governance"`
- `visibility: "workspace"`
- `rawReferenceTable: "constitutional_workspace"`
- `rawReferenceId: workspace.id`

## Persistence

The Constitutional Workspace is a **deterministic view**. There are no tables, no migrations, and no persistence. The workspace is rebuilt on demand from its supplied artifacts.
