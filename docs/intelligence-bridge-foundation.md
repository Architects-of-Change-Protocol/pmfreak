# Intelligence Bridge Foundation

## Purpose and Overview

The Intelligence Bridge connects a PM's personal intelligence records (patterns, memories, effectiveness, pattern candidates) to organizational intelligence records (organizational memory, patterns, decision effectiveness, pattern candidates) without AI, scoring, profiling, ranking, or cross-PM leakage.

Every bridge link is:
- **Explicit** — created by the PM, not inferred by a system
- **Auditable** — backed by 7 governance event types
- **Inspectable** — exposed via explain/lineage/export functions
- **Isolated** — RLS ensures each PM only sees their own bridges
- **Sovereign** — the PM controls creation, update, archive, freeze, and deletion

## Privacy Model

- No AI inference, no embeddings, no automatic learning
- No scoring, ranking, profiling, or cross-PM intelligence leakage
- `learningEligible: false` on every emitted platform event
- RLS enforces `pm_user_id = auth.uid()` — bridges are invisible across PM accounts
- Metadata is structured governance data only; no raw content

## Tables and Schema

### `intelligence_bridge_links`

The primary table. Each row links one personal source record to one organizational source record.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| pm_user_id | uuid | FK auth.users — RLS isolation anchor |
| relationship_type | text | one of 13 allowed types |
| status | text | active / archived / frozen / deprecated |
| personal_source_type | text | one of 5 personal source types |
| personal_source_id | uuid | FK to personal record |
| organizational_source_type | text | one of 7 organizational source types |
| organizational_source_id | uuid | FK to organizational record |
| summary | text | required, non-empty |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-maintained by trigger |
| created_by | uuid | nullable, FK auth.users |
| metadata | jsonb | customer-owned structured data |

### `intelligence_bridge_sources`

Additional evidence sources beyond the primary personal/organizational pair.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| bridge_id | uuid | FK intelligence_bridge_links |
| source_type | text | one of 11 allowed types |
| source_id | uuid | |
| relationship_type | text | supports / contradicts / derived_from / reviewed_during / contextualizes / related_to |
| created_at | timestamptz | |

### `intelligence_bridge_observations`

Explicit PM review notes explaining why a bridge relationship exists.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| bridge_id | uuid | FK intelligence_bridge_links |
| observation_summary | text | required, non-empty |
| recorded_at | timestamptz | |
| recorded_by | uuid | nullable, FK auth.users |
| metadata | jsonb | |

## Available Operations

| Function | Description |
|---|---|
| `createIntelligenceBridge` | Create a new bridge link |
| `getIntelligenceBridge` | Fetch a bridge by ID |
| `listIntelligenceBridges` | List all bridges for a PM in a workspace |
| `updateIntelligenceBridge` | Update summary or metadata (not frozen) |
| `archiveIntelligenceBridge` | Move to archived status |
| `freezeIntelligenceBridge` | Move to frozen (immutable) status |
| `deprecateIntelligenceBridge` | Move to deprecated status |
| `deleteIntelligenceBridge` | Hard delete (not frozen) |
| `recordIntelligenceBridgeObservation` | Add a review note |
| `explainIntelligenceBridge` | Fetch bridge + observations + resolved sources |
| `buildIntelligenceBridgeLineage` | Build timeline from creation through observations |
| `exportIntelligenceBridge` | Full export package |
| `getIntelligenceBridgeHealth` | Aggregate health metrics |

## Relationship Types

