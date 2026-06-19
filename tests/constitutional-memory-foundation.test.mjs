import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── In-memory Constitutional Vault Store ────────────────────────────────────

function createVaultStore() {
  const artifacts = new Map();
  const memoryRecords = new Map();
  const memoryLinks = new Map();
  const auditLog = [];

  const ARTIFACT_TYPES = new Set([
    "document", "email", "meeting", "transcript",
    "spreadsheet", "image", "video", "link", "chat", "other",
  ]);

  const STORAGE_PROVIDERS = new Set([
    "local", "supabase", "s3", "azure_blob",
    "google_drive", "sharepoint", "dropbox", "custom",
  ]);

  const MEMORY_TYPES = new Set([
    "decision", "objective", "constraint", "risk",
    "issue", "amendment", "ratification", "authority", "evidence", "other",
  ]);

  const LINK_ENTITY_TYPES = new Set([
    "constitution", "decision", "amendment",
    "ratification", "authority", "violation", "escalation",
  ]);

  function validUuid(v) {
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function validation(error) { return { ok: false, error, failureClass: "validation_failed" }; }
  function failed(error, failureClass = "persistence_failed") { return { ok: false, error, failureClass }; }
  function emit(eventType, payload) { auditLog.push({ eventType, payload, at: isoNow() }); return { ok: true }; }

  // ── registerArtifact ──

  function registerArtifact(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.uploadedBy)) return validation("uploadedBy must be a UUID.");
    if (!input.title || !input.title.trim()) return validation("title is required.");
    if (!input.storageReference || !input.storageReference.trim()) return validation("storageReference is required.");
    if (!input.checksum || !input.checksum.trim()) return validation("checksum is required.");
    if (!ARTIFACT_TYPES.has(input.artifactType)) return validation(`Invalid artifact type: ${input.artifactType}`);
    if (!STORAGE_PROVIDERS.has(input.storageProvider)) return validation(`Invalid storage provider: ${input.storageProvider}`);

    const id = uuid();
    const now = isoNow();
    const record = {
      id,
      workspace_id: input.workspaceId,
      artifact_type: input.artifactType,
      title: input.title.trim(),
      description: input.description ?? null,
      storage_provider: input.storageProvider,
      storage_reference: input.storageReference,
      storage_path: input.storagePath ?? null,
      checksum: input.checksum,
      uploaded_by: input.uploadedBy,
      created_at: now,
      deleted_at: null,
    };
    artifacts.set(id, record);
    emit("CONSTITUTIONAL_ARTIFACT_REGISTERED", { artifactId: id, workspaceId: input.workspaceId });
    return { ok: true, data: record };
  }

  // ── updateArtifact ──

  function updateArtifact(input) {
    if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

    const artifact = artifacts.get(input.artifactId);
    if (!artifact || artifact.workspace_id !== input.workspaceId) return failed("Artifact not found.", "not_found");
    if (artifact.deleted_at !== null) return failed("Archived artifacts are read-only.", "governance_violation");

    if (input.title !== undefined) {
      if (!input.title.trim()) return validation("title cannot be empty.");
      artifact.title = input.title.trim();
    }
    if (input.description !== undefined) artifact.description = input.description;
    if (input.storageReference !== undefined) {
      if (!input.storageReference.trim()) return validation("storageReference cannot be empty.");
      artifact.storage_reference = input.storageReference;
    }
    if (input.checksum !== undefined) {
      if (!input.checksum.trim()) return validation("checksum cannot be empty.");
      artifact.checksum = input.checksum;
    }

    emit("CONSTITUTIONAL_ARTIFACT_UPDATED", { artifactId: artifact.id });
    return { ok: true, data: { ...artifact } };
  }

  // ── archiveArtifact ──

  function archiveArtifact(input) {
    if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

    const artifact = artifacts.get(input.artifactId);
    if (!artifact || artifact.workspace_id !== input.workspaceId) return failed("Artifact not found.", "not_found");
    if (artifact.deleted_at !== null) return failed("Artifact is already archived.", "governance_violation");

    artifact.deleted_at = isoNow();
    emit("CONSTITUTIONAL_ARTIFACT_ARCHIVED", { artifactId: artifact.id, archivedAt: artifact.deleted_at });
    return { ok: true, data: { ...artifact } };
  }

  // ── createMemoryRecord ──

  function createMemoryRecord(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
    if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
    if (!input.title || !input.title.trim()) return validation("title is required.");
    if (!input.canonicalText || !input.canonicalText.trim()) return validation("canonicalText is required.");
    if (!MEMORY_TYPES.has(input.memoryType)) return validation(`Invalid memory type: ${input.memoryType}`);

    // Traceability: artifact must exist in same workspace
    const artifact = artifacts.get(input.artifactId);
    if (!artifact || artifact.workspace_id !== input.workspaceId) {
      return failed("Constitutional artifact not found.", "not_found");
    }

    const id = uuid();
    const now = isoNow();
    const record = {
      id,
      workspace_id: input.workspaceId,
      artifact_id: input.artifactId,
      memory_type: input.memoryType,
      title: input.title.trim(),
      canonical_text: input.canonicalText,
      summary: input.summary ?? null,
      created_at: now,
      created_by: input.createdBy,
    };
    memoryRecords.set(id, record);
    emit("CONSTITUTIONAL_MEMORY_CREATED", { memoryRecordId: id, artifactId: input.artifactId });
    return { ok: true, data: record };
  }

  // ── updateMemoryRecord ──

  function updateMemoryRecord(input) {
    if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

    const record = memoryRecords.get(input.memoryRecordId);
    if (!record || record.workspace_id !== input.workspaceId) return failed("Memory record not found.", "not_found");

    if (input.title !== undefined) {
      if (!input.title.trim()) return validation("title cannot be empty.");
      record.title = input.title.trim();
    }
    if (input.canonicalText !== undefined) {
      if (!input.canonicalText.trim()) return validation("canonicalText cannot be empty.");
      record.canonical_text = input.canonicalText;
    }
    if (input.summary !== undefined) record.summary = input.summary;

    emit("CONSTITUTIONAL_MEMORY_UPDATED", { memoryRecordId: record.id });
    return { ok: true, data: { ...record } };
  }

  // ── linkMemoryToEntity ──

  function linkMemoryToEntity(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
    if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    if (!LINK_ENTITY_TYPES.has(input.entityType)) return validation(`Invalid entity type: ${input.entityType}`);

    const record = memoryRecords.get(input.memoryRecordId);
    if (!record || record.workspace_id !== input.workspaceId) return failed("Memory record not found.", "not_found");

    const id = uuid();
    const link = {
      id,
      workspace_id: input.workspaceId,
      memory_record_id: input.memoryRecordId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      created_at: isoNow(),
    };
    memoryLinks.set(id, link);
    emit("CONSTITUTIONAL_MEMORY_LINKED", { linkId: id, memoryRecordId: input.memoryRecordId, entityType: input.entityType });
    return { ok: true, data: link };
  }

  // ── getMemoryLineage ──

  function getMemoryLineage(input) {
    if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

    const record = memoryRecords.get(input.memoryRecordId);
    if (!record || record.workspace_id !== input.workspaceId) return failed("Memory record not found.", "not_found");

    const artifact = artifacts.get(record.artifact_id);
    if (!artifact || artifact.workspace_id !== input.workspaceId) return failed("Artifact not found.", "not_found");

    const links = [...memoryLinks.values()].filter(
      (l) => l.memory_record_id === input.memoryRecordId && l.workspace_id === input.workspaceId,
    );

    emit("CONSTITUTIONAL_LINEAGE_GENERATED", { memoryRecordId: input.memoryRecordId, linkCount: links.length });
    return { ok: true, data: { artifact, memoryRecord: record, links } };
  }

  // ── generateCanonicalRepresentation ──

  function generateCanonicalRepresentation(input) {
    if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

    const artifact = artifacts.get(input.artifactId);
    if (!artifact || artifact.workspace_id !== input.workspaceId) return failed("Artifact not found.", "not_found");

    const BUCKET_MAP = {
      decision: "decisions", amendment: "decisions", ratification: "decisions",
      risk: "risks", issue: "risks",
      objective: "objectives",
      constraint: "constraints",
      authority: null, evidence: null, other: null,
    };

    const records = [...memoryRecords.values()].filter(
      (r) => r.artifact_id === input.artifactId && r.workspace_id === input.workspaceId,
    );

    const decisions = [], risks = [], objectives = [], constraints = [];
    const summaryRecord = records.find((r) => r.summary);
    const summary = summaryRecord?.summary ?? artifact.description ?? `${artifact.artifact_type}: ${artifact.title}`;

    for (const r of records) {
      const bucket = BUCKET_MAP[r.memory_type];
      if (bucket === "decisions") decisions.push(r.canonical_text);
      else if (bucket === "risks") risks.push(r.canonical_text);
      else if (bucket === "objectives") objectives.push(r.canonical_text);
      else if (bucket === "constraints") constraints.push(r.canonical_text);
    }

    return {
      ok: true,
      data: {
        artifactId: artifact.id,
        artifactType: artifact.artifact_type,
        title: artifact.title,
        summary,
        decisions,
        risks,
        objectives,
        constraints,
        generatedAt: isoNow(),
        metadata: {
          storageProvider: artifact.storage_provider,
          storageReference: artifact.storage_reference,
          checksum: artifact.checksum,
        },
      },
    };
  }

  return {
    registerArtifact,
    updateArtifact,
    archiveArtifact,
    createMemoryRecord,
    updateMemoryRecord,
    linkMemoryToEntity,
    getMemoryLineage,
    generateCanonicalRepresentation,
    auditLog,
    artifacts,
    memoryRecords,
    memoryLinks,
  };
}

