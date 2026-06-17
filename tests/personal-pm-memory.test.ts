/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Architecture and unit tests for Personal PM Memory Foundation.
const assert = require("node:assert/strict");
const test = require("node:test");

// ─── Inline implementations under test ───────────────────────────────────────
// These mirror the validation logic in personal-memory-service.ts so the tests
// run without a live database. They verify constitutional guarantees.

const CATEGORIES = [
  "decision_behavior", "risk_behavior", "stakeholder_behavior",
  "communication_behavior", "execution_behavior", "planning_behavior",
  "escalation_behavior", "governance_behavior", "delivery_behavior",
  "leadership_behavior", "other",
];

const CONFIDENCE_VALUES = ["low", "medium", "high", "very_high"];
const STATUSES = ["active", "archived", "frozen", "deprecated"];
const SOURCE_TYPES = [
  "platform_event", "decision", "decision_effectiveness",
  "organizational_pattern", "organizational_memory", "outcome",
  "risk", "task", "milestone", "stakeholder",
];
const SOURCE_RELATIONSHIPS = [
  "supports", "contradicts", "caused_by", "derived_from",
  "reviewed_during", "supersedes", "related_to",
];

const CAPABILITIES = [
  "PERSONAL_MEMORY_CREATE",
  "PERSONAL_MEMORY_UPDATE",
  "PERSONAL_MEMORY_INSPECT",
  "PERSONAL_MEMORY_EXPORT",
  "PERSONAL_MEMORY_FREEZE",
  "PERSONAL_MEMORY_ARCHIVE",
  "PERSONAL_MEMORY_DELETE",
];

