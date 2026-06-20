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

function validUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v) { return typeof v === "string" && v.trim().length > 0; }
function validation(error) { return { ok: false, error, failureClass: "validation_failed" }; }
function failed(error, failureClass = "persistence_failed") { return { ok: false, error, failureClass }; }

const PROGRAM_ITEM_STATUSES = ["DRAFT", "BACKLOG", "READY", "IN_PROGRESS", "IN_REVIEW", "DONE", "ARCHIVED"];
const PROGRAM_CARD_TYPES = ["EPIC", "SPRINT", "TASK", "PROMPT", "MILESTONE", "DELIVERABLE", "CUSTOM"];

// ─── In-memory Hierarchy Store ────────────────────────────────────────────────

function createHierarchyStore() {
  const programs = new Map();
  const epics = new Map();
  const sprints = new Map();
  const cards = new Map();
  const events = [];

  function emit(entityType, record, eventType, actorId, extra = {}) {
    events.push({ eventType, id: record.id, actorId, status: record.status, ...extra });
    return { ok: true, data: record };
  }

  // ── Programs (minimal, for tree tests) ──────────────────────────────────────
  function createProgram(input) {
    const now = new Date().toISOString();
    const program = { id: uuid(), workspace_id: input.workspaceId, name: input.name, status: "DRAFT", created_at: now, updated_at: now, deleted_at: null };
    programs.set(program.id, program);
    return { ok: true, data: program };
  }

  // ── Epics ────────────────────────────────────────────────────────────────────
  function createEpic(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.programId)) return validation("programId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    if (!required(input.title)) return validation("title is required.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    if (typeof input.number !== "number" || !Number.isInteger(input.number) || input.number <= 0) return validation("number must be a positive integer.");
    if (typeof input.orderIndex !== "number" || !Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    // Check unique number per program
    for (const e of epics.values()) {
      if (e.program_id === input.programId && e.number === input.number && !e.deleted_at) {
        return { ok: false, error: "Epic number must be unique per program.", failureClass: "persistence_failed" };
      }
    }
    const status = input.status ?? "DRAFT";
    if (!PROGRAM_ITEM_STATUSES.includes(status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
    const now = new Date().toISOString();
    const epic = {
      id: uuid(), workspace_id: input.workspaceId, program_id: input.programId,
      number: input.number, title: input.title.trim(),
      description: input.description?.trim() ?? null,
      status, order_index: input.orderIndex,
      created_at: now, updated_at: now, deleted_at: null,
    };
    epics.set(epic.id, epic);
    return emit("epic", epic, "PROGRAM_EPIC_CREATED", input.actorId);
  }

  function findEpicById(id, workspaceId) {
    const e = epics.get(id);
    if (!e || e.deleted_at || e.workspace_id !== workspaceId) return failed("Epic not found.", "not_found");
    return { ok: true, data: e };
  }

  function updateEpic(epicId, workspaceId, input) {
    if (!validUuid(epicId)) return validation("epicId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    const current = findEpicById(epicId, workspaceId);
    if (!current.ok) return current;
    const patch = {};
    if (input.title !== undefined) {
      if (!required(input.title)) return validation("title cannot be empty.");
      if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
      patch.title = input.title.trim();
    }
    if (input.description !== undefined) patch.description = input.description?.trim() ?? null;
    if (input.status !== undefined) {
      if (!PROGRAM_ITEM_STATUSES.includes(input.status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
      if (input.status === "ARCHIVED") return validation("Use DELETE to archive an epic.");
      patch.status = input.status;
    }
    if (input.orderIndex !== undefined) {
      if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
      patch.order_index = input.orderIndex;
    }
    if (Object.keys(patch).length === 0) return { ok: true, data: current.data };
    const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
    epics.set(epicId, updated);
    return emit("epic", updated, "PROGRAM_EPIC_UPDATED", input.actorId);
  }

  function archiveEpic(epicId, workspaceId, actorId) {
    if (!validUuid(epicId)) return validation("epicId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(actorId)) return validation("actorId must be a UUID.");
    const current = findEpicById(epicId, workspaceId);
    if (!current.ok) return current;
    const now = new Date().toISOString();
    const archived = { ...current.data, status: "ARCHIVED", deleted_at: now, updated_at: now };
    epics.set(epicId, archived);
    return emit("epic", archived, "PROGRAM_EPIC_ARCHIVED", actorId);
  }

  function listEpics(programId, workspaceId) {
    const result = [...epics.values()]
      .filter(e => e.program_id === programId && e.workspace_id === workspaceId && !e.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    return { ok: true, data: result };
  }

  // ── Sprints ──────────────────────────────────────────────────────────────────
  function createSprint(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.programId)) return validation("programId must be a UUID.");
    if (!validUuid(input.epicId)) return validation("epicId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    if (!required(input.title)) return validation("title is required.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    if (typeof input.number !== "number" || !Number.isInteger(input.number) || input.number <= 0) return validation("number must be a positive integer.");
    if (typeof input.orderIndex !== "number" || !Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    // Check epic exists
    const epicCheck = findEpicById(input.epicId, input.workspaceId);
    if (!epicCheck.ok) return { ok: false, error: "Epic not found.", failureClass: "not_found" };
    // Check unique number per program
    for (const s of sprints.values()) {
      if (s.program_id === input.programId && s.number === input.number && !s.deleted_at) {
        return { ok: false, error: "Sprint number must be unique per program.", failureClass: "persistence_failed" };
      }
    }
    const status = input.status ?? "DRAFT";
    if (!PROGRAM_ITEM_STATUSES.includes(status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
    const now = new Date().toISOString();
    const sprint = {
      id: uuid(), workspace_id: input.workspaceId, program_id: input.programId, epic_id: input.epicId,
      number: input.number, title: input.title.trim(),
      description: input.description?.trim() ?? null,
      objective: input.objective?.trim() ?? null,
      status, order_index: input.orderIndex,
      created_at: now, updated_at: now, deleted_at: null,
    };
    sprints.set(sprint.id, sprint);
    return emit("sprint", sprint, "PROGRAM_SPRINT_CREATED", input.actorId);
  }

  function findSprintById(id, workspaceId) {
    const s = sprints.get(id);
    if (!s || s.deleted_at || s.workspace_id !== workspaceId) return failed("Sprint not found.", "not_found");
    return { ok: true, data: s };
  }

  function updateSprint(sprintId, workspaceId, input) {
    if (!validUuid(sprintId)) return validation("sprintId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    const current = findSprintById(sprintId, workspaceId);
    if (!current.ok) return current;
    const patch = {};
    if (input.title !== undefined) {
      if (!required(input.title)) return validation("title cannot be empty.");
      if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
      patch.title = input.title.trim();
    }
    if (input.description !== undefined) patch.description = input.description?.trim() ?? null;
    if (input.objective !== undefined) patch.objective = input.objective?.trim() ?? null;
    if (input.status !== undefined) {
      if (!PROGRAM_ITEM_STATUSES.includes(input.status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
      if (input.status === "ARCHIVED") return validation("Use DELETE to archive a sprint.");
      patch.status = input.status;
    }
    if (input.orderIndex !== undefined) {
      if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
      patch.order_index = input.orderIndex;
    }
    if (Object.keys(patch).length === 0) return { ok: true, data: current.data };
    const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
    sprints.set(sprintId, updated);
    return emit("sprint", updated, "PROGRAM_SPRINT_UPDATED", input.actorId);
  }

  function archiveSprint(sprintId, workspaceId, actorId) {
    if (!validUuid(sprintId)) return validation("sprintId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(actorId)) return validation("actorId must be a UUID.");
    const current = findSprintById(sprintId, workspaceId);
    if (!current.ok) return current;
    const now = new Date().toISOString();
    const archived = { ...current.data, status: "ARCHIVED", deleted_at: now, updated_at: now };
    sprints.set(sprintId, archived);
    return emit("sprint", archived, "PROGRAM_SPRINT_ARCHIVED", actorId);
  }

  function listSprints(epicId, workspaceId) {
    const result = [...sprints.values()]
      .filter(s => s.epic_id === epicId && s.workspace_id === workspaceId && !s.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    return { ok: true, data: result };
  }

  // ── Cards ────────────────────────────────────────────────────────────────────
  function createCard(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.programId)) return validation("programId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    if (input.epicId != null && !validUuid(input.epicId)) return validation("epicId must be a UUID.");
    if (input.sprintId != null && !validUuid(input.sprintId)) return validation("sprintId must be a UUID.");
    if (!required(input.title)) return validation("title is required.");
    if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
    if (!PROGRAM_CARD_TYPES.includes(input.type)) return validation(`type must be one of: ${PROGRAM_CARD_TYPES.join(", ")}.`);
    if (typeof input.orderIndex !== "number" || !Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
    const status = input.status ?? "DRAFT";
    if (!PROGRAM_ITEM_STATUSES.includes(status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
    const now = new Date().toISOString();
    const card = {
      id: uuid(), workspace_id: input.workspaceId, program_id: input.programId,
      epic_id: input.epicId ?? null, sprint_id: input.sprintId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      prompt_body: input.promptBody ?? null,
      type: input.type, status, order_index: input.orderIndex,
      created_at: now, updated_at: now, deleted_at: null,
    };
    cards.set(card.id, card);
    return emit("card", card, "PROGRAM_CARD_CREATED", input.actorId);
  }

  function findCardById(id, workspaceId) {
    const c = cards.get(id);
    if (!c || c.deleted_at || c.workspace_id !== workspaceId) return failed("Card not found.", "not_found");
    return { ok: true, data: c };
  }

  function updateCard(cardId, workspaceId, input) {
    if (!validUuid(cardId)) return validation("cardId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    const current = findCardById(cardId, workspaceId);
    if (!current.ok) return current;
    const patch = {};
    if (input.title !== undefined) {
      if (!required(input.title)) return validation("title cannot be empty.");
      if (input.title.trim().length > 200) return validation("title must be 200 characters or fewer.");
      patch.title = input.title.trim();
    }
    if (input.description !== undefined) patch.description = input.description?.trim() ?? null;
    if (input.promptBody !== undefined) patch.prompt_body = input.promptBody ?? null;
    if (input.status !== undefined) {
      if (!PROGRAM_ITEM_STATUSES.includes(input.status)) return validation(`status must be one of: ${PROGRAM_ITEM_STATUSES.join(", ")}.`);
      if (input.status === "ARCHIVED") return validation("Use DELETE to archive a card.");
      patch.status = input.status;
    }
    if (input.orderIndex !== undefined) {
      if (!Number.isInteger(input.orderIndex)) return validation("orderIndex must be an integer.");
      patch.order_index = input.orderIndex;
    }
    if (Object.keys(patch).length === 0) return { ok: true, data: current.data };
    const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
    cards.set(cardId, updated);
    return emit("card", updated, "PROGRAM_CARD_UPDATED", input.actorId);
  }

  function archiveCard(cardId, workspaceId, actorId) {
    if (!validUuid(cardId)) return validation("cardId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(actorId)) return validation("actorId must be a UUID.");
    const current = findCardById(cardId, workspaceId);
    if (!current.ok) return current;
    const now = new Date().toISOString();
    const archived = { ...current.data, status: "ARCHIVED", deleted_at: now, updated_at: now };
    cards.set(cardId, archived);
    return emit("card", archived, "PROGRAM_CARD_ARCHIVED", actorId);
  }

  function listCards(programId, workspaceId) {
    const result = [...cards.values()]
      .filter(c => c.program_id === programId && c.workspace_id === workspaceId && !c.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    return { ok: true, data: result };
  }

  // ── Program Tree ─────────────────────────────────────────────────────────────
  function getProgramTree(programId, workspaceId) {
    const program = programs.get(programId);
    if (!program || program.workspace_id !== workspaceId) return failed("Program not found.", "not_found");
    const epicList = [...epics.values()]
      .filter(e => e.program_id === programId && e.workspace_id === workspaceId && !e.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    const cardList = [...cards.values()]
      .filter(c => c.program_id === programId && c.workspace_id === workspaceId && !c.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    const sprintList = [...sprints.values()]
      .filter(s => s.program_id === programId && s.workspace_id === workspaceId && !s.deleted_at)
      .sort((a, b) => a.order_index - b.order_index);
    const epicNodes = epicList.map(epic => ({
      epic,
      sprints: sprintList
        .filter(s => s.epic_id === epic.id)
        .map(sprint => ({
          sprint,
          cards: cardList.filter(c => c.sprint_id === sprint.id),
        })),
      cards: cardList.filter(c => c.epic_id === epic.id && c.sprint_id === null),
    }));
    return { ok: true, data: { program, epics: epicNodes } };
  }

  return { createProgram, createEpic, findEpicById, updateEpic, archiveEpic, listEpics, createSprint, findSprintById, updateSprint, archiveSprint, listSprints, createCard, findCardById, updateCard, archiveCard, listCards, getProgramTree, events };
}

// ─── ProgramEpic Tests ────────────────────────────────────────────────────────

describe("ProgramEpic — CreateEpic", () => {
  test("creates epic correctly", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const result = store.createEpic({ workspaceId, programId, number: 1, title: "Epic 1", orderIndex: 0, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.title, "Epic 1");
    assert.equal(result.data.number, 1);
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.deleted_at, null);
  });

  test("fails without title", () => {
    const store = createHierarchyStore();
    const result = store.createEpic({ workspaceId: uuid(), programId: uuid(), number: 1, title: "", orderIndex: 0, actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with number 0 (not positive)", () => {
    const store = createHierarchyStore();
    const result = store.createEpic({ workspaceId: uuid(), programId: uuid(), number: 0, title: "E", orderIndex: 0, actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with duplicate number within program", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    store.createEpic({ workspaceId, programId, number: 1, title: "E1", orderIndex: 0, actorId });
    const result = store.createEpic({ workspaceId, programId, number: 1, title: "E2", orderIndex: 1, actorId });
    assert.ok(!result.ok);
  });

  test("allows same number in different programs", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E1", orderIndex: 0, actorId });
    const result = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E2", orderIndex: 0, actorId });
    assert.ok(result.ok);
  });

  test("emits PROGRAM_EPIC_CREATED event", () => {
    const store = createHierarchyStore();
    store.createEpic({ workspaceId: uuid(), programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId: uuid() });
    assert.equal(store.events[0].eventType, "PROGRAM_EPIC_CREATED");
  });

  test("title over 200 characters fails", () => {
    const store = createHierarchyStore();
    const result = store.createEpic({ workspaceId: uuid(), programId: uuid(), number: 1, title: "x".repeat(201), orderIndex: 0, actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });
});

describe("ProgramEpic — UpdateEpic", () => {
  test("updates epic", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "Old", orderIndex: 0, actorId });
    const result = store.updateEpic(epic.id, workspaceId, { title: "New", actorId });
    assert.ok(result.ok);
    assert.equal(result.data.title, "New");
  });

  test("emits PROGRAM_EPIC_UPDATED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId });
    store.updateEpic(epic.id, workspaceId, { title: "Updated", actorId });
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_EPIC_UPDATED"));
  });

  test("blocks setting status ARCHIVED via update", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId });
    const result = store.updateEpic(epic.id, workspaceId, { status: "ARCHIVED", actorId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });
});

describe("ProgramEpic — ArchiveEpic", () => {
  test("archives epic with soft delete", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId });
    const result = store.archiveEpic(epic.id, workspaceId, actorId);
    assert.ok(result.ok);
    assert.ok(result.data.deleted_at);
    assert.equal(result.data.status, "ARCHIVED");
  });

  test("archived epic not found in subsequent queries", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId });
    store.archiveEpic(epic.id, workspaceId, actorId);
    const result = store.findEpicById(epic.id, workspaceId);
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("emits PROGRAM_EPIC_ARCHIVED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId: uuid(), number: 1, title: "E", orderIndex: 0, actorId });
    store.archiveEpic(epic.id, workspaceId, actorId);
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_EPIC_ARCHIVED"));
  });
});

// ─── ProgramSprint Tests ──────────────────────────────────────────────────────

describe("ProgramSprint — CreateSprint", () => {
  test("creates sprint correctly", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "Epic", orderIndex: 0, actorId });
    const result = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "Sprint 1", orderIndex: 0, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.epic_id, epic.id);
    assert.equal(result.data.status, "DRAFT");
  });

  test("fails without valid epic", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const result = store.createSprint({ workspaceId, programId, epicId: uuid(), number: 1, title: "S", orderIndex: 0, actorId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("fails with duplicate number within program", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S1", orderIndex: 0, actorId });
    const result = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S2", orderIndex: 1, actorId });
    assert.ok(!result.ok);
  });

  test("saves objective field", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    const result = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S", objective: "Deliver MVP", orderIndex: 0, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.objective, "Deliver MVP");
  });

  test("emits PROGRAM_SPRINT_CREATED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S", orderIndex: 0, actorId });
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_SPRINT_CREATED"));
  });
});

describe("ProgramSprint — UpdateSprint", () => {
  test("updates sprint", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    const { data: sprint } = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "Old", orderIndex: 0, actorId });
    const result = store.updateSprint(sprint.id, workspaceId, { title: "New", actorId });
    assert.ok(result.ok);
    assert.equal(result.data.title, "New");
  });

  test("archives sprint with soft delete", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    const { data: sprint } = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S", orderIndex: 0, actorId });
    const result = store.archiveSprint(sprint.id, workspaceId, actorId);
    assert.ok(result.ok);
    assert.ok(result.data.deleted_at);
    assert.equal(result.data.status, "ARCHIVED");
  });

  test("emits PROGRAM_SPRINT_ARCHIVED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const { data: epic } = store.createEpic({ workspaceId, programId, number: 1, title: "E", orderIndex: 0, actorId });
    const { data: sprint } = store.createSprint({ workspaceId, programId, epicId: epic.id, number: 1, title: "S", orderIndex: 0, actorId });
    store.archiveSprint(sprint.id, workspaceId, actorId);
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_SPRINT_ARCHIVED"));
  });
});

// ─── ProgramCard Tests ────────────────────────────────────────────────────────

describe("ProgramCard — CreateCard", () => {
  test("creates card correctly", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const programId = uuid(); const actorId = uuid();
    const result = store.createCard({ workspaceId, programId, title: "Card 1", type: "PROMPT", orderIndex: 0, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.type, "PROMPT");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.deleted_at, null);
  });

  test("saves promptBody preserving format (no trimming)", () => {
    const store = createHierarchyStore();
    const body = "Line 1\n\nLine 2\n   indented";
    const result = store.createCard({ workspaceId: uuid(), programId: uuid(), title: "C", type: "PROMPT", orderIndex: 0, promptBody: body, actorId: uuid() });
    assert.ok(result.ok);
    assert.equal(result.data.prompt_body, body);
  });

  test("fails without title", () => {
    const store = createHierarchyStore();
    const result = store.createCard({ workspaceId: uuid(), programId: uuid(), title: "", type: "TASK", orderIndex: 0, actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("fails with invalid type", () => {
    const store = createHierarchyStore();
    const result = store.createCard({ workspaceId: uuid(), programId: uuid(), title: "C", type: "INVALID", orderIndex: 0, actorId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("accepts all valid card types", () => {
    const store = createHierarchyStore();
    for (const type of PROGRAM_CARD_TYPES) {
      const result = store.createCard({ workspaceId: uuid(), programId: uuid(), title: "C", type, orderIndex: 0, actorId: uuid() });
      assert.ok(result.ok, `type ${type} should be valid`);
    }
  });

  test("emits PROGRAM_CARD_CREATED event", () => {
    const store = createHierarchyStore();
    store.createCard({ workspaceId: uuid(), programId: uuid(), title: "C", type: "TASK", orderIndex: 0, actorId: uuid() });
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_CARD_CREATED"));
  });
});

describe("ProgramCard — UpdateCard", () => {
  test("updates status", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: card } = store.createCard({ workspaceId, programId: uuid(), title: "C", type: "TASK", orderIndex: 0, actorId });
    const result = store.updateCard(card.id, workspaceId, { status: "IN_PROGRESS", actorId });
    assert.ok(result.ok);
    assert.equal(result.data.status, "IN_PROGRESS");
  });

  test("archives card with soft delete", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: card } = store.createCard({ workspaceId, programId: uuid(), title: "C", type: "TASK", orderIndex: 0, actorId });
    const result = store.archiveCard(card.id, workspaceId, actorId);
    assert.ok(result.ok);
    assert.ok(result.data.deleted_at);
    assert.equal(result.data.status, "ARCHIVED");
  });

  test("emits PROGRAM_CARD_ARCHIVED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: card } = store.createCard({ workspaceId, programId: uuid(), title: "C", type: "TASK", orderIndex: 0, actorId });
    store.archiveCard(card.id, workspaceId, actorId);
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_CARD_ARCHIVED"));
  });

  test("emits PROGRAM_CARD_UPDATED event", () => {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: card } = store.createCard({ workspaceId, programId: uuid(), title: "C", type: "TASK", orderIndex: 0, actorId });
    store.updateCard(card.id, workspaceId, { title: "Updated", actorId });
    assert.ok(store.events.some(e => e.eventType === "PROGRAM_CARD_UPDATED"));
  });
});

// ─── ProgramTree Tests ────────────────────────────────────────────────────────

describe("ProgramTree — getProgramTree", () => {
  function buildFullTree() {
    const store = createHierarchyStore();
    const workspaceId = uuid(); const actorId = uuid();
    const { data: program } = store.createProgram({ workspaceId, name: "My Program" });
    const { data: epic1 } = store.createEpic({ workspaceId, programId: program.id, number: 1, title: "Epic 1", orderIndex: 0, actorId });
    const { data: epic2 } = store.createEpic({ workspaceId, programId: program.id, number: 2, title: "Epic 2", orderIndex: 1, actorId });
    const { data: sprint1 } = store.createSprint({ workspaceId, programId: program.id, epicId: epic1.id, number: 1, title: "Sprint 1", orderIndex: 0, actorId });
    const { data: sprint2 } = store.createSprint({ workspaceId, programId: program.id, epicId: epic1.id, number: 2, title: "Sprint 2", orderIndex: 1, actorId });
    const { data: card1 } = store.createCard({ workspaceId, programId: program.id, sprintId: sprint1.id, title: "Card 1", type: "PROMPT", orderIndex: 0, actorId });
    const { data: card2 } = store.createCard({ workspaceId, programId: program.id, epicId: epic1.id, title: "Epic Card", type: "TASK", orderIndex: 0, actorId });
    return { store, workspaceId, program, epic1, epic2, sprint1, sprint2, card1, card2 };
  }

  test("returns program with epics", () => {
    const { store, workspaceId, program } = buildFullTree();
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    assert.equal(result.data.program.id, program.id);
    assert.equal(result.data.epics.length, 2);
  });

  test("returns epics with sprints", () => {
    const { store, workspaceId, program, epic1 } = buildFullTree();
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    const epicNode = result.data.epics.find(e => e.epic.id === epic1.id);
    assert.ok(epicNode);
    assert.equal(epicNode.sprints.length, 2);
  });

  test("returns sprints with cards", () => {
    const { store, workspaceId, program, sprint1, card1 } = buildFullTree();
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    const epicNode = result.data.epics[0];
    const sprintNode = epicNode.sprints.find(s => s.sprint.id === sprint1.id);
    assert.ok(sprintNode);
    assert.equal(sprintNode.cards.length, 1);
    assert.equal(sprintNode.cards[0].id, card1.id);
  });

  test("epic-level cards (no sprint) appear under epic.cards", () => {
    const { store, workspaceId, program, epic1, card2 } = buildFullTree();
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    const epicNode = result.data.epics.find(e => e.epic.id === epic1.id);
    assert.ok(epicNode.cards.some(c => c.id === card2.id));
  });

  test("respects order_index for epics", () => {
    const { store, workspaceId, program } = buildFullTree();
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    const [first, second] = result.data.epics;
    assert.ok(first.epic.order_index <= second.epic.order_index);
  });

  test("excludes soft-deleted records", () => {
    const { store, workspaceId, program, epic1, actorId = uuid() } = buildFullTree();
    store.archiveEpic(epic1.id, workspaceId, uuid());
    const result = store.getProgramTree(program.id, workspaceId);
    assert.ok(result.ok);
    assert.ok(!result.data.epics.some(e => e.epic.id === epic1.id));
  });

  test("workspace isolation — returns not_found for wrong workspace", () => {
    const { store, program } = buildFullTree();
    const result = store.getProgramTree(program.id, uuid());
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });
});

describe("Workspace Isolation", () => {
  test("epics from other workspaces not returned", () => {
    const store = createHierarchyStore();
    const ws1 = uuid(); const ws2 = uuid(); const programId = uuid(); const actorId = uuid();
    store.createEpic({ workspaceId: ws1, programId, number: 1, title: "E1", orderIndex: 0, actorId });
    const result = store.listEpics(programId, ws2);
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });

  test("cards from other workspaces not returned", () => {
    const store = createHierarchyStore();
    const ws1 = uuid(); const ws2 = uuid(); const programId = uuid();
    store.createCard({ workspaceId: ws1, programId, title: "C", type: "TASK", orderIndex: 0, actorId: uuid() });
    const result = store.listCards(programId, ws2);
    assert.ok(result.ok);
    assert.equal(result.data.length, 0);
  });
});
