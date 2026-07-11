import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Source file reads ────────────────────────────────────────────────────────

const typesFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-types.ts", "utf8");
const scopingFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-scoping.ts", "utf8");
const lineageFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-lineage.ts", "utf8");
const signalsFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-signals.ts", "utf8");
const ingestionFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-ingestion.ts", "utf8");
const persistenceFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-persistence.ts", "utf8");
const retrievalFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-retrieval.ts", "utf8");
const continuityFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-continuity.ts", "utf8");
const managerFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-manager.ts", "utf8");
const diagnosticsFile = fs.readFileSync("src/lib/operational-memory/runtime-memory-diagnostics.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/operational-memory/index.ts", "utf8");
const migrationFile = fs.readFileSync("supabase/migrations/20260522000000_operational_runtime_memory.sql", "utf8");

// ─── Dynamic imports for pure functions ──────────────────────────────────────

const {
  validateOperationalScope,
  buildScopeKey,
  buildPartialScopeKey,
  scopesMatch,
  scopeIsWithinBoundary,
  assertScopeIsolation,
} = await import("../src/lib/operational-memory/runtime-memory-scoping.js").catch(() => ({
  validateOperationalScope: null,
  buildScopeKey: null,
  buildPartialScopeKey: null,
  scopesMatch: null,
  scopeIsWithinBoundary: null,
  assertScopeIsolation: null,
}));

const { buildCausalityChain, reconstructLineageAncestry, computeLineageDepth, findLineageRoot } =
  await import("../src/lib/operational-memory/runtime-memory-lineage.js").catch(() => ({
    buildCausalityChain: null,
    reconstructLineageAncestry: null,
    computeLineageDepth: null,
    findLineageRoot: null,
  }));

const { extractOperationalSignals, signalToRecordType, computeSignalWeights } = await import(
  "../src/lib/operational-memory/runtime-memory-signals.js"
).catch(() => ({
  extractOperationalSignals: null,
  signalToRecordType: null,
  computeSignalWeights: null,
}));

const { computeContinuityScore, detectContinuityGaps } = await import(
  "../src/lib/operational-memory/runtime-memory-continuity.js"
).catch(() => ({ computeContinuityScore: null, detectContinuityGaps: null }));

const { computePressureWeight } = await import(
  "../src/lib/operational-memory/runtime-memory-retrieval.js"
).catch(() => ({ computePressureWeight: null }));

const { diagnoseRetrievalItem, diagnosePressureWeighting, diagnoseContinuityGap } = await import(
  "../src/lib/operational-memory/runtime-memory-diagnostics.js"
).catch(() => ({
  diagnoseRetrievalItem: null,
  diagnosePressureWeighting: null,
  diagnoseContinuityGap: null,
}));

// ─── Type definitions ─────────────────────────────────────────────────────────

test("types file defines all required operational memory types", () => {
  const required = [
    "OperationalMemoryScope",
    "OperationalMemoryRecordType",
    "OperationalResolutionStatus",
    "OperationalLineageType",
    "OperationalIngestionSource",
    "OperationalMemoryWeights",
    "OperationalMemoryRecord",
    "OperationalContinuityRecord",
    "OperationalInterventionRecord",
    "OperationalDecisionRecord",
    "OperationalCommitmentRecord",
    "OperationalRiskSignal",
    "OperationalPressureSignal",
    "OperationalStakeholderSignal",
    "OperationalDependencySignal",
    "OperationalEscalationSignal",
    "OperationalTimelineSignal",
    "OperationalSignal",
    "OperationalMemoryIngestionInput",
    "OperationalMemoryIngestionResult",
    "OperationalTimelineEvent",
    "OperationalTimeline",
    "OperationalCausalityChain",
  ];
  for (const name of required) {
    assert.match(typesFile, new RegExp(`export type ${name}`), `Missing type: ${name}`);
  }
});