// ─── Migration Contract Tests ─────────────────────────────────────────────────

describe("Migration: constitutional_memory_foundation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260619000001_constitutional_memory_foundation.sql",
    "utf8",
  );

  test("creates constitutional_artifacts with workspace isolation", () => {
    assert.match(migration, /create table if not exists public\.constitutional_artifacts/);
    assert.match(migration, /workspace_id.*uuid.*not null/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  });

  test("constitutional_artifacts has required fields", () => {
    assert.match(migration, /artifact_type.*text.*not null/);
    assert.match(migration, /storage_provider.*text.*not null/);
    assert.match(migration, /storage_reference.*text.*not null/);
    assert.match(migration, /checksum.*text.*not null/);
    assert.match(migration, /uploaded_by.*uuid.*not null/);
    assert.match(migration, /deleted_at.*timestamptz.*null/);
  });

  test("constitutional_artifacts enforces artifact_type enum", () => {
    assert.match(migration, /document.*email.*meeting.*transcript/);
    assert.match(migration, /spreadsheet.*image.*video.*link.*chat.*other/);
  });

  test("constitutional_artifacts enforces storage_provider enum", () => {
    assert.match(migration, /local.*supabase.*s3.*azure_blob/);
    assert.match(migration, /google_drive.*sharepoint.*dropbox.*custom/);
  });

  test("creates constitutional_memory_records with composite FK", () => {
    assert.match(migration, /create table if not exists public\.constitutional_memory_records/);
    assert.match(migration, /constitutional_memory_records_artifact_fk/);
    assert.match(migration, /references public\.constitutional_artifacts\(id, workspace_id\)/);
  });

  test("constitutional_memory_records has canonical_text", () => {
    assert.match(migration, /canonical_text.*text.*not null/);
    assert.match(migration, /memory_type.*text.*not null/);
  });

  test("creates constitutional_memory_links with composite FK", () => {
    assert.match(migration, /create table if not exists public\.constitutional_memory_links/);
    assert.match(migration, /constitutional_memory_links_record_fk/);
    assert.match(migration, /references public\.constitutional_memory_records\(id, workspace_id\)/);
  });

  test("constitutional_memory_links enforces entity_type enum", () => {
    const entityTypes = ["constitution", "decision", "amendment", "ratification", "authority", "violation", "escalation"];
    for (const t of entityTypes) {
      assert.match(migration, new RegExp(`'${t}'`), `Entity type '${t}' must be in entity_type check constraint`);
    }
  });

  test("all tables have RLS policies", () => {
    const rlsBlocks = migration.match(/enable row level security/g) ?? [];
    assert.equal(rlsBlocks.length, 3, "All 3 tables must have RLS enabled");
  });

  test("insert policies enforce workspace membership", () => {
    assert.match(migration, /uploaded_by = auth\.uid\(\)/);
    assert.match(migration, /created_by = auth\.uid\(\)/);
  });

  test("migration is wrapped in a transaction", () => {
    assert.match(migration, /^begin;/m);
    assert.match(migration, /^commit;/m);
  });
});

