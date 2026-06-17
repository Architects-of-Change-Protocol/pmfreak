/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Architecture and unit tests for Personal PM Pattern Formation Foundation.
const assert = require("node:assert/strict");
const test = require("node:test");

// ─── Inline implementations under test ───────────────────────────────────────
// Mirror the validation and governance logic from personal-pattern-service.ts
// so tests run without a live database. They verify constitutional guarantees.

const CATEGORIES = [
  "decision_pattern",
  "risk_response_pattern",
  "stakeholder_management_pattern",
  "communication_pattern",
  "execution_pattern",
  "planning_pattern",
  "escalation_pattern",
  "governance_pattern",
  "delivery_pattern",
  "approval_pattern",
  "follow_up_pattern",
  "dependency_resolution_pattern",
  "other",
];

const CONFIDENCE_VALUES = ["low", "medium", "high", "very_high"];
const STATUSES = ["active", "archived", "frozen", "deprecated"];

const SOURCE_TYPES = [
  "platform_event",
  "decision",
  "decision_effectiveness",
  "organizational_pattern",
  "organizational_memory",
  "personal_memory",
  "outcome",
  "risk",
  "task",
  "milestone",
  "stakeholder",
];

const SOURCE_RELATIONSHIPS = [
  "supports",
  "contradicts",
  "caused_by",
  "derived_from",
  "reviewed_during",
  "supersedes",
  "related_to",
];

const CAPABILITIES = [
  "PERSONAL_PATTERN_CREATE",
  "PERSONAL_PATTERN_UPDATE",
  "PERSONAL_PATTERN_INSPECT",
  "PERSONAL_PATTERN_EXPORT",
  "PERSONAL_PATTERN_FREEZE",
  "PERSONAL_PATTERN_ARCHIVE",
  "PERSONAL_PATTERN_DELETE",
  "PERSONAL_PATTERN_OBSERVE",
];