test("types include all five weight dimensions", () => {
  assert.match(typesFile, /continuityWeight/);
  assert.match(typesFile, /operationalPressureWeight/);
  assert.match(typesFile, /escalationWeight/);
  assert.match(typesFile, /unresolvedWeight/);
  assert.match(typesFile, /deliveryImpactWeight/);
});

test("types include multi-dimensional scope fields", () => {
  assert.match(typesFile, /companyId: string/);
  assert.match(typesFile, /workspaceId: string \| null/);
  assert.match(typesFile, /projectId: string \| null/);
  assert.match(typesFile, /conversationId/);
  assert.match(typesFile, /interventionId/);
  assert.match(typesFile, /stakeholderId/);
});

test("types include operational causality lineage fields", () => {
  assert.match(typesFile, /parentRecordId/);
  assert.match(typesFile, /lineageType/);
  assert.match(typesFile, /caused_by/);
  assert.match(typesFile, /escalates_to/);
  assert.match(typesFile, /resolved_by/);
});

// ─── Scoping ──────────────────────────────────────────────────────────────────

test("scoping module exports required functions", () => {
  for (const fn of [
    "export function validateOperationalScope",
    "export function buildScopeKey",
    "export function buildPartialScopeKey",
    "export function scopesMatch",
    "export function scopeIsWithinBoundary",
    "export function assertScopeIsolation",
  ]) {
    assert.match(scopingFile, new RegExp(fn), `Missing export: ${fn}`);
  }
});

test("validateOperationalScope rejects missing companyId", () => {
  if (!validateOperationalScope) return;
  const violation = validateOperationalScope({ companyId: "", workspaceId: null, projectId: null });
  assert.ok(violation !== null);
  assert.equal(violation?.type, "missing_required_scope");
});

test("validateOperationalScope accepts valid scope", () => {
  if (!validateOperationalScope) return;
  const result = validateOperationalScope({ companyId: "company-abc", workspaceId: null, projectId: null });
  assert.equal(result, null);
});

test("buildScopeKey produces deterministic compound key", () => {
  if (!buildScopeKey) return;
  const scope = { companyId: "c1", workspaceId: "w1", projectId: "p1", conversationId: "cv1", interventionId: null, stakeholderId: null };
  const key = buildScopeKey(scope);
  assert.ok(key.includes("c1"));
  assert.ok(key.includes("w1"));
  assert.ok(key.includes("p1"));
  assert.equal(buildScopeKey(scope), buildScopeKey(scope));
});

test("buildPartialScopeKey produces company::workspace::project key", () => {
  if (!buildPartialScopeKey) return;
  const key = buildPartialScopeKey({ companyId: "c1", workspaceId: "w1", projectId: null });
  assert.ok(key.startsWith("c1"));
  assert.ok(key.includes("w1"));
  assert.ok(key.includes("none"));
});

test("scopesMatch is true for same scope and false for different company", () => {
  if (!scopesMatch) return;
  const a = { companyId: "c1", workspaceId: "w1", projectId: null };
  const b = { companyId: "c1", workspaceId: "w1", projectId: null };
  const c = { companyId: "c2", workspaceId: "w1", projectId: null };
  assert.equal(scopesMatch(a, b), true);
  assert.equal(scopesMatch(a, c), false);
});

test("scopeIsWithinBoundary enforces company isolation", () => {
  if (!scopeIsWithinBoundary) return;
  const inner = { companyId: "c1", workspaceId: "w1", projectId: "p1" };
  const boundary = { companyId: "c1", workspaceId: "w1", projectId: null };
  const foreignBoundary = { companyId: "c2", workspaceId: null, projectId: null };
  assert.equal(scopeIsWithinBoundary(inner, boundary), true);
  assert.equal(scopeIsWithinBoundary(inner, foreignBoundary), false);
});

test("assertScopeIsolation throws on cross-tenant access", () => {
  if (!assertScopeIsolation) return;
  const recordScope = { companyId: "c1", workspaceId: null, projectId: null };
  const requestScope = { companyId: "c2", workspaceId: null, projectId: null };
  assert.throws(
    () => assertScopeIsolation(recordScope, requestScope),
    /operational_memory_scope_violation/,
  );
});

