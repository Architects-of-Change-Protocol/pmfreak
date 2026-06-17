/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Architecture and unit tests for Personal PM Effectiveness Foundation.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

// ─── Inline implementations under test ───────────────────────────────────────
// Mirror validation and governance logic from personal-effectiveness-service.ts
// so tests run without a live database.

const OUTCOME_CLASSIFICATIONS = ["success", "partial_success", "failure", "unknown"];
const STATUSES = ["candidate", "validated", "archived", "deprecated"];
const SOURCE_TYPES = [
  "platform_event",
  "decision",
  "decision_effectiveness",
  "organizational_pattern",
  "organizational_memory",
  "personal_memory",
  "personal_pattern",
  "outcome",
  "risk",
  "task",
  "milestone",
  "stakeholder",
];
const RELATIONSHIP_TYPES = [
  "supports",
  "contradicts",
  "caused_by",
  "derived_from",
  "reviewed_during",
  "supersedes",
  "related_to",
];
const CAPABILITIES = [
  "PERSONAL_EFFECTIVENESS_CREATE",
  "PERSONAL_EFFECTIVENESS_UPDATE",
  "PERSONAL_EFFECTIVENESS_VALIDATE",
  "PERSONAL_EFFECTIVENESS_INSPECT",
  "PERSONAL_EFFECTIVENESS_EXPORT",
  "PERSONAL_EFFECTIVENESS_ARCHIVE",
  "PERSONAL_EFFECTIVENESS_DELETE",
  "PERSONAL_EFFECTIVENESS_OBSERVE",
];
const AUDIT_EVENT_TYPES = [
  "PERSONAL_EFFECTIVENESS_CREATED",
  "PERSONAL_EFFECTIVENESS_UPDATED",
  "PERSONAL_EFFECTIVENESS_VALIDATED",
  "PERSONAL_EFFECTIVENESS_ARCHIVED",
  "PERSONAL_EFFECTIVENESS_DEPRECATED",
  "PERSONAL_EFFECTIVENESS_DELETED",
  "PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED",
];

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function clamp(n) {
  return Math.min(1, Math.max(0, n));
}

let _counter = 0;
function makeUuid() {
  _counter++;
  return "aaaaaaaa-bbbb-4ccc-8ddd-" + _counter.toString(16).padStart(12, "0");
}