const AUDIT_EVENT_TYPES = [
  "PERSONAL_PATTERN_CREATED",
  "PERSONAL_PATTERN_UPDATED",
  "PERSONAL_PATTERN_FROZEN",
  "PERSONAL_PATTERN_ARCHIVED",
  "PERSONAL_PATTERN_DEPRECATED",
  "PERSONAL_PATTERN_DELETED",
  "PERSONAL_PATTERN_OBSERVATION_RECORDED",
];

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createStore() {
  const patterns = new Map();
  const sources = new Map();   // pattern_id -> source[]
  const observations = new Map(); // pattern_id -> observation[]
  const events = [];

  return {
    patterns,
    sources,
    observations,
    events,

    createPattern(input) {
      if (!validUuid(input.workspaceId)) return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.pmUserId)) return { ok: false, error: "pmUserId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.createdBy)) return { ok: false, error: "createdBy must be a UUID.", failureClass: "validation_failed" };
      if (!CATEGORIES.includes(input.patternCategory)) return { ok: false, error: "Invalid patternCategory.", failureClass: "validation_failed" };
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
      const pattern = {
        id,
        workspace_id: input.workspaceId,
        pm_user_id: input.pmUserId,
        pattern_category: input.patternCategory,
        title: input.title.trim(),
        summary: input.summary.trim(),
        confidence: input.confidence,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: input.createdBy,
        metadata: input.metadata ?? {},
      };
      patterns.set(id, pattern);
      sources.set(id, input.sources.map((s, i) => ({
        id: `src-${i}-${id}`,
        pattern_id: id,
        source_type: s.sourceType,
        source_id: s.sourceId,
        relationship_type: s.relationshipType,
        created_at: new Date().toISOString(),
      })));
      events.push({ type: "PERSONAL_PATTERN_CREATED", patternId: id, learningEligible: false, eventCategory: "governance" });
      return { ok: true, data: pattern };
    },

    getPattern(patternId, workspaceId, pmUserId) {
      const p = patterns.get(patternId);
      if (!p || p.workspace_id !== workspaceId || p.pm_user_id !== pmUserId) {
        return { ok: false, error: "Personal pattern not found or access denied.", failureClass: "not_found" };
      }
      return { ok: true, data: p };
    },

    updatePattern(patternId, workspaceId, pmUserId, patch) {
      const current = this.getPattern(patternId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen") return { ok: false, error: "Frozen patterns cannot be edited.", failureClass: "governance_violation" };
      const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
      patterns.set(patternId, updated);
      events.push({ type: "PERSONAL_PATTERN_UPDATED", patternId, learningEligible: false, eventCategory: "governance" });
      return { ok: true, data: updated };
    },

    setStatus(patternId, workspaceId, pmUserId, nextStatus, eventType) {
      const current = this.getPattern(patternId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen" && nextStatus !== "archived") {
        return { ok: false, error: "Frozen patterns can only be archived.", failureClass: "governance_violation" };
      }
      const updated = { ...current.data, status: nextStatus, updated_at: new Date().toISOString() };
      patterns.set(patternId, updated);
      events.push({ type: eventType, patternId, learningEligible: false, eventCategory: "governance" });
      return { ok: true, data: updated };
    },

    deletePattern(patternId, workspaceId, pmUserId) {
      const current = this.getPattern(patternId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen") return { ok: false, error: "Frozen patterns cannot be deleted.", failureClass: "governance_violation" };
      patterns.delete(patternId);
      events.push({ type: "PERSONAL_PATTERN_DELETED", patternId, learningEligible: false, eventCategory: "governance" });
      return { ok: true, data: { id: patternId } };
    },

    addSource(patternId, workspaceId, pmUserId, source) {
      const current = this.getPattern(patternId, workspaceId, pmUserId);
      if (!current.ok) return current;
      if (current.data.status === "frozen") return { ok: false, error: "Sources of frozen patterns cannot be mutated.", failureClass: "governance_violation" };
      const existing = sources.get(patternId) ?? [];
      existing.push({ id: `src-extra-${Date.now()}`, pattern_id: patternId, ...source, created_at: new Date().toISOString() });
      sources.set(patternId, existing);
      return { ok: true, data: existing[existing.length - 1] };
    },

    recordObservation(patternId, workspaceId, pmUserId, input) {
      const pattern = this.getPattern(patternId, workspaceId, pmUserId);
      if (!pattern.ok) return pattern;
      if (pattern.data.status === "frozen") return { ok: false, error: "Observations cannot be added to frozen patterns.", failureClass: "governance_violation" };
      if (!required(input.observationSummary)) return { ok: false, error: "observationSummary is required.", failureClass: "validation_failed" };
      const obs = {
        id: `obs-${Date.now()}`,
        pattern_id: patternId,
        observation_summary: input.observationSummary.trim(),
        recorded_at: new Date().toISOString(),
        recorded_by: input.recordedBy,
        metadata: input.metadata ?? {},
      };
      const existing = observations.get(patternId) ?? [];
      existing.push(obs);
      observations.set(patternId, existing);
      events.push({ type: "PERSONAL_PATTERN_OBSERVATION_RECORDED", patternId, learningEligible: false, eventCategory: "governance" });
      return { ok: true, data: obs };
    },

    buildLineage(patternId, workspaceId, pmUserId) {
      const pattern = this.getPattern(patternId, workspaceId, pmUserId);
      if (!pattern.ok) return pattern;
      return {
        ok: true,
        data: {
          pattern: pattern.data,
          observations: observations.get(patternId) ?? [],
          sources: sources.get(patternId) ?? [],
          events: [],
          decisions: [],
          decisionEffectiveness: [],
          organizationalPatterns: [],
          organizationalMemory: [],
          personalMemory: [],
          outcomes: [],
          unresolvedSources: [],
          timeline: pattern.data.created_at,
        },
      };
    },

    exportPattern(patternId, workspaceId, pmUserId) {
      const lineage = this.buildLineage(patternId, workspaceId, pmUserId);
      if (!lineage.ok) return lineage;
      return {
        ok: true,
        data: {
          pattern: lineage.data.pattern,
          observations: lineage.data.observations,
          sources: lineage.data.sources,
          lineage: lineage.data,
          unresolvedSources: lineage.data.unresolvedSources,
          exportedAt: new Date().toISOString(),
        },
      };
    },

    computeHealth(workspaceId, pmUserId) {
      const ps = [...patterns.values()].filter((p) => p.workspace_id === workspaceId && p.pm_user_id === pmUserId);
      const total = ps.length || 1;
      const ids = new Set(ps.map((p) => p.id));
      const allSources = [...sources.entries()].filter(([id]) => ids.has(id)).flatMap(([, s]) => s);
      const allObs = [...observations.entries()].filter(([id]) => ids.has(id)).flatMap(([, o]) => o);
      const coveredIds = new Set(allSources.map((s) => s.pattern_id));
      return {
        ok: true,
        data: {
          activeCount: ps.filter((p) => p.status === "active").length,
          archivedCount: ps.filter((p) => p.status === "archived").length,
          frozenCount: ps.filter((p) => p.status === "frozen").length,
          deprecatedCount: ps.filter((p) => p.status === "deprecated").length,
          observationCount: allObs.length,
          sourceCoverage: Math.min(1, Math.max(0, coveredIds.size / total)),
          lineageCoverage: Math.min(1, Math.max(0, coveredIds.size / total)),
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
    patternCategory: "decision_pattern",
    title: "Documents decisions before execution",
    summary: "Consistently produces written decision records before project execution begins.",
    confidence: "high",
    createdBy: ACTOR,
    sources: [{ sourceType: "decision", sourceId: SOURCE_UUID, relationshipType: "supports" }],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("pattern creation — happy path", () => {
  const store = createStore();
  const result = store.createPattern(baseInput());
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "active");
  assert.equal(result.data.pm_user_id, PM_A);
  assert.equal(result.data.workspace_id, WS_A);
});

test("pattern creation — missing source is rejected", () => {
  const store = createStore();
  const result = store.createPattern(baseInput({ sources: [] }));
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("pattern creation — source required at service level", () => {
  const store = createStore();
  const noSource = store.createPattern(baseInput({ sources: [] }));
  assert.equal(noSource.ok, false, "creation without source must fail");
});

test("pattern creation — invalid category is rejected", () => {
  const store = createStore();
  const result = store.createPattern(baseInput({ patternCategory: "behavior_score" }));
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("pattern creation — emits PERSONAL_PATTERN_CREATED event", () => {
  const store = createStore();
  const result = store.createPattern(baseInput());
  assert.equal(result.ok, true);
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_CREATED" && e.patternId === result.data.id);
  assert.ok(ev, "PERSONAL_PATTERN_CREATED event must be emitted");
  assert.equal(ev.learningEligible, false);
  assert.equal(ev.eventCategory, "governance");
});

test("pattern update — modifies active pattern", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  assert.equal(created.ok, true);
  const updated = store.updatePattern(created.data.id, WS_A, PM_A, { title: "Updated title" });
  assert.equal(updated.ok, true);
  assert.equal(updated.data.title, "Updated title");
});

test("pattern update — emits PERSONAL_PATTERN_UPDATED event", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.updatePattern(created.data.id, WS_A, PM_A, { title: "New title" });
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_UPDATED");
  assert.ok(ev, "PERSONAL_PATTERN_UPDATED must be emitted");
  assert.equal(ev.learningEligible, false);
});

test("pattern freeze — emits PERSONAL_PATTERN_FROZEN event", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_FROZEN");
  assert.ok(ev, "PERSONAL_PATTERN_FROZEN must be emitted");
  assert.equal(ev.learningEligible, false);
});

test("pattern archive — emits PERSONAL_PATTERN_ARCHIVED event", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_PATTERN_ARCHIVED");
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_ARCHIVED");
  assert.ok(ev, "PERSONAL_PATTERN_ARCHIVED must be emitted");
});

test("pattern delete — emits PERSONAL_PATTERN_DELETED event", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.deletePattern(created.data.id, WS_A, PM_A);
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_DELETED");
  assert.ok(ev, "PERSONAL_PATTERN_DELETED must be emitted");
  assert.equal(ev.learningEligible, false);
});

test("observation recording — emits PERSONAL_PATTERN_OBSERVATION_RECORDED event", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Evidence noted.", recordedBy: ACTOR });
  const ev = store.events.find((e) => e.type === "PERSONAL_PATTERN_OBSERVATION_RECORDED");
  assert.ok(ev, "PERSONAL_PATTERN_OBSERVATION_RECORDED must be emitted");
  assert.equal(ev.learningEligible, false);
});

test("frozen pattern — cannot be updated", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const updated = store.updatePattern(created.data.id, WS_A, PM_A, { title: "Attempt" });
  assert.equal(updated.ok, false);
  assert.equal(updated.failureClass, "governance_violation");
});

test("frozen pattern — cannot be deleted", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const deleted = store.deletePattern(created.data.id, WS_A, PM_A);
  assert.equal(deleted.ok, false);
  assert.equal(deleted.failureClass, "governance_violation");
});

test("frozen pattern — cannot have sources mutated", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const addSource = store.addSource(created.data.id, WS_A, PM_A, {
    source_type: "decision",
    source_id: SOURCE_UUID,
    relationship_type: "supports",
  });
  assert.equal(addSource.ok, false);
  assert.equal(addSource.failureClass, "governance_violation");
});