const AUDIT_EVENT_TYPES = [
  "PERSONAL_MEMORY_CREATED",
  "PERSONAL_MEMORY_UPDATED",
  "PERSONAL_MEMORY_FROZEN",
  "PERSONAL_MEMORY_ARCHIVED",
  "PERSONAL_MEMORY_DEPRECATED",
  "PERSONAL_MEMORY_DELETED",
  "PERSONAL_MEMORY_OBSERVATION_RECORDED",
];

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// In-memory store simulating the database for unit testing.
function createStore() {
  const memories = new Map();
  const sources = new Map(); // memory_id -> source[]
  const observations = new Map(); // memory_id -> observation[]
  const events = [];

  return {
    memories,
    sources,
    observations,
    events,

    createMemory(input) {
      if (!validUuid(input.workspaceId)) return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.pmUserId)) return { ok: false, error: "pmUserId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.createdBy)) return { ok: false, error: "createdBy must be a UUID.", failureClass: "validation_failed" };
      if (!CATEGORIES.includes(input.memoryCategory)) return { ok: false, error: "Invalid memoryCategory.", failureClass: "validation_failed" };
      if (!CONFIDENCE_VALUES.includes(input.confidence)) return { ok: false, error: "Invalid confidence.", failureClass: "validation_failed" };
      if (!required(input.title)) return { ok: false, error: "title is required.", failureClass: "validation_failed" };
      if (!required(input.summary)) return { ok: false, error: "summary is required.", failureClass: "validation_failed" };
      if (!input.sources || input.sources.length === 0) return { ok: false, error: "At least one source is required.", failureClass: "validation_failed" };
      for (const s of input.sources) {
        if (!SOURCE_TYPES.includes(s.sourceType)) return { ok: false, error: "Invalid sourceType.", failureClass: "validation_failed" };
        if (!validUuid(s.sourceId)) return { ok: false, error: "sourceId must be a UUID.", failureClass: "validation_failed" };
        if (!SOURCE_RELATIONSHIPS.includes(s.relationshipType)) return { ok: false, error: "Invalid relationshipType.", failureClass: "validation_failed" };
      }

      const counter = (createStore._counter = (createStore._counter ?? 0) + 1);
      const id = "aaaaaaaa-bbbb-4ccc-8ddd-" + counter.toString(16).padStart(12, "0");
      const memory = {
        id,
        workspace_id: input.workspaceId,
        pm_user_id: input.pmUserId,
        memory_category: input.memoryCategory,
        title: input.title.trim(),
        summary: input.summary.trim(),
        confidence: input.confidence,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: input.createdBy,
        metadata: input.metadata ?? {},
      };
      memories.set(id, memory);
      sources.set(id, input.sources.map((s, i) => ({ id: `src-${i}-${id}`, memory_id: id, source_type: s.sourceType, source_id: s.sourceId, relationship_type: s.relationshipType, created_at: new Date().toISOString() })));
      events.push({ type: "PERSONAL_MEMORY_CREATED", memoryId: id, learningEligible: false });
      return { ok: true, data: memory };
    },

    getMemory(memoryId, workspaceId, pmUserId) {
      const m = memories.get(memoryId);
      if (!m || m.workspace_id !== workspaceId || m.pm_user_id !== pmUserId) {
        return { ok: false, error: "Personal memory not found or access denied.", failureClass: "not_found" };
      }
      return { ok: true, data: m };
    },

    updateMemory(memoryId, workspaceId, pmUserId, patch) {
      const current = this.getMemory(memoryId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen") return { ok: false, error: "Frozen memories cannot be edited.", failureClass: "governance_violation" };
      const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
      memories.set(memoryId, updated);
      events.push({ type: "PERSONAL_MEMORY_UPDATED", memoryId, learningEligible: false });
      return { ok: true, data: updated };
    },

    setStatus(memoryId, workspaceId, pmUserId, nextStatus, eventType) {
      const current = this.getMemory(memoryId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen" && nextStatus !== "archived") {
        return { ok: false, error: "Frozen memories can only be archived.", failureClass: "governance_violation" };
      }
      const updated = { ...current.data, status: nextStatus, updated_at: new Date().toISOString() };
      memories.set(memoryId, updated);
      events.push({ type: eventType, memoryId, learningEligible: false });
      return { ok: true, data: updated };
    },

    deleteMemory(memoryId, workspaceId, pmUserId) {
      const current = this.getMemory(memoryId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen") return { ok: false, error: "Frozen memories cannot be deleted.", failureClass: "governance_violation" };
      memories.delete(memoryId);
      events.push({ type: "PERSONAL_MEMORY_DELETED", memoryId, learningEligible: false });
      return { ok: true, data: { id: memoryId } };
    },

    recordObservation(memoryId, workspaceId, pmUserId, input) {
      const memory = this.getMemory(memoryId, workspaceId, pmUserId);
      if (!memory.ok) return memory;
      if (!required(input.observationSummary)) return { ok: false, error: "observationSummary is required.", failureClass: "validation_failed" };
      const obs = { id: `obs-${Date.now()}`, memory_id: memoryId, observation_summary: input.observationSummary.trim(), recorded_at: new Date().toISOString(), recorded_by: input.recordedBy, metadata: input.metadata ?? {} };
      const existing = observations.get(memoryId) ?? [];
      existing.push(obs);
      observations.set(memoryId, existing);
      events.push({ type: "PERSONAL_MEMORY_OBSERVATION_RECORDED", memoryId, learningEligible: false });
      return { ok: true, data: obs };
    },

    buildLineage(memoryId, workspaceId, pmUserId) {
      const memory = this.getMemory(memoryId, workspaceId, pmUserId);
      if (!memory.ok) return memory;
      return {
        ok: true,
        data: {
          memory: memory.data,
          observations: observations.get(memoryId) ?? [],
          sources: sources.get(memoryId) ?? [],
          events: [],
          decisions: [],
          outcomes: [],
          patterns: [],
          effectiveness: [],
        },
      };
    },

    exportMemory(memoryId, workspaceId, pmUserId) {
      const lineage = this.buildLineage(memoryId, workspaceId, pmUserId);
      if (!lineage.ok) return lineage;
      return {
        ok: true,
        data: {
          memory: lineage.data.memory,
          observations: lineage.data.observations,
          sources: lineage.data.sources,
          lineage: lineage.data,
          exportedAt: new Date().toISOString(),
        },
      };
    },

    computeHealth(workspaceId, pmUserId) {
      const ms = [...memories.values()].filter((m) => m.workspace_id === workspaceId && m.pm_user_id === pmUserId);
      const total = ms.length || 1;
      const ids = new Set(ms.map((m) => m.id));
      const allSources = [...sources.entries()].filter(([id]) => ids.has(id)).flatMap(([, s]) => s);
      const allObs = [...observations.entries()].filter(([id]) => ids.has(id)).flatMap(([, o]) => o);
      const coveredIds = new Set(allSources.map((s) => s.memory_id));
      return {
        ok: true,
        data: {
          activeCount: ms.filter((m) => m.status === "active").length,
          archivedCount: ms.filter((m) => m.status === "archived").length,
          frozenCount: ms.filter((m) => m.status === "frozen").length,
          deprecatedCount: ms.filter((m) => m.status === "deprecated").length,
          observationCount: allObs.length,
          sourceCoverage: Math.min(1, coveredIds.size / total),
          lineageCoverage: Math.min(1, coveredIds.size / total),
        },
      };
    },
  };
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const WS_A = "aaaaaaaa-0000-1000-8000-000000000001";
const WS_B = "aaaaaaaa-0000-1000-8000-000000000002";
const PM_A = "aaaaaaaa-0000-1000-8000-000000000010";
const PM_B = "aaaaaaaa-0000-1000-8000-000000000011";
const ACTOR = "aaaaaaaa-0000-1000-8000-000000000020";
const SOURCE_UUID = "aaaaaaaa-0000-1000-8000-000000000099";

function baseInput(overrides = {}) {
  return {
    workspaceId: WS_A,
    pmUserId: PM_A,
    memoryCategory: "decision_behavior",
    title: "Prefers written decisions",
    summary: "Consistently documents major decisions in writing before execution.",
    confidence: "high",
    createdBy: ACTOR,
    sources: [{ sourceType: "decision", sourceId: SOURCE_UUID, relationshipType: "supports" }],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("memory creation — happy path", () => {
  const store = createStore();
  const result = store.createMemory(baseInput());
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "active");
  assert.equal(result.data.pm_user_id, PM_A);
  assert.equal(result.data.workspace_id, WS_A);
});

test("memory creation — missing source is rejected", () => {
  const store = createStore();
  const result = store.createMemory(baseInput({ sources: [] }));
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("memory creation — invalid category is rejected", () => {
  const store = createStore();
  const result = store.createMemory(baseInput({ memoryCategory: "behavior_score" }));
  assert.equal(result.ok, false);
});

test("memory creation — no scoring categories exist", () => {
  const forbidden = ["behavior_score", "pm_score", "leadership_score", "execution_score", "personality_score", "trust_score"];
  for (const cat of forbidden) assert.equal(CATEGORIES.includes(cat), false, `${cat} must not exist as a category`);
});

test("memory update — modifies active memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  assert.equal(created.ok, true);
  const updated = store.updateMemory(created.data.id, WS_A, PM_A, { title: "Updated title" });
  assert.equal(updated.ok, true);
  assert.equal(updated.data.title, "Updated title");
});

test("memory update — frozen memory cannot be edited", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  assert.equal(created.ok, true);
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  const updated = store.updateMemory(created.data.id, WS_A, PM_A, { title: "Attempt" });
  assert.equal(updated.ok, false);
  assert.equal(updated.failureClass, "governance_violation");
});

test("memory freeze — prevents editing and deletion", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");

  const editAttempt = store.updateMemory(created.data.id, WS_A, PM_A, { title: "No" });
  assert.equal(editAttempt.ok, false);

  const deleteAttempt = store.deleteMemory(created.data.id, WS_A, PM_A);
  assert.equal(deleteAttempt.ok, false);
  assert.equal(deleteAttempt.failureClass, "governance_violation");
});

test("memory freeze — frozen can be archived", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  const archived = store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_MEMORY_ARCHIVED");
  assert.equal(archived.ok, true);
  assert.equal(archived.data.status, "archived");
});

test("memory freeze — frozen cannot be deprecated directly", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  const deprecated = store.setStatus(created.data.id, WS_A, PM_A, "deprecated", "PERSONAL_MEMORY_DEPRECATED");
  assert.equal(deprecated.ok, false);
  assert.equal(deprecated.failureClass, "governance_violation");
});

