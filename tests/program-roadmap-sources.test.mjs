import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

assert.ok(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid()),
  "uuid() must produce a valid v4 UUID"
);

function validUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function validation(error) { return { ok: false, error, failureClass: "validation_failed" }; }
function failed(error, failureClass = "persistence_failed") { return { ok: false, error, failureClass }; }

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_TYPES = ["TEXT", "MARKDOWN", "CLAUDE_PLAN", "AOC_PLAN", "INFRASTRUCTURE_PLAN", "CUSTOM"];
const SOURCE_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"];
const RAW_TEXT_MAX = 500_000;
const TITLE_MAX = 200;

// ─── In-memory Store ─────────────────────────────────────────────────────────

function createRoadmapSourceStore() {
  const sources = new Map();
  const events = [];

  function emit(source, eventType, actorId, extra = {}) {
    events.push({ eventType, sourceId: source.id, programId: source.program_id, actorId, status: source.status, version: source.version, ...extra });
    return { ok: true, data: source };
  }

  function nextVersion(programId, workspaceId) {
    const existing = [...sources.values()].filter(
      (s) => s.program_id === programId && s.workspace_id === workspaceId
    );
    const maxVersion = existing.reduce((max, s) => Math.max(max, s.version), 0);
    return maxVersion + 1;
  }

  function supersedePrevious(programId, workspaceId, excludeId) {
    for (const [id, s] of sources) {
      if (s.program_id === programId && s.workspace_id === workspaceId && s.status === "ACTIVE" && id !== excludeId && !s.deleted_at) {
        sources.set(id, { ...s, status: "SUPERSEDED", updated_at: new Date().toISOString() });
      }
    }
  }

  function create(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.programId)) return validation("programId must be a UUID.");
    if (!required(input.rawText)) return validation("rawText is required.");
    if (input.rawText.length > RAW_TEXT_MAX) return validation(`rawText must be ${RAW_TEXT_MAX} characters or fewer.`);
    if (!SOURCE_TYPES.includes(input.sourceType)) return validation(`sourceType must be one of: ${SOURCE_TYPES.join(", ")}.`);
    if (input.title != null) {
      if (!required(input.title)) return validation("title cannot be empty.");
      if (input.title.length > TITLE_MAX) return validation(`title must be ${TITLE_MAX} characters or fewer.`);
    }
    const requestedStatus = input.status === "ACTIVE" ? "ACTIVE" : "DRAFT";
    const version = nextVersion(input.programId, input.workspaceId);
    const now = new Date().toISOString();
    const source = {
      id: uuid(),
      workspace_id: input.workspaceId,
      program_id: input.programId,
      raw_text: input.rawText,
      source_type: input.sourceType,
      title: input.title ?? null,
      version,
      status: requestedStatus,
      metadata: input.metadata ?? null,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    sources.set(source.id, source);
    if (requestedStatus === "ACTIVE") {
      supersedePrevious(input.programId, input.workspaceId, source.id);
      emit(source, "PROGRAM_ROADMAP_SOURCE_ACTIVATED", input.createdBy ?? null);
    }
    return emit(source, "PROGRAM_ROADMAP_SOURCE_CREATED", input.createdBy ?? null);
  }

  function findById(id, workspaceId) {
    const s = sources.get(id);
    if (!s || s.deleted_at || s.workspace_id !== workspaceId) return failed("Roadmap source not found.", "not_found");
    return { ok: true, data: s };
  }

  function update(sourceId, workspaceId, input) {
    if (!validUuid(sourceId)) return validation("sourceId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

    const current = findById(sourceId, workspaceId);
    if (!current.ok) return current;

    const patch = {};
    if (input.rawText !== undefined) {
      if (!required(input.rawText)) return validation("rawText cannot be empty.");
      if (input.rawText.length > RAW_TEXT_MAX) return validation(`rawText must be ${RAW_TEXT_MAX} characters or fewer.`);
      patch.raw_text = input.rawText;
    }
    if (input.title !== undefined) {
      if (input.title !== null) {
        if (!required(input.title)) return validation("title cannot be empty.");
        if (input.title.length > TITLE_MAX) return validation(`title must be ${TITLE_MAX} characters or fewer.`);
      }
      patch.title = input.title;
    }
    if (input.status !== undefined) {
      if (!SOURCE_STATUSES.includes(input.status)) return validation(`status must be one of: ${SOURCE_STATUSES.join(", ")}.`);
      if (input.status === "SUPERSEDED") return validation("status SUPERSEDED is managed by the system.");
      if (input.status === "ARCHIVED") return validation("Use DELETE to archive a roadmap source.");
      patch.status = input.status;
    }
    if (input.metadata !== undefined) patch.metadata = input.metadata;

    if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

    const previousStatus = current.data.status;
    const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
    sources.set(sourceId, updated);

    const becameActive = input.status === "ACTIVE" && previousStatus !== "ACTIVE";
    if (becameActive) {
      supersedePrevious(current.data.program_id, workspaceId, sourceId);
      emit(updated, "PROGRAM_ROADMAP_SOURCE_ACTIVATED", input.actorId);
    }

    return emit(updated, "PROGRAM_ROADMAP_SOURCE_UPDATED", input.actorId, { previousStatus });
  }

  function archive(sourceId, workspaceId, actorId) {
    if (!validUuid(sourceId)) return validation("sourceId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(actorId)) return validation("actorId must be a UUID.");
    const current = findById(sourceId, workspaceId);
    if (!current.ok) return current;
    const now = new Date().toISOString();
    const archived = { ...current.data, status: "ARCHIVED", deleted_at: now, updated_at: now };
    sources.set(sourceId, archived);
    return emit(archived, "PROGRAM_ROADMAP_SOURCE_ARCHIVED", actorId);
  }

  function list(programId, workspaceId) {
    const result = [...sources.values()].filter(
      (s) => s.program_id === programId && s.workspace_id === workspaceId && !s.deleted_at
    );
    return { ok: true, data: result };
  }

  function getActive(programId, workspaceId) {
    const active = [...sources.values()].find(
      (s) => s.program_id === programId && s.workspace_id === workspaceId && s.status === "ACTIVE" && !s.deleted_at
    );
    return { ok: true, data: active ?? null };
  }

  return { create, findById, update, archive, list, getActive, events, sources };
}

// ─── Tests: Create ────────────────────────────────────────────────────────────

describe("ProgramRoadmapSource — create", () => {
  test("creates roadmap source correctly", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const result = store.create({ workspaceId, programId, rawText: "EPIC 1\nSprint 1\n...", sourceType: "TEXT" });
    assert.ok(result.ok);
    assert.equal(result.data.workspace_id, workspaceId);
    assert.equal(result.data.program_id, programId);
    assert.equal(result.data.raw_text, "EPIC 1\nSprint 1\n...");
    assert.equal(result.data.source_type, "TEXT");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.deleted_at, null);
  });

  test("fails if rawText is empty", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "", sourceType: "TEXT" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails if rawText is whitespace only", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "   ", sourceType: "TEXT" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails if rawText exceeds max length", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "x".repeat(500_001), sourceType: "TEXT" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("preserves newlines in rawText exactly", () => {
    const store = createRoadmapSourceStore();
    const rawText = "Line 1\nLine 2\r\nLine 3\n\nLine 5";
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText, sourceType: "TEXT" });
    assert.ok(result.ok);
    assert.equal(result.data.raw_text, rawText);
  });

  test("assigns version 1 to the first source of a program", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "v1", sourceType: "TEXT" });
    assert.ok(result.ok);
    assert.equal(result.data.version, 1);
  });

  test("assigns incremental version for subsequent sources of the same program", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const r1 = store.create({ workspaceId, programId, rawText: "v1", sourceType: "TEXT" });
    const r2 = store.create({ workspaceId, programId, rawText: "v2", sourceType: "TEXT" });
    const r3 = store.create({ workspaceId, programId, rawText: "v3", sourceType: "TEXT" });
    assert.ok(r1.ok && r2.ok && r3.ok);
    assert.equal(r1.data.version, 1);
    assert.equal(r2.data.version, 2);
    assert.equal(r3.data.version, 3);
  });

  test("versioning is independent per program", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programA = uuid();
    const programB = uuid();
    store.create({ workspaceId, programId: programA, rawText: "A1", sourceType: "TEXT" });
    store.create({ workspaceId, programId: programA, rawText: "A2", sourceType: "TEXT" });
    const bResult = store.create({ workspaceId, programId: programB, rawText: "B1", sourceType: "TEXT" });
    assert.ok(bResult.ok);
    assert.equal(bResult.data.version, 1);
  });

  test("creates source with DRAFT status by default", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT" });
    assert.ok(result.ok);
    assert.equal(result.data.status, "DRAFT");
  });

  test("creates source with ACTIVE status when requested", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT", status: "ACTIVE" });
    assert.ok(result.ok);
    assert.equal(result.data.status, "ACTIVE");
  });

  test("when creating ACTIVE, marks previous ACTIVE source as SUPERSEDED", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const first = store.create({ workspaceId, programId, rawText: "v1", sourceType: "TEXT", status: "ACTIVE" });
    assert.ok(first.ok);
    assert.equal(first.data.status, "ACTIVE");

    const second = store.create({ workspaceId, programId, rawText: "v2", sourceType: "TEXT", status: "ACTIVE" });
    assert.ok(second.ok);
    assert.equal(second.data.status, "ACTIVE");

    const superseded = store.sources.get(first.data.id);
    assert.equal(superseded.status, "SUPERSEDED");
  });

  test("emits PROGRAM_ROADMAP_SOURCE_CREATED event", () => {
    const store = createRoadmapSourceStore();
    store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const created = store.events.find((e) => e.eventType === "PROGRAM_ROADMAP_SOURCE_CREATED");
    assert.ok(created, "PROGRAM_ROADMAP_SOURCE_CREATED event must be emitted");
  });

  test("emits PROGRAM_ROADMAP_SOURCE_ACTIVATED event when creating ACTIVE source", () => {
    const store = createRoadmapSourceStore();
    store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT", status: "ACTIVE" });
    const activated = store.events.find((e) => e.eventType === "PROGRAM_ROADMAP_SOURCE_ACTIVATED");
    assert.ok(activated, "PROGRAM_ROADMAP_SOURCE_ACTIVATED event must be emitted");
  });

  test("fails with invalid sourceType", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "INVALID" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with invalid workspaceId", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: "not-a-uuid", programId: uuid(), rawText: "text", sourceType: "TEXT" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with invalid programId", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: "bad", rawText: "text", sourceType: "TEXT" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("accepts all valid sourceTypes", () => {
    const store = createRoadmapSourceStore();
    for (const sourceType of SOURCE_TYPES) {
      const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType });
      assert.ok(result.ok, `sourceType ${sourceType} should be valid`);
    }
  });

  test("optional title stored when provided", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT", title: "My Plan" });
    assert.ok(result.ok);
    assert.equal(result.data.title, "My Plan");
  });

  test("title is null when not provided", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT" });
    assert.ok(result.ok);
    assert.equal(result.data.title, null);
  });

  test("fails if title exceeds 200 characters", () => {
    const store = createRoadmapSourceStore();
    const result = store.create({ workspaceId: uuid(), programId: uuid(), rawText: "text", sourceType: "TEXT", title: "x".repeat(201) });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });
});

