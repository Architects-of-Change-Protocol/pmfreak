# Personal PM Pattern Formation Foundation

## What Personal PM Patterns Are

A Personal PM Pattern is an explicit, evidence-backed observation about a repeated professional operating behavior exhibited by a specific Project Manager in project execution contexts.

Examples:
- "Consistently documents major decisions in writing before initiating execution."
- "Escalates cross-functional blockers within 24 hours of identification."
- "Structures stakeholder briefings around risk posture rather than schedule."

Every pattern is:
- **Inspectable** — the full record, sources, and observations are readable at any time
- **Explainable** — the explanation API returns why the pattern exists, tracing back to source evidence
- **Editable** — title, summary, confidence, and metadata are mutable while the pattern is active
- **Exportable** — JSON export includes pattern, observations, sources, and full lineage
- **Auditable** — every write operation emits a governance event to the platform event log
- **Deletable** — PMs can delete their own patterns (unless frozen)
- **Traceable** — every pattern must cite at least one source record

---

## What Personal PM Patterns Are NOT

| Prohibited concept | Why |
|---|---|
| Personality profile | Patterns describe observable work behavior, not personality traits |
| Psychological analysis | No inference about mental state, emotion, or motivation |
| Behavioral prediction | Patterns record what happened, not what will happen |
| Performance score | No numeric scoring, ranking, or comparison across PMs |
| AI/ML output | No embeddings, vectors, semantic search, or model inference |
| Autonomous creation | Every pattern is explicitly created by a human actor |
| Recommendation engine | Patterns do not generate suggestions or prescriptions |

The service enforces these constraints in code. Forbidden category values (`behavior_score`, `trust_score`, `leadership_score`, `personality`, etc.) are rejected at the service and database constraint layer.

---

## Personal PM Memory vs Personal PM Patterns

| Dimension | Personal PM Memory | Personal PM Patterns |
|---|---|---|
| **Purpose** | Records a specific instance or observation of behavior | Records a repeated, substantiated pattern of behavior |
| **Grain** | Single event or moment | Multiple corroborating sources |
| **Categories** | Behavior-oriented (`decision_behavior`, `risk_behavior`, …) | Pattern-oriented (`decision_pattern`, `risk_response_pattern`, …) |
| **Evidence link** | At least one source | At least one source (same requirement) |
| **Created by** | PM explicitly | PM explicitly |
| **Table** | `personal_pm_memory` | `personal_pm_patterns` |

Personal PM Memory feeds into Personal PM Patterns as a source. A pattern is the synthesis across multiple memory entries over time.

---

## Evidence Chain

```
Platform Events
      ↓
Decisions
      ↓
Outcomes / Decision Effectiveness
      ↓
Personal PM Memory
      ↓
Personal PM Patterns
```

Platform events (governance event log) are the root evidence tier. Decisions and outcomes build on them. Personal PM Memory records specific behavioral instances. Personal PM Patterns synthesize multiple memory entries into stable, substantiated operating patterns.

---

## Privacy Model

Every personal PM pattern is isolated by `workspace_id` + `pm_user_id`.

**A PM can:**
- Read their own patterns within workspaces they belong to
- Create patterns for themselves
- Update, archive, freeze, deprecate, or delete their own patterns
- Record observations on their own patterns

**A PM cannot:**
- Read another PM's patterns
- Update, delete, or observe another PM's patterns
- Access patterns outside their workspace

Cross-PM reads fail with `not_found` to avoid existence disclosure. RLS policies on all three tables (`personal_pm_patterns`, `personal_pm_pattern_sources`, `personal_pm_pattern_observations`) enforce this boundary at the database layer.

No delegation system exists. Future delegation would require an explicit design and migration.

---

## Freeze Guarantee

A frozen pattern is immutable except for the `active → archived` status transition.

**Frozen patterns cannot be:**
- Updated (title, summary, confidence, metadata)
- Deprecated
- Deleted
- Have sources added or removed
- Have observations added or removed

**Frozen patterns can only be:**
- Archived

This guarantee is enforced at two layers:
1. **Service layer** — `governance_violation` error returned before the database is touched
2. **Database trigger** — `personal_pm_patterns_freeze_guard`, `personal_pm_pattern_sources_freeze_guard`, and `personal_pm_pattern_observations_freeze_guard` triggers enforce the constraint at write time, regardless of how the table is accessed

---

## Source Lineage

Every pattern must have at least one source. Sources are typed references to existing records in the codebase:

| Source type | Backed by table |
|---|---|
| `platform_event` | `platform_events` |
| `decision` | `project_decisions` |
| `decision_effectiveness` | `decision_effectiveness` |
| `organizational_pattern` | `organizational_patterns` |
| `organizational_memory` | `organizational_memory` |
| `personal_memory` | `personal_pm_memory` |
| `outcome` | `decision_outcomes` |
| `risk` | Tracked as unresolved |
| `task` | Tracked as unresolved |
| `milestone` | Tracked as unresolved |
| `stakeholder` | Tracked as unresolved |

Sources not yet backed by a resolved table appear in `unresolvedSources` in all lineage and export outputs. They remain visible for audit purposes — the system never silently discards them.

Each source has a `relationship_type` (`supports`, `contradicts`, `caused_by`, `derived_from`, `reviewed_during`, `supersedes`, `related_to`) that explains how the evidence relates to the pattern.

---

## Export

`exportPersonalPattern(patternId, pmUserId)` returns a JSON-serializable object:

```json
{
  "pattern": { ... },
  "observations": [ ... ],
  "sources": [ ... ],
  "lineage": {
    "pattern": { ... },
    "observations": [ ... ],
    "sources": [ ... ],
    "events": [ ... ],
    "decisions": [ ... ],
    "decisionEffectiveness": [ ... ],
    "organizationalPatterns": [ ... ],
    "organizationalMemory": [ ... ],
    "personalMemory": [ ... ],
    "outcomes": [ ... ],
    "unresolvedSources": [ ... ],
    "timeline": "2026-01-15T09:00:00Z → 2026-06-15T14:30:00Z"
  },
  "unresolvedSources": [ ... ],
  "exportedAt": "2026-06-19T00:00:00Z"
}
```

No PDF generation. No UI rendering. JSON only.

---

## Audit Events

Every write operation emits a platform event:

| Operation | Event type |
|---|---|
| Create pattern | `PERSONAL_PATTERN_CREATED` |
| Update pattern | `PERSONAL_PATTERN_UPDATED` |
| Freeze pattern | `PERSONAL_PATTERN_FROZEN` |
| Archive pattern | `PERSONAL_PATTERN_ARCHIVED` |
| Deprecate pattern | `PERSONAL_PATTERN_DEPRECATED` |
| Delete pattern | `PERSONAL_PATTERN_DELETED` |
| Record observation | `PERSONAL_PATTERN_OBSERVATION_RECORDED` |

All events use:
- `learningEligible: false` — prevents this data from feeding pattern extraction
- `eventCategory: "governance"`
- `visibility: "personal"`
- `sensitivityLevel: "confidential"`
- `rawReferenceTable: "personal_pm_patterns"` (or `"personal_pm_pattern_observations"` for observations)

---

## Health Metrics

`getPersonalPatternHealth(workspaceId, pmUserId)` returns:

| Field | Definition |
|---|---|
| `activeCount` | Count of patterns with `status = 'active'` |
| `archivedCount` | Count of patterns with `status = 'archived'` |
| `frozenCount` | Count of patterns with `status = 'frozen'` |
| `deprecatedCount` | Count of patterns with `status = 'deprecated'` |
| `observationCount` | Total observations across all patterns |
| `sourceCoverage` | `patternsWithAtLeastOneSource / totalPatterns`, clamped `[0, 1]` |
| `lineageCoverage` | `patternsWithAtLeastOneValidLineageSource / totalPatterns`, clamped `[0, 1]` |

---

## Future Governance Hooks (Capability Vocabulary)

The following capability constants are defined for future governance integration:

```typescript
PERSONAL_PATTERN_CREATE
PERSONAL_PATTERN_UPDATE
PERSONAL_PATTERN_INSPECT
PERSONAL_PATTERN_EXPORT
PERSONAL_PATTERN_FREEZE
PERSONAL_PATTERN_ARCHIVE
PERSONAL_PATTERN_DELETE
PERSONAL_PATTERN_OBSERVE
```

These are vocabulary only. No permission system is wired to them in this foundation layer.

---

## No Scoring / No Profiling Guarantee

The following are explicitly absent from the codebase and will be rejected by service-layer validation if attempted:

- `personality`, `psychological` — not valid categories
- `profile_score`, `performance_score`, `behavior_score`, `trust_score`, `leadership_score` — not valid categories
- `ranking` — no ranking function exists
- `prediction`, `probability`, `future_success`, `future_failure` — no inference fields exist
- AI/ML source types (`embedding`, `vector`, `semantic`, `ai_inference`) — not valid source types

The database `CHECK` constraints enforce the same rules at the persistence layer.