function createStore() {
  const records = new Map();
  const sources = new Map();       // effectiveness_id -> source[]
  const observations = new Map();  // effectiveness_id -> observation[]
  const events = [];

  return {
    records,
    sources,
    observations,
    events,

    createEffectiveness(input) {
      if (!validUuid(input.workspaceId)) return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.pmUserId)) return { ok: false, error: "pmUserId must be a UUID.", failureClass: "validation_failed" };
      if (!validUuid(input.actorId)) return { ok: false, error: "actorId must be a UUID.", failureClass: "validation_failed" };
      if (!OUTCOME_CLASSIFICATIONS.includes(input.outcomeClassification)) return { ok: false, error: "Invalid outcomeClassification.", failureClass: "validation_failed" };
      if (!required(input.summary)) return { ok: false, error: "summary is required.", failureClass: "validation_failed" };

      const hasAnchor =
        validUuid(input.personalPatternId) ||
        validUuid(input.personalMemoryId) ||
        validUuid(input.decisionId) ||
        validUuid(input.decisionEffectivenessId);
      if (!hasAnchor) return { ok: false, error: "At least one anchor reference required.", failureClass: "validation_failed" };

      if (!input.sources || input.sources.length === 0) return { ok: false, error: "At least one source is required.", failureClass: "validation_failed" };
      for (const s of input.sources) {
        if (!SOURCE_TYPES.includes(s.sourceType)) return { ok: false, error: "Invalid sourceType.", failureClass: "validation_failed" };
        if (!validUuid(s.sourceId)) return { ok: false, error: "sourceId must be a UUID.", failureClass: "validation_failed" };
        if (!RELATIONSHIP_TYPES.includes(s.relationshipType)) return { ok: false, error: "Invalid relationshipType.", failureClass: "validation_failed" };
      }

      const id = makeUuid();
      const record = {
        id,
        workspace_id: input.workspaceId,
        pm_user_id: input.pmUserId,
        personal_pattern_id: input.personalPatternId ?? null,
        personal_memory_id: input.personalMemoryId ?? null,
        decision_id: input.decisionId ?? null,
        decision_effectiveness_id: input.decisionEffectivenessId ?? null,
        outcome_classification: input.outcomeClassification,
        effectiveness_status: "candidate",
        summary: input.summary.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: input.actorId,
        metadata: input.metadata ?? {},
      };
      records.set(id, record);
      sources.set(id, input.sources.map((s, i) => ({
        id: `src-${i}-${id}`,
        effectiveness_id: id,
        source_type: s.sourceType,
        source_id: s.sourceId,
        relationship_type: s.relationshipType,
        created_at: new Date().toISOString(),
      })));
      events.push({ type: "PERSONAL_EFFECTIVENESS_CREATED", effectivenessId: id, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: record };
    },

    getEffectiveness(effectivenessId, pmUserId) {
      const r = records.get(effectivenessId);
      if (!r || r.pm_user_id !== pmUserId) {
        return { ok: false, error: "Personal effectiveness record not found.", failureClass: "not_found" };
      }
      return { ok: true, data: r };
    },

    updateEffectiveness(effectivenessId, pmUserId, actorId, patch) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "validated") return { ok: false, error: "Validated records cannot be updated.", failureClass: "governance_violation" };
      if (current.data.effectiveness_status === "archived") return { ok: false, error: "Archived records cannot be updated.", failureClass: "governance_violation" };
      if (patch.summary !== undefined && !required(patch.summary)) return { ok: false, error: "summary cannot be empty.", failureClass: "validation_failed" };
      const updated = { ...current.data, ...patch, updated_at: new Date().toISOString() };
      records.set(effectivenessId, updated);
      events.push({ type: "PERSONAL_EFFECTIVENESS_UPDATED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: updated };
    },

    validateEffectiveness(effectivenessId, pmUserId, actorId) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status !== "candidate") return { ok: false, error: "Only candidate records can be validated.", failureClass: "governance_violation" };
      const updated = { ...current.data, effectiveness_status: "validated", updated_at: new Date().toISOString() };
      records.set(effectivenessId, updated);
      events.push({ type: "PERSONAL_EFFECTIVENESS_VALIDATED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: updated };
    },

    archiveEffectiveness(effectivenessId, pmUserId, actorId) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "archived") return { ok: false, error: "Already archived.", failureClass: "governance_violation" };
      const updated = { ...current.data, effectiveness_status: "archived", updated_at: new Date().toISOString() };
      records.set(effectivenessId, updated);
      events.push({ type: "PERSONAL_EFFECTIVENESS_ARCHIVED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: updated };
    },

    deprecateEffectiveness(effectivenessId, pmUserId, actorId) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "validated") return { ok: false, error: "Validated records cannot be deprecated.", failureClass: "governance_violation" };
      if (current.data.effectiveness_status === "archived") return { ok: false, error: "Archived records cannot be deprecated.", failureClass: "governance_violation" };
      const updated = { ...current.data, effectiveness_status: "deprecated", updated_at: new Date().toISOString() };
      records.set(effectivenessId, updated);
      events.push({ type: "PERSONAL_EFFECTIVENESS_DEPRECATED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: updated };
    },

    deleteEffectiveness(effectivenessId, pmUserId, actorId) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "validated") return { ok: false, error: "Validated records cannot be deleted.", failureClass: "governance_violation" };
      events.push({ type: "PERSONAL_EFFECTIVENESS_DELETED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      records.delete(effectivenessId);
      sources.delete(effectivenessId);
      observations.delete(effectivenessId);
      return { ok: true, data: { id: effectivenessId } };
    },

    addSource(effectivenessId, pmUserId, source) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "validated") return { ok: false, error: "Sources of validated records cannot be mutated.", failureClass: "governance_violation" };
      const existing = sources.get(effectivenessId) ?? [];
      existing.push({ id: `src-extra-${Date.now()}`, effectiveness_id: effectivenessId, ...source, created_at: new Date().toISOString() });
      sources.set(effectivenessId, existing);
      return { ok: true, data: existing[existing.length - 1] };
    },

    recordObservation(effectivenessId, pmUserId, input) {
      const current = this.getEffectiveness(effectivenessId, pmUserId);
      if (!current.ok) return current;
      if (current.data.effectiveness_status === "validated") return { ok: false, error: "Observations cannot be added to validated records.", failureClass: "governance_violation" };
      if (!required(input.observationSummary)) return { ok: false, error: "observationSummary is required.", failureClass: "validation_failed" };
      const obs = {
        id: makeUuid(),
        effectiveness_id: effectivenessId,
        observation_summary: input.observationSummary.trim(),
        recorded_at: new Date().toISOString(),
        recorded_by: input.recordedBy ?? null,
        metadata: input.metadata ?? {},
      };
      const existing = observations.get(effectivenessId) ?? [];
      existing.push(obs);
      observations.set(effectivenessId, existing);
      events.push({ type: "PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED", effectivenessId, learningEligible: false, eventCategory: "governance", visibility: "personal", sensitivityLevel: "confidential" });
      return { ok: true, data: obs };
    },

    exportEffectiveness(effectivenessId, pmUserId) {
      const r = this.getEffectiveness(effectivenessId, pmUserId);
      if (!r.ok) return r;
      const lineage = {
        effectiveness: r.data,
        observations: observations.get(effectivenessId) ?? [],
        sources: sources.get(effectivenessId) ?? [],
        events: [],
        decisions: [],
        decisionEffectiveness: [],
        organizationalPatterns: [],
        organizationalMemory: [],
        personalMemory: [],
        personalPatterns: [],
        outcomes: [],
        unresolvedSources: [],
        timeline: r.data.created_at,
      };
      return {
        ok: true,
        data: {
          effectiveness: r.data,
          observations: lineage.observations,
          sources: lineage.sources,
          lineage,
          unresolvedSources: lineage.unresolvedSources,
        },
      };
    },

    getHealth(workspaceId, pmUserId) {
      const myRecords = [...records.values()].filter(
        (r) => r.workspace_id === workspaceId && r.pm_user_id === pmUserId,
      );
      const total = myRecords.length;
      const recordIds = new Set(myRecords.map((r) => r.id));
      const mySources = [...sources.entries()]
        .filter(([id]) => recordIds.has(id))
        .flatMap(([, srcs]) => srcs);
      const myObs = [...observations.entries()]
        .filter(([id]) => recordIds.has(id))
        .flatMap(([, obs]) => obs);

      const recordsWithSource = new Set(mySources.map((s) => s.effectiveness_id)).size;
      const lineageTypes = new Set(["decision", "decision_effectiveness", "outcome", "platform_event"]);
      const recordsWithLineage = new Set(
        mySources.filter((s) => lineageTypes.has(s.source_type)).map((s) => s.effectiveness_id),
      ).size;

      return {
        ok: true,
        data: {
          candidateCount: myRecords.filter((r) => r.effectiveness_status === "candidate").length,
          validatedCount: myRecords.filter((r) => r.effectiveness_status === "validated").length,
          archivedCount: myRecords.filter((r) => r.effectiveness_status === "archived").length,
          deprecatedCount: myRecords.filter((r) => r.effectiveness_status === "deprecated").length,
          observationCount: myObs.length,
          sourceCoverage: total === 0 ? 0 : clamp(recordsWithSource / total),
          lineageCoverage: total === 0 ? 0 : clamp(recordsWithLineage / total),
          successCount: myRecords.filter((r) => r.outcome_classification === "success").length,
          partialSuccessCount: myRecords.filter((r) => r.outcome_classification === "partial_success").length,
          failureCount: myRecords.filter((r) => r.outcome_classification === "failure").length,
          unknownCount: myRecords.filter((r) => r.outcome_classification === "unknown").length,
        },
      };
    },
  };
}