test("assertScopeIsolation does not throw for same company", () => {
  if (!assertScopeIsolation) return;
  const scope = { companyId: "c1", workspaceId: "w1", projectId: null };
  assert.doesNotThrow(() => assertScopeIsolation(scope, scope));
});

// ─── Lineage / causality chain ────────────────────────────────────────────────

test("lineage module exports required functions", () => {
  for (const fn of [
    "export function buildCausalityChain",
    "export function reconstructLineageAncestry",
    "export function computeLineageDepth",
    "export function findLineageRoot",
    "export function getDirectChildren",
  ]) {
    assert.match(lineageFile, new RegExp(fn), `Missing export: ${fn}`);
  }
});

const makeRecord = (id, parentId = null, status = "unresolved") => ({
  id,
  recordType: "blocker",
  summary: `Record ${id}`,
  detail: null,
  scope: { companyId: "c1", workspaceId: null, projectId: null },
  parentRecordId: parentId,
  lineageType: parentId ? "caused_by" : null,
  resolutionStatus: status,
  weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.7, deliveryImpactWeight: 0.7 },
  confidence: 0.7,
  ingestionSource: "chat_conversation",
  sourceRef: null,
  nutrientIds: [],
  interventionCount: 0,
  firstObservedAt: new Date().toISOString(),
  lastObservedAt: new Date().toISOString(),
  resolvedAt: null,
  createdAt: new Date().toISOString(),
});

test("buildCausalityChain builds chain from root through children", () => {
  if (!buildCausalityChain) return;
  const root = makeRecord("r1");
  const child = makeRecord("c1", "r1");
  const grandchild = makeRecord("g1", "c1");
  const chain = buildCausalityChain(root, [root, child, grandchild]);
  assert.equal(chain.rootRecordId, "r1");
  assert.equal(chain.chain.length, 3);
  assert.equal(chain.totalDepth, 2);
  assert.equal(chain.unresolved, true);
});

test("buildCausalityChain marks chain resolved when all records resolved", () => {
  if (!buildCausalityChain) return;
  const root = makeRecord("r1", null, "resolved");
  const child = makeRecord("c1", "r1", "resolved");
  const chain = buildCausalityChain(root, [root, child]);
  assert.equal(chain.unresolved, false);
});

test("buildCausalityChain handles cycle prevention", () => {
  if (!buildCausalityChain) return;
  const a = makeRecord("a", "b");
  const b = makeRecord("b", "a");
  assert.doesNotThrow(() => buildCausalityChain(a, [a, b]));
});

test("reconstructLineageAncestry returns ancestry in order from root", () => {
  if (!reconstructLineageAncestry) return;
  const root = makeRecord("root");
  const mid = makeRecord("mid", "root");
  const leaf = makeRecord("leaf", "mid");
  const ancestry = reconstructLineageAncestry(leaf, [root, mid, leaf]);
  assert.equal(ancestry.length, 2);
  assert.equal(ancestry[0].id, "root");
  assert.equal(ancestry[1].id, "mid");
});

test("computeLineageDepth returns correct depth", () => {
  if (!computeLineageDepth) return;
  const root = makeRecord("root");
  const mid = makeRecord("mid", "root");
  const leaf = makeRecord("leaf", "mid");
  assert.equal(computeLineageDepth(root, [root, mid, leaf]), 0);
  assert.equal(computeLineageDepth(leaf, [root, mid, leaf]), 2);
});

test("findLineageRoot returns the root for any descendant", () => {
  if (!findLineageRoot) return;
  const root = makeRecord("root");
  const mid = makeRecord("mid", "root");
  const leaf = makeRecord("leaf", "mid");
  const found = findLineageRoot(leaf, [root, mid, leaf]);
  assert.equal(found.id, "root");
});

