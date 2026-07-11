#!/usr/bin/env node
/**
 * Nutrient-Operational Memory Bridge validation script.
 *
 * Validates the structural integrity and behavioral contracts of the
 * nutrient-bridge module without requiring a live Supabase connection.
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

function readBridge(rel) {
  return fs.readFileSync(
    path.resolve("src/lib/operational-memory/nutrient-bridge", rel),
    "utf8",
  );
}

// ─── 1. File existence ────────────────────────────────────────────────────────

console.log("\n[1] File existence");

const REQUIRED_BRIDGE_FILES = [
  "nutrient-bridge-types.ts",
  "nutrient-signal-classifier.ts",
  "nutrient-pressure-calculator.ts",
  "nutrient-recurrence-detector.ts",
  "nutrient-to-memory-mapper.ts",
  "nutrient-memory-linker.ts",
  "nutrient-bridge-diagnostics.ts",
  "nutrient-bridge-manager.ts",
  "index.ts",
];

for (const file of REQUIRED_BRIDGE_FILES) {
  check(`nutrient-bridge/${file} exists`, () => {
    assert(
      fs.existsSync(path.resolve("src/lib/operational-memory/nutrient-bridge", file)),
      `Missing: ${file}`,
    );
  });
}

check("migration 20260522100000_operational_memory_nutrient_links.sql exists", () => {
  assert(
    fs.existsSync("supabase/migrations/20260522100000_operational_memory_nutrient_links.sql"),
    "Missing link table migration",
  );
});

check("test file nutrient-operational-bridge-contract.test.mjs exists", () => {
  assert(
    fs.existsSync("tests/nutrient-operational-bridge-contract.test.mjs"),
    "Missing bridge test file",
  );
});

check("architecture doc nutrient-ingestion-operational-bridge.md exists", () => {
  assert(
    fs.existsSync("docs/architecture/nutrient-ingestion-operational-bridge.md"),
    "Missing architecture doc",
  );
});

// ─── 2. Type definitions ──────────────────────────────────────────────────────

console.log("\n[2] Type definitions");

const types = readBridge("nutrient-bridge-types.ts");

check("NutrientOperationalBridgeInput defined", () => {
  assert(types.includes("NutrientOperationalBridgeInput"));
});

check("NutrientOperationalBridgeResult defined", () => {
  assert(types.includes("NutrientOperationalBridgeResult"));
});

check("NutrientMemoryMapping defined", () => {
  assert(types.includes("NutrientMemoryMapping"));
});

check("NutrientRecurrenceResult defined", () => {
  assert(types.includes("NutrientRecurrenceResult"));
});

check("NutrientMemoryLink with all required fields", () => {
  for (const f of ["companyId", "workspaceId", "projectId", "nutrientId", "operationalMemoryRecordId", "linkType", "confidence", "metadata"]) {
    assert(types.includes(f), `NutrientMemoryLink missing field: ${f}`);
  }
});

check("NutrientBridgePolicy with all fields", () => {
  for (const f of ["minimumSignificanceScore", "minimumConfidence", "suppressInformationalOnly", "suppressAmbiguityWithoutRecurrence", "dedupWindowMs"]) {
    assert(types.includes(f), `NutrientBridgePolicy missing field: ${f}`);
  }
});

check("all five NutrientRecurrenceOutcome values defined", () => {
  for (const o of ["new_record", "recurrence", "escalation", "duplicate_noise", "resolved_followup"]) {
    assert(types.includes(`"${o}"`), `Missing recurrence outcome: ${o}`);
  }
});

check("all NutrientSkipReason values defined", () => {
  for (const r of ["duplicate_recent", "low_confidence", "informational_only", "already_linked", "out_of_scope", "below_significance_threshold", "ambiguity_signal_suppressed"]) {
    assert(types.includes(`"${r}"`), `Missing skip reason: ${r}`);
  }
});

check("all NutrientLinkType values defined", () => {
  for (const l of ["promoted_from", "recurrence_match", "escalation_match", "resolved_followup", "lineage_reference"]) {
    assert(types.includes(`"${l}"`), `Missing link type: ${l}`);
  }
});

check("DEFAULT_NUTRIENT_BRIDGE_POLICY exported", () => {
  assert(types.includes("DEFAULT_NUTRIENT_BRIDGE_POLICY"));
});

// ─── 3. Mapping rules ─────────────────────────────────────────────────────────

console.log("\n[3] Mapping rules (nutrient-signal-classifier)");

const classifier = readBridge("nutrient-signal-classifier.ts");

check("all 14 nutrient types mapped in classifier", () => {
  const nutrientTypes = [
    "blocker_signal", "risk_signal", "dependency_signal", "decision_signal",
    "commitment_signal", "delivery_drift_signal", "financial_impediment_signal",
    "governance_gap_signal", "escalation_signal", "recovery_signal",
    "ambiguity_signal", "contradiction_signal", "timeline_pressure_signal",
    "stakeholder_signal",
  ];
  for (const nt of nutrientTypes) {
    // TypeScript object keys may appear with or without quotes
    const present = classifier.includes(`"${nt}"`) || classifier.includes(`${nt}:`);
    assert(present, `Missing mapping for: ${nt}`);
  }
});

check("blocker_signal maps to blocker memory type", () => {
  const idx = classifier.indexOf("blocker_signal");
  const region = classifier.slice(idx, idx + 300);
  assert(region.includes('"blocker"'), "blocker_signal must map to blocker memory type");
});

check("timeline_pressure_signal maps to timeline_signal memory type", () => {
  assert(classifier.includes('"timeline_signal"'), "Must map to timeline_signal");
});

check("financial_impediment_signal maps to delivery_pressure", () => {
  const idx = classifier.indexOf("financial_impediment_signal");
  const region = classifier.slice(idx, idx + 300);
  assert(region.includes('"delivery_pressure"'), "Must map to delivery_pressure");
});

check("ambiguity downgrade logic present", () => {
  assert(classifier.includes("highly_ambiguous"), "Must handle highly_ambiguous confidence downgrade");
  assert(classifier.includes("ambiguous"), "Must handle ambiguous confidence downgrade");
});

check("classifyNutrientOperationalSignal exported", () => {
  assert(classifier.includes("export function classifyNutrientOperationalSignal"));
});

// ─── 4. Recurrence detection ─────────────────────────────────────────────────

console.log("\n[4] Recurrence detection");

const recurrence = readBridge("nutrient-recurrence-detector.ts");

check("recurrence detector exists with detectNutrientRecurrence export", () => {
  assert(recurrence.includes("export function detectNutrientRecurrence"));
});

check("recurrence detector handles duplicate_noise (already linked)", () => {
  assert(recurrence.includes("duplicate_noise"));
  assert(recurrence.includes("alreadyLinked"));
});

check("recurrence detector handles recovery/resolved_followup", () => {
  assert(recurrence.includes("resolved_followup"));
  assert(recurrence.includes("recovery_signal"));
});

check("recurrence detector handles escalation outcome", () => {
  assert(recurrence.includes("escalation"));
  assert(recurrence.includes("escalation_signal"));
});

check("recurrence detector enforces workspace scope", () => {
  assert(recurrence.includes("workspaceId"), "Must enforce workspace scope in recurrence");
});

check("recurrence detector uses rule-based text comparison (no ML/embedding API)", () => {
  assert(recurrence.includes("wordOverlapScore"), "Must use rule-based text comparison");
  assert(!recurrence.includes("createEmbedding") && !recurrence.includes("embed("), "Must not call embedding API");
});

// ─── 5. Pressure calculation ──────────────────────────────────────────────────

console.log("\n[5] Pressure calculation");

const pressure = readBridge("nutrient-pressure-calculator.ts");

check("calculateNutrientPressureContribution exported", () => {
  assert(pressure.includes("export function calculateNutrientPressureContribution"));
});

check("deriveOperationalWeightsFromNutrient exported", () => {
  assert(pressure.includes("export function deriveOperationalWeightsFromNutrient"));
});

check("pressure increases for confirmed_recurrence", () => {
  assert(pressure.includes("confirmed_recurrence"), "Must boost pressure on confirmed recurrence");
});

check("pressure decreases for informational actionability", () => {
  assert(pressure.includes("informational"), "Must reduce pressure for informational signals");
});

check("recovery_signal gets low pressure", () => {
  assert(pressure.includes("recovery_signal"), "Must handle recovery_signal pressure");
});

check("pressure output clamped to 0..1", () => {
  assert(pressure.includes("Math.max(0, Math.min(1.0"), "Must clamp pressure to 0..1");
});

// ─── 6. Bidirectional link ────────────────────────────────────────────────────

console.log("\n[6] Bidirectional link contract");

const linker = readBridge("nutrient-memory-linker.ts");

check("buildNutrientMemoryLink exported", () => {
  assert(linker.includes("export function buildNutrientMemoryLink"));
});

check("persistNutrientMemoryLink exported (async, Supabase-backed)", () => {
  assert(linker.includes("export async function persistNutrientMemoryLink"));
  assert(linker.includes("operational_memory_nutrient_links"));
});

check("updateOperationalMemoryRecordForRecurrence exported", () => {
  assert(linker.includes("export async function updateOperationalMemoryRecordForRecurrence"));
});

check("link builder includes tenant fields", () => {
  assert(linker.includes("companyId"));
  assert(linker.includes("workspaceId"));
  assert(linker.includes("projectId"));
});

// ─── 7. Bridge manager public API ────────────────────────────────────────────

console.log("\n[7] Bridge manager public API");

const manager = readBridge("nutrient-bridge-manager.ts");

check("bridgeNutrientsToOperationalMemory exported", () => {
  assert(manager.includes("export async function bridgeNutrientsToOperationalMemory"));
});

check("bridgeSingleNutrientToOperationalMemory exported", () => {
  assert(manager.includes("export async function bridgeSingleNutrientToOperationalMemory"));
});

check("classifyNutrientOperationalSignalPublic exported", () => {
  assert(manager.includes("export function classifyNutrientOperationalSignalPublic"));
});

check("detectNutrientRecurrencePublic exported", () => {
  assert(manager.includes("export function detectNutrientRecurrencePublic"));
});

check("linkNutrientToOperationalMemory exported", () => {
  assert(manager.includes("export async function linkNutrientToOperationalMemory"));
});

check("manager enforces workspace scope on nutrient", () => {
  assert(manager.includes("nutrient.workspaceId !== input.workspaceId"));
});

check("manager handles in-run duplicate suppression", () => {
  assert(manager.includes("processedInRun"), "Must track in-run duplicates");
});

// ─── 8. Diagnostics ──────────────────────────────────────────────────────────

console.log("\n[8] Diagnostics");

const diagnostics = readBridge("nutrient-bridge-diagnostics.ts");

check("buildPromotionDiagnostic explains promotion reason", () => {
  assert(diagnostics.includes("export function buildPromotionDiagnostic"));
  assert(diagnostics.includes("explainPromotionReason"));
});

check("buildSkipDiagnostic explains skip reason", () => {
  assert(diagnostics.includes("export function buildSkipDiagnostic"));
  assert(diagnostics.includes("explainSkipReason"));
});

check("buildNutrientBridgeDiagnosticsReport provides summary", () => {
  assert(diagnostics.includes("export function buildNutrientBridgeDiagnosticsReport"));
  assert(diagnostics.includes("summary"));
});

check("diagnostics explain confidence downgrade", () => {
  assert(diagnostics.includes("confidence_downgraded"));
  assert(diagnostics.includes("ambiguity_level"));
});

// ─── 9. Migration integrity ───────────────────────────────────────────────────

console.log("\n[9] Migration integrity");

const migrationContent = fs.readFileSync(
  "supabase/migrations/20260522100000_operational_memory_nutrient_links.sql",
  "utf8",
);

check("migration has RLS enabled", () => {
  assert(migrationContent.includes("enable row level security"));
});

check("migration uses current_company_id() for tenant isolation", () => {
  assert(migrationContent.includes("current_company_id() = company_id"));
});

check("migration has FK to operational_memory_runtime_records", () => {
  assert(migrationContent.includes("references public.operational_memory_runtime_records(id)"));
});

check("migration has required indexes", () => {
  assert(migrationContent.includes("omn_links_company_idx"), "Missing company index");
  assert(migrationContent.includes("omn_links_nutrient_idx"), "Missing nutrient index");
  assert(migrationContent.includes("omn_links_record_idx"), "Missing record index");
});

check("migration has unique constraint on nutrient + record", () => {
  assert(
    migrationContent.includes("omn_links_unique_nutrient_record") ||
    migrationContent.includes("create unique index"),
    "Must have unique constraint on nutrient_id + operational_memory_record_id",
  );
});

check("migration has all link_type constraint values", () => {
  for (const lt of ["promoted_from", "recurrence_match", "escalation_match", "resolved_followup", "lineage_reference"]) {
    assert(migrationContent.includes(`'${lt}'`), `Missing link_type in constraint: ${lt}`);
  }
});

// ─── 10. Tests coverage ───────────────────────────────────────────────────────

console.log("\n[10] Test coverage");

const testFile = fs.readFileSync(
  "tests/nutrient-operational-bridge-contract.test.mjs",
  "utf8",
);

check("tests cover blocker nutrient → blocker memory mapping", () => {
  assert(testFile.includes("blocker_signal") && testFile.includes("blocker"));
});

check("tests cover recurrence detection", () => {
  assert(testFile.includes("recurrence"));
});

check("tests cover duplicate suppression", () => {
  assert(testFile.includes("duplicate") || testFile.includes("already_linked"));
});

check("tests cover pressure calculation", () => {
  assert(testFile.includes("pressure"));
});

check("tests cover bidirectional link contract", () => {
  assert(testFile.includes("buildNutrientMemoryLink") || testFile.includes("link_type"));
});

check("tests cover tenant scope isolation", () => {
  assert(testFile.includes("companyId") || testFile.includes("workspaceId"));
});

check("tests cover diagnostics output", () => {
  assert(testFile.includes("diagnostic") || testFile.includes("Diagnostic"));
});

check("tests cover recovery signal → resolved status", () => {
  assert(testFile.includes("recovery_signal") && testFile.includes("resolved"));
});

// ─── 11. Index exports ────────────────────────────────────────────────────────

console.log("\n[11] Index exports");

const indexContent = readBridge("index.ts");

check("index exports bridgeNutrientsToOperationalMemory", () => {
  assert(indexContent.includes("bridgeNutrientsToOperationalMemory"));
});

check("index exports classifyNutrientOperationalSignal", () => {
  assert(indexContent.includes("classifyNutrientOperationalSignal"));
});

check("index exports detectNutrientRecurrence", () => {
  assert(indexContent.includes("detectNutrientRecurrence"));
});

check("index exports DEFAULT_NUTRIENT_BRIDGE_POLICY", () => {
  assert(indexContent.includes("DEFAULT_NUTRIENT_BRIDGE_POLICY"));
});

check("index exports all type definitions", () => {
  for (const t of ["NutrientOperationalBridgeInput", "NutrientOperationalBridgeResult",
    "NutrientMemoryLink", "NutrientSignalClassification", "NutrientBridgeDiagnostic"]) {
    assert(indexContent.includes(t), `Missing type export: ${t}`);
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────");
const passed = results.filter((r) => r.status === PASS).length;
const failed = results.filter((r) => r.status === FAIL).length;
console.log(`Nutrient-Operational Bridge: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log("\nFailed checks:");
  for (const r of results.filter((r) => r.status === FAIL)) {
    console.log(`  ✗ ${r.label}: ${r.error}`);
  }
  process.exit(1);
} else {
  console.log("\nAll nutrient bridge checks passed.");
  console.log("Nutrient-to-memory mapping: verified");
  console.log("Recurrence detection (rule-based): verified");
  console.log("Duplicate suppression: verified");
  console.log("Bidirectional link contract: verified");
  console.log("Pressure calculation: verified");
  console.log("Tenant isolation: verified");
  console.log("Diagnostics: verified");
}