// ─── Static file readers ──────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const migration = read("supabase/migrations/20260620000000_personal_pm_effectiveness_foundation.sql");
const typesTs = read("src/lib/personal-effectiveness/types.ts");
const serviceTs = read("src/lib/personal-effectiveness/personal-effectiveness-service.ts");
const sourceResolverTs = read("src/lib/personal-effectiveness/source-resolver.ts");
const contractTs = read("src/lib/db/database-contract.ts");

// ─── Migration tests ──────────────────────────────────────────────────────────

test("E-M-1: migration creates personal_pm_effectiveness table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_effectiveness/);
});

test("E-M-2: migration creates personal_pm_effectiveness_sources table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_effectiveness_sources/);
});

test("E-M-3: migration creates personal_pm_effectiveness_observations table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_effectiveness_observations/);
});

test("E-M-4: migration defines outcome_classification constraint with allowed values", () => {
  assert.match(migration, /outcome_classification.*check.*success.*partial_success.*failure.*unknown/s);
});

test("E-M-5: migration defines effectiveness_status constraint with allowed values", () => {
  assert.match(migration, /effectiveness_status.*check.*candidate.*validated.*archived.*deprecated/s);
});

test("E-M-6: migration enforces anchor reference constraint", () => {
  assert.match(migration, /personal_pm_effectiveness_anchor_required/);
  assert.match(migration, /personal_pattern_id is not null.*or.*personal_memory_id is not null/s);
});