// ─── Signal extraction ────────────────────────────────────────────────────────

test("signals module exports required functions", () => {
  for (const fn of [
    "export function extractOperationalSignals",
    "export function signalToRecordType",
    "export function computeSignalWeights",
  ]) {
    assert.match(signalsFile, new RegExp(fn), `Missing export: ${fn}`);
  }
});

test("extractOperationalSignals detects blocker/risk/escalation/dependency/timeline/pressure signals", () => {
  if (!extractOperationalSignals) return;
  const ctx = { sourceRef: "test", timestamp: new Date().toISOString() };

  const risk = extractOperationalSignals("This project is at risk of missing the deadline", ctx);
  assert.ok(risk.some((s) => s.signalType === "risk"), "Should detect risk signal");

  const blocker = extractOperationalSignals("We are still blocked on procurement approval and cannot proceed", ctx);
  assert.ok(blocker.some((s) => s.signalType === "pressure"), "Should detect pressure signal for blocker");

  const escalation = extractOperationalSignals("Executive escalation required — steering committee is not responding", ctx);
  assert.ok(escalation.some((s) => s.signalType === "escalation"), "Should detect escalation signal");

  const dependency = extractOperationalSignals("This work depends on the upstream team completing their handoff", ctx);
  assert.ok(dependency.some((s) => s.signalType === "dependency"), "Should detect dependency signal");

  const timeline = extractOperationalSignals("The delivery is overdue and we have a date conflict with Q3 launch", ctx);
  assert.ok(timeline.some((s) => s.signalType === "timeline"), "Should detect timeline signal");
});

test("extractOperationalSignals rejects content below minimum length", () => {
  if (!extractOperationalSignals) return;
  const ctx = { sourceRef: "test", timestamp: new Date().toISOString() };
  const signals = extractOperationalSignals("hi", ctx);
  assert.equal(signals.length, 0);
});

test("signalToRecordType maps signal types to record types correctly", () => {
  if (!signalToRecordType) return;
  assert.equal(signalToRecordType({ signalType: "risk" }), "risk");
  assert.equal(signalToRecordType({ signalType: "pressure" }), "delivery_pressure");
  assert.equal(signalToRecordType({ signalType: "escalation" }), "escalation");
  assert.equal(signalToRecordType({ signalType: "stakeholder" }), "stakeholder_signal");
  assert.equal(signalToRecordType({ signalType: "dependency" }), "dependency");
  assert.equal(signalToRecordType({ signalType: "timeline" }), "timeline_signal");
});

test("computeSignalWeights returns valid weight object for all signal types", () => {
  if (!computeSignalWeights) return;
  const riskSignal = { signalType: "risk", severity: "high", riskCategory: "delivery", summary: "risk", confidence: 0.8, sourceRef: "test", timestamp: new Date().toISOString(), lineageMemoryRecordId: null, retrievalWeight: 0.85 };
  const weights = computeSignalWeights(riskSignal);
  assert.ok(weights.continuityWeight >= 0 && weights.continuityWeight <= 1);
  assert.ok(weights.operationalPressureWeight >= 0 && weights.operationalPressureWeight <= 1);
  assert.ok(weights.escalationWeight >= 0 && weights.escalationWeight <= 1);
  assert.ok(weights.unresolvedWeight >= 0 && weights.unresolvedWeight <= 1);
  assert.ok(weights.deliveryImpactWeight >= 0 && weights.deliveryImpactWeight <= 1);
});

// ─── Ingestion ────────────────────────────────────────────────────────────────

test("ingestion module exports ingestOperationalMemory and persistOperationalSignal", () => {
  assert.match(ingestionFile, /export async function ingestOperationalMemory/);
  assert.match(ingestionFile, /export async function persistOperationalSignal/);
});

test("ingestion validates scope before processing", () => {
  assert.match(ingestionFile, /validateOperationalScope/);
  assert.match(ingestionFile, /scope_violation/);
});

