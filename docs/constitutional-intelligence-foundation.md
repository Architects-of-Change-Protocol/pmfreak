# Constitutional Intelligence Foundation

## What Constitutional Intelligence Is

Constitutional Intelligence is the aggregation and explanation layer that answers the question:

> "What does the system know?"

It sits above all foundational intelligence layers in PMFreak:

- Organizational Memory
- Organizational Patterns
- Decision Effectiveness
- Pattern Extraction (candidates)
- Personal PM Memory
- Personal PM Patterns
- Personal PM Effectiveness
- Personal Pattern Extraction
- Personal ↔ Organizational Intelligence Bridge

The layer assembles a `ConstitutionalIntelligenceSnapshot` from all existing records and provides deterministic query functions for retrieving, explaining, exporting, and auditing that knowledge.

---

## What It Is Not

Constitutional Intelligence is **not**:

- AI
- Machine learning
- Embeddings or vector search
- Semantic or fuzzy search
- Prediction
- Recommendation generation
- Scoring or ranking
- Profiling
- Autonomous reasoning or autonomous decision making

The layer **only** aggregates and explains already-existing constitutional records. It never invents conclusions.

---

## Knowledge Assembly

`assembleConstitutionalKnowledge(workspaceId, pmUserId)` builds a snapshot by:

1. Fetching all organizational memory, patterns, decision effectiveness, and pattern candidates scoped to the workspace.
2. Fetching all personal memory, patterns, effectiveness, and pattern candidates scoped to the workspace **and** the specific PM user.
3. Fetching all intelligence bridge relationships scoped to the workspace and PM user.
4. Detecting contradictions by reading explicit `*_contradicts_*` relationship types from bridge records.
5. Classifying every record into a knowledge domain using a deterministic category-to-domain string map.
6. Computing the total evidence count as the sum of all record counts.

No record is inferred, predicted, or invented. Every record in the snapshot came from a prior explicit human or system action recorded in the database.

---

## Evidence Lineage

Every piece of knowledge in the snapshot is linked to its origin via:

- **Explicit IDs** — every record has a UUID traceable to its creating event.
- **Explicit relationships** — bridge records carry `relationship_type`, `personal_source_id`, `organizational_source_id`, and source type fields.
- **Explicit lineage** — `explainKnowledge()` traverses bridge relationships for a given record and returns its full lineage without inference.

No semantic matching is used. If a record's ID is not explicitly referenced in a bridge or source table, it is not linked.

---

## Contradictions

Contradictions are detected deterministically. The assembler inspects each bridge record's `relationship_type`. If the type contains the string `"contradicts"` (e.g., `personal_pattern_contradicts_org_pattern`), a `ConstitutionalContradiction` is created referencing both sides.

Examples of detectable contradiction pairs:

| Bridge relationship_type | Meaning |
|---|---|
| `personal_pattern_contradicts_org_pattern` | A PM's personal pattern contradicts the organizational pattern |
| `personal_memory_contradicts_org_memory` | A PM's personal memory contradicts the organizational memory |
| `personal_effectiveness_contradicts_org_effectiveness` | A PM's effectiveness record contradicts the organizational effectiveness record |

No AI is used. No hidden conclusions are drawn. The contradiction only exists if an explicit bridge record with a `*_contradicts_*` relationship_type was recorded.

---

## Knowledge Domains

All records are classified into one of twelve knowledge domains:

| Domain | Description |
|---|---|
| `execution` | Task execution and operational work |
| `delivery` | Delivery patterns and milestone completion |
| `stakeholders` | Stakeholder management and alignment |
| `risk` | Risk patterns, risk responses |
| `governance` | Governance compliance and approval patterns |
| `communication` | Communication and follow-up patterns |
| `planning` | Schedule planning and resource planning |
| `escalation` | Escalation patterns |
| `decision-making` | Decision patterns and effectiveness |
| `coordination` | Dependency resolution and team coordination |
| `quality` | Quality patterns |
| `operational` | Resource optimization and cost avoidance |

Classification is done by matching the record's `memory_category`, `pattern_category`, `outcome_type`, or similar field against a deterministic map. Records without a classifiable category are placed in `operational`.

---

## Export

`exportConstitutionalKnowledge(workspaceId, pmUserId)` returns a `ConstitutionalKnowledgeExport` containing:

- The full `ConstitutionalIntelligenceSnapshot`
- An `exportedAt` ISO timestamp
- `format: "json"`

The export is JSON only. No transformation, scoring, or ranking is applied.

---

## Auditability

Three audit events are emitted to the platform event log:

| Event | Trigger |
|---|---|
| `CONSTITUTIONAL_INTELLIGENCE_ACCESSED` | `getConstitutionalIntelligence()` called |
| `CONSTITUTIONAL_KNOWLEDGE_EXPLAINED` | `explainKnowledge()` called |
| `CONSTITUTIONAL_KNOWLEDGE_EXPORTED` | `exportConstitutionalKnowledge()` called |

All events are emitted with:

- `learningEligible: false` — the audit event must not feed any learning loop.
- `eventCategory: "governance"` — governance-level visibility.
- `visibility: "workspace"` — visible at the workspace level.

---

## Privacy Model

Personal records (personal memory, personal patterns, personal effectiveness, personal pattern candidates, bridge relationships) are always scoped to:

1. `workspace_id` — prevents cross-workspace leakage.
2. `pm_user_id` — prevents cross-PM leakage within the same workspace.

Organizational records are scoped to `workspace_id` only, since they represent shared organizational knowledge.

No personal record is ever aggregated across PM users. The snapshot for PM A and the snapshot for PM B are completely isolated, even within the same workspace.

---

## Health Metrics

`getConstitutionalKnowledgeHealth(workspaceId, pmUserId)` returns:

| Field | Description |
|---|---|
| `memoryCount` | Total organizational + personal memory records |
| `patternCount` | Total organizational + personal pattern records |
| `effectivenessCount` | Total decision + personal effectiveness records |
| `bridgeCount` | Total bridge relationship records |
| `candidateCount` | Total organizational + personal pattern candidates |
| `contradictionCount` | Total detected contradictions |
| `evidenceCount` | Total records across all layers |
| `coverageMetrics` | Per-domain evidence counts and per-layer proportions |

Coverage metrics are proportional to total evidence count. They measure what fraction of total evidence belongs to each layer or domain — not quality, not value.