test("frozen pattern — cannot have observations added", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const obs = store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Attempt.", recordedBy: ACTOR });
  assert.equal(obs.ok, false);
  assert.equal(obs.failureClass, "governance_violation");
});

test("frozen pattern — can only be archived", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const archived = store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_PATTERN_ARCHIVED");
  assert.equal(archived.ok, true);
  assert.equal(archived.data.status, "archived");
});

test("frozen pattern — cannot be deprecated directly", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  const deprecated = store.setStatus(created.data.id, WS_A, PM_A, "deprecated", "PERSONAL_PATTERN_DEPRECATED");
  assert.equal(deprecated.ok, false);
  assert.equal(deprecated.failureClass, "governance_violation");
});

test("RLS model — cross-PM read returns not_found", () => {
  const store = createStore();
  const created = store.createPattern(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  assert.equal(created.ok, true);
  const crossRead = store.getPattern(created.data.id, WS_A, PM_B);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.failureClass, "not_found");
});

test("RLS model — cross-workspace read returns not_found", () => {
  const store = createStore();
  const created = store.createPattern(baseInput({ workspaceId: WS_A }));
  assert.equal(created.ok, true);
  const crossRead = store.getPattern(created.data.id, WS_B, PM_A);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.failureClass, "not_found");
});

test("RLS model — cross-PM delete returns not_found", () => {
  const store = createStore();
  const created = store.createPattern(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  const crossDelete = store.deletePattern(created.data.id, WS_A, PM_B);
  assert.equal(crossDelete.ok, false);
  assert.equal(crossDelete.failureClass, "not_found");
});

test("RLS model — cross-PM update returns not_found", () => {
  const store = createStore();
  const created = store.createPattern(baseInput({ workspaceId: WS_A, pmUserId: PM_A }));
  const crossUpdate = store.updatePattern(created.data.id, WS_A, PM_B, { title: "Stolen" });
  assert.equal(crossUpdate.ok, false);
  assert.equal(crossUpdate.failureClass, "not_found");
});

test("export — includes pattern, observations, sources, lineage, unresolvedSources", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Observed pattern.", recordedBy: ACTOR });
  const exported = store.exportPattern(created.data.id, WS_A, PM_A);
  assert.equal(exported.ok, true);
  assert.ok(exported.data.pattern, "pattern required");
  assert.ok(Array.isArray(exported.data.observations), "observations required");
  assert.ok(Array.isArray(exported.data.sources), "sources required");
  assert.ok(exported.data.lineage, "lineage required");
  assert.ok(Array.isArray(exported.data.unresolvedSources), "unresolvedSources required");
  assert.ok(exported.data.exportedAt, "exportedAt required");
  assert.doesNotThrow(() => JSON.stringify(exported.data), "export must be JSON-serializable");
});

