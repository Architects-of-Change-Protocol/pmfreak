# Personal PM Memory Foundation

## What Personal Memory Is

Personal PM Memory is an inspectable, sovereign, exportable, and auditable record of operational behaviors, decisions, outcomes, and patterns associated with an individual Project Manager.

Every memory item is:

- **Inspectable** — a PM can view the full record, its observations, and its source evidence at any time
- **Explainable** — every record links to the evidence that caused it to exist
- **Exportable** — a PM can export the complete record as JSON, including lineage
- **Editable** — unless frozen, a PM can update or correct their own records
- **Auditable** — every create, update, freeze, archive, deprecate, delete, and observation action emits a platform audit event
- **Deletable** — unless frozen, a PM can permanently remove a record

---

## What Personal Memory Is Not

| What it is NOT | Why |
|---|---|
| AI memory | No model learns from or writes to these records |
| LLM memory | No language model is involved |
| Embeddings | No vector representations are created |
| Vector search | No semantic similarity queries |
| Autonomous learning | Nothing is inferred or created without explicit PM action |
| Personality modeling | No behavioral profile is constructed |
| Behavioral prediction | No future behavior is inferred |
| Recommendation generation | No suggestions are derived from memory |
| Psychological profiling | No scoring, ranking, or grading of any kind |

---

## Constitutional Principle

> A PM should own and understand their professional memory. Nothing should be inferred secretly. Nothing should be learned invisibly.

---

## Difference Between Organizational Memory and Personal PM Memory

| Dimension | Organizational Memory | Personal PM Memory |
|---|---|---|
| Scope | Workspace or project-wide | Tied to a single PM user |
| Ownership | Belongs to the organization | Belongs to the individual PM |
| Visibility | Shared across workspace members | Isolated to the PM + workspace pair |
| Purpose | Capture patterns at org level | Capture PM-specific operational behaviors |
| Cross-read access | Any workspace member may read | Only the owning PM may read |
| Categories | Risk/decision/delivery patterns | Decision/risk/stakeholder/communication/execution behaviors |

---

## Privacy Guarantees

Isolation is enforced at the database level via Row-Level Security on every table.

**The compound key is: `workspace_id + pm_user_id`**

- A PM in workspace A cannot read another PM's records in workspace A
- A PM in workspace B cannot read records that belong to workspace A
- Cross-PM reads return `not_found` — no information about the existence of other PMs' records is disclosed

---

## Export Guarantees

`exportPersonalMemory()` returns a complete JSON structure:

```
{
  memory,          -- the memory record
  observations,    -- all explicit observations
  sources,         -- all source evidence links
  lineage: {       -- full lineage reconstruction
    memory,
    observations,
    sources,
    events,         -- platform audit events
    decisions,      -- linked decisions
    outcomes,       -- linked outcomes
    patterns,       -- linked organizational patterns
    effectiveness   -- linked decision effectiveness records
  },
  exportedAt
}
```

- JSON only — no PDF, no binary formats
- No server-side state is mutated during export
- The export is point-in-time; re-exporting always reflects the current record state

---

## Auditability Guarantees

Every state transition emits a platform audit event with `learningEligible: false`:

| Action | Audit Event |
|---|---|
| Create | `PERSONAL_MEMORY_CREATED` |
| Update | `PERSONAL_MEMORY_UPDATED` |
| Freeze | `PERSONAL_MEMORY_FROZEN` |
| Archive | `PERSONAL_MEMORY_ARCHIVED` |
| Deprecate | `PERSONAL_MEMORY_DEPRECATED` |
| Delete | `PERSONAL_MEMORY_DELETED` |
| Record observation | `PERSONAL_MEMORY_OBSERVATION_RECORDED` |

All events are stored in the immutable `platform_events` table (append-only, no DELETE, no UPDATE).

---

## Governance Controls

### Memory Freeze

A frozen memory:
- Cannot be edited
- Cannot be deleted
- Cannot have sources mutated
- Can only be archived

Freeze is irreversible except by archiving the record. It provides a hard governance boundary for memories that must be preserved exactly as recorded.

### Capability Vocabulary

The following capabilities are defined for future governance hooks:

- `PERSONAL_MEMORY_CREATE`
- `PERSONAL_MEMORY_UPDATE`
- `PERSONAL_MEMORY_INSPECT`
- `PERSONAL_MEMORY_EXPORT`
- `PERSONAL_MEMORY_FREEZE`
- `PERSONAL_MEMORY_ARCHIVE`
- `PERSONAL_MEMORY_DELETE`

These are vocabulary definitions only. No new authorization system is introduced.

---

## Evidence Lineage Diagram

```
Platform Events
      ↓
Decisions
      ↓
Outcomes
      ↓
Organizational Patterns / Decision Effectiveness
      ↓
Personal PM Memory (manual, explicit creation only)
      ↓
Observations (explicit annotations added by PM)
```

Every Personal PM Memory record must reference at least one source. The supported source types are:

- `platform_event`
- `decision`
- `decision_effectiveness`
- `organizational_pattern`
- `organizational_memory`
- `outcome`
- `risk`
- `task`
- `milestone`
- `stakeholder`

---

## Memory Categories

| Category | Description |
|---|---|
| `decision_behavior` | How the PM approaches and documents decisions |
| `risk_behavior` | How the PM identifies, escalates, and manages risks |
| `stakeholder_behavior` | How the PM engages and communicates with stakeholders |
| `communication_behavior` | Communication patterns and preferences |
| `execution_behavior` | Task and milestone execution patterns |
| `planning_behavior` | Planning approach and rigor |
| `escalation_behavior` | Escalation timing and patterns |
| `governance_behavior` | Compliance with governance processes |
| `delivery_behavior` | Delivery patterns and outcomes |
| `leadership_behavior` | Leadership approaches and team dynamics |
| `other` | Anything that does not fit above |

No scoring, ranking, or grading categories exist. Adding them would violate the constitutional principle.

---

## Database Tables

| Table | Purpose |
|---|---|
| `personal_pm_memory` | Core memory registry |
| `personal_pm_memory_sources` | Evidence links (source → memory) |
| `personal_pm_memory_observations` | Explicit PM annotations |

All tables have Row-Level Security enabled. All foreign keys cascade deletes from `personal_pm_memory` to sources and observations.

---

## Service API

Located at `src/lib/personal-memory/personal-memory-service.ts`.

| Function | Description |
|---|---|
| `createPersonalMemory()` | Create a new memory record with required source evidence |
| `getPersonalMemory()` | Fetch a single record (enforces PM + workspace isolation) |
| `listPersonalMemory()` | List all records for a PM in a workspace |
| `updatePersonalMemory()` | Update title, summary, confidence, or metadata |
| `archivePersonalMemory()` | Set status to archived |
| `freezePersonalMemory()` | Set status to frozen (irreversible except archive) |
| `deprecatePersonalMemory()` | Set status to deprecated |
| `deletePersonalMemory()` | Permanently delete (blocked if frozen) |
| `recordObservation()` | Attach an explicit observation to a memory |
| `explainPersonalMemory()` | Return memory + observations + all source evidence |
| `buildPersonalMemoryLineage()` | Return full lineage tree |
| `exportPersonalMemory()` | Return complete JSON export |
| `getPersonalMemoryHealth()` | Return health metrics for a PM's memory corpus |
