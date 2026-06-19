# Project Constitutional Ratification Framework

## Overview

The Constitutional Ratification Framework ensures that Constitutions, Amendments, and Decisions acquire formal legitimacy through explicit approval, ratification, and acceptance processes. Existence alone does not confer legitimacy — formal evidence of acceptance by authorised parties is required.

The system differentiates clearly between:
- **Creating** something
- **Approving** something
- **Ratifying** something
- **Accepting** something

---

## Architecture

```
src/lib/constitutional-ratification/
├── types.ts              — Domain types, Result<T>, all input/output shapes
├── hash-engine.ts        — Deterministic signature hash generation
├── signature-engine.ts   — requestSignature, signEntity, rejectSignature,
│                           withdrawSignature, expireSignature, getSignatureStatus
├── ratification-engine.ts — validateRatification, ratifyEntity,
│                            upsertRatificationPolicy, getRatificationPolicy
├── legitimacy-engine.ts  — calculateLegitimacyStatus
├── explain.ts            — explainConstitutionalRatification
└── index.ts              — Public re-exports

supabase/migrations/
└── 20260626000000_constitutional_ratification_framework.sql
    ├── constitutional_signatures
    ├── constitutional_signature_requests
    └── constitutional_ratification_policies
```

---

## Data Model

### `constitutional_signatures`

The primary audit record. One row per authority per entity.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Tenant isolation |
| `entity_type` | text | `constitution`, `amendment`, `decision` |
| `entity_id` | uuid | FK to the ratifiable entity |
| `entity_version` | integer | Version of entity at time of signing |
| `authority_type` | text | Role of the signer (see below) |
| `authority_id` | uuid | User who signs |
| `status` | text | `pending`, `signed`, `rejected`, `expired`, `withdrawn` |
| `signature_hash` | text | Deterministic hash (set on sign) |
| `comments` | text | Optional remarks |
| `requested_at` | timestamptz | When the signature was requested |
| `signed_at` | timestamptz | When signed (null until then) |
| `rejected_at` | timestamptz | When rejected (null until then) |
| `expired_at` | timestamptz | When expired (null until then) |
| `withdrawn_at` | timestamptz | When withdrawn (null until then) |
| `created_by` | uuid | User who requested the signature |

Unique constraint: `(workspace_id, entity_type, entity_id, authority_id)` — Rule 2.

### `constitutional_signature_requests`

Tracks the request side separately for traceability and deadline management.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Tenant isolation |
| `entity_type` | text | Ratifiable entity type |
| `entity_id` | uuid | Target entity |
| `requested_authority` | text | Authority role requested |
| `requested_by` | uuid | User making the request |
| `status` | text | `pending`, `fulfilled`, `declined`, `expired` |
| `deadline` | timestamptz | Optional deadline |

### `constitutional_ratification_policies`

One policy per entity type per workspace. Defines ratification thresholds.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Tenant isolation |
| `entity_type` | text | `constitution`, `amendment`, `decision` |
| `minimum_signatures` | integer | Floor count of signed signatures required |
| `required_authorities` | text[] | Authority types that must sign |
| `allow_unanimous_override` | boolean | All requestees signed → bypass minimum |

---

## Signature Authorities

| Authority Type | Role |
|---|---|
| `sponsor` | Project sponsor |
| `project_manager` | Responsible PM |
| `client` | Client representative |
| `steering_committee` | Steering committee |
| `governance_board` | Governance board |
| `product_owner` | Product owner |
| `architect` | Solution architect |
| `technical_lead` | Technical lead |
| `external_approver` | External third-party approver |

---

## Signature States

```
pending ──→ signed
pending ──→ rejected  (terminal)
pending ──→ expired
pending ──→ withdrawn
signed  ──→ withdrawn
```

Rejected is **terminal** (Rule 3). A withdrawn signature does **not** count toward ratification (Rule 4).

---

## Ratification Flow

```
1. requestSignature()
   Creates a pending constitutional_signature + constitutional_signature_request.
   Emits: CONSTITUTIONAL_SIGNATURE_REQUESTED

2. signEntity()
   Transitions pending → signed.
   Generates signature_hash. Records signed_at.
   Emits: CONSTITUTIONAL_SIGNATURE_SIGNED

3a. rejectSignature()    → terminal, emits CONSTITUTIONAL_SIGNATURE_REJECTED
3b. expireSignature()    → emits CONSTITUTIONAL_SIGNATURE_EXPIRED
3c. withdrawSignature()  → emits CONSTITUTIONAL_SIGNATURE_WITHDRAWN

4. validateRatification()
   Checks: signedCount >= minimum_signatures AND required_authorities all signed.
   Withdrawn signatures are excluded.
   Returns: { valid, reason, signedCount, minimumRequired, missingAuthorities }

5. ratifyEntity()
   Calls validateRatification() internally.
   On success: emits CONSTITUTIONAL_ENTITY_RATIFIED
   On failure: emits CONSTITUTIONAL_RATIFICATION_FAILED, returns governance_violation
```

---

## Legitimacy Engine

`calculateLegitimacyStatus()` returns a `LegitimacyAssessment` with one of:

| Status | Condition |
|---|---|
| `unratified` | No signatures exist |
| `partially_ratified` | Some signed but below minimum, or missing required authorities |
| `ratified` | Meets minimum signatures and all required authorities |
| `rejected` | All signatures are rejected and none are signed/pending |
| `expired` | All signatures are expired |

