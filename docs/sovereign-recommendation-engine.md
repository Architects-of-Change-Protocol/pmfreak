# Sovereign Recommendation Engine

**EPIC 2 — Sovereign Project Vault**
**Sprint 4 — Sovereign Recommendation Engine**

---

## Overview

The Sovereign Recommendation Engine transforms Institutional Learning Patterns into actionable, auditable, and traceable recommendations. It is the final layer of the constitutional intelligence stack — converting institutional memory into operational intelligence.

```
Artifact
  ↓
Memory
  ↓
Digest
  ↓
Learning Pattern
  ↓
Recommendation
```

Recommendations guide project managers and governance actors. They never replace human authority.

---

## Sovereignty Principles

| Principle | Rule |
|-----------|------|
| 1 | Every recommendation must originate from verifiable learning. |
| 2 | Every recommendation must be traceable to its supporting patterns. |
| 3 | No opaque recommendations — every recommendation must explain itself. |
| 4 | Every recommendation must justify its origin via pattern evidence. |
| 5 | Recommendations guide decisions — they never replace human authority. |
| 6 | Workspace isolation is mandatory — no cross-workspace data access. |

---

## Architecture

### Source Files

| File | Purpose |
|------|---------|
| `recommendation-registry.ts` | Lifecycle management: create, generate, validate, publish, retire, apply, get, list, lineage, justification |
| `generation-engine.ts` | Template catalog: maps `patternType::patternKey` → recommendation template |
| `confidence-engine.ts` | Calculates composite confidence from 4 dimensions |
| `applicability-engine.ts` | Evaluates how applicable a recommendation is to a project context |
| `justification-engine.ts` | Produces structured justification for every recommendation |
| `explain-capability.ts` | Self-describing API |
| `types.ts` | All type definitions |
| `index.ts` | Public API exports |

### Database Tables

| Table | Purpose |
|-------|---------|
| `constitutional_recommendations` | Core recommendation record |
| `constitutional_recommendation_evidence` | Links recommendation to supporting learning patterns |
| `constitutional_recommendation_applications` | Records each application to a project entity |

---

## Recommendation Lifecycle

```
draft → generated → validated → published → retired
```

| Status | Transition |
|--------|-----------|
| `draft` | Manually created via `createRecommendation()` |
| `generated` | Created by `generateRecommendation()` from a Learning Pattern |
| `validated` | `validateRecommendation()` — requires evidence + confidence > 0 |
| `published` | `publishRecommendation()` — requires validated status |
| `retired` | `retireRecommendation()` — soft retirement only; `deleted_at` is set |

**Rule 3:** A recommendation cannot be published without at least one evidence link (learning pattern).
**Rule 4:** A recommendation cannot be published without a confidence score > 0.
**Rule 8:** Retirement is always soft — records are preserved for audit.

---

## Recommendation Generation

`generateRecommendationsFromPatterns()` reads all qualifying Learning Patterns in a workspace and maps each to an actionable recommendation via the **Template Catalog**.

### Template Catalog (initial)

| Pattern Key | Recommendation |
|-------------|---------------|
| `third_party_dependency` | Establecer evaluación formal de readiness del proveedor antes de comprometer fechas. |
| `approval_delay` | Introducir ratificación temprana y responsables explícitos de aprobación. |
| `authority_gap` | Definir delegaciones formales antes del inicio de ejecución. |
| `late_escalation` | Establecer umbrales automáticos de escalación. |
| `resource_shortage` | Validar capacidad operativa antes de aprobar cronogramas. |
| `delivery_delay` | Establecer indicadores de riesgo de entrega y monitorearlos semanalmente. |
| `technical_complexity` | Requerir revisión de factibilidad técnica antes del compromiso. |
| `regulatory_compliance` | Involucrar revisión de cumplimiento desde el inicio del proyecto. |
| `budget_overrun` | Establecer puntos de control de presupuesto en hitos de etapa. |
| `scope_creep` | Definir y congelar el alcance en la iniciación del proyecto. |
| `vendor_replacement` | Introducir planificación de transición de proveedor. |
| `schedule_change` | Requerir evaluación de impacto antes de aprobar cambios de cronograma. |
| `cancelled` | Definir criterios de viabilidad y revisiones periódicas de go/no-go. |

For unknown pattern keys, the engine falls back to a type-level recommendation.

---

## Confidence Model

`calculateRecommendationConfidence()` produces a `RecommendationConfidenceBreakdown`:

| Dimension | Weight | Meaning |
|-----------|--------|---------|
| `patternConfidence` | 40% | Inherited confidence from the supporting Learning Pattern |
| `occurrenceWeight` | 30% | How many times the pattern appeared across Digests |
| `consistencyWeight` | 20% | Average contribution weight from evidence rows |
| `evidenceWeight` | 10% | Number of distinct learning patterns supporting the recommendation |

**Scale:** 0.0 (insufficient evidence) → 1.0 (highly reliable institutional backing)

---

## Justification Model

`generateRecommendationJustification()` produces a structured justification that satisfies Principles 3 and 4:

```yaml
recommendation: Introducir ratificación temprana y responsables explícitos de aprobación.
because: Risk pattern: approval delay
evidence: 127 digests
confidence: 0.81
patternKey: approval_delay
patternType: risk_pattern
```

---

## Applicability Model