// ─── Tests: Update ────────────────────────────────────────────────────────────

describe("ProgramRoadmapSource — update", () => {
  test("updates rawText preserving format", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const { data: source } = store.create({ workspaceId, programId, rawText: "original\ntext", sourceType: "TEXT" });
    const newText = "updated\ntext\n\nwith blank line";
    const result = store.update(source.id, workspaceId, { rawText: newText, actorId: uuid() });
    assert.ok(result.ok);
    assert.equal(result.data.raw_text, newText);
  });

  test("emits PROGRAM_ROADMAP_SOURCE_UPDATED event", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    store.update(source.id, workspaceId, { title: "New Title", actorId: uuid() });
    const updated = store.events.find((e) => e.eventType === "PROGRAM_ROADMAP_SOURCE_UPDATED");
    assert.ok(updated);
  });

  test("activates source and supersedes other active sources", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const r1 = store.create({ workspaceId, programId, rawText: "v1", sourceType: "TEXT", status: "ACTIVE" });
    const r2 = store.create({ workspaceId, programId, rawText: "v2", sourceType: "TEXT" });
    assert.ok(r1.ok && r2.ok);

    store.update(r2.data.id, workspaceId, { status: "ACTIVE", actorId: uuid() });

    assert.equal(store.sources.get(r1.data.id).status, "SUPERSEDED");
    assert.equal(store.sources.get(r2.data.id).status, "ACTIVE");
  });

  test("emits PROGRAM_ROADMAP_SOURCE_ACTIVATED when activating", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    store.update(source.id, workspaceId, { status: "ACTIVE", actorId: uuid() });
    const activated = store.events.find((e) => e.eventType === "PROGRAM_ROADMAP_SOURCE_ACTIVATED");
    assert.ok(activated);
  });

  test("cannot update archived source (soft-deleted, returns not_found)", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    store.archive(source.id, workspaceId, uuid());
    const result = store.update(source.id, workspaceId, { title: "new", actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("cannot set status to SUPERSEDED directly", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const result = store.update(source.id, workspaceId, { status: "SUPERSEDED", actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("cannot set status to ARCHIVED via update", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const result = store.update(source.id, workspaceId, { status: "ARCHIVED", actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("no-op update returns current data", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const eventsBefore = store.events.length;
    const result = store.update(source.id, workspaceId, { actorId: uuid() });
    assert.ok(result.ok);
    assert.equal(result.data.id, source.id);
    assert.equal(store.events.length, eventsBefore);
  });
});

// ─── Tests: Archive ───────────────────────────────────────────────────────────

describe("ProgramRoadmapSource — archive", () => {
  test("archives source with soft delete", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const result = store.archive(source.id, workspaceId, uuid());
    assert.ok(result.ok);
    assert.equal(result.data.status, "ARCHIVED");
    assert.ok(result.data.deleted_at !== null);
  });

  test("archived source is excluded from list", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const { data: source } = store.create({ workspaceId, programId, rawText: "text", sourceType: "TEXT" });
    store.archive(source.id, workspaceId, uuid());
    const result = store.list(programId, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });

  test("archived source is not found by findById", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    store.archive(source.id, workspaceId, uuid());
    const result = store.findById(source.id, workspaceId);
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("emits PROGRAM_ROADMAP_SOURCE_ARCHIVED event", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const { data: source } = store.create({ workspaceId, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    store.archive(source.id, workspaceId, uuid());
    const archived = store.events.find((e) => e.eventType === "PROGRAM_ROADMAP_SOURCE_ARCHIVED");
    assert.ok(archived);
  });

  test("fails when archiving non-existent source", () => {
    const store = createRoadmapSourceStore();
    const result = store.archive(uuid(), uuid(), uuid());
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });
});

// ─── Tests: Query ─────────────────────────────────────────────────────────────

describe("ProgramRoadmapSource — getActive", () => {
  test("returns active source for program", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const { data: source } = store.create({ workspaceId, programId, rawText: "text", sourceType: "TEXT", status: "ACTIVE" });
    const result = store.getActive(programId, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data?.id, source.id);
  });

  test("returns null if no active source exists", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    store.create({ workspaceId, programId, rawText: "text", sourceType: "TEXT" });
    const result = store.getActive(programId, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data, null);
  });

  test("returns null after active source is archived", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    const { data: source } = store.create({ workspaceId, programId, rawText: "text", sourceType: "TEXT", status: "ACTIVE" });
    store.archive(source.id, workspaceId, uuid());
    const result = store.getActive(programId, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data, null);
  });
});

// ─── Tests: Workspace Isolation ───────────────────────────────────────────────

describe("ProgramRoadmapSource — workspace isolation", () => {
  test("cannot access source from different workspace", () => {
    const store = createRoadmapSourceStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const { data: source } = store.create({ workspaceId: workspaceA, programId: uuid(), rawText: "text", sourceType: "TEXT" });
    const result = store.findById(source.id, workspaceB);
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("list only returns sources from the given workspace/program pair", () => {
    const store = createRoadmapSourceStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const programId = uuid();
    store.create({ workspaceId: workspaceA, programId, rawText: "A text", sourceType: "TEXT" });
    store.create({ workspaceId: workspaceB, programId, rawText: "B text", sourceType: "TEXT" });
    const resultA = store.list(programId, workspaceA);
    assert.ok(resultA.ok);
    assert.equal(resultA.data.length, 1);
    assert.equal(resultA.data[0].workspace_id, workspaceA);
  });

  test("getActive only returns sources from correct workspace", () => {
    const store = createRoadmapSourceStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const programId = uuid();
    store.create({ workspaceId: workspaceA, programId, rawText: "A text", sourceType: "TEXT", status: "ACTIVE" });
    const result = store.getActive(programId, workspaceB);
    assert.ok(result.ok);
    assert.equal(result.data, null);
  });
});

// ─── Tests: List ──────────────────────────────────────────────────────────────

describe("ProgramRoadmapSource — list", () => {
  test("lists multiple sources for a program", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programId = uuid();
    store.create({ workspaceId, programId, rawText: "v1", sourceType: "TEXT" });
    store.create({ workspaceId, programId, rawText: "v2", sourceType: "MARKDOWN" });
    const result = store.list(programId, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.length, 2);
  });

  test("list excludes sources from other programs", () => {
    const store = createRoadmapSourceStore();
    const workspaceId = uuid();
    const programA = uuid();
    const programB = uuid();
    store.create({ workspaceId, programId: programA, rawText: "A", sourceType: "TEXT" });
    store.create({ workspaceId, programId: programB, rawText: "B", sourceType: "TEXT" });
    const result = store.list(programA, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].program_id, programA);
  });

  test("returns empty list when no sources exist", () => {
    const store = createRoadmapSourceStore();
    const result = store.list(uuid(), uuid());
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });
});
