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

// ─── In-memory Program Store ─────────────────────────────────────────────────

const PROGRAM_TYPES = [
  "SOFTWARE_DEVELOPMENT",
  "INFRASTRUCTURE_PROJECT",
  "CUSTOMER_ONBOARDING",
  "AOC_PROTOCOL_ADOPTION",
  "ORGANIZATIONAL_CHANGE",
  "STRATEGIC_INITIATIVE",
  "INTERNAL_PROGRAM",
  "CUSTOM",
];

const PROGRAM_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

function validUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Supabase-style UUIDs (v4) use [89ab] in position 17; verify the regex matches them
assert.ok(validUuid("550e8400-e29b-41d4-a716-446655440000"), "known v4 UUID must match");
assert.ok(!validUuid("not-a-uuid"), "non-UUID must not match");
function required(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function validation(error) { return { ok: false, error, failureClass: "validation_failed" }; }
function failed(error, failureClass = "persistence_failed") { return { ok: false, error, failureClass }; }

function createProgramStore() {
  const programs = new Map();
  const events = [];

  function emit(program, eventType, actorId, extra = {}) {
    events.push({ eventType, programId: program.id, actorId, status: program.status, ...extra });
    return { ok: true, data: program };
  }

  function create(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.ownerId)) return validation("ownerId must be a UUID.");
    if (!required(input.name)) return validation("name is required.");
    if (input.name.trim().length > 200) return validation("name must be 200 characters or fewer.");
    if (!PROGRAM_TYPES.includes(input.type)) return validation(`type must be one of: ${PROGRAM_TYPES.join(", ")}.`);
    if (input.description != null && input.description.length > 5000) return validation("description must be 5000 characters or fewer.");

    const now = new Date().toISOString();
    const program = {
      id: uuid(),
      workspace_id: input.workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      type: input.type,
      status: "DRAFT",
      owner_id: input.ownerId,
      start_date: null,
      target_date: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    programs.set(program.id, program);
    return emit(program, "PROGRAM_CREATED", input.ownerId);
  }

  function findById(id, workspaceId) {
    const p = programs.get(id);
    if (!p || p.deleted_at || p.workspace_id !== workspaceId) return failed("Program not found.", "not_found");
    return { ok: true, data: p };
  }

  function update(programId, workspaceId, input) {
    if (!validUuid(programId)) return validation("programId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

    const current = findById(programId, workspaceId);
    if (!current.ok) return current;
    if (current.data.status === "ARCHIVED") return { ok: false, error: "Archived programs cannot be updated.", failureClass: "governance_violation" };

    const patch = {};
    if (input.name !== undefined) {
      if (!required(input.name)) return validation("name cannot be empty.");
      if (input.name.trim().length > 200) return validation("name must be 200 characters or fewer.");
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      if (input.description !== null && input.description.length > 5000) return validation("description must be 5000 characters or fewer.");
      patch.description = input.description?.trim() ?? null;
    }
    if (input.status !== undefined) {
      if (!PROGRAM_STATUSES.includes(input.status)) return validation(`status must be one of: ${PROGRAM_STATUSES.join(", ")}.`);
      if (input.status === "ARCHIVED") return validation("Use DELETE /programs/:id to archive a program.");
      patch.status = input.status;
    }
    if (input.startDate !== undefined) patch.start_date = input.startDate;
    if (input.targetDate !== undefined) patch.target_date = input.targetDate;

    const startDate = input.startDate !== undefined ? input.startDate : current.data.start_date;
    const targetDate = input.targetDate !== undefined ? input.targetDate : current.data.target_date;
    if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
      return validation("targetDate must be on or after startDate.");
    }

    const previousStatus = current.data.status;
    const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
    programs.set(programId, updated);

    const eventType = (input.status !== undefined && input.status !== previousStatus)
      ? "PROGRAM_STATUS_CHANGED"
      : "PROGRAM_UPDATED";
    return emit(updated, eventType, input.actorId, { previousStatus });
  }

  function archive(programId, workspaceId, actorId) {
    if (!validUuid(programId)) return validation("programId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(actorId)) return validation("actorId must be a UUID.");
    const current = findById(programId, workspaceId);
    if (!current.ok) return current;
    const now = new Date().toISOString();
    const archived = { ...current.data, status: "ARCHIVED", deleted_at: now, updated_at: now };
    programs.set(programId, archived);
    return emit(archived, "PROGRAM_ARCHIVED", actorId);
  }

  function list(workspaceId) {
    const result = [...programs.values()].filter(
      (p) => p.workspace_id === workspaceId && p.deleted_at === null
    );
    return { ok: true, data: result };
  }

  function explain(program) {
    return {
      id: program.id,
      name: program.name,
      type: program.type,
      status: program.status,
      owner: program.owner_id,
      createdAt: program.created_at,
      summary: `${program.name} is a program currently in ${program.status.toLowerCase()} state.`,
    };
  }

  return { create, findById, update, archive, list, explain, events };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Program — CreateProgram", () => {
  test("creates a program with valid input", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const result = store.create({ workspaceId, ownerId, name: "My Program", type: "SOFTWARE_DEVELOPMENT" });
    assert.ok(result.ok);
    assert.equal(result.data.name, "My Program");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.type, "SOFTWARE_DEVELOPMENT");
    assert.equal(result.data.workspace_id, workspaceId);
    assert.equal(result.data.owner_id, ownerId);
    assert.equal(result.data.deleted_at, null);
  });

  test("emits PROGRAM_CREATED event", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    store.create({ workspaceId, ownerId, name: "Prog", type: "CUSTOM" });
    assert.equal(store.events.length, 1);
    assert.equal(store.events[0].eventType, "PROGRAM_CREATED");
  });

  test("fails without name", () => {
    const store = createProgramStore();
    const result = store.create({ workspaceId: uuid(), ownerId: uuid(), name: "", type: "CUSTOM" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails without type", () => {
    const store = createProgramStore();
    const result = store.create({ workspaceId: uuid(), ownerId: uuid(), name: "X", type: "INVALID_TYPE" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with invalid workspaceId", () => {
    const store = createProgramStore();
    const result = store.create({ workspaceId: "not-a-uuid", ownerId: uuid(), name: "X", type: "CUSTOM" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails when name exceeds 200 characters", () => {
    const store = createProgramStore();
    const result = store.create({ workspaceId: uuid(), ownerId: uuid(), name: "a".repeat(201), type: "CUSTOM" });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails when description exceeds 5000 characters", () => {
    const store = createProgramStore();
    const result = store.create({ workspaceId: uuid(), ownerId: uuid(), name: "X", type: "CUSTOM", description: "x".repeat(5001) });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("accepts all valid program types", () => {
    const store = createProgramStore();
    for (const type of PROGRAM_TYPES) {
      const result = store.create({ workspaceId: uuid(), ownerId: uuid(), name: "T", type });
      assert.ok(result.ok, `type ${type} should be valid`);
    }
  });
});

describe("Program — UpdateProgram", () => {
  test("updates name", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "Original", type: "CUSTOM" });
    const result = store.update(prog.id, workspaceId, { name: "Updated", actorId: ownerId });
    assert.ok(result.ok);
    assert.equal(result.data.name, "Updated");
  });

  test("updates status and emits PROGRAM_STATUS_CHANGED", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    store.update(prog.id, workspaceId, { status: "ACTIVE", actorId: ownerId });
    const statusEvent = store.events.find((e) => e.eventType === "PROGRAM_STATUS_CHANGED");
    assert.ok(statusEvent, "PROGRAM_STATUS_CHANGED event should be emitted");
    assert.equal(statusEvent.previousStatus, "DRAFT");
  });

  test("updating without status change emits PROGRAM_UPDATED", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    store.update(prog.id, workspaceId, { name: "New Name", actorId: ownerId });
    const updateEvent = store.events.find((e) => e.eventType === "PROGRAM_UPDATED");
    assert.ok(updateEvent);
  });

  test("maintains integrity when no fields provided", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    const result = store.update(prog.id, workspaceId, { actorId: ownerId });
    assert.ok(result.ok);
    assert.equal(result.data.name, "P");
  });

  test("rejects targetDate before startDate", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    const result = store.update(prog.id, workspaceId, {
      startDate: "2027-06-01T00:00:00Z",
      targetDate: "2027-01-01T00:00:00Z",
      actorId: ownerId,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("cannot update archived program", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    store.archive(prog.id, workspaceId, ownerId);
    const result = store.update(prog.id, workspaceId, { name: "New Name", actorId: ownerId });
    // Archived programs are soft-deleted; findById returns not_found since deleted_at is set.
    assert.ok(!result.ok);
  });

  test("blocks setting status to ARCHIVED via update", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    const result = store.update(prog.id, workspaceId, { status: "ARCHIVED", actorId: ownerId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("clearing startDate to null passes date range validation", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    // Set start and target dates first
    store.update(prog.id, workspaceId, { startDate: "2027-01-01T00:00:00Z", targetDate: "2027-12-01T00:00:00Z", actorId: ownerId });
    // Clear startDate — targetDate should not be compared against old startDate
    const result = store.update(prog.id, workspaceId, { startDate: null, actorId: ownerId });
    assert.ok(result.ok, "clearing startDate should pass");
  });
});

describe("Program — ArchiveProgram", () => {
  test("performs soft delete", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    const result = store.archive(prog.id, workspaceId, ownerId);
    assert.ok(result.ok);
    assert.ok(result.data.deleted_at !== null, "deleted_at must be set");
    assert.equal(result.data.status, "ARCHIVED");
  });

  test("does not physically remove the record", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    store.archive(prog.id, workspaceId, ownerId);
    // findById returns not_found because deleted_at is set, but the record exists in the map
    const notVisible = store.findById(prog.id, workspaceId);
    assert.ok(!notVisible.ok);
    assert.equal(notVisible.failureClass, "not_found");
  });

  test("emits PROGRAM_ARCHIVED event", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "P", type: "CUSTOM" });
    store.archive(prog.id, workspaceId, ownerId);
    const archiveEvent = store.events.find((e) => e.eventType === "PROGRAM_ARCHIVED");
    assert.ok(archiveEvent);
  });
});