// ─── Artifact Registry Tests ──────────────────────────────────────────────────

describe("Artifact Registry", () => {
  test("registers artifact correctly", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const result = store.registerArtifact({
      workspaceId: ws,
      artifactType: "document",
      title: "Project Charter v1.0",
      description: "Initial project charter PDF",
      storageProvider: "s3",
      storageReference: "bucket/path/charter-v1.pdf",
      checksum: "sha256:abc123def456",
      uploadedBy: user,
    });

    assert.ok(result.ok);
    assert.equal(result.data.workspace_id, ws);
    assert.equal(result.data.artifact_type, "document");
    assert.equal(result.data.title, "Project Charter v1.0");
    assert.equal(result.data.storage_provider, "s3");
    assert.equal(result.data.storage_reference, "bucket/path/charter-v1.pdf");
    assert.equal(result.data.checksum, "sha256:abc123def456");
    assert.equal(result.data.deleted_at, null);
  });

  test("rejects artifact without checksum", () => {
    const store = createVaultStore();
    const result = store.registerArtifact({
      workspaceId: uuid(),
      artifactType: "email",
      title: "Kickoff Email",
      storageProvider: "google_drive",
      storageReference: "drive-file-id-123",
      checksum: "",
      uploadedBy: uuid(),
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("rejects invalid artifact type", () => {
    const store = createVaultStore();
    const result = store.registerArtifact({
      workspaceId: uuid(),
      artifactType: "invoice",
      title: "Invoice",
      storageProvider: "local",
      storageReference: "/files/invoice.pdf",
      checksum: "sha256:xyz",
      uploadedBy: uuid(),
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("rejects invalid storage provider", () => {
    const store = createVaultStore();
    const result = store.registerArtifact({
      workspaceId: uuid(),
      artifactType: "document",
      title: "Doc",
      storageProvider: "ftp",
      storageReference: "ref",
      checksum: "sha256:xyz",
      uploadedBy: uuid(),
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("updates artifact title and checksum", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws,
      artifactType: "document",
      title: "Original Title",
      storageProvider: "s3",
      storageReference: "s3://bucket/file.pdf",
      checksum: "sha256:old",
      uploadedBy: user,
    });
    assert.ok(reg.ok);

    const upd = store.updateArtifact({
      artifactId: reg.data.id,
      workspaceId: ws,
      actorId: user,
      title: "Updated Title",
      checksum: "sha256:new",
    });
    assert.ok(upd.ok);
    assert.equal(upd.data.title, "Updated Title");
    assert.equal(upd.data.checksum, "sha256:new");
  });

  test("archives artifact (soft delete only)", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws,
      artifactType: "meeting",
      title: "Kickoff Meeting Notes",
      storageProvider: "sharepoint",
      storageReference: "sp-doc-id-789",
      checksum: "sha256:meeting",
      uploadedBy: user,
    });
    assert.ok(reg.ok);
    assert.equal(reg.data.deleted_at, null);

    const arc = store.archiveArtifact({
      artifactId: reg.data.id,
      workspaceId: ws,
      actorId: user,
    });
    assert.ok(arc.ok);
    assert.notEqual(arc.data.deleted_at, null, "deleted_at should be set on archive");
    assert.ok(store.artifacts.has(reg.data.id), "Record must still exist in store (soft delete)");
  });

  test("prevents update of archived artifact", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws,
      artifactType: "link",
      title: "Requirements URL",
      storageProvider: "custom",
      storageReference: "https://example.com/requirements",
      checksum: "sha256:link",
      uploadedBy: user,
    });
    store.archiveArtifact({ artifactId: reg.data.id, workspaceId: ws, actorId: user });

    const upd = store.updateArtifact({
      artifactId: reg.data.id,
      workspaceId: ws,
      actorId: user,
      title: "New Title",
    });
    assert.ok(!upd.ok);
    assert.equal(upd.failureClass, "governance_violation");
  });

  test("emits CONSTITUTIONAL_ARTIFACT_REGISTERED event", () => {
    const store = createVaultStore();
    store.registerArtifact({
      workspaceId: uuid(),
      artifactType: "transcript",
      title: "Sprint Review Transcript",
      storageProvider: "supabase",
      storageReference: "storage-object-id",
      checksum: "sha256:transcript",
      uploadedBy: uuid(),
    });
    const event = store.auditLog.find((e) => e.eventType === "CONSTITUTIONAL_ARTIFACT_REGISTERED");
    assert.ok(event, "CONSTITUTIONAL_ARTIFACT_REGISTERED event must be emitted");
  });
});

// ─── Memory Record Tests ──────────────────────────────────────────────────────

describe("Memory Records", () => {
  function setupWithArtifact() {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();
    const reg = store.registerArtifact({
      workspaceId: ws,
      artifactType: "document",
      title: "Governance Charter",
      storageProvider: "s3",
      storageReference: "s3://bucket/governance-charter.pdf",
      checksum: "sha256:charter",
      uploadedBy: user,
    });
    return { store, ws, user, artifactId: reg.data.id };
  }

  test("creates memory record with artifact association", () => {
    const { store, ws, user, artifactId } = setupWithArtifact();

    const result = store.createMemoryRecord({
      workspaceId: ws,
      artifactId,
      memoryType: "decision",
      title: "Architecture Decision",
      canonicalText: "The project will use a microservices architecture to enable independent scaling.",
      summary: "Microservices chosen for scalability.",
      createdBy: user,
    });

    assert.ok(result.ok);
    assert.equal(result.data.workspace_id, ws);
    assert.equal(result.data.artifact_id, artifactId);
    assert.equal(result.data.memory_type, "decision");
    assert.ok(result.data.canonical_text.length > 0);
  });

  test("rejects memory record without artifact", () => {
    const { store, ws, user } = setupWithArtifact();

    const result = store.createMemoryRecord({
      workspaceId: ws,
      artifactId: uuid(),  // non-existent artifact
      memoryType: "risk",
      title: "Orphan Risk",
      canonicalText: "This risk has no artifact backing.",
      createdBy: user,
    });

    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("rejects memory record for artifact in different workspace", () => {
    const { store, user, artifactId } = setupWithArtifact();
    const otherWorkspace = uuid();

    const result = store.createMemoryRecord({
      workspaceId: otherWorkspace,
      artifactId,  // artifact belongs to ws, not otherWorkspace
      memoryType: "objective",
      title: "Cross-Workspace Objective",
      canonicalText: "Should not be allowed.",
      createdBy: user,
    });

    assert.ok(!result.ok, "Cross-workspace access must be denied");
  });

  test("updates memory record title and canonical text", () => {
    const { store, ws, user, artifactId } = setupWithArtifact();

    const created = store.createMemoryRecord({
      workspaceId: ws,
      artifactId,
      memoryType: "constraint",
      title: "Budget Constraint",
      canonicalText: "Project budget capped at $500K.",
      createdBy: user,
    });
    assert.ok(created.ok);

    const updated = store.updateMemoryRecord({
      memoryRecordId: created.data.id,
      workspaceId: ws,
      actorId: user,
      canonicalText: "Project budget capped at $750K following board approval.",
      summary: "Budget cap revised upward.",
    });
    assert.ok(updated.ok);
    assert.match(updated.data.canonical_text, /\$750K/);
    assert.equal(updated.data.summary, "Budget cap revised upward.");
  });

  test("supports all memory types", () => {
    const { store, ws, user, artifactId } = setupWithArtifact();
    const TYPES = ["decision", "objective", "constraint", "risk", "issue", "amendment", "ratification", "authority", "evidence", "other"];

    for (const memoryType of TYPES) {
      const result = store.createMemoryRecord({
        workspaceId: ws,
        artifactId,
        memoryType,
        title: `${memoryType} memory`,
        canonicalText: `Canonical text for ${memoryType}`,
        createdBy: user,
      });
      assert.ok(result.ok, `Memory type '${memoryType}' should be valid`);
    }
  });

  test("emits CONSTITUTIONAL_MEMORY_CREATED event", () => {
    const { store, ws, user, artifactId } = setupWithArtifact();
    store.createMemoryRecord({
      workspaceId: ws,
      artifactId,
      memoryType: "evidence",
      title: "Evidence Record",
      canonicalText: "Stakeholder approved scope on 2026-06-15.",
      createdBy: user,
    });

    const event = store.auditLog.find((e) => e.eventType === "CONSTITUTIONAL_MEMORY_CREATED");
    assert.ok(event, "CONSTITUTIONAL_MEMORY_CREATED must be emitted");
    assert.equal(event.payload.artifactId, artifactId);
  });
});

// ─── Memory Linking Tests ─────────────────────────────────────────────────────

describe("Memory Linking", () => {
  function setupWithMemory() {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();
    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "document",
      title: "Policy Doc", storageProvider: "s3",
      storageReference: "s3://bucket/policy.pdf",
      checksum: "sha256:policy", uploadedBy: user,
    });
    const mem = store.createMemoryRecord({
      workspaceId: ws, artifactId: reg.data.id,
      memoryType: "decision", title: "Policy Decision",
      canonicalText: "Policy approved by steering committee.",
      createdBy: user,
    });
    return { store, ws, user, artifactId: reg.data.id, memoryRecordId: mem.data.id };
  }

  test("links memory record to constitution", () => {
    const { store, ws, user, memoryRecordId } = setupWithMemory();
    const constitutionId = uuid();

    const result = store.linkMemoryToEntity({
      workspaceId: ws,
      memoryRecordId,
      entityType: "constitution",
      entityId: constitutionId,
      actorId: user,
    });

    assert.ok(result.ok);
    assert.equal(result.data.entity_type, "constitution");
    assert.equal(result.data.entity_id, constitutionId);
    assert.equal(result.data.memory_record_id, memoryRecordId);
  });

  test("links memory record to all supported entity types", () => {
    const { store, ws, user, memoryRecordId } = setupWithMemory();
    const ENTITY_TYPES = ["constitution", "decision", "amendment", "ratification", "authority", "violation", "escalation"];

    for (const entityType of ENTITY_TYPES) {
      const result = store.linkMemoryToEntity({
        workspaceId: ws,
        memoryRecordId,
        entityType,
        entityId: uuid(),
        actorId: user,
      });
      assert.ok(result.ok, `Entity type '${entityType}' should be linkable`);
    }
    assert.equal(store.memoryLinks.size, 7);
  });

  test("rejects link for non-existent memory record", () => {
    const { store, ws, user } = setupWithMemory();

    const result = store.linkMemoryToEntity({
      workspaceId: ws,
      memoryRecordId: uuid(),
      entityType: "decision",
      entityId: uuid(),
      actorId: user,
    });

    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("emits CONSTITUTIONAL_MEMORY_LINKED event", () => {
    const { store, ws, user, memoryRecordId } = setupWithMemory();
    store.linkMemoryToEntity({
      workspaceId: ws,
      memoryRecordId,
      entityType: "amendment",
      entityId: uuid(),
      actorId: user,
    });

    const event = store.auditLog.find((e) => e.eventType === "CONSTITUTIONAL_MEMORY_LINKED");
    assert.ok(event, "CONSTITUTIONAL_MEMORY_LINKED must be emitted");
    assert.equal(event.payload.entityType, "amendment");
  });
});

// ─── Lineage Reconstruction Tests ─────────────────────────────────────────────

describe("Lineage Reconstruction", () => {
  test("reconstructs Artifact → Memory → Links lineage", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "transcript",
      title: "Steering Committee Transcript",
      storageProvider: "google_drive",
      storageReference: "gdrive-file-id-steering-2026",
      checksum: "sha256:steering-transcript",
      uploadedBy: user,
    });
    const artifactId = reg.data.id;

    const mem = store.createMemoryRecord({
      workspaceId: ws, artifactId,
      memoryType: "decision",
      title: "Scope Change Approved",
      canonicalText: "Steering committee approved scope extension to include Phase 3.",
      createdBy: user,
    });
    const memoryRecordId = mem.data.id;

    const constitutionId = uuid();
    const decisionId = uuid();
    store.linkMemoryToEntity({ workspaceId: ws, memoryRecordId, entityType: "constitution", entityId: constitutionId, actorId: user });
    store.linkMemoryToEntity({ workspaceId: ws, memoryRecordId, entityType: "decision", entityId: decisionId, actorId: user });

    const lineage = store.getMemoryLineage({ memoryRecordId, workspaceId: ws });

    assert.ok(lineage.ok);
    assert.equal(lineage.data.artifact.id, artifactId);
    assert.equal(lineage.data.memoryRecord.id, memoryRecordId);
    assert.equal(lineage.data.links.length, 2);
    assert.ok(lineage.data.links.some((l) => l.entity_type === "constitution"));
    assert.ok(lineage.data.links.some((l) => l.entity_type === "decision"));
  });

  test("fails lineage for memory record in different workspace", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "document",
      title: "Doc", storageProvider: "local",
      storageReference: "/files/doc.pdf",
      checksum: "sha256:doc", uploadedBy: user,
    });
    const mem = store.createMemoryRecord({
      workspaceId: ws, artifactId: reg.data.id,
      memoryType: "objective", title: "Goal",
      canonicalText: "Deliver phase 1 by Q3.", createdBy: user,
    });

    const lineage = store.getMemoryLineage({
      memoryRecordId: mem.data.id,
      workspaceId: uuid(),  // wrong workspace
    });

    assert.ok(!lineage.ok);
    assert.equal(lineage.failureClass, "not_found");
  });

  test("emits CONSTITUTIONAL_LINEAGE_GENERATED event", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "email",
      title: "Approval Email", storageProvider: "custom",
      storageReference: "email-id-xyz", checksum: "sha256:email", uploadedBy: user,
    });
    const mem = store.createMemoryRecord({
      workspaceId: ws, artifactId: reg.data.id,
      memoryType: "ratification", title: "Email Ratification",
      canonicalText: "Project sponsor ratified the charter via email on 2026-06-01.",
      createdBy: user,
    });

    store.getMemoryLineage({ memoryRecordId: mem.data.id, workspaceId: ws });

    const event = store.auditLog.find((e) => e.eventType === "CONSTITUTIONAL_LINEAGE_GENERATED");
    assert.ok(event, "CONSTITUTIONAL_LINEAGE_GENERATED must be emitted");
  });
});