| Type | Meaning |
|---|---|
| `personal_pattern_supports_org_pattern` | PM's observed personal pattern aligns with an organizational pattern |
| `personal_pattern_contradicts_org_pattern` | PM's personal pattern diverges from organizational pattern |
| `personal_effectiveness_supports_org_effectiveness` | PM's personal effectiveness record confirms an org-level effectiveness record |
| `personal_effectiveness_contradicts_org_effectiveness` | PM's personal experience contradicts an org-level effectiveness record |
| `personal_memory_supports_org_memory` | PM's personal memory corroborates an organizational memory entry |
| `personal_memory_contradicts_org_memory` | PM's personal memory conflicts with an organizational memory entry |
| `personal_candidate_supports_org_candidate` | PM's personal pattern candidate aligns with an org-level candidate |
| `personal_candidate_contradicts_org_candidate` | PM's personal pattern candidate diverges from org-level candidate |
| `org_pattern_contextualizes_personal_pattern` | An organizational pattern provides context for a PM's personal pattern |
| `org_memory_contextualizes_personal_memory` | An organizational memory entry provides context for a PM's personal memory |
| `org_effectiveness_contextualizes_personal_effectiveness` | An org effectiveness record contextualizes a PM's personal effectiveness |
| `shared_evidence` | Both sides share a common evidence source |
| `related_to` | General relatedness without a directional claim |

## Source Types

### Personal Source Types

- `personal_memory` → `personal_pm_memory`
- `personal_pattern` → `personal_pm_patterns`
- `personal_effectiveness` → `personal_pm_effectiveness`
- `personal_pattern_candidate` → `personal_pattern_extraction_candidates`
- `personal_event` → unsupported (no backing table; resolves as unresolved)

### Organizational Source Types

- `organizational_memory` → `organizational_memory`
- `organizational_pattern` → `organizational_patterns`
- `decision_effectiveness` → `decision_effectiveness`
- `pattern_candidate` → `pattern_extraction_candidates`
- `platform_event` → `platform_events`
- `decision` → `project_decisions`
- `outcome` → `decision_outcomes`

## Audit Events

All events are emitted with `learningEligible: false` and `eventCategory: 'governance'`.

| Event Type | Emitted When |
|---|---|
| `INTELLIGENCE_BRIDGE_CREATED` | New bridge link created |
| `INTELLIGENCE_BRIDGE_UPDATED` | Bridge summary or metadata updated |
| `INTELLIGENCE_BRIDGE_ARCHIVED` | Bridge moved to archived |
| `INTELLIGENCE_BRIDGE_FROZEN` | Bridge moved to frozen (immutable) |
| `INTELLIGENCE_BRIDGE_DEPRECATED` | Bridge moved to deprecated |
| `INTELLIGENCE_BRIDGE_DELETED` | Bridge hard-deleted |
| `INTELLIGENCE_BRIDGE_OBSERVATION_RECORDED` | Observation note added to a bridge |

## RLS Policies

The `is_bridge_owner(workspace_id, pm_user_id)` function checks that:
- The calling user (`auth.uid()`) is a member of the workspace
- The calling user is the `pm_user_id` on the bridge
- The calling user has role `owner`, `admin`, or `pm`

This guarantees that PMs can only read, write, and manage their own bridge records. Cross-PM bridge access is structurally impossible.

### `intelligence_bridge_links`

- **SELECT**: bridge owner only
- **INSERT**: bridge owner only; `created_by` must be null or `auth.uid()`
- **UPDATE (active)**: bridge owner + status = active
- **UPDATE (preserve)**: bridge owner (for archive/freeze/deprecate transitions)
- **DELETE**: bridge owner + status ≠ frozen

### `intelligence_bridge_sources` and `intelligence_bridge_observations`

- **SELECT**: bridge owner (via join to bridge)
- **INSERT**: bridge owner + bridge not frozen
- **DELETE**: bridge owner + bridge not frozen

## Frozen Bridge Guard

A database trigger (`intelligence_bridge_frozen_guard`) prevents:
- Editing a frozen bridge to any status other than `archived`
- Deleting a frozen bridge

This provides database-level immutability guarantees for frozen bridges, enforced independently of application logic.

## What the Bridge Is

The Intelligence Bridge is an **explicit, evidence-backed relational record** that connects:

- A specific personal PM intelligence record (personal memory, pattern, effectiveness record, or pattern candidate)
- A specific organizational intelligence record (organizational memory, pattern, decision effectiveness, or platform event)

Every bridge link must have:
- A `summary` explaining why the relationship exists
- A `relationship_type` from the allowed vocabulary
- Both a `personal_source_id` and an `organizational_source_id`
- Optional `sources` (additional supporting evidence)
- Optional `observations` (explicit review notes)