`evaluateRecommendationApplicability()` evaluates how relevant a recommendation is to a specific project context:

| Level | Score threshold | Meaning |
|-------|----------------|---------|
| `high` | ≥ 0.65 | Strong match — recommendation directly addresses the context |
| `medium` | ≥ 0.40 | Partial match — relevant but not critical |
| `low` | < 0.40 | Weak match — may not apply to this context |

**Scoring factors:**
- Recommendation confidence score (40%)
- Risk and pattern overlap with current context (30%)
- Scope alignment with project type and status (20%)
- Supporting pattern count / evidence breadth (10%)

---

## Lineage Chain

`getRecommendationLineage()` reconstructs the full provenance chain:

```
Artifact
  ↓  (storage reference, checksum)
Memory Record
  ↓  (canonical text, memory type)
Digest
  ↓  (digest payload, confidence score)
Learning Pattern
  ↓  (occurrence count, pattern key)
Recommendation
     (recommendation text, confidence, scope)
```

This is the full sovereign audit trail from raw document to actionable recommendation.

---

## Application

`applyRecommendation()` associates a published recommendation with a project entity:

```typescript
applyRecommendation({
  recommendationId: "...",
  workspaceId: "...",
  actorId: "...",
  entityType: "constitution",  // or: decision, amendment, risk, authority, project
  entityId: "...",
});
```

Every application is recorded in `constitutional_recommendation_applications`.
**Rule 7:** All applications are registered.
**Rule 9:** Application is advisory — it never grants or removes authority.

---

## Recommendation Types

| Type | Purpose |
|------|---------|
| `risk_mitigation` | Mitigate a recurring risk pattern |
| `governance_control` | Strengthen governance for a recurring failure |
| `decision_guidance` | Guide decision-making for a recurring decision pattern |
| `authority_control` | Clarify authority for a recurring authority gap |
| `delivery_improvement` | Improve delivery for a recurring delivery failure |
| `ratification_control` | Strengthen ratification for approval delays |
| `amendment_guidance` | Guide amendment handling |
| `portfolio_guidance` | Guide portfolio-level governance |

## Recommendation Scopes

`project` | `decision` | `risk` | `governance` | `amendment` | `authority` | `ratification` | `delivery` | `portfolio`

---

## Audit Events

| Event | When |
|-------|------|
| `CONSTITUTIONAL_RECOMMENDATION_CREATED` | Manually created via `createRecommendation()` |
| `CONSTITUTIONAL_RECOMMENDATION_GENERATED` | Derived from a Learning Pattern |
| `CONSTITUTIONAL_RECOMMENDATION_VALIDATED` | Evidence and confidence requirements verified |
| `CONSTITUTIONAL_RECOMMENDATION_PUBLISHED` | Made available for application |
| `CONSTITUTIONAL_RECOMMENDATION_RETIRED` | Soft-retired (record preserved) |
| `CONSTITUTIONAL_RECOMMENDATION_APPLIED` | Associated with a project entity |
| `CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED` | Confidence score recalculated |
| `CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED` | Full chain reconstructed |
| `CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED` | Justification produced |

---

## Usage Examples

### Generate all recommendations from patterns

```typescript
import { generateRecommendationsFromPatterns } from "@/lib/constitutional-recommendations";

const result = await generateRecommendationsFromPatterns({
  workspaceId: "...",
  actorId: "...",
  minPatternConfidence: 0.5,
});
```

### Full lifecycle

```typescript
import {
  generateRecommendation,
  validateRecommendation,
  publishRecommendation,
  applyRecommendation,
  getRecommendationLineage,
} from "@/lib/constitutional-recommendations";

// 1. Generate from pattern
const gen = await generateRecommendation(patternId, workspaceId, actorId);

// 2. Validate (checks evidence and confidence)
const validated = await validateRecommendation({ recommendationId: gen.data.id, workspaceId, actorId });

// 3. Publish
const published = await publishRecommendation({ recommendationId: gen.data.id, workspaceId, actorId });

// 4. Apply to a constitution
const applied = await applyRecommendation({ recommendationId: gen.data.id, workspaceId, actorId, entityType: "constitution", entityId: "..." });

// 5. Reconstruct lineage
const lineage = await getRecommendationLineage(gen.data.id, workspaceId, actorId);
// lineage: Artifact → Memory → Digest → Learning Pattern → Recommendation
```

### Evaluate applicability

```typescript
import { evaluateRecommendationApplicability } from "@/lib/constitutional-recommendations";

const applicability = evaluateRecommendationApplicability(recommendation, {
  presentRiskKeys: ["approval_delay", "resource_shortage"],
  observedPatternKeys: ["third_party_dependency"],
  projectType: "delivery",
  constitutionStatus: "active",
});
// { level: "high", score: 0.78, rationale: [...] }
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| Rule 1 | Every recommendation must originate from Learning Patterns. |
| Rule 2 | Every recommendation must be traceable. |
| Rule 3 | Cannot publish without evidence. |
| Rule 4 | Cannot publish without confidence score. |
| Rule 5 | Every recommendation must be justifiable. |
| Rule 6 | Workspace isolation is mandatory. |
| Rule 7 | Every application must be registered. |
| Rule 8 | Retirement is always soft. |
| Rule 9 | Recommendations never substitute human authority. |