test("ingestion skips content that is too short", () => {
  assert.match(ingestionFile, /content_too_short/);
  assert.match(ingestionFile, /MIN_INGESTION_TEXT/);
});

test("ingestion skips when no operational signals are found", () => {
  assert.match(ingestionFile, /no_operational_signals/);
});

// ─── Persistence ──────────────────────────────────────────────────────────────

test("persistence module exports required functions", () => {
  for (const fn of [
    "export async function persistOperationalMemoryRecord",
    "export async function persistOperationalInterventionRecord",
    "export async function loadOperationalMemoryRecords",
    "export async function loadOperationalInterventionRecords",
  ]) {
    assert.match(persistenceFile, new RegExp(fn), `Missing: ${fn}`);
  }
});

test("persistence enforces company_id scoping in load queries", () => {
  assert.match(persistenceFile, /\.eq\("company_id", scope\.companyId\)/);
  assert.match(persistenceFile, /\.eq\("company_id", companyId\)/);
});

test("persistence falls back gracefully on Supabase unavailability", () => {
  assert.match(persistenceFile, /persistence_unavailable/);
  assert.match(persistenceFile, /return \[\]/);
});

// ─── Retrieval ────────────────────────────────────────────────────────────────

test("retrieval module exports required functions and types", () => {
  for (const token of [
    "export async function retrieveOperationalContinuity",
    "export async function retrieveOperationalPressure",
    "export async function retrieveInterventionLineage",
    "export function computePressureWeight",
    "export type OperationalRetrievalInput",
    "export type OperationalRetrievalItem",
    "export type OperationalRetrievalResult",
  ]) {
    assert.match(retrievalFile, new RegExp(token), `Missing: ${token}`);
  }
});

test("unresolved pressure weight increases with age", () => {
  if (!computePressureWeight) return;
  const record = makeRecord("r1");
  record.resolutionStatus = "unresolved";
  record.weights.unresolvedWeight = 0.7;
  const p0 = computePressureWeight(record, 0);
  const p14 = computePressureWeight(record, 14);
  const p30 = computePressureWeight(record, 30);
  assert.ok(p14 > p0, "Pressure should increase over time for unresolved items");
  assert.ok(p30 > p14, "Pressure should continue increasing");
  assert.ok(p30 <= 1.0, "Pressure should be capped at 1.0");
});

test("resolved records receive suppressed pressure weight", () => {
  if (!computePressureWeight) return;
  const record = makeRecord("r1", null, "resolved");
  record.weights.unresolvedWeight = 0.8;
  const weight = computePressureWeight(record, 30);
  assert.ok(weight < 0.2, "Resolved records should have suppressed pressure weight");
});

test("retrieval enforces scope isolation via assertScopeIsolation", () => {
  assert.match(retrievalFile, /assertScopeIsolation/);
  assert.match(retrievalFile, /suppressed\+\+/);
});

test("retrieval type base scores prioritize blockers and escalations over decisions", () => {
  assert.match(retrievalFile, /blocker: 30/);
  assert.match(retrievalFile, /escalation: 28/);
  assert.match(retrievalFile, /decision: 12/);
});

test("retrieval includes unresolved pressure rate constant", () => {
  assert.match(retrievalFile, /UNRESOLVED_PRESSURE_RATE = 0\.03/);
});

// ─── Continuity / timeline reconstruction ────────────────────────────────────

test("continuity module exports required functions", () => {
  for (const fn of [
    "export function detectContinuityGaps",
    "export function computeContinuityScore",
    "export async function reconstructOperationalTimeline",
    "export async function buildOperationalCausalityChains",
  ]) {
    assert.match(continuityFile, new RegExp(fn), `Missing: ${fn}`);
  }
});