// ─── Canonical Representation Tests ───────────────────────────────────────────

describe("Canonical Representation", () => {
  test("generates correct canonical representation with all memory types", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "document",
      title: "Project Brief", storageProvider: "s3",
      storageReference: "s3://bucket/brief.pdf",
      checksum: "sha256:brief", uploadedBy: user,
    });
    const artifactId = reg.data.id;

    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "decision", title: "Tech Stack", canonicalText: "Use Next.js and Supabase.", createdBy: user });
    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "risk", title: "Delivery Risk", canonicalText: "Team capacity may be insufficient in Q3.", createdBy: user });
    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "objective", title: "Launch Goal", canonicalText: "Launch MVP by end of Q2 2026.", summary: "Q2 launch target.", createdBy: user });
    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "constraint", title: "Budget Cap", canonicalText: "Maximum budget: $500K.", createdBy: user });
    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "evidence", title: "Board Minutes", canonicalText: "Board minutes from 2026-05-15 session.", createdBy: user });

    const result = store.generateCanonicalRepresentation({ artifactId, workspaceId: ws });

    assert.ok(result.ok);
    assert.equal(result.data.artifactId, artifactId);
    assert.equal(result.data.artifactType, "document");
    assert.equal(result.data.title, "Project Brief");
    assert.equal(result.data.decisions.length, 1);
    assert.equal(result.data.risks.length, 1);
    assert.equal(result.data.objectives.length, 1);
    assert.equal(result.data.constraints.length, 1);
    assert.ok(result.data.generatedAt);
    assert.equal(result.data.metadata.storageProvider, "s3");
    assert.equal(result.data.metadata.checksum, "sha256:brief");
  });

  test("canonical representation includes metadata with storage reference and checksum", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "spreadsheet",
      title: "Budget Tracker", storageProvider: "azure_blob",
      storageReference: "azure://container/budget.xlsx",
      checksum: "sha256:budget-xlsx", uploadedBy: user,
    });

    const result = store.generateCanonicalRepresentation({ artifactId: reg.data.id, workspaceId: ws });

    assert.ok(result.ok);
    assert.equal(result.data.metadata.storageProvider, "azure_blob");
    assert.equal(result.data.metadata.storageReference, "azure://container/budget.xlsx");
    assert.equal(result.data.metadata.checksum, "sha256:budget-xlsx");
  });

  test("amendment and ratification memory types map to decisions bucket", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "document",
      title: "Amendment Doc", storageProvider: "dropbox",
      storageReference: "dropbox://amendments.pdf",
      checksum: "sha256:amendments", uploadedBy: user,
    });
    const artifactId = reg.data.id;

    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "amendment", title: "Scope Amendment", canonicalText: "Phase 3 scope extended by 4 weeks.", createdBy: user });
    store.createMemoryRecord({ workspaceId: ws, artifactId, memoryType: "ratification", title: "Charter Ratification", canonicalText: "Constitution ratified by all stakeholders.", createdBy: user });

    const result = store.generateCanonicalRepresentation({ artifactId, workspaceId: ws });

    assert.ok(result.ok);
    assert.equal(result.data.decisions.length, 2, "amendment and ratification must map to decisions bucket");
  });
});

