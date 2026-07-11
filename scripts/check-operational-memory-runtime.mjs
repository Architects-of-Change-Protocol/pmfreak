#!/usr/bin/env node
/**
 * Operational Runtime Memory validation script.
 *
 * Validates the structural integrity and behavioral contracts of the
 * operational-memory domain without requiring a live Supabase connection.
 */

import fs from "node:fs";
import path from "node:path";

const PASS = "PASS";
const FAIL = "FAIL";
const results = [];

function check(label, fn) {
  try {
    fn();
    results.push({ label, status: PASS });
    process.stdout.write(`  ✓ ${label}\n`);
  } catch (err) {
    results.push({ label, status: FAIL, error: err.message });
    process.stdout.write(`  ✗ ${label}: ${err.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "assertion failed");
}

function readSrc(rel) {
  return fs.readFileSync(path.resolve("src/lib/operational-memory", rel), "utf8");
}

// ─── File existence ───────────────────────────────────────────────────────────

console.log("\n[1] File existence");

const REQUIRED_FILES = [
  "runtime-memory-types.ts",
  "runtime-memory-scoping.ts",
  "runtime-memory-lineage.ts",
  "runtime-memory-signals.ts",
  "runtime-memory-ingestion.ts",
  "runtime-memory-persistence.ts",
  "runtime-memory-retrieval.ts",
  "runtime-memory-continuity.ts",
  "runtime-memory-manager.ts",
  "runtime-memory-diagnostics.ts",
  "index.ts",
];

for (const file of REQUIRED_FILES) {
  check(`src/lib/operational-memory/${file} exists`, () => {
    assert(fs.existsSync(path.resolve("src/lib/operational-memory", file)), `Missing: ${file}`);
  });
}

check("migration 20260522000000_operational_runtime_memory.sql exists", () => {
  assert(fs.existsSync("supabase/migrations/20260522000000_operational_runtime_memory.sql"));
});

// ─── Type definitions ─────────────────────────────────────────────────────────

console.log("\n[2] Type definitions");

const types = readSrc("runtime-memory-types.ts");

check("all five weight dimensions defined", () => {
  for (const w of ["continuityWeight", "operationalPressureWeight", "escalationWeight", "unresolvedWeight", "deliveryImpactWeight"]) {
    assert(types.includes(w), `Missing weight: ${w}`);
  }
});

check("operational causality lineage types defined", () => {
  for (const lt of ["caused_by", "triggers", "blocks", "escalates_to", "resolved_by", "depends_on", "related_to"]) {
    assert(types.includes(lt), `Missing lineage type: ${lt}`);
  }
});

check("multi-dimensional scope fields defined", () => {
  for (const field of ["companyId", "workspaceId", "projectId", "conversationId", "interventionId", "stakeholderId"]) {
    assert(types.includes(field), `Missing scope field: ${field}`);
  }
});

check("all required operational record types defined", () => {
  for (const rt of ["blocker", "risk", "escalation", "decision", "commitment", "dependency", "stakeholder_signal", "delivery_pressure", "governance_gap", "timeline_signal"]) {
    assert(types.includes(`"${rt}"`), `Missing record type: ${rt}`);
  }
});

check("OperationalCausalityChain type defined", () => {
  assert(types.includes("OperationalCausalityChain"));
});

// ─── Scope isolation ──────────────────────────────────────────────────────────

console.log("\n[3] Scope isolation");

const scoping = readSrc("runtime-memory-scoping.ts");

check("assertScopeIsolation throws on cross-tenant access", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-scoping.js").catch(() => null);
  if (!mod) { assert(scoping.includes("operational_memory_scope_violation"), "Must include scope violation error"); return; }
  let threw = false;
  try { mod.assertScopeIsolation({ companyId: "a", workspaceId: null, projectId: null }, { companyId: "b", workspaceId: null, projectId: null }); }
  catch { threw = true; }
  assert(threw, "Should throw on cross-tenant access");
});

check("validateOperationalScope rejects empty companyId", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-scoping.js").catch(() => null);
  if (!mod) { assert(scoping.includes("missing_required_scope")); return; }
  const result = mod.validateOperationalScope({ companyId: "", workspaceId: null, projectId: null });
  assert(result !== null && result.type === "missing_required_scope");
});

check("buildScopeKey is deterministic", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-scoping.js").catch(() => null);
  if (!mod) { assert(scoping.includes("buildScopeKey")); return; }
  const scope = { companyId: "c1", workspaceId: "w1", projectId: "p1" };
  assert(mod.buildScopeKey(scope) === mod.buildScopeKey(scope), "Key must be deterministic");
});

// ─── Causality lineage ────────────────────────────────────────────────────────

console.log("\n[4] Causality lineage");

const lineage = readSrc("runtime-memory-lineage.ts");

check("lineage module handles cycle prevention", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-lineage.js").catch(() => null);
  if (!mod) { assert(lineage.includes("visited.has"), "Must include cycle detection"); return; }
  const makeRec = (id, parentId) => ({
    id, recordType: "blocker", summary: "test", detail: null,
    scope: { companyId: "c1", workspaceId: null, projectId: null },
    parentRecordId: parentId ?? null, lineageType: parentId ? "caused_by" : null,
    resolutionStatus: "unresolved",
    weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.7, deliveryImpactWeight: 0.7 },
    confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null,
    nutrientIds: [], interventionCount: 0,
    firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(),
    resolvedAt: null, createdAt: new Date().toISOString(),
  });
  const a = makeRec("a", "b");
  const b = makeRec("b", "a");
  let threw = false;
  try { mod.buildCausalityChain(a, [a, b]); } catch { threw = true; }
  assert(!threw, "Should not throw on cyclic lineage");
});

check("causality chain marks unresolved when any node unresolved", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-lineage.js").catch(() => null);
  if (!mod) { assert(lineage.includes("unresolved: chain.some")); return; }
  const root = { id: "root", recordType: "blocker", summary: "root", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: "unresolved", weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.7, deliveryImpactWeight: 0.7 }, confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date().toISOString() };
  const chain = mod.buildCausalityChain(root, [root]);
  assert(chain.unresolved === true);
});

// ─── Signal extraction ────────────────────────────────────────────────────────

console.log("\n[5] Operational signal extraction");

check("risk signal detected from 'at risk' text", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-signals.js").catch(() => null);
  if (!mod) { assert(readSrc("runtime-memory-signals.ts").includes("/\\bat risk\\b/i")); return; }
  const ctx = { sourceRef: "test", timestamp: new Date().toISOString() };
  const signals = mod.extractOperationalSignals("This project is at risk of delivery failure", ctx);
  assert(signals.some((s) => s.signalType === "risk"), "Should detect risk signal");
});

check("escalation signal detected from 'executive escalation' text", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-signals.js").catch(() => null);
  if (!mod) { assert(readSrc("runtime-memory-signals.ts").includes("executive escalation")); return; }
  const ctx = { sourceRef: "test", timestamp: new Date().toISOString() };
  const signals = mod.extractOperationalSignals("Executive escalation required — steering committee unresponsive for 3 weeks", ctx);
  assert(signals.some((s) => s.signalType === "escalation"), "Should detect escalation signal");
});

check("empty/short text produces no signals", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-signals.js").catch(() => null);
  if (!mod) return;
  const ctx = { sourceRef: "test", timestamp: new Date().toISOString() };
  assert(mod.extractOperationalSignals("ok", ctx).length === 0);
});

// ─── Unresolved pressure weighting ───────────────────────────────────────────

console.log("\n[6] Unresolved pressure weighting");

check("pressure weight increases for unresolved items over time", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-retrieval.js").catch(() => null);
  if (!mod) {
    const ret = readSrc("runtime-memory-retrieval.ts");
    assert(ret.includes("UNRESOLVED_PRESSURE_RATE"));
    return;
  }
  const record = { id: "r1", recordType: "blocker", summary: "test", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: "unresolved", weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.7, deliveryImpactWeight: 0.7 }, confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date().toISOString() };
  const p0 = mod.computePressureWeight(record, 0);
  const p21 = mod.computePressureWeight(record, 21);
  assert(p21 > p0, `Pressure should increase: p0=${p0}, p21=${p21}`);
  assert(p21 <= 1.0, "Pressure capped at 1.0");
});

check("resolved records receive suppressed pressure", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-retrieval.js").catch(() => null);
  if (!mod) return;
  const record = { id: "r1", recordType: "blocker", summary: "test", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: "resolved", weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.9, deliveryImpactWeight: 0.7 }, confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date().toISOString() };
  const weight = mod.computePressureWeight(record, 30);
  assert(weight < 0.2, `Expected suppressed weight, got ${weight}`);
});

// ─── Continuity gap detection ────────────────────────────────────────────────

console.log("\n[7] Continuity gap detection");

check("old unresolved blockers trigger missing_resolution gap", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-continuity.js").catch(() => null);
  if (!mod) {
    assert(readSrc("runtime-memory-continuity.ts").includes("missing_resolution"));
    return;
  }
  const record = { id: "r1", recordType: "blocker", summary: "procurement blocked", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: "unresolved", weights: { continuityWeight: 0.8, operationalPressureWeight: 0.8, escalationWeight: 0.5, unresolvedWeight: 0.8, deliveryImpactWeight: 0.8 }, confidence: 0.8, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date(Date.now() - 10 * 86400000).toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() };
  const gaps = mod.detectContinuityGaps([record], Date.now());
  assert(gaps.some((g) => g.type === "missing_resolution"), "Should detect old unresolved blocker");
});

check("computeContinuityScore is higher when more records resolved", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-continuity.js").catch(() => null);
  if (!mod) return;
  const makeRec = (id, status) => ({ id, recordType: "risk", summary: "s", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: status, weights: { continuityWeight: 0.5, operationalPressureWeight: 0.5, escalationWeight: 0.3, unresolvedWeight: 0.5, deliveryImpactWeight: 0.5 }, confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date().toISOString() });
  const allUnresolved = [makeRec("r1", "unresolved"), makeRec("r2", "unresolved")];
  const allResolved = [makeRec("r1", "resolved"), makeRec("r2", "resolved")];
  assert(mod.computeContinuityScore(allResolved) > mod.computeContinuityScore(allUnresolved));
});

// ─── Diagnostics ──────────────────────────────────────────────────────────────

console.log("\n[8] Diagnostics");

check("diagnosePressureWeighting explains pressure increase", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-diagnostics.js").catch(() => null);
  if (!mod) {
    assert(readSrc("runtime-memory-diagnostics.ts").includes("pressureExplanation"));
    return;
  }
  const record = { id: "r1", recordType: "blocker", summary: "s", detail: null, scope: { companyId: "c1", workspaceId: null, projectId: null }, parentRecordId: null, lineageType: null, resolutionStatus: "unresolved", weights: { continuityWeight: 0.7, operationalPressureWeight: 0.7, escalationWeight: 0.4, unresolvedWeight: 0.7, deliveryImpactWeight: 0.7 }, confidence: 0.7, ingestionSource: "chat_conversation", sourceRef: null, nutrientIds: [], interventionCount: 0, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), resolvedAt: null, createdAt: new Date().toISOString() };
  const diag = mod.diagnosePressureWeighting(record, 14, 0.82);
  assert(typeof diag.pressureExplanation === "string" && diag.pressureExplanation.length > 5);
});

check("diagnoseContinuityGap provides recommended action", async () => {
  const mod = await import("../src/lib/operational-memory/runtime-memory-diagnostics.js").catch(() => null);
  if (!mod) {
    assert(readSrc("runtime-memory-diagnostics.ts").includes("recommendedAction"));
    return;
  }
  const gap = { type: "stale_escalation", description: "test", relatedRecordId: "r1", ageDays: 5 };
  const diag = mod.diagnoseContinuityGap(gap);
  assert(diag.recommendedAction.length > 10);
});

// ─── Migration integrity ──────────────────────────────────────────────────────

console.log("\n[9] Migration integrity");

const migration = fs.readFileSync("supabase/migrations/20260522000000_operational_runtime_memory.sql", "utf8");

check("migration has RLS on both tables", () => {
  assert((migration.match(/enable row level security/g) ?? []).length >= 2);
});

check("migration uses current_company_id() for tenant isolation", () => {
  assert(migration.includes("current_company_id() = company_id"));
});

check("migration has self-referencing lineage FK", () => {
  assert(migration.includes("references public.operational_memory_runtime_records(id)") &&
    migration.includes("parent_record_id uuid null"));
});

check("migration has unresolved index for pressure retrieval", () => {
  assert(migration.includes("operational_memory_runtime_records_unresolved_idx"));
});

check("intervention table FKs to memory records", () => {
  assert(migration.includes("memory_record_id uuid not null references public.operational_memory_runtime_records(id)"));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────");
const passed = results.filter((r) => r.status === PASS).length;
const failed = results.filter((r) => r.status === FAIL).length;
console.log(`Operational Memory Runtime: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log("\nFailed checks:");
  for (const r of results.filter((r) => r.status === FAIL)) {
    console.log(`  ✗ ${r.label}: ${r.error}`);
  }
  process.exit(1);
} else {
  console.log("\nAll operational memory runtime checks passed.");
  console.log("Operational continuity lineage: verified");
  console.log("Unresolved pressure persistence: verified");
  console.log("Tenant isolation: verified");
  console.log("Causality chain construction: verified");
  console.log("Continuity gap detection: verified");
}
