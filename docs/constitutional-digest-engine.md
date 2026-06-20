# Constitutional Digest Engine

EPIC 2 Sprint 2 — Sovereign Project Vault

## Overview

The Constitutional Digest Engine transforms Constitutional Memory into anonymized, normalized, portable **Constitutional Digests**. Digests preserve institutional learning (patterns, categories, outcomes) without retaining any information that could identify a client, vendor, individual, or project.

This is the boundary between:

```
Project Knowledge (Constitutional Memory — may contain PII)
        ↓
Institutional Knowledge (Constitutional Digest — anonymized patterns only)
```

---

## Architecture

```
constitutional_artifacts
        ↓
constitutional_memory_records
        ↓
constitutional_digests
        ↓
constitutional_digest_classifications
```

### Module Layout

```
src/lib/constitutional-digest/
├── index.ts                    Public API exports
├── types.ts                    All type definitions
├── digest-registry.ts          Lifecycle: create, generate, validate, publish, archive, list
├── anonymization-engine.ts     PII removal + entity normalization
├── pattern-extraction-engine.ts Decision / risk / governance / outcome patterns
├── confidence-engine.ts        Digest quality score (0.0–1.0)
├── digest-lineage.ts           Artifact → Memory → Digest chain reconstruction
└── explain-capability.ts       Self-describing capability API
```

---

## Digest Lifecycle

```
draft → generated → validated → published
                              ↓
                           archived (soft delete, from any status)
```

| Status | Description |
|--------|-------------|
| `draft` | Empty digest created, associated with a Memory Record. |
| `generated` | Patterns extracted, payload populated, anonymization applied. |
| `validated` | PII absence verified, confidence score calculated. |
| `published` | Available for sovereign learning. |
| `archived` | Soft-deleted. Not visible in lists or fetchable by ID. |

### Transition Rules

- `draft → generated`: `generateDigest()` — memory record must exist in workspace.
- `generated → validated`: `validateDigest()` — payload must not contain PII; confidence is calculated.
- `validated → published`: `publishDigest()` — digest must have passed validation.
- `any → archived`: `archiveDigest()` — soft delete only; no hard deletes.

---

## Anonymization

The Anonymization Engine (`anonymization-engine.ts`) removes or normalizes all sensitive entities before patterns are extracted.

### Removed Entities

| Entity | Replacement |
|--------|-------------|
| Email addresses | `[email_removed]` |
| Phone numbers | `[phone_removed]` |
| Specific URLs | `[url_removed]` |
| Project IDs (e.g. `BPD-16483`) | `[project_id_removed]` |
| Physical addresses | `[address_removed]` |

### Normalized Entities

| Original | Normalized |
|----------|------------|
| `Banco Popular` (banking context) | `banking_organization` |
| `Enercom` (energy context) | `energy_organization` |
| Any vendor/supplier | `third_party_vendor` |
| `$125,000` | `budget_band_large` |
| `$50,000` | `budget_band_medium` |
| `$5,000` | `budget_band_small` |
| `$2,500,000` | `budget_band_enterprise` |

### Budget Bands

| Range | Band |
|-------|------|
| < $10,000 | `budget_band_small` |
| $10,000 – $99,999 | `budget_band_medium` |
| $100,000 – $999,999 | `budget_band_large` |
| ≥ $1,000,000 | `budget_band_enterprise` |

---

## Classification

The Classification Engine runs during `generateDigest()` and persists classification records to `constitutional_digest_classifications`.

### Classification Types

| Type | Description |
|------|-------------|
| `industry` | Detected industry (banking, healthcare, energy, etc.) |
| `project_type` | Project category (infrastructure, software_development, migration, etc.) |
| `decision` | Decision pattern identified |
| `risk` | Risk pattern identified |
| `governance` | Governance pattern identified |
| `outcome` | Outcome pattern identified |
| `delivery` | Delivery pattern |
| `authority` | Authority pattern |

Each classification has a `confidence_score` in the range `0.0–1.0`.

---

## Pattern Extraction

The Pattern Extraction Engine (`pattern-extraction-engine.ts`) analyzes anonymized text using keyword pattern matching.

### Decision Patterns

| Pattern | Trigger Keywords |
|---------|-----------------|
| `schedule_change` | schedule, cronograma, delay, postpone |
| `scope_reduction` | scope, alcance, reduce, cut |
| `vendor_replacement` | vendor, proveedor, replace |
| `resource_reallocation` | resource, recurso, reallocate |
| `budget_adjustment` | budget, presupuesto, cost |
| `priority_change` | priority, prioridad, escalate |
| `approval_required` | approval, aprobación, authorize |

### Risk Patterns

| Pattern | Trigger Keywords |
|---------|-----------------|
| `third_party_dependency` | third-party, tercero, vendor, proveedor, depend |
| `approval_delay` | approval delay, retraso, demora, stall |
| `resource_shortage` | resource shortage, falta de, understaffed |
| `technical_complexity` | technical complexity, complejidad, technical debt |
| `regulatory_compliance` | regulatory, compliance, normativa, legal |
| `budget_overrun` | cost overrun, sobrecosto, over budget |
| `scope_creep` | scope creep, expand, additional |

### Governance Patterns

| Pattern | Trigger Keywords |
|---------|-----------------|
| `authority_gap` | authority gap, no tiene autoridad |
| `late_escalation` | late escalation, escalación tardía |
| `decision_reversal` | decision reversal, revertir, annul |
| `approval_bottleneck` | bottleneck, cuello de botella, approval delay |
| `delegation_conflict` | delegation, delegación, conflict |
| `quorum_failure` | quorum, mayoría |

