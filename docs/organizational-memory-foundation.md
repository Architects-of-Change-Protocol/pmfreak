# Organizational Memory Foundation

PMFreak organizational memory is a sovereign operational memory layer built from explicit project execution history: platform events, decisions, outcomes, risks, tasks, milestones, dependencies, stakeholders, and recommendations.

## What memory is

A memory record is an inspectable `organizational_memory` row with a workspace, optional project, scope, category, title, summary, confidence, status, creator, timestamps, and customer-owned metadata. Every memory is created explicitly by an authorized actor and is linked to evidence through `organizational_memory_sources`.

## What memory is not

Organizational memory is not an AI memory system. It does not use embeddings, vector databases, semantic search, retrieval augmented generation, autonomous learning, machine learning, recommendation engines, pattern extraction, or AI-generated memory. PMFreak does not automatically create memories.

## Memory sovereignty

Organizations own their operational memory. Memory must be inspectable, explainable, exportable, editable, auditable, and deletable. The service layer exposes create, update, archive, freeze, deprecate, get, list, inspect, explain, export, health, and delete operations without hidden black-box state.

## Memory lineage

`organizational_memory_sources` records source type, source id, relationship type, and creation time. Supported source types are `platform_event`, `decision`, `outcome`, `risk`, `task`, `milestone`, `dependency`, `stakeholder`, and `recommendation`. The lineage enables an auditor to answer: “Why does this memory exist?”

## Memory export

`exportMemory()` returns JSON only. It includes the memory, sources, platform events, decisions, outcomes, and lineage. There is no PDF export and no UI surface in this foundation.

## Memory freeze

`freezeMemory()` preserves a memory constitutionally. Frozen memories cannot be edited, mutated, source-mutated, or deleted. They can only be archived. Database triggers enforce this preservation rule in addition to service-level checks.

## Relationship with events

Memory actions emit platform events: `MEMORY_CREATED`, `MEMORY_UPDATED`, `MEMORY_FROZEN`, `MEMORY_ARCHIVED`, `MEMORY_DEPRECATED`, and `MEMORY_DELETED`. Events use `correlation_id` and `causation_id`, and are marked `learning_eligible: false` to avoid automatic learning semantics.

## Relationship with decisions

Decision records can be sources for decision-pattern memories. `explainMemory()` and `exportMemory()` include linked decision rows when the source type is `decision`.

## Relationship with outcomes

Outcome records can be sources for delivery, governance, schedule, or execution memories. `explainMemory()` and `exportMemory()` include linked outcome rows when the source type is `outcome`.

## Governance controls

Workspace members can read, create, inspect, and export memory inside their workspace. The migration currently uses temporary workspace-role governance for preservation actions: `owner`, `admin`, and `pm` are centralized inside `is_organizational_memory_governor()` and are not scattered through service code or policies. Existing PMFreak AOC Runtime and capability-governance helpers are not invoked directly from RLS policies, so this role bridge is intentionally documented as temporary until runtime authorization can be safely wired at an API boundary. Row-level security remains workspace scoped and prevents cross-workspace access.

## Memory capability vocabulary

The TypeScript domain exports future governance hooks: `MEMORY_CREATE`, `MEMORY_UPDATE`, `MEMORY_FREEZE`, `MEMORY_ARCHIVE`, `MEMORY_DEPRECATE`, `MEMORY_DELETE`, `MEMORY_INSPECT`, and `MEMORY_EXPORT`. Capability enforcement is prepared but not fully wired yet; the current behavior remains workspace/RLS governed.

## Source resolver boundary

Table-specific source resolution is isolated in `source-resolver.ts`. The memory service asks `resolveMemorySources()` for platform events, decisions, outcomes, and unresolved sources rather than directly querying decision/outcome tables. Unsupported source types remain visible as `unresolvedSources` so auditors can see incomplete lineage resolution without hiding evidence links.

## Health metric definitions

`sourceCoverage` is the percentage of memories with at least one source: `memoriesWithAtLeastOneSource / totalMemories`. `lineageCoverage` is the percentage of memories with at least one valid lineage source containing source type, source id, and relationship type: `memoriesWithAtLeastOneValidLineageSource / totalMemories`. Both values are clamped between `0` and `1`, including empty-memory workspaces.

## Frozen source mutation guarantee

Frozen memories cannot be updated, deleted, or source-mutated. The database blocks source insert, update, and delete attempts against frozen parent memories, and frozen parent records can only transition to `archived`.

## Future extension points

Future work may add API routes, UI inspection screens, richer source resolvers, and workspace governance workflows. These extensions must preserve explicit creation, source lineage, JSON export, frozen-memory immutability, and the prohibition on AI-generated or automatically learned memory.