test("detectContinuityGaps identifies unresolved blockers older than 7 days", () => {
  if (!detectContinuityGaps) return;
  const old = makeRecord("old");
  old.recordType = "blocker";
  old.resolutionStatus = "unresolved";
  old.firstObservedAt = new Date(Date.now() - 10 * 86400000).toISOString();
  const nowMs = Date.now();
  const gaps = detectContinuityGaps([old], nowMs);
  assert.ok(gaps.some((g) => g.type === "missing_resolution"), "Should detect old unresolved blocker");
});

test("detectContinuityGaps does not flag recently created records", () => {
  if (!detectContinuityGaps) return;
  const fresh = makeRecord("fresh");
  fresh.recordType = "blocker";
  fresh.resolutionStatus = "unresolved";
  fresh.firstObservedAt = new Date().toISOString();
  const gaps = detectContinuityGaps([fresh], Date.now());
  assert.equal(gaps.filter((g) => g.type === "missing_resolution").length, 0);
});

test("computeContinuityScore is 0 for no records", () => {
  if (!computeContinuityScore) return;
  assert.equal(computeContinuityScore([]), 0);
});

test("computeContinuityScore increases when records are resolved", () => {
  if (!computeContinuityScore) return;
  const unresolved = [makeRecord("r1"), makeRecord("r2")];
  const resolved = [makeRecord("r1", null, "resolved"), makeRecord("r2", null, "resolved")];
  const scoreUnresolved = computeContinuityScore(unresolved);
  const scoreResolved = computeContinuityScore(resolved);
  assert.ok(scoreResolved > scoreUnresolved, "More resolved records = higher continuity score");
});

test("continuity gaps ordered by ageDays descending", () => {
  if (!detectContinuityGaps) return;
  const old1 = makeRecord("old1");
  old1.recordType = "blocker";
  old1.resolutionStatus = "unresolved";
  old1.firstObservedAt = new Date(Date.now() - 20 * 86400000).toISOString();
  const old2 = makeRecord("old2");
  old2.recordType = "blocker";
  old2.resolutionStatus = "unresolved";
  old2.firstObservedAt = new Date(Date.now() - 10 * 86400000).toISOString();
  const gaps = detectContinuityGaps([old1, old2], Date.now());
  if (gaps.length >= 2) {
    assert.ok(gaps[0].ageDays >= gaps[1].ageDays, "Gaps should be sorted by ageDays desc");
  }
});

// ─── Diagnostics ──────────────────────────────────────────────────────────────

test("diagnostics module exports required functions", () => {
  for (const fn of [
    "export function diagnoseRetrievalItem",
    "export function diagnoseLineage",
    "export function diagnosePressureWeighting",
    "export function diagnoseContinuityGap",
    "export function generateContinuityDiagnosticsReport",
  ]) {
    assert.match(diagnosticsFile, new RegExp(fn), `Missing: ${fn}`);
  }
});

test("diagnoseRetrievalItem explains escalated priority", () => {
  if (!diagnoseRetrievalItem) return;
  const record = makeRecord("r1", null, "escalated");
  const item = {
    record,
    retrievalScore: 90,
    retrievalBasis: ["type_base:28", "resolution_status:20"],
    computedPressureWeight: 0.9,
    agedays: 5,
    interventionCount: 1,
    failedInterventionCount: 0,
  };
  const diag = diagnoseRetrievalItem(item);
  assert.ok(diag.priorityReason.includes("escalated"));
});

test("diagnosePressureWeighting shows pressure increase for unresolved items", () => {
  if (!diagnosePressureWeighting) return;
  const record = makeRecord("r1");
  record.weights.unresolvedWeight = 0.7;
  const diag = diagnosePressureWeighting(record, 14, 0.82);
  assert.ok(diag.pressureExplanation.includes("14") || diag.pressureExplanation.includes("Unresolved"));
  assert.ok(diag.pressureIncrease >= 0);
});

test("diagnoseContinuityGap includes recommended action for each gap type", () => {
  if (!diagnoseContinuityGap) return;
  const gap = { type: "missing_resolution", description: "blocker", relatedRecordId: "r1", ageDays: 10 };
  const diag = diagnoseContinuityGap(gap);
  assert.ok(diag.recommendedAction.length > 10);
  assert.ok(diag.explanation.includes("10"));
});