// ─── Workspace Isolation Tests ────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("workspace A cannot access artifacts from workspace B", () => {
    const store = createVaultStore();
    const wsA = uuid();
    const wsB = uuid();
    const user = uuid();

    const regA = store.registerArtifact({
      workspaceId: wsA, artifactType: "document",
      title: "Workspace A Doc", storageProvider: "s3",
      storageReference: "s3://ws-a/doc.pdf",
      checksum: "sha256:ws-a-doc", uploadedBy: user,
    });

    // Workspace B tries to access workspace A's artifact via memory record
    const result = store.createMemoryRecord({
      workspaceId: wsB,
      artifactId: regA.data.id,  // belongs to wsA
      memoryType: "decision",
      title: "Cross-Workspace Access",
      canonicalText: "Should not be accessible.",
      createdBy: user,
    });

    assert.ok(!result.ok, "Cross-workspace artifact access must be denied");
    assert.equal(result.failureClass, "not_found");
  });

  test("workspace B cannot access memory lineage from workspace A", () => {
    const store = createVaultStore();
    const wsA = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: wsA, artifactType: "transcript",
      title: "WS-A Meeting", storageProvider: "local",
      storageReference: "/meetings/ws-a.txt",
      checksum: "sha256:meeting-a", uploadedBy: user,
    });
    const mem = store.createMemoryRecord({
      workspaceId: wsA, artifactId: reg.data.id,
      memoryType: "authority", title: "Authority Note",
      canonicalText: "PM has full authority over budget.", createdBy: user,
    });

    const lineage = store.getMemoryLineage({
      memoryRecordId: mem.data.id,
      workspaceId: uuid(),  // different workspace
    });

    assert.ok(!lineage.ok);
    assert.equal(lineage.failureClass, "not_found");
  });
});