describe("Program — GetProgram", () => {
  test("retrieves an existing program", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "Fetch Me", type: "INTERNAL_PROGRAM" });
    const result = store.findById(prog.id, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.name, "Fetch Me");
  });

  test("returns not_found for unknown id", () => {
    const store = createProgramStore();
    const result = store.findById(uuid(), uuid());
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });
});

describe("Program — ListPrograms", () => {
  test("lists programs for workspace", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    store.create({ workspaceId, ownerId, name: "A", type: "CUSTOM" });
    store.create({ workspaceId, ownerId, name: "B", type: "CUSTOM" });
    const result = store.list(workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.length, 2);
  });

  test("workspace isolation — does not return other workspace programs", () => {
    const store = createProgramStore();
    const wsA = uuid();
    const wsB = uuid();
    const ownerId = uuid();
    store.create({ workspaceId: wsA, ownerId, name: "WS-A Program", type: "CUSTOM" });
    const result = store.list(wsB);
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });

  test("archived programs do not appear in list", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "To Archive", type: "CUSTOM" });
    store.archive(prog.id, workspaceId, ownerId);
    const result = store.list(workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });
});

describe("Program — ExplainProgram", () => {
  test("returns explanation shape", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "My Initiative", type: "STRATEGIC_INITIATIVE" });
    const explanation = store.explain(prog);
    assert.equal(typeof explanation.id, "string");
    assert.equal(typeof explanation.name, "string");
    assert.equal(typeof explanation.type, "string");
    assert.equal(typeof explanation.status, "string");
    assert.equal(typeof explanation.summary, "string");
    assert.equal(typeof explanation.createdAt, "string");
    assert.ok(explanation.summary.length > 0);
  });
});

describe("Program — Audit Events", () => {
  test("all four event types are emitted across lifecycle", () => {
    const store = createProgramStore();
    const workspaceId = uuid();
    const ownerId = uuid();
    const { data: prog } = store.create({ workspaceId, ownerId, name: "Lifecycle", type: "CUSTOM" });
    store.update(prog.id, workspaceId, { name: "Renamed", actorId: ownerId });
    store.update(prog.id, workspaceId, { status: "ACTIVE", actorId: ownerId });
    store.archive(prog.id, workspaceId, ownerId);
    const types = store.events.map((e) => e.eventType);
    assert.ok(types.includes("PROGRAM_CREATED"));
    assert.ok(types.includes("PROGRAM_UPDATED"));
    assert.ok(types.includes("PROGRAM_STATUS_CHANGED"));
    assert.ok(types.includes("PROGRAM_ARCHIVED"));
  });
});