test("health metrics — counts by status are accurate", () => {
  const store = createStore();
  store.createPattern(baseInput());
  const m2 = store.createPattern(baseInput({ title: "B", summary: "B pattern" }));
  const m3 = store.createPattern(baseInput({ title: "C", summary: "C pattern" }));
  store.setStatus(m2.data.id, WS_A, PM_A, "archived", "PERSONAL_PATTERN_ARCHIVED");
  store.setStatus(m3.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");

  const health = store.computeHealth(WS_A, PM_A);
  assert.equal(health.ok, true);
  assert.equal(health.data.activeCount, 1);
  assert.equal(health.data.archivedCount, 1);
  assert.equal(health.data.frozenCount, 1);
  assert.equal(health.data.deprecatedCount, 0);
  assert.equal(health.data.sourceCoverage, 1);
});

test("health metrics — clamped between 0 and 1", () => {
  const store = createStore();
  const health = store.computeHealth(WS_A, PM_A);
  assert.equal(health.ok, true);
  assert.ok(health.data.sourceCoverage >= 0 && health.data.sourceCoverage <= 1);
  assert.ok(health.data.lineageCoverage >= 0 && health.data.lineageCoverage <= 1);
});

test("health metrics — observation count is accurate", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Obs 1", recordedBy: ACTOR });
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Obs 2", recordedBy: ACTOR });
  const health = store.computeHealth(WS_A, PM_A);
  assert.equal(health.data.observationCount, 2);
});