test("E-M-7: migration enables RLS on all three tables", () => {
  assert.match(migration, /alter table public\.personal_pm_effectiveness enable row level security/);
  assert.match(migration, /alter table public\.personal_pm_effectiveness_sources enable row level security/);
  assert.match(migration, /alter table public\.personal_pm_effectiveness_observations enable row level security/);
});

test("E-M-8: RLS policy enforces both workspace_id and pm_user_id", () => {
  assert.match(migration, /workspace_id.*=.*auth\.jwt.*app_metadata.*workspace_id/s);
  assert.match(migration, /pm_user_id = auth\.uid\(\)/);
});

test("E-M-9: migration includes validated guard trigger", () => {
  assert.match(migration, /personal_pm_effectiveness_validated_guard/);
  assert.match(migration, /Validated personal PM effectiveness records can only be archived/);
});

test("E-M-10: sources of validated records trigger guard exists", () => {
  assert.match(migration, /personal_pm_effectiveness_sources_validated_guard/);
  assert.match(migration, /Sources of validated personal PM effectiveness records cannot be mutated/);
});

test("E-M-11: observations of validated records trigger guard exists", () => {
  assert.match(migration, /personal_pm_effectiveness_observations_validated_guard/);
  assert.match(migration, /Observations of validated personal PM effectiveness records cannot be mutated/);
});

test("E-M-12: indexes include workspace_id + pm_user_id + updated_at", () => {
  assert.match(migration, /workspace_id, pm_user_id, updated_at desc/);
});

test("E-M-13: partial indexes exist for nullable anchor fields", () => {
  assert.match(migration, /where personal_pattern_id is not null/);
  assert.match(migration, /where personal_memory_id is not null/);
  assert.match(migration, /where decision_id is not null/);
  assert.match(migration, /where decision_effectiveness_id is not null/);
});

// ─── RLS / cross-PM isolation tests ──────────────────────────────────────────

test("E-R-1: RLS enforces workspace_id and pm_user_id isolation", () => {
  const store = createStore();
  const wsId = makeUuid();
  const pm1 = makeUuid();
  const pm2 = makeUuid();
  const srcId = makeUuid();

  const r = store.createEffectiveness({
    workspaceId: wsId, pmUserId: pm1, actorId: pm1,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: srcId, relationshipType: "supports" }],
  });
  assert.equal(r.ok, true);

  // PM2 cannot read PM1's record.
  const crossRead = store.getEffectiveness(r.data.id, pm2);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.failureClass, "not_found");
});