// ─── Audit Events Tests ───────────────────────────────────────────────────────

describe("Audit Events", () => {
  const ALL_VAULT_EVENTS = [
    "CONSTITUTIONAL_ARTIFACT_REGISTERED",
    "CONSTITUTIONAL_ARTIFACT_UPDATED",
    "CONSTITUTIONAL_ARTIFACT_ARCHIVED",
    "CONSTITUTIONAL_MEMORY_CREATED",
    "CONSTITUTIONAL_MEMORY_UPDATED",
    "CONSTITUTIONAL_MEMORY_LINKED",
    "CONSTITUTIONAL_LINEAGE_GENERATED",
  ];

  test("all 7 vault audit events are emitted through a complete lifecycle", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "document",
      title: "Full Lifecycle Doc", storageProvider: "s3",
      storageReference: "s3://bucket/full-lifecycle.pdf",
      checksum: "sha256:full", uploadedBy: user,
    });
    const artifactId = reg.data.id;

    store.updateArtifact({ artifactId, workspaceId: ws, actorId: user, title: "Updated Title" });

    const mem = store.createMemoryRecord({
      workspaceId: ws, artifactId,
      memoryType: "decision", title: "Key Decision",
      canonicalText: "Adopted Agile governance framework.",
      createdBy: user,
    });
    const memoryRecordId = mem.data.id;

    store.updateMemoryRecord({ memoryRecordId, workspaceId: ws, actorId: user, summary: "Agile adopted." });
    store.linkMemoryToEntity({ workspaceId: ws, memoryRecordId, entityType: "constitution", entityId: uuid(), actorId: user });
    store.getMemoryLineage({ memoryRecordId, workspaceId: ws });
    store.archiveArtifact({ artifactId, workspaceId: ws, actorId: user });

    const emittedTypes = new Set(store.auditLog.map((e) => e.eventType));
    for (const expected of ALL_VAULT_EVENTS) {
      assert.ok(emittedTypes.has(expected), `Expected audit event '${expected}' to be emitted`);
    }
  });

  test("audit events contain correct metadata", () => {
    const store = createVaultStore();
    const ws = uuid();
    const user = uuid();

    const reg = store.registerArtifact({
      workspaceId: ws, artifactType: "email",
      title: "Approval Email", storageProvider: "custom",
      storageReference: "email://msg-id-001",
      checksum: "sha256:email-approval", uploadedBy: user,
    });

    const event = store.auditLog.find((e) => e.eventType === "CONSTITUTIONAL_ARTIFACT_REGISTERED");
    assert.ok(event);
    assert.equal(event.payload.workspaceId, ws);
    assert.equal(event.payload.artifactId, reg.data.id);
    assert.ok(event.at, "Event must have timestamp");
  });
});