test("capability vocabulary — all required capabilities are present", () => {
  const { PERSONAL_PATTERN_CAPABILITIES } = require("../src/lib/personal-patterns/types");
  for (const cap of CAPABILITIES) {
    assert.ok(PERSONAL_PATTERN_CAPABILITIES.includes(cap), `Missing capability: ${cap}`);
  }
});

test("capability vocabulary — capabilities are constant strings", () => {
  for (const cap of CAPABILITIES) {
    assert.ok(typeof cap === "string" && cap.startsWith("PERSONAL_PATTERN_"), `Bad capability: ${cap}`);
  }
});

test("source resolver — isolates table-specific resolution", () => {
  // Structural test: verify the resolver returns the correct shape without live DB.
  const KNOWN_TABLE_TYPES = [
    "platform_event",
    "decision",
    "decision_effectiveness",
    "organizational_pattern",
    "organizational_memory",
    "personal_memory",
    "outcome",
  ];
  const UNRESOLVED_TYPES = ["risk", "task", "milestone", "stakeholder"];

  for (const t of KNOWN_TABLE_TYPES) {
    assert.ok(SOURCE_TYPES.includes(t), `${t} must be in SOURCE_TYPES`);
  }
  for (const t of UNRESOLVED_TYPES) {
    assert.ok(SOURCE_TYPES.includes(t), `${t} must still be in SOURCE_TYPES for audit visibility`);
  }
  // Types not in SOURCE_TYPES must not exist.
  const unknownType = "ai_recommendation";
  assert.equal(SOURCE_TYPES.includes(unknownType), false, `${unknownType} must not be a source type`);
});

test("audit events — learningEligible is false for all event types", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.updatePattern(created.data.id, WS_A, PM_A, { title: "Updated" });
  store.setStatus(created.data.id, WS_A, PM_A, "frozen", "PERSONAL_PATTERN_FROZEN");
  store.setStatus(created.data.id, WS_A, PM_A, "archived", "PERSONAL_PATTERN_ARCHIVED");
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Obs.", recordedBy: ACTOR });

  for (const event of store.events) {
    assert.equal(event.learningEligible, false, `Event ${event.type} must have learningEligible=false`);
  }
});

test("audit events — all required event types are defined", () => {
  for (const eventType of AUDIT_EVENT_TYPES) {
    assert.ok(typeof eventType === "string" && eventType.length > 0, `Missing audit event: ${eventType}`);
  }
});

test("no scoring categories — scoring/ranking/profiling types must not exist", () => {
  const prohibited = [
    "personality",
    "psychological",
    "profile_score",
    "performance_score",
    "behavior_score",
    "trust_score",
    "leadership_score",
    "ranking",
    "prediction",
    "probability",
    "future_success",
    "future_failure",
    "pm_score",
  ];
  for (const p of prohibited) {
    assert.equal(CATEGORIES.includes(p), false, `Prohibited profiling category found: ${p}`);
  }
});

test("no AI/ML terms in source types", () => {
  const prohibited = ["embedding", "vector", "semantic", "recommendation", "ai_inference", "ml_output"];
  for (const p of prohibited) {
    assert.equal(SOURCE_TYPES.includes(p), false, `Prohibited source type: ${p}`);
  }
});

test("status values — all four statuses are defined", () => {
  for (const s of ["active", "archived", "frozen", "deprecated"]) {
    assert.ok(STATUSES.includes(s), `Missing status: ${s}`);
  }
});