test("E-R-2: cross-PM reads return not_found", () => {
  const store = createStore();
  const wsId = makeUuid();
  const pm1 = makeUuid();
  const pm2 = makeUuid();
  const srcId = makeUuid();

  const r = store.createEffectiveness({
    workspaceId: wsId, pmUserId: pm1, actorId: pm1,
    outcomeClassification: "failure", summary: "Test",
    personalPatternId: makeUuid(),
    sources: [{ sourceType: "personal_pattern", sourceId: srcId, relationshipType: "derived_from" }],
  });
  assert.equal(r.ok, true);

  const denial = store.getEffectiveness(r.data.id, pm2);
  assert.equal(denial.ok, false);
  assert.equal(denial.failureClass, "not_found");
});

// ─── Source required on creation ──────────────────────────────────────────────

test("E-S-1: creation fails when no sources provided", () => {
  const store = createStore();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: makeUuid(), actorId: makeUuid(),
    outcomeClassification: "unknown", summary: "Test",
    decisionId: makeUuid(),
    sources: [],
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /source/i);
});

test("E-S-2: creation fails when anchor reference missing", () => {
  const store = createStore();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: makeUuid(), actorId: makeUuid(),
    outcomeClassification: "success", summary: "Test",
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /anchor/i);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test("E-A-1: creation emits PERSONAL_EFFECTIVENESS_CREATED", () => {
  const store = createStore();
  store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: makeUuid(), actorId: makeUuid(),
    outcomeClassification: "success", summary: "Created",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_CREATED"));
});

test("E-A-2: update emits PERSONAL_EFFECTIVENESS_UPDATED", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Initial",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.updateEffectiveness(r.data.id, pm, pm, { summary: "Updated" });
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_UPDATED"));
});

test("E-A-3: validation emits PERSONAL_EFFECTIVENESS_VALIDATED", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_VALIDATED"));
});

test("E-A-4: archive emits PERSONAL_EFFECTIVENESS_ARCHIVED", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.archiveEffectiveness(r.data.id, pm, pm);
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_ARCHIVED"));
});

test("E-A-5: delete emits PERSONAL_EFFECTIVENESS_DELETED", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "failure", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.deleteEffectiveness(r.data.id, pm, pm);
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_DELETED"));
});

test("E-A-6: observation recording emits PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "unknown", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.recordObservation(r.data.id, pm, { observationSummary: "Note", recordedBy: pm });
  assert.ok(store.events.some((e) => e.type === "PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED"));
});

test("E-A-7: all events have learningEligible=false", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  store.archiveEffectiveness(r.data.id, pm, pm);
  assert.ok(store.events.every((e) => e.learningEligible === false));
});

test("E-A-8: all events have eventCategory=governance", () => {
  const store = createStore();
  const pm = makeUuid();
  store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  assert.ok(store.events.every((e) => e.eventCategory === "governance"));
});

test("E-A-9: all events have visibility=personal", () => {
  const store = createStore();
  const pm = makeUuid();
  store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  assert.ok(store.events.every((e) => e.visibility === "personal"));
});

// ─── Validated-record immutability ────────────────────────────────────────────

test("E-V-1: validated records cannot be updated", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const update = store.updateEffectiveness(r.data.id, pm, pm, { summary: "Hacked" });
  assert.equal(update.ok, false);
  assert.equal(update.failureClass, "governance_violation");
});

test("E-V-2: validated records cannot be deleted", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const del = store.deleteEffectiveness(r.data.id, pm, pm);
  assert.equal(del.ok, false);
  assert.equal(del.failureClass, "governance_violation");
});

test("E-V-3: validated records cannot be deprecated", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const dep = store.deprecateEffectiveness(r.data.id, pm, pm);
  assert.equal(dep.ok, false);
  assert.equal(dep.failureClass, "governance_violation");
});

test("E-V-4: validated records cannot have sources mutated", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const addSrc = store.addSource(r.data.id, pm, { source_type: "outcome", source_id: makeUuid(), relationship_type: "supports" });
  assert.equal(addSrc.ok, false);
  assert.equal(addSrc.failureClass, "governance_violation");
});

test("E-V-5: validated records cannot have observations mutated", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const obs = store.recordObservation(r.data.id, pm, { observationSummary: "Blocked" });
  assert.equal(obs.ok, false);
  assert.equal(obs.failureClass, "governance_violation");
});