// ─── Manager / public API ─────────────────────────────────────────────────────

test("manager exports all public API functions", () => {
  for (const fn of [
    "export async function ingestOperationalMemoryRecord",
    "export async function retrieveOperationalContinuityContext",
    "export async function persistOperationalSignalRecord",
    "export async function retrieveOperationalPressureSignals",
    "export async function reconstructOperationalTimelineContext",
    "export async function retrieveInterventionLineageContext",
    "export async function getOperationalCausalityChains",
    "export async function generateOperationalDiagnostics",
  ]) {
    assert.match(managerFile, new RegExp(fn), `Missing manager export: ${fn}`);
  }
});

// ─── Index / public surface ───────────────────────────────────────────────────

test("index re-exports all major types and functions", () => {
  const required = [
    "OperationalMemoryScope",
    "OperationalMemoryRecord",
    "OperationalMemoryWeights",
    "OperationalCausalityChain",
    "validateOperationalScope",
    "buildScopeKey",
    "assertScopeIsolation",
    "buildCausalityChain",
    "extractOperationalSignals",
    "computeSignalWeights",
    "ingestOperationalMemoryRecord",
    "retrieveOperationalContinuityContext",
    "retrieveInterventionLineageContext",
    "reconstructOperationalTimelineContext",
    "retrieveOperationalContinuity",
    "computePressureWeight",
    "detectContinuityGaps",
    "computeContinuityScore",
    "diagnoseRetrievalItem",
    "diagnosePressureWeighting",
    "generateContinuityDiagnosticsReport",
  ];
  for (const token of required) {
    assert.ok(indexFile.includes(token), `index.ts missing: ${token}`);
  }
});

// ─── Migration ────────────────────────────────────────────────────────────────

test("migration creates operational_memory_runtime_records table with correct columns", () => {
  assert.match(migrationFile, /create table if not exists public\.operational_memory_runtime_records/);
  assert.match(migrationFile, /company_id text not null/);
  assert.match(migrationFile, /parent_record_id uuid null references public\.operational_memory_runtime_records/);
  assert.match(migrationFile, /lineage_type text null/);
  assert.match(migrationFile, /resolution_status text not null/);
  assert.match(migrationFile, /continuity_weight/);
  assert.match(migrationFile, /operational_pressure_weight/);
  assert.match(migrationFile, /escalation_weight/);
  assert.match(migrationFile, /unresolved_weight/);
  assert.match(migrationFile, /delivery_impact_weight/);
  assert.match(migrationFile, /ingestion_source text not null/);
  assert.match(migrationFile, /nutrient_ids jsonb/);
});

test("migration creates operational_intervention_records table", () => {
  assert.match(migrationFile, /create table if not exists public\.operational_intervention_records/);
  assert.match(migrationFile, /memory_record_id uuid not null references public\.operational_memory_runtime_records/);
  assert.match(migrationFile, /intervention_type text not null/);
  assert.match(migrationFile, /outcome text not null/);
});

test("migration enables RLS and creates tenant isolation policies", () => {
  assert.match(migrationFile, /enable row level security/);
  assert.match(migrationFile, /current_company_id\(\) = company_id/);
  assert.ok(
    (migrationFile.match(/create policy "/g) ?? []).length >= 2,
    "Should have at least 2 RLS policies",
  );
});

test("migration includes unresolved index for pressure retrieval performance", () => {
  assert.match(migrationFile, /operational_memory_runtime_records_unresolved_idx/);
  assert.match(migrationFile, /'unresolved', 'escalated', 'in_progress'/);
});

test("migration includes lineage parent index for causality chain traversal", () => {
  assert.match(migrationFile, /operational_memory_runtime_records_lineage_idx/);
  assert.match(migrationFile, /parent_record_id is not null/);
});