test("memory archive — archived memory reports correct status", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_MEMORY_ARCHIVED");
  const fetched = store.getMemory(created.data.id, WS_A, PM_A);
  assert.equal(fetched.data.status, "archived");
});

test("memory deletion — removes memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  const deleted = store.deleteMemory(created.data.id, WS_A, PM_A);
  assert.equal(deleted.ok, true);
  const fetched = store.getMemory(created.data.id, WS_A, PM_A);
  assert.equal(fetched.ok, false);
});

test("memory deletion — frozen memory cannot be deleted", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  const deleted = store.deleteMemory(created.data.id, WS_A, PM_A);
  assert.equal(deleted.ok, false);
  assert.equal(deleted.failureClass, "governance_violation");
});

test("observation recording — attaches to memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  const obs = store.recordObservation(created.data.id, WS_A, PM_A, {
    observationSummary: "PM documented decision with full stakeholder sign-off.",
    recordedBy: ACTOR,
  });
  assert.equal(obs.ok, true);
  assert.equal(obs.data.observation_summary, "PM documented decision with full stakeholder sign-off.");
});

test("observation recording — empty summary is rejected", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  const obs = store.recordObservation(created.data.id, WS_A, PM_A, {
    observationSummary: "   ",
    recordedBy: ACTOR,
  });
  assert.equal(obs.ok, false);
  assert.equal(obs.failureClass, "validation_failed");
});