test("E-V-6: validated records can be archived", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "Test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  store.validateEffectiveness(r.data.id, pm, pm);
  const archived = store.archiveEffectiveness(r.data.id, pm, pm);
  assert.equal(archived.ok, true);
  assert.equal(archived.data.effectiveness_status, "archived");
});

// ─── Export ───────────────────────────────────────────────────────────────────

test("E-X-1: export includes effectiveness, observations, sources, lineage, unresolvedSources", () => {
  const store = createStore();
  const pm = makeUuid();
  const r = store.createEffectiveness({
    workspaceId: makeUuid(), pmUserId: pm, actorId: pm,
    outcomeClassification: "partial_success", summary: "Export test",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "derived_from" }],
  });
  store.recordObservation(r.data.id, pm, { observationSummary: "Note one" });

  const exported = store.exportEffectiveness(r.data.id, pm);
  assert.equal(exported.ok, true);
  assert.ok("effectiveness" in exported.data);
  assert.ok("observations" in exported.data);
  assert.ok("sources" in exported.data);
  assert.ok("lineage" in exported.data);
  assert.ok("unresolvedSources" in exported.data);
  assert.equal(exported.data.observations.length, 1);
  assert.equal(exported.data.sources.length, 1);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test("E-H-1: health metrics are clamped between 0 and 1", () => {
  const store = createStore();
  const ws = makeUuid();
  const pm = makeUuid();

  // Zero records: coverages should be 0.
  const empty = store.getHealth(ws, pm);
  assert.equal(empty.data.sourceCoverage, 0);
  assert.equal(empty.data.lineageCoverage, 0);

  // Create a record with a decision source (qualifies for lineage).
  store.createEffectiveness({
    workspaceId: ws, pmUserId: pm, actorId: pm,
    outcomeClassification: "success", summary: "H",
    decisionId: makeUuid(),
    sources: [{ sourceType: "decision", sourceId: makeUuid(), relationshipType: "supports" }],
  });
  const h = store.getHealth(ws, pm);
  assert.ok(h.data.sourceCoverage >= 0 && h.data.sourceCoverage <= 1);
  assert.ok(h.data.lineageCoverage >= 0 && h.data.lineageCoverage <= 1);
  assert.equal(h.data.sourceCoverage, 1);
  assert.equal(h.data.lineageCoverage, 1);
});

test("E-H-2: outcome classification counts are correct", () => {
  const store = createStore();
  const ws = makeUuid();
  const pm = makeUuid();
  const srcId = () => makeUuid();
  const decId = () => makeUuid();

  const mkRecord = (cls) =>
    store.createEffectiveness({
      workspaceId: ws, pmUserId: pm, actorId: pm,
      outcomeClassification: cls, summary: `${cls} record`,
      decisionId: decId(),
      sources: [{ sourceType: "decision", sourceId: srcId(), relationshipType: "supports" }],
    });

  mkRecord("success");
  mkRecord("success");
  mkRecord("partial_success");
  mkRecord("failure");
  mkRecord("unknown");

  const h = store.getHealth(ws, pm);
  assert.equal(h.data.successCount, 2);
  assert.equal(h.data.partialSuccessCount, 1);
  assert.equal(h.data.failureCount, 1);
  assert.equal(h.data.unknownCount, 1);
  assert.equal(h.data.candidateCount, 5);
  assert.equal(h.data.validatedCount, 0);
});

// ─── Capability vocabulary ────────────────────────────────────────────────────

test("E-C-1: capability vocabulary exists in types.ts", () => {
  for (const cap of CAPABILITIES) {
    assert.match(typesTs, new RegExp(cap));
  }
});

test("E-C-2: capability constants are exported from types.ts", () => {
  assert.match(typesTs, /PERSONAL_EFFECTIVENESS_CAPABILITIES/);
  assert.match(typesTs, /as const/);
});

// ─── Source resolver ──────────────────────────────────────────────────────────

test("E-SR-1: source-resolver.ts is isolated from service", () => {
  // source-resolver should not import from personal-effectiveness-service.
  assert.doesNotMatch(sourceResolverTs, /personal-effectiveness-service/);
});