### Outcome Patterns

| Pattern | Trigger Keywords |
|---------|-----------------|
| `successful_delivery` | successful, éxito, completado, delivered on time |
| `delivery_delay` | delay, retraso, atraso, late, postponed |
| `cost_overrun` | cost overrun, sobrecosto, over budget |
| `scope_reduction` | scope reduction, alcance reducido |
| `cancelled` | cancel, cancelado, abandoned |
| `partial_delivery` | partial, parcial, incomplete |

---

## Confidence Model

Calculated in `confidence-engine.ts` during `validateDigest()`.

```
confidence = completeness × 0.30
           + classificationCoverage × 0.30
           + patternCoverage × 0.30
           + traceability × 0.10
```

| Dimension | Weight | Calculation |
|-----------|--------|-------------|
| `completeness` | 30% | Fraction of 6 payload fields that are populated |
| `classificationCoverage` | 30% | `min(classificationCount / 2, 1.0)` |
| `patternCoverage` | 30% | Fraction of 4 pattern arrays that are non-empty |
| `traceability` | 10% | `1.0` if artifact link exists, else `0.0` |

Score stored in `constitutional_digests.confidence_score` as `numeric(4,3)`.

---

## Digest Lineage

`getDigestLineage()` reconstructs the complete chain:

```
Artifact (constitutional_artifacts)
    ↓
Memory Record (constitutional_memory_records)
    ↓
Digest (constitutional_digests)
```

Returns a `DigestLineage` object with all three entities.

---

## Digest Payload Format

```json
{
  "project_type": "infrastructure",
  "industry": "banking",
  "decision_patterns": ["schedule_change", "vendor_replacement"],
  "risk_patterns": ["third_party_dependency", "approval_delay"],
  "governance_patterns": ["authority_gap"],
  "outcome_patterns": ["delivery_delay"]
}
```

No client-identifiable information may appear in the payload. `validateDigest()` rejects payloads containing emails, project IDs, or URLs.

---

## Business Rules

| Rule | Description |
|------|-------------|
| Rule 1 | Every Digest must originate from a Memory Record. |
| Rule 2 | Every Digest must be traceable to its Memory Record and Artifact. |
| Rule 3 | Every Digest must pass validation before publishing. |
| Rule 4 | No identifiable client data in published Digests. |
| Rule 5 | Every classification must record a confidence score. |
| Rule 6 | Workspace isolation is mandatory. |
| Rule 7 | Every Digest maintains lineage. |
| Rule 8 | Every publish generates an audit event. |

---

## Audit Events

| Event | Trigger |
|-------|---------|
| `CONSTITUTIONAL_DIGEST_CREATED` | `createDigest()` |
| `CONSTITUTIONAL_DIGEST_GENERATED` | `generateDigest()` |
| `CONSTITUTIONAL_DIGEST_VALIDATED` | `validateDigest()` |
| `CONSTITUTIONAL_DIGEST_PUBLISHED` | `publishDigest()` |
| `CONSTITUTIONAL_DIGEST_ARCHIVED` | `archiveDigest()` |
| `CONSTITUTIONAL_DIGEST_ANONYMIZED` | During `generateDigest()` after anonymization |
| `CONSTITUTIONAL_DIGEST_CLASSIFIED` | During `generateDigest()` after classification |
| `CONSTITUTIONAL_DIGEST_PATTERN_EXTRACTED` | During `generateDigest()` after extraction |
| `CONSTITUTIONAL_DIGEST_CONFIDENCE_CALCULATED` | During `validateDigest()` |

All events are emitted with `learningEligible: true`, `visibility: "workspace"`, `sensitivityLevel: "internal"`.

---

## Use Cases

### 1. Transform a Memory Record into a Digest

```typescript
import {
  createDigest,
  generateDigest,
  validateDigest,
  publishDigest,
} from "@/lib/constitutional-digest";

// Step 1: Create empty digest
const digest = await createDigest({
  workspaceId,
  memoryRecordId,
  createdBy: actorId,
});

// Step 2: Extract patterns and anonymize
const generated = await generateDigest({
  digestId: digest.data.id,
  workspaceId,
  actorId,
});

// Step 3: Verify no PII, calculate confidence
const validated = await validateDigest({
  digestId: digest.data.id,
  workspaceId,
  actorId,
});

// Step 4: Make available for sovereign learning
const published = await publishDigest({
  digestId: digest.data.id,
  workspaceId,
  actorId,
});
```

### 2. List Digests by Industry

```typescript
import { listDigests } from "@/lib/constitutional-digest";

const digests = await listDigests({
  workspaceId,
  industry: "banking",
  status: "published",
});
```

### 3. Reconstruct Digest Lineage

```typescript
import { getDigestLineage } from "@/lib/constitutional-digest";

const lineage = await getDigestLineage({ digestId, workspaceId });
// lineage.data.artifact   → original file reference
// lineage.data.memoryRecord → structured knowledge
// lineage.data.digest       → anonymized patterns
```

### 4. Explain the Digest Engine

```typescript
import { explainConstitutionalDigest } from "@/lib/constitutional-digest";

const explanation = explainConstitutionalDigest();
// Returns full description of lifecycle, anonymization,
// classification, pattern extraction, confidence model.
```

---

## Sovereign Learning

Published Digests constitute the **PMFreak Sovereign Learning layer**. They allow the platform to accumulate institutional knowledge across all workspaces without retaining client-identifiable information.

The engine enforces the boundary between **Project Knowledge** (which may be sensitive) and **Institutional Knowledge** (which is safe to learn from collectively).