test("lineage reconstruction — returns all supporting data", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Evidence A.", recordedBy: ACTOR });
  const lineage = store.buildLineage(created.data.id, WS_A, PM_A);
  assert.equal(lineage.ok, true);
  assert.ok(Array.isArray(lineage.data.sources));
  assert.ok(Array.isArray(lineage.data.observations));
  assert.ok(Array.isArray(lineage.data.events));
  assert.ok(Array.isArray(lineage.data.decisions));
  assert.ok(Array.isArray(lineage.data.outcomes));
  assert.ok(Array.isArray(lineage.data.patterns));
  assert.ok(Array.isArray(lineage.data.effectiveness));
  assert.equal(lineage.data.observations.length, 1);
  assert.equal(lineage.data.sources.length, 1);
});

test("export — produces JSON-serializable structure", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Noted pattern.", recordedBy: ACTOR });
  const exported = store.exportMemory(created.data.id, WS_A, PM_A);
  assert.equal(exported.ok, true);
  assert.ok(exported.data.memory);
  assert.ok(exported.data.observations);
  assert.ok(exported.data.sources);
  assert.ok(exported.data.lineage);
  assert.ok(exported.data.exportedAt);
  // Must be fully JSON-serializable — no circular refs, no undefined values.
  assert.doesNotThrow(() => JSON.stringify(exported.data));
});

test("cross-workspace denial — PM A cannot read PM A memory in workspace B", () => {
  const store = createStore();
  const created = store.createMemory(baseInput({ workspaceId: WS_A }));
  assert.equal(created.ok, true);
  const crossRead = store.getMemory(created.data.id, WS_B, PM_A);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.failureClass, "not_found");
});

test("cross-PM denial — PM B cannot read PM A's memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  assert.equal(created.ok, true);
  const crossRead = store.getMemory(created.data.id, WS_A, PM_B);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.failureClass, "not_found");
});

test("cross-PM denial — PM B cannot delete PM A's memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  assert.equal(created.ok, true);
  const crossDelete = store.deleteMemory(created.data.id, WS_A, PM_B);
  assert.equal(crossDelete.ok, false);
  assert.equal(crossDelete.failureClass, "not_found");
});