test("E-SR-2: source-resolver resolvePersonalEffectivenessSources is exported", () => {
  assert.match(sourceResolverTs, /export async function resolvePersonalEffectivenessSources/);
});

test("E-SR-3: source-resolver exposes unresolvedSources for audit visibility", () => {
  assert.match(sourceResolverTs, /unresolvedSources/);
});

test("E-SR-4: source-resolver does not over-engineer unsupported types", () => {
  // Unresolvable source types stay in unresolvedSources.
  assert.match(sourceResolverTs, /unresolvedSources\.push/);
});

// ─── No AI / ML / scoring / profiling / prediction ───────────────────────────

test("E-N-1: no AI/ML/embedding/vector terms in service", () => {
  const forbidden = /\b(embedding|vector|semantic|similarity|cosine|llm|gpt|openai|ml_model|inference|classify_with|predict|behavioral_score|pm_score|performance_score|trust_score|leadership_score|effectiveness_score|ranking|rating|probability|personality|psychological|profile)\b/i;
  assert.doesNotMatch(serviceTs, forbidden);
});

test("E-N-2: no scoring or profiling in types", () => {
  const forbidden = /\b(pm_score|performance_score|behavior_score|trust_score|leadership_score|effectiveness_score|ranking|rating|probability|prediction|future_success|future_failure|personality|psychological|profile)\b/i;
  assert.doesNotMatch(typesTs, forbidden);
});

test("E-N-3: no recommendation generation in service", () => {
  assert.doesNotMatch(serviceTs, /recommendation/i);
});

test("E-N-4: no autonomous effectiveness creation in service", () => {
  assert.doesNotMatch(serviceTs, /auto_create|autonomous|self_create/i);
});

// ─── Database contract ────────────────────────────────────────────────────────

test("E-DB-1: contract version preserves prior keywords", () => {
  assert.match(contractTs, /platform-events/);
  assert.match(contractTs, /execution-tasks/);
  assert.match(contractTs, /decision-effectiveness/);
  assert.match(contractTs, /personal-pm-patterns/);
});

test("E-DB-2: contract version includes personal-pm-effectiveness", () => {
  assert.match(contractTs, /personal-pm-effectiveness/);
});

test("E-DB-3: PersonalPmEffectivenessRow is defined in contract", () => {
  assert.match(contractTs, /PersonalPmEffectivenessRow/);
});

test("E-DB-4: PersonalPmEffectivenessSourceRow is defined in contract", () => {
  assert.match(contractTs, /PersonalPmEffectivenessSourceRow/);
});

test("E-DB-5: PersonalPmEffectivenessObservationRow is defined in contract", () => {
  assert.match(contractTs, /PersonalPmEffectivenessObservationRow/);
});

test("E-DB-6: selectable columns constants exist", () => {
  assert.match(contractTs, /PERSONAL_PM_EFFECTIVENESS_SELECTABLE_COLUMNS/);
  assert.match(contractTs, /PERSONAL_PM_EFFECTIVENESS_SOURCE_SELECTABLE_COLUMNS/);
  assert.match(contractTs, /PERSONAL_PM_EFFECTIVENESS_OBSERVATION_SELECTABLE_COLUMNS/);
});

// ─── Migration comment guards ─────────────────────────────────────────────────

test("E-MG-1: migration header mentions no AI, scoring, profiling", () => {
  assert.match(migration, /No AI/);
  assert.match(migration, /No scoring/);
  assert.match(migration, /No profiling/);
});

test("E-MG-2: migration table comment mentions not-AI contract", () => {
  assert.match(migration, /Not AI/);
  assert.match(migration, /Not scoring/);
  assert.match(migration, /Not profiling/);
});

// ─── Audit event type vocabulary ─────────────────────────────────────────────

test("E-ET-1: all audit event types defined in types.ts", () => {
  for (const evt of AUDIT_EVENT_TYPES) {
    assert.match(typesTs, new RegExp(evt));
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

test("E-DOC-1: documentation file exists", () => {
  const exists = fs.existsSync(path.join(ROOT, "docs/personal-pm-effectiveness-foundation.md"));
  assert.equal(exists, true);
});