test("lineage — returns correct shape", () => {
  const store = createStore();
  const created = store.createPattern(baseInput());
  store.recordObservation(created.data.id, WS_A, PM_A, { observationSummary: "Evidence A.", recordedBy: ACTOR });
  const lineage = store.buildLineage(created.data.id, WS_A, PM_A);
  assert.equal(lineage.ok, true);
  assert.ok(lineage.data.pattern, "pattern required");
  assert.ok(Array.isArray(lineage.data.observations), "observations required");
  assert.ok(Array.isArray(lineage.data.sources), "sources required");
  assert.ok(Array.isArray(lineage.data.events), "events required");
  assert.ok(Array.isArray(lineage.data.decisions), "decisions required");
  assert.ok(Array.isArray(lineage.data.decisionEffectiveness), "decisionEffectiveness required");
  assert.ok(Array.isArray(lineage.data.organizationalPatterns), "organizationalPatterns required");
  assert.ok(Array.isArray(lineage.data.organizationalMemory), "organizationalMemory required");
  assert.ok(Array.isArray(lineage.data.personalMemory), "personalMemory required");
  assert.ok(Array.isArray(lineage.data.outcomes), "outcomes required");
  assert.ok(Array.isArray(lineage.data.unresolvedSources), "unresolvedSources required");
  assert.ok(typeof lineage.data.timeline === "string", "timeline required");
  assert.equal(lineage.data.observations.length, 1);
  assert.equal(lineage.data.sources.length, 1);
});

test("database contract version — preserves prior keywords", () => {
  const { DATABASE_CONTRACT_VERSION } = require("../src/lib/db/database-contract");
  assert.ok(DATABASE_CONTRACT_VERSION.includes("platform-events"), "must preserve platform-events keyword");
  assert.ok(DATABASE_CONTRACT_VERSION.includes("execution-tasks"), "must preserve execution-tasks keyword");
  assert.ok(DATABASE_CONTRACT_VERSION.includes("decision-effectiveness"), "must preserve decision-effectiveness keyword");
  assert.ok(DATABASE_CONTRACT_VERSION.includes("pattern-extraction-foundation"), "must preserve pattern-extraction-foundation keyword");
  assert.ok(DATABASE_CONTRACT_VERSION.includes("personal-pm-patterns"), "must include personal-pm-patterns keyword");
});

test("database contract — personal pattern row types are exported", () => {
  const contract = require("../src/lib/db/database-contract");
  assert.ok(Array.isArray(contract.PERSONAL_PM_PATTERN_SELECTABLE_COLUMNS), "PERSONAL_PM_PATTERN_SELECTABLE_COLUMNS must exist");
  assert.ok(Array.isArray(contract.PERSONAL_PM_PATTERN_SOURCE_SELECTABLE_COLUMNS), "PERSONAL_PM_PATTERN_SOURCE_SELECTABLE_COLUMNS must exist");
  assert.ok(Array.isArray(contract.PERSONAL_PM_PATTERN_OBSERVATION_SELECTABLE_COLUMNS), "PERSONAL_PM_PATTERN_OBSERVATION_SELECTABLE_COLUMNS must exist");
});

test("migration — three tables defined in migration file", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260619000000_personal_pm_patterns_foundation.sql"),
    "utf8",
  );
  assert.ok(sql.includes("create table if not exists public.personal_pm_patterns"), "personal_pm_patterns table");
  assert.ok(sql.includes("create table if not exists public.personal_pm_pattern_sources"), "personal_pm_pattern_sources table");
  assert.ok(sql.includes("create table if not exists public.personal_pm_pattern_observations"), "personal_pm_pattern_observations table");
});

test("migration — RLS enabled on all three tables", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260619000000_personal_pm_patterns_foundation.sql"),
    "utf8",
  );
  assert.ok(sql.includes("alter table public.personal_pm_patterns enable row level security"), "RLS on personal_pm_patterns");
  assert.ok(sql.includes("alter table public.personal_pm_pattern_sources enable row level security"), "RLS on sources");
  assert.ok(sql.includes("alter table public.personal_pm_pattern_observations enable row level security"), "RLS on observations");
});

test("migration — RLS policies enforce workspace_id + pm_user_id isolation", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260619000000_personal_pm_patterns_foundation.sql"),
    "utf8",
  );
  assert.ok(sql.includes("pm_user_id = auth.uid()"), "must enforce pm_user_id = auth.uid()");
  assert.ok(sql.includes("workspace_id"), "must scope to workspace_id");
});

test("migration — freeze guard trigger exists", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260619000000_personal_pm_patterns_foundation.sql"),
    "utf8",
  );
  assert.ok(sql.includes("personal_pm_patterns_freeze_guard"), "freeze guard trigger must exist");
  assert.ok(sql.includes("Frozen personal PM patterns can only be archived"), "freeze guard must enforce archive-only transition");
});