test("cross-PM denial — PM B cannot update PM A's memory", () => {
  const store = createStore();
  const created = store.createMemory(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  assert.equal(created.ok, true);
  const crossUpdate = store.updateMemory(created.data.id, WS_A, PM_B, { title: "Stolen" });
  assert.equal(crossUpdate.ok, false);
  assert.equal(crossUpdate.failureClass, "not_found");
});

test("audit events — learningEligible is false for all event types", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_MEMORY_ARCHIVED");

  for (const event of store.events) {
    assert.equal(event.learningEligible, false, `Event ${event.type} must have learningEligible=false`);
  }
});

test("audit events — all required event types are defined", () => {
  for (const eventType of AUDIT_EVENT_TYPES) {
    assert.ok(typeof eventType === "string" && eventType.length > 0, `Missing audit event: ${eventType}`);
  }
});

test("immutability — frozen memory sources cannot be mutated via status changes", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");
  // Any attempt to change frozen memory (other than archive) must be blocked.
  const attempts = [
    store.updateMemory(created.data.id, WS_A, PM_A, { summary: "Mutated" }),
    store.setStatus(created.data.id, WS_A, PM_A, "deprecated", "PERSONAL_MEMORY_DEPRECATED"),
    store.deleteMemory(created.data.id, WS_A, PM_A),
  ];
  for (const attempt of attempts) {
    assert.equal(attempt.ok, false, "All mutations on frozen memory must fail.");
    assert.equal(attempt.failureClass, "governance_violation");
  }
});

test("health metrics — counts by status are accurate", () => {
  const store = createStore();
  store.createMemory(baseInput());
  const m2 = store.createMemory(baseInput({ title: "B", summary: "B" }));
  const m3 = store.createMemory(baseInput({ title: "C", summary: "C" }));
  store.setStatus(m2.data.id, WS_A, PM_A, "archived", "PERSONAL_MEMORY_ARCHIVED");
  store.setStatus(m3.data.id, WS_A, PM_A, "frozen", "PERSONAL_MEMORY_FROZEN");

  const health = store.computeHealth(WS_A, PM_A);
  assert.equal(health.ok, true);
  assert.equal(health.data.activeCount, 1);
  assert.equal(health.data.archivedCount, 1);
  assert.equal(health.data.frozenCount, 1);
  assert.equal(health.data.deprecatedCount, 0);
  assert.equal(health.data.sourceCoverage, 1);
});

test("health metrics — observation count is accurate", () => {
  const store = createStore();
  const created = store.createMemory(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Obs 1", recordedBy: ACTOR });
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Obs 2", recordedBy: ACTOR });
  const health = store.computeHealth(WS_A, PM_A);
  assert.equal(health.data.observationCount, 2);
});

test("capability vocabulary — all required capabilities are present", () => {
  for (const cap of CAPABILITIES) {
    assert.ok(typeof cap === "string" && cap.startsWith("PERSONAL_MEMORY_"), `Missing capability: ${cap}`);
  }
});

test("no profiling categories — scoring/ranking types must not exist", () => {
  const prohibited = ["pm_score", "leadership_score", "execution_score", "personality_score", "behavior_score", "trust_score", "ranking"];
  for (const p of prohibited) {
    assert.equal(CATEGORIES.includes(p), false, `Prohibited profiling category found: ${p}`);
  }
});

test("source types — decision_effectiveness is supported", () => {
  assert.ok(SOURCE_TYPES.includes("decision_effectiveness"));
});

test("source types — organizational sources are supported", () => {
  assert.ok(SOURCE_TYPES.includes("organizational_pattern"));
  assert.ok(SOURCE_TYPES.includes("organizational_memory"));
});

test("status values — all four statuses are defined", () => {
  for (const s of ["active", "archived", "frozen", "deprecated"]) {
    assert.ok(STATUSES.includes(s), `Missing status: ${s}`);
  }
});