// ─── Platform Events Type Tests ───────────────────────────────────────────────

describe("Platform Events — Vault types registered", () => {
  const platformEventsTypes = readFileSync("src/lib/platform-events/types.ts", "utf8");

  test("ConstitutionalVaultEventType is defined in platform events", () => {
    assert.match(platformEventsTypes, /ConstitutionalVaultEventType/);
  });

  test("all vault event literals are present", () => {
    const VAULT_EVENTS = [
      "CONSTITUTIONAL_ARTIFACT_REGISTERED",
      "CONSTITUTIONAL_ARTIFACT_UPDATED",
      "CONSTITUTIONAL_ARTIFACT_ARCHIVED",
      "CONSTITUTIONAL_MEMORY_CREATED",
      "CONSTITUTIONAL_MEMORY_UPDATED",
      "CONSTITUTIONAL_MEMORY_LINKED",
      "CONSTITUTIONAL_LINEAGE_GENERATED",
    ];
    for (const event of VAULT_EVENTS) {
      assert.match(platformEventsTypes, new RegExp(event), `Event type '${event}' must be in platform events types`);
    }
  });

  test("ConstitutionalVaultEventType is included in PlatformEventType union", () => {
    assert.match(platformEventsTypes, /ConstitutionalVaultEventType/);
    const unionBlock = platformEventsTypes.match(/export type PlatformEventType[\s\S]*?;/)?.[0] ?? "";
    assert.match(unionBlock, /ConstitutionalVaultEventType/);
  });
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

describe("Database Contract — Vault rows registered", () => {
  const contract = readFileSync("src/lib/db/database-contract.ts", "utf8");

  test("ConstitutionalArtifactRow is defined", () => {
    assert.match(contract, /ConstitutionalArtifactRow/);
    assert.match(contract, /artifact_type: ArtifactType/);
    assert.match(contract, /storage_provider: StorageProvider/);
    assert.match(contract, /checksum: string/);
    assert.match(contract, /deleted_at: string \| null/);
  });

  test("ConstitutionalMemoryRecordRow is defined", () => {
    assert.match(contract, /ConstitutionalMemoryRecordRow/);
    assert.match(contract, /memory_type: MemoryType/);
    assert.match(contract, /canonical_text: string/);
  });

  test("ConstitutionalMemoryLinkRow is defined", () => {
    assert.match(contract, /ConstitutionalMemoryLinkRow/);
    assert.match(contract, /entity_type: MemoryLinkEntityType/);
    assert.match(contract, /entity_id: string/);
  });

  test("all three SELECTABLE_COLUMNS constants are present", () => {
    assert.match(contract, /CONSTITUTIONAL_ARTIFACT_SELECTABLE_COLUMNS/);
    assert.match(contract, /CONSTITUTIONAL_MEMORY_RECORD_SELECTABLE_COLUMNS/);
    assert.match(contract, /CONSTITUTIONAL_MEMORY_LINK_SELECTABLE_COLUMNS/);
  });
});
