# Constitutional Memory Foundation

**EPIC 2 Sprint 1 — Sovereign Project Vault**

---

## Overview

The Constitutional Memory Foundation establishes the sovereign repository of constitutional knowledge for PMFreak. It separates three distinct layers:

- **Operational data** — active project records (EPIC 1)
- **Constitutional memory** — structured knowledge derived from artifacts
- **Physical storage** — client-controlled file storage systems

The Vault does not store files. It stores constitutional representations of knowledge derived from artifacts, evidence, and decisions.

---

## Core Principles

| # | Principle |
|---|-----------|
| 1 | The Vault is not a file system |
| 2 | The client maintains ownership of their data |
| 3 | PMFreak maintains constitutional memory |
| 4 | Every piece of knowledge must be traceable to an artifact |
| 5 | Every memory must be transformable into a Digest |
| 6 | Workspace isolation is mandatory |
| 7 | Every artifact must have a checksum |

---

## Data Model

### `constitutional_artifacts`

Registers external artifacts as sovereign references. The Vault stores the _reference_, not the file.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace FK (RLS boundary) |
| `artifact_type` | text | See Artifact Types below |
| `title` | text | Human-readable name |
| `description` | text? | Optional description |
| `storage_provider` | text | Where the file lives |
| `storage_reference` | text | Opaque ID in the external system |
| `storage_path` | text? | Optional path within the system |
| `checksum` | text | Integrity hash (SHA-256 recommended) |
| `uploaded_by` | uuid | Actor who registered the reference |
| `created_at` | timestamptz | Registration timestamp |
| `deleted_at` | timestamptz? | Soft delete only — never physically deleted |

**Artifact Types:** `document`, `email`, `meeting`, `transcript`, `spreadsheet`, `image`, `video`, `link`, `chat`, `other`

**Storage Providers:** `local`, `supabase`, `s3`, `azure_blob`, `google_drive`, `sharepoint`, `dropbox`, `custom`

### `constitutional_memory_records`

Structured constitutional knowledge derived from an artifact. Every record must be traceable to an artifact.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace FK (composite RLS) |
| `artifact_id` | uuid | FK → `constitutional_artifacts` (composite) |
| `memory_type` | text | See Memory Types below |
| `title` | text | Record title |
| `canonical_text` | text | Authoritative knowledge representation |
| `summary` | text? | Optional shortened summary |
| `created_at` | timestamptz | Creation timestamp |
| `created_by` | uuid | Actor who created the memory |

**Memory Types:** `decision`, `objective`, `constraint`, `risk`, `issue`, `amendment`, `ratification`, `authority`, `evidence`, `other`

### `constitutional_memory_links`

Links a memory record to a governance entity, enabling lineage reconstruction.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Workspace FK |
| `memory_record_id` | uuid | FK → `constitutional_memory_records` (composite) |
| `entity_type` | text | See Linkable Entities below |
| `entity_id` | uuid | The linked governance entity |
| `created_at` | timestamptz | Link creation timestamp |

**Linkable Entities:** `constitution`, `decision`, `amendment`, `ratification`, `authority`, `violation`, `escalation`

---

## Workspace Isolation

All three tables enforce workspace isolation at two levels:

1. **RLS policies** — `public.is_workspace_member(workspace_id)` on all SELECT/INSERT/UPDATE
2. **Composite foreign keys** — `(artifact_id, workspace_id)` and `(memory_record_id, workspace_id)` prevent cross-workspace joins at the database level
3. **Service layer** — every function validates `workspaceId` before any DB operation

---

## Soft Delete

Artifacts use soft delete exclusively:
- `archiveArtifact()` sets `deleted_at` to current timestamp
- Physical record is never deleted
- `listArtifacts()` filters `where deleted_at is null` by default
- Archived artifacts are read-only — `updateArtifact()` returns `governance_violation`

Memory records and links are hard-deleted only when their parent is cascade-deleted (workspace deletion).

---

## Service API

### Artifact Registry (`src/lib/constitutional-vault/artifact-registry.ts`)

```typescript
registerArtifact(input: RegisterArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>>
updateArtifact(input: UpdateArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>>
archiveArtifact(input: ArchiveArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>>
getArtifact(artifactId, workspaceId): Promise<VaultResult<ConstitutionalArtifactRow>>
listArtifacts(workspaceId, filters?): Promise<VaultResult<ConstitutionalArtifactRow[]>>
```

### Memory Registry (`src/lib/constitutional-vault/memory-registry.ts`)