## What the Bridge Is Not

The bridge is **not**:

- AI or machine learning
- Embeddings or semantic search
- Profiling or behavioral prediction
- Scoring, ranking, or rating any PM
- Cross-PM comparison or leaderboards
- Manager surveillance
- Autonomous learning or recommendation generation
- Employee evaluation

No bridge relationship is ever inferred, generated, or created without explicit PM action.

## Differences Between Intelligence Layers

| Layer | Answers | Scope |
|---|---|---|
| Organizational Intelligence | What does the organization know from repeated execution? | Workspace/project/team |
| Personal PM Intelligence | What evidence-backed operating knowledge belongs to this PM? | Individual PM only |
| Bridge Relationships | How are these two knowledge systems related? | PM ↔ Workspace (isolated by pm_user_id) |

## Architecture Diagram

```
Organizational Intelligence        Personal PM Intelligence
─────────────────────────          ───────────────────────
Organizational Memory              Personal PM Memory
       ↓                                    ↓
Organizational Patterns            Personal PM Patterns
       ↓                                    ↓
Decision Effectiveness      ↕      Personal PM Effectiveness
       ↓               (bridge)            ↓
Pattern Candidates         ↕      Personal Pattern Candidates
                     Intelligence
                        Bridge
                         Links
```

The `↕` represents `intelligence_bridge_links` — explicit, PM-owned, auditable connections. Neither side collapses into the other. Organizational intelligence is not made personal; personal intelligence is not made organizational.

## Cross-PM Isolation

The `is_bridge_owner` RLS function ensures:

```sql
wm.user_id = auth.uid()
AND wm.user_id = target_pm_user_id
```

A PM can only read, create, or mutate their **own** bridge links. Cross-PM reads return `not_found` — not a permission error — to avoid existence disclosure. There is no delegation system, no manager view, and no aggregate PM performance surface.

## No Scoring / No Profiling Guarantee

The following are **permanently excluded** from the bridge layer:

- Fields: score, rating, ranking, leaderboard
- Relationship types: better_than, worse_than, higher_performer, lower_performer, performance_risk, trust_risk, manager_flag, ranked_above, ranked_below
- Functions: cross-PM comparison, aggregate PM performance, behavioral prediction

These exclusions are enforced by:
1. `chk_bridge_relationship_type` database constraint
2. `ALLOWED_RELATIONSHIP_TYPES` constant in `types.ts`
3. Test assertions in `tests/intelligence-bridge.test.mjs`

## Source Lineage

Every bridge has primary sources (`personal_source_id`, `organizational_source_id`) and optional additional sources in `intelligence_bridge_sources`. Sources are resolved via `resolveIntelligenceBridgeSources()` which returns a `ResolvedBridgeSources` object including `unresolvedSources` for any IDs that could not be fetched — preserving audit visibility even for missing records.

## Export (JSON only)

`exportIntelligenceBridge(bridgeId, pmUserId)` returns a structured JSON object:

```json
{
  "bridge": { ... },
  "observations": [ ... ],
  "sources": [ ... ],
  "lineage": { "timeline": [ ... ], "personalSide": { ... }, "organizationalSide": { ... } },
  "unresolvedSources": [ ... ],
  "exportedAt": "ISO timestamp"
}
```

No PDF. No UI. Pure data export for the PM to own.

## Future Governance Hooks

The `INTELLIGENCE_BRIDGE_CAPABILITIES` vocabulary is reserved for future permission/delegation systems:

- `INTELLIGENCE_BRIDGE_CREATE`
- `INTELLIGENCE_BRIDGE_UPDATE`
- `INTELLIGENCE_BRIDGE_INSPECT`
- `INTELLIGENCE_BRIDGE_EXPORT`
- `INTELLIGENCE_BRIDGE_FREEZE`
- `INTELLIGENCE_BRIDGE_ARCHIVE`
- `INTELLIGENCE_BRIDGE_DELETE`
- `INTELLIGENCE_BRIDGE_OBSERVE`

These are constants only. No permission enforcement is built now.