---

## Signature Hashing

`generateSignatureHash()` uses four chained FNV-1a(32) passes to produce a 128-bit-wide deterministic hex string prefixed `sha-sig-`.

Input fields:
- `entity_type`
- `entity_id`
- `entity_version`
- `authority_type`
- `authority_id`
- `timestamp` (the exact `signed_at` moment)

The same inputs always produce the same hash, enabling **historical reconstruction** and **non-repudiation verification**.

---

## Non-Repudiation

Every signature record guarantees:

- **Identity** — `authority_id` and `authority_type` are immutably recorded.
- **Intention** — signing is a formal act of consent.
- **Moment** — `signed_at` is recorded at signing time.
- **Version binding** — `entity_version` pins the approval to the exact state of the document.
- **Hash integrity** — `signature_hash` can be recomputed from the recorded fields to verify nothing changed.

---

## Integration Points

### Amendment → Applied

`applyAmendment()` calls `validateRatification()` before applying. An approved amendment cannot transition to `applied` if ratification requirements are not met. Returns `governance_violation`.

### Decision → Execute

Call `validateRatification()` before executing a decision when the workspace policy requires it.

### Constitution → Active

Call `validateRatification()` before activating a constitution when the workspace policy requires it.

---

## Audit Events

All events are emitted to `platform_events` with `eventCategory: "governance"`, `visibility: "workspace"`, `sensitivityLevel: "internal"`.

| Event | Trigger |
|---|---|
| `CONSTITUTIONAL_SIGNATURE_REQUESTED` | `requestSignature()` |
| `CONSTITUTIONAL_SIGNATURE_SIGNED` | `signEntity()` |
| `CONSTITUTIONAL_SIGNATURE_REJECTED` | `rejectSignature()` |
| `CONSTITUTIONAL_SIGNATURE_WITHDRAWN` | `withdrawSignature()` |
| `CONSTITUTIONAL_SIGNATURE_EXPIRED` | `expireSignature()` |
| `CONSTITUTIONAL_ENTITY_RATIFIED` | `ratifyEntity()` success |
| `CONSTITUTIONAL_RATIFICATION_FAILED` | `ratifyEntity()` failure |
| `CONSTITUTIONAL_LEGITIMACY_UPDATED` | `calculateLegitimacyStatus(emitEvent: true)` |

---

## Business Rules

1. Every signature must belong to a ratifiable entity (`constitution`, `amendment`, `decision`).
2. The same authority cannot sign the same entity twice. Unique constraint + runtime guard → `governance_violation`.
3. A rejected signature is terminal — it cannot transition to any other state.
4. A withdrawn signature does not count toward the ratification threshold.
5. Ratification requires fulfilling the workspace policy: `minimum_signatures` signed AND all `required_authorities` present.
6. Every signature state transition emits an audit event to `platform_events`.
7. Every ratification attempt (success or failure) emits an audit event.
8. Workspace isolation is enforced at the RLS layer and at every service call via `workspace_id` scoping.
9. Every signature records `entity_version` to bind the approval to the exact entity state at signing time.
10. The `signature_hash` is derived deterministically — signing conditions are permanently reconstructible.

---

## Usage Examples

```typescript
import {
  requestSignature,
  signEntity,
  validateRatification,
  ratifyEntity,
  calculateLegitimacyStatus,
  upsertRatificationPolicy,
  explainConstitutionalRatification,
} from "@/lib/constitutional-ratification";

// 1. Define a ratification policy for amendments
await upsertRatificationPolicy({
  workspaceId,
  entityType: "amendment",
  minimumSignatures: 2,
  requiredAuthorities: ["sponsor", "governance_board"],
  allowUnanimousOverride: false,
});

// 2. Request signatures
const sigReq = await requestSignature({
  workspaceId,
  entityType: "amendment",
  entityId: amendmentId,
  entityVersion: 1,
  authorityType: "sponsor",
  authorityId: sponsorUserId,
  requestedBy: pmUserId,
  deadline: "2026-07-01T00:00:00Z",
});

// 3. Sponsor signs
const signed = await signEntity({
  workspaceId,
  signatureId: sigReq.data.id,
  actorId: sponsorUserId,
  comments: "Approved as presented.",
});

// 4. Check legitimacy
const legitimacy = await calculateLegitimacyStatus({
  workspaceId,
  entityType: "amendment",
  entityId: amendmentId,
});
// legitimacy.data.status → "partially_ratified" (1 of 2 required)

// 5. After governance board also signs, ratify
const ratification = await ratifyEntity({
  workspaceId,
  entityType: "amendment",
  entityId: amendmentId,
  actorId: pmUserId,
});
// On success: ratification.data.ratifiedAt

// 6. Get a human-readable explanation
const explanation = explainConstitutionalRatification();
```

---

## Workspace Isolation

- **RLS**: All three tables enforce `is_workspace_member(workspace_id)` on select/insert/update.
- **Service layer**: Every function accepts and filters by `workspaceId`. Cross-workspace access is impossible at both the DB and service layers.
- **Composite FKs**: Not required here since signatures target entities across multiple tables (via `entity_type` discriminator), but workspace isolation is enforced via the `workspace_id` column on each row.