```typescript
createMemoryRecord(input: CreateMemoryRecordInput): Promise<VaultResult<ConstitutionalMemoryRecordRow>>
updateMemoryRecord(input: UpdateMemoryRecordInput): Promise<VaultResult<ConstitutionalMemoryRecordRow>>
linkMemoryToEntity(input: LinkMemoryToEntityInput): Promise<VaultResult<ConstitutionalMemoryLinkRow>>
getMemoryRecord(memoryRecordId, workspaceId): Promise<VaultResult<ConstitutionalMemoryRecordRow>>
listMemoryRecordsByArtifact(artifactId, workspaceId): Promise<VaultResult<ConstitutionalMemoryRecordRow[]>>
listLinksForMemoryRecord(memoryRecordId, workspaceId): Promise<VaultResult<ConstitutionalMemoryLinkRow[]>>
```

### Lineage Engine (`src/lib/constitutional-vault/lineage-engine.ts`)

```typescript
getMemoryLineage(input): Promise<VaultResult<MemoryLineage>>
getArtifactLineage(input): Promise<VaultResult<ArtifactLineage>>
```

Reconstructs the lineage chain:

```
Artifact
  ↓
Memory Record
  ↓
Links (constitution / decision / amendment / ...)
```

### Canonical Representation (`src/lib/constitutional-vault/canonical-representation.ts`)

```typescript
generateCanonicalRepresentation(input): Promise<VaultResult<CanonicalRepresentation>>
```

Transforms memory records into a structured representation:

```yaml
summary: "..."
decisions:
  - "..."
risks:
  - "..."
objectives:
  - "..."
constraints:
  - "..."
metadata:
  storageProvider: "s3"
  storageReference: "s3://bucket/file.pdf"
  checksum: "sha256:..."
```

**Bucket mapping:**
- `decision`, `amendment`, `ratification` → `decisions[]`
- `risk`, `issue` → `risks[]`
- `objective` → `objectives[]`
- `constraint` → `constraints[]`
- `authority`, `evidence`, `other` → included in summary only

### Explain Capability (`src/lib/constitutional-vault/explain-capability.ts`)

```typescript
explainConstitutionalMemory(): ConstitutionalMemoryExplanation
```

Returns a structured description of the entire constitutional memory system: artifact model, memory record model, canonical representation, storage reference model, and sovereignty model.

---

## Result Type

All service functions return `VaultResult<T>`:

```typescript
type VaultResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      failureClass:
        | "validation_failed"
        | "not_found"
        | "persistence_failed"
        | "event_emission_failed"
        | "governance_violation";
    };
```

---

## Audit Events

Every mutation emits a platform event via `createPlatformEvent()`:

| Event | Trigger |
|-------|---------|
| `CONSTITUTIONAL_ARTIFACT_REGISTERED` | `registerArtifact()` |
| `CONSTITUTIONAL_ARTIFACT_UPDATED` | `updateArtifact()` |
| `CONSTITUTIONAL_ARTIFACT_ARCHIVED` | `archiveArtifact()` |
| `CONSTITUTIONAL_MEMORY_CREATED` | `createMemoryRecord()` |
| `CONSTITUTIONAL_MEMORY_UPDATED` | `updateMemoryRecord()` |
| `CONSTITUTIONAL_MEMORY_LINKED` | `linkMemoryToEntity()` |
| `CONSTITUTIONAL_LINEAGE_GENERATED` | `getMemoryLineage()` |

All events use:
- `eventCategory: "governance"`
- `visibility: "workspace"`
- `sensitivityLevel: "internal"`
- `learningEligible: false`

---

## Sovereignty Model

### PMFreak Controls
- `constitutional_artifacts` — references and checksums
- `constitutional_memory_records` — structured knowledge
- `constitutional_memory_links` — lineage graph
- Canonical representations and Digests
- Audit trail of all memory operations

### Client Controls
- Physical files (PDFs, emails, spreadsheets, etc.)
- Storage infrastructure (S3, Google Drive, SharePoint, etc.)
- Access credentials to storage systems
- File lifecycle management (deletion, versioning, retention)

The system can function entirely without direct file access. Knowledge is extracted once into canonical form; the original file remains under client control. Archiving an artifact in the Vault does not delete the client's file.

---

## Files

| Path | Description |
|------|-------------|
| `supabase/migrations/20260619000001_constitutional_memory_foundation.sql` | Database migration |
| `src/lib/constitutional-vault/types.ts` | All TypeScript types |
| `src/lib/constitutional-vault/artifact-registry.ts` | Artifact CRUD |
| `src/lib/constitutional-vault/memory-registry.ts` | Memory record CRUD + linking |
| `src/lib/constitutional-vault/lineage-engine.ts` | Lineage reconstruction |
| `src/lib/constitutional-vault/canonical-representation.ts` | Canonical representation generation |
| `src/lib/constitutional-vault/explain-capability.ts` | System explanation |
| `src/lib/constitutional-vault/index.ts` | Public API barrel |
| `tests/constitutional-memory-foundation.test.mjs` | Test suite |
| `docs/constitutional-memory-foundation.md` | This document |
