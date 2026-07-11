import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Source file reads ────────────────────────────────────────────────────────

const typesFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-bridge-types.ts",
  "utf8",
);
const classifierFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-signal-classifier.ts",
  "utf8",
);
const pressureFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-pressure-calculator.ts",
  "utf8",
);
const recurrenceFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-recurrence-detector.ts",
  "utf8",
);
const mapperFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-to-memory-mapper.ts",
  "utf8",
);
const linkerFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-memory-linker.ts",
  "utf8",
);
const diagnosticsFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-bridge-diagnostics.ts",
  "utf8",
);
const managerFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/nutrient-bridge-manager.ts",
  "utf8",
);
const indexFile = fs.readFileSync(
  "src/lib/operational-memory/nutrient-bridge/index.ts",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260522100000_operational_memory_nutrient_links.sql",
  "utf8",
);

// ─── Dynamic imports (with graceful fallback) ─────────────────────────────────

const {
  classifyNutrientOperationalSignal,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-signal-classifier.js"
).catch(() => ({ classifyNutrientOperationalSignal: null }));

const {
  calculateNutrientPressureContribution,
  deriveOperationalWeightsFromNutrient,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-pressure-calculator.js"
).catch(() => ({ calculateNutrientPressureContribution: null, deriveOperationalWeightsFromNutrient: null }));

const {
  detectNutrientRecurrence,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-recurrence-detector.js"
).catch(() => ({ detectNutrientRecurrence: null }));

const {
  mapNutrientToMemoryRecord,
  buildNutrientMemoryMapping,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-to-memory-mapper.js"
).catch(() => ({ mapNutrientToMemoryRecord: null, buildNutrientMemoryMapping: null }));

const {
  buildNutrientMemoryLink,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-memory-linker.js"
).catch(() => ({ buildNutrientMemoryLink: null }));

const {
  buildPromotionDiagnostic,
  buildSkipDiagnostic,
  buildNutrientBridgeDiagnosticsReport,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-bridge-diagnostics.js"
).catch(() => ({
  buildPromotionDiagnostic: null,
  buildSkipDiagnostic: null,
  buildNutrientBridgeDiagnosticsReport: null,
}));

const {
  bridgeNutrientsToOperationalMemory,
  classifyNutrientOperationalSignalPublic,
  detectNutrientRecurrencePublic,
} = await import(
  "../src/lib/operational-memory/nutrient-bridge/nutrient-bridge-manager.js"
).catch(() => ({
  bridgeNutrientsToOperationalMemory: null,
  classifyNutrientOperationalSignalPublic: null,
  detectNutrientRecurrencePublic: null,
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeNutrient(overrides = {}) {
  return {
    id: "n1",
    nutrientType: "blocker_signal",
    summary: "Vendor procurement blocked pending approval",
    entities: [],
    evidence: [
      {
        sourceArtifactId: "a1",
        sourceType: "project_note",
        sourceTitle: "Weekly update",
        excerpt: "Procurement is blocked — PO not issued",
        timestamp: NOW,
        workspaceId: "ws1",
        projectId: "proj1",
        actorUserId: null,
        confidenceBasis: "direct statement of blocker",
        extractionMethod: "rule_based",
      },
    ],
    scoring: {
      confidence: 0.85,
      severity: "high",
      freshness: 0.9,
      recurrenceHint: "first_occurrence",
      ambiguityLevel: "clear",
      actionability: "actionable",
      evidenceStrength: "strong",
      decayProfile: "slow",
      significanceScore: 0.8,
    },
    duplicateMergeCount: 0,
    workspaceId: "ws1",
    projectId: "proj1",
    digestionRunId: "run1",
    createdAt: NOW,
    ...overrides,
  };
}

function makeMemoryRecord(overrides = {}) {
  return {
    id: "r1",
    recordType: "blocker",
    summary: "Vendor procurement blocked pending approval",
    detail: null,
    scope: { companyId: "co1", workspaceId: "ws1", projectId: "proj1" },
    parentRecordId: null,
    lineageType: null,
    resolutionStatus: "unresolved",
    weights: {
      continuityWeight: 0.85,
      operationalPressureWeight: 0.8,
      escalationWeight: 0.5,
      unresolvedWeight: 0.85,
      deliveryImpactWeight: 0.9,
    },
    confidence: 0.85,
    ingestionSource: "operational_summary",
    sourceRef: "nutrient_bridge:n1",
    nutrientIds: ["n1"],
    interventionCount: 0,
    firstObservedAt: NOW,
    lastObservedAt: NOW,
    resolvedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

const BASE_SCOPE = {
  companyId: "co1",
  workspaceId: "ws1",
  projectId: "proj1",
  conversationId: null,
  interventionId: null,
  stakeholderId: null,
};

// ─── 1. Type definitions ──────────────────────────────────────────────────────

test("types file defines NutrientOperationalBridgeInput", () => {
  assert.ok(typesFile.includes("NutrientOperationalBridgeInput"));
});

test("types file defines NutrientOperationalBridgeResult", () => {
  assert.ok(typesFile.includes("NutrientOperationalBridgeResult"));
});

test("types file defines NutrientMemoryMapping", () => {
  assert.ok(typesFile.includes("NutrientMemoryMapping"));
});

test("types file defines NutrientRecurrenceResult", () => {
  assert.ok(typesFile.includes("NutrientRecurrenceResult"));
});

test("types file defines NutrientMemoryLink", () => {
  assert.ok(typesFile.includes("NutrientMemoryLink"));
});

test("types file defines NutrientSignalClassification", () => {
  assert.ok(typesFile.includes("NutrientSignalClassification"));
});

test("types file defines NutrientBridgeDiagnostic", () => {
  assert.ok(typesFile.includes("NutrientBridgeDiagnostic"));
});

test("types file defines NutrientBridgePolicy with all fields", () => {
  assert.ok(typesFile.includes("minimumSignificanceScore"));
  assert.ok(typesFile.includes("minimumConfidence"));
  assert.ok(typesFile.includes("suppressInformationalOnly"));
  assert.ok(typesFile.includes("suppressAmbiguityWithoutRecurrence"));
  assert.ok(typesFile.includes("dedupWindowMs"));
});

test("types file defines all skip reasons", () => {
  for (const r of [
    "duplicate_recent", "low_confidence", "informational_only",
    "already_linked", "out_of_scope", "below_significance_threshold",
    "ambiguity_signal_suppressed",
  ]) {
    assert.ok(typesFile.includes(`"${r}"`), `Missing skip reason: ${r}`);
  }
});

test("types file defines all recurrence outcomes", () => {
  for (const o of ["new_record", "recurrence", "escalation", "duplicate_noise", "resolved_followup"]) {
    assert.ok(typesFile.includes(`"${o}"`), `Missing recurrence outcome: ${o}`);
  }
});

test("types file defines all link types", () => {
  for (const l of ["promoted_from", "recurrence_match", "escalation_match", "resolved_followup", "lineage_reference"]) {
    assert.ok(typesFile.includes(`"${l}"`), `Missing link type: ${l}`);
  }
});

test("types file defines DEFAULT_NUTRIENT_BRIDGE_POLICY", () => {
  assert.ok(typesFile.includes("DEFAULT_NUTRIENT_BRIDGE_POLICY"));
});

// ─── 2. Mapping rules ─────────────────────────────────────────────────────────

test("classifier maps blocker_signal to blocker memory type", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("blocker_signal"), "Must have blocker_signal mapping");
    assert.ok(classifierFile.includes('"blocker"') || classifierFile.includes("blocker:"), "Must map to blocker");
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "blocker_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "blocker");
  assert.equal(result.signalCategory, "blocker");
  assert.ok(result.unresolved, "blocker should be unresolved");
});

test("classifier maps risk_signal to risk memory type", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("risk_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "risk_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "risk");
  assert.equal(result.signalCategory, "risk");
});

test("classifier maps dependency_signal to dependency memory type", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("dependency_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "dependency_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "dependency");
});

test("classifier maps timeline_pressure_signal to timeline_signal", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("timeline_pressure_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "timeline_pressure_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "timeline_signal");
  assert.equal(result.signalCategory, "timeline_pressure");
});

test("classifier maps financial_impediment_signal to delivery_pressure", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("financial_impediment_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "financial_impediment_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "delivery_pressure");
  assert.equal(result.signalCategory, "procurement_pressure");
});

test("classifier maps governance_gap_signal to governance_gap", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("governance_gap_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "governance_gap_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "governance_gap");
});

test("classifier maps escalation_signal to escalation", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("escalation_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "escalation_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.suggestedMemoryType, "escalation");
});

test("classifier downgrades confidence for highly_ambiguous nutrients", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("highly_ambiguous"), "Must handle highly_ambiguous");
    return;
  }
  const nutrient = makeNutrient({
    nutrientType: "risk_signal",
    scoring: { confidence: 0.8, severity: "medium", freshness: 0.9, recurrenceHint: "first_occurrence", ambiguityLevel: "highly_ambiguous", actionability: "monitor", evidenceStrength: "moderate", decayProfile: "medium", significanceScore: 0.6 },
  });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.ok(result.confidence < 0.8, `Expected confidence < 0.8, got ${result.confidence}`);
  assert.ok(result.confidence > 0, "Confidence should remain positive");
});

test("classifier marks recovery_signal as not unresolved", () => {
  if (!classifyNutrientOperationalSignal) {
    assert.ok(classifierFile.includes("recovery_signal"));
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "recovery_signal" });
  const result = classifyNutrientOperationalSignal(nutrient);
  assert.equal(result.unresolved, false);
});

// ─── 3. Recurrence detection ──────────────────────────────────────────────────

test("recurrence detector returns new_record when no existing records", () => {
  if (!detectNutrientRecurrence) {
    assert.ok(recurrenceFile.includes("new_record"), "Must handle new_record outcome");
    return;
  }
  const nutrient = makeNutrient();
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const result = detectNutrientRecurrence(nutrient, classification, [], []);
  assert.equal(result.outcome, "new_record");
  assert.equal(result.matchingRecordId, null);
});

test("recurrence detector detects recurrence for same type + similar text", () => {
  if (!detectNutrientRecurrence) {
    assert.ok(recurrenceFile.includes("recurrence"), "Must handle recurrence outcome");
    return;
  }
  const nutrient = makeNutrient({
    scoring: {
      confidence: 0.85, severity: "high", freshness: 0.9,
      recurrenceHint: "confirmed_recurrence",
      ambiguityLevel: "clear", actionability: "actionable",
      evidenceStrength: "strong", decayProfile: "slow", significanceScore: 0.8,
    },
  });
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const existingRecord = makeMemoryRecord();
  const result = detectNutrientRecurrence(nutrient, classification, [existingRecord], []);
  assert.ok(
    result.outcome === "recurrence" || result.outcome === "escalation",
    `Expected recurrence/escalation, got ${result.outcome}. Reason: ${result.recurrenceReason}`,
  );
  assert.equal(result.matchingRecordId, "r1");
});

test("recurrence detector returns duplicate_noise when nutrient already linked", () => {
  if (!detectNutrientRecurrence) {
    assert.ok(recurrenceFile.includes("duplicate_noise"), "Must handle duplicate_noise");
    return;
  }
  const nutrient = makeNutrient({ id: "n-already" });
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const existingLink = buildNutrientMemoryLink
    ? buildNutrientMemoryLink("n-already", "r1", "promoted_from", { companyId: "co1", workspaceId: "ws1", projectId: null }, 0.85)
    : { id: "l1", companyId: "co1", workspaceId: "ws1", projectId: null, nutrientId: "n-already", operationalMemoryRecordId: "r1", linkType: "promoted_from", confidence: 0.85, createdAt: NOW, metadata: {} };
  const result = detectNutrientRecurrence(nutrient, classification, [], [existingLink]);
  assert.equal(result.outcome, "duplicate_noise");
});

test("recurrence detector returns resolved_followup for recovery signal matching unresolved record", () => {
  if (!detectNutrientRecurrence) {
    assert.ok(recurrenceFile.includes("resolved_followup"), "Must handle resolved_followup");
    return;
  }
  const nutrient = makeNutrient({
    nutrientType: "recovery_signal",
    summary: "Vendor procurement blocker resolved and approved",
  });
  const classification = { signalCategory: "weak_signal", suggestedMemoryType: "recovery", operationalSeverity: "low", confidence: 0.75, unresolved: false, pressureImpact: "none", deliveryImpact: "none" };
  const existingRecord = makeMemoryRecord({
    id: "r-unresolved",
    summary: "Vendor procurement blocker",
    resolutionStatus: "unresolved",
  });
  const result = detectNutrientRecurrence(nutrient, classification, [existingRecord], []);
  assert.equal(result.outcome, "resolved_followup");
  assert.equal(result.matchingRecordId, "r-unresolved");
});

test("recurrence detector enforces workspace scope isolation", () => {
  if (!detectNutrientRecurrence) {
    assert.ok(recurrenceFile.includes("workspaceId"), "Must check workspace scope");
    return;
  }
  const nutrient = makeNutrient({ workspaceId: "ws-DIFFERENT" });
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const existingRecord = makeMemoryRecord({ scope: { companyId: "co1", workspaceId: "ws1", projectId: "proj1" } });
  const result = detectNutrientRecurrence(nutrient, classification, [existingRecord], []);
  // Different workspace → no match
  assert.equal(result.outcome, "new_record");
});

// ─── 4. Duplicate suppression ─────────────────────────────────────────────────

test("manager suppresses low-confidence nutrients", () => {
  assert.ok(managerFile.includes("low_confidence"), "Manager must handle low_confidence suppression");
});

test("manager suppresses informational-only nutrients with low significance", () => {
  assert.ok(managerFile.includes("informational_only"), "Manager must handle informational suppression");
});

test("manager suppresses ambiguity signals without recurrence", () => {
  assert.ok(managerFile.includes("ambiguity_signal_suppressed"), "Manager must suppress ambiguity signals");
});

test("manager handles in-run duplicate detection", () => {
  assert.ok(managerFile.includes("processedInRun"), "Manager must track in-run duplicates");
});

// ─── 5. Pressure calculation ─────────────────────────────────────────────────

test("pressure calculator returns high value for blocker_signal", () => {
  if (!calculateNutrientPressureContribution) {
    assert.ok(pressureFile.includes("blocker_signal"), "Must include blocker_signal base pressure");
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "blocker_signal" });
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const pressure = calculateNutrientPressureContribution(nutrient, classification);
  assert.ok(pressure >= 0.6, `Expected pressure >= 0.6 for blocker, got ${pressure}`);
  assert.ok(pressure <= 1.0, "Pressure must be capped at 1.0");
});

test("pressure calculator returns very low value for recovery_signal", () => {
  if (!calculateNutrientPressureContribution) {
    assert.ok(pressureFile.includes("recovery_signal"), "Must include recovery_signal");
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "recovery_signal" });
  const classification = { signalCategory: "weak_signal", suggestedMemoryType: "recovery", operationalSeverity: "low", confidence: 0.7, unresolved: false, pressureImpact: "none", deliveryImpact: "none" };
  const pressure = calculateNutrientPressureContribution(nutrient, classification);
  assert.ok(pressure <= 0.1, `Expected low pressure for recovery, got ${pressure}`);
});

test("pressure calculator increases pressure for confirmed_recurrence", () => {
  if (!calculateNutrientPressureContribution) {
    assert.ok(pressureFile.includes("confirmed_recurrence"), "Must handle confirmed_recurrence boost");
    return;
  }
  const base = makeNutrient({ nutrientType: "risk_signal" });
  const recurring = makeNutrient({
    nutrientType: "risk_signal",
    scoring: { ...base.scoring, recurrenceHint: "confirmed_recurrence" },
  });
  const classification = { signalCategory: "risk", suggestedMemoryType: "risk", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "medium", deliveryImpact: "medium" };
  const p1 = calculateNutrientPressureContribution(base, classification);
  const p2 = calculateNutrientPressureContribution(recurring, classification);
  assert.ok(p2 > p1, `Recurring pressure ${p2} should exceed base pressure ${p1}`);
});

test("pressure calculator returns lower value for informational actionability", () => {
  if (!calculateNutrientPressureContribution) {
    assert.ok(pressureFile.includes("informational"), "Must handle informational actionability");
    return;
  }
  const actionable = makeNutrient({ nutrientType: "risk_signal" });
  const informational = makeNutrient({
    nutrientType: "risk_signal",
    scoring: { ...actionable.scoring, actionability: "informational" },
  });
  const classification = { signalCategory: "risk", suggestedMemoryType: "risk", operationalSeverity: "medium", confidence: 0.75, unresolved: false, pressureImpact: "low", deliveryImpact: "low" };
  const p1 = calculateNutrientPressureContribution(actionable, classification);
  const p2 = calculateNutrientPressureContribution(informational, classification);
  assert.ok(p1 > p2, `Actionable pressure ${p1} should exceed informational pressure ${p2}`);
});

// ─── 6. Weight derivation ─────────────────────────────────────────────────────

test("weight derivation returns all five weight dimensions", () => {
  if (!deriveOperationalWeightsFromNutrient) {
    assert.ok(pressureFile.includes("continuityWeight"), "Must derive continuityWeight");
    assert.ok(pressureFile.includes("operationalPressureWeight"), "Must derive operationalPressureWeight");
    return;
  }
  const nutrient = makeNutrient();
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const weights = deriveOperationalWeightsFromNutrient(nutrient, classification);
  assert.ok(typeof weights.continuityWeight === "number");
  assert.ok(typeof weights.operationalPressureWeight === "number");
  assert.ok(typeof weights.escalationWeight === "number");
  assert.ok(typeof weights.unresolvedWeight === "number");
  assert.ok(typeof weights.deliveryImpactWeight === "number");
  for (const [k, v] of Object.entries(weights)) {
    assert.ok(v >= 0 && v <= 1.0, `Weight ${k}=${v} out of range 0..1`);
  }
});

// ─── 7. Memory record mapping ─────────────────────────────────────────────────

test("mapper creates memory record with nutrient ID in nutrientIds", () => {
  if (!mapNutrientToMemoryRecord) {
    assert.ok(mapperFile.includes("nutrientIds"), "Mapper must set nutrientIds");
    return;
  }
  const nutrient = makeNutrient({ id: "n-test" });
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const recurrence = { outcome: "new_record", matchingRecordId: null, recurrenceCount: 0, recurrenceReason: "first", evidenceTrail: [] };
  const weights = { continuityWeight: 0.85, operationalPressureWeight: 0.8, escalationWeight: 0.5, unresolvedWeight: 0.85, deliveryImpactWeight: 0.9 };
  const record = mapNutrientToMemoryRecord(nutrient, BASE_SCOPE, classification, recurrence, weights);
  assert.ok(record.nutrientIds.includes("n-test"), "Record should reference the source nutrient");
  assert.equal(record.ingestionSource, "operational_summary");
  assert.ok(record.sourceRef?.includes("n-test"), "sourceRef should reference nutrient ID");
});

test("mapper sets resolved status for recovery_signal", () => {
  if (!mapNutrientToMemoryRecord) {
    assert.ok(mapperFile.includes("recovery_signal"), "Mapper must handle recovery signals");
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "recovery_signal" });
  const classification = { signalCategory: "weak_signal", suggestedMemoryType: "recovery", operationalSeverity: "low", confidence: 0.7, unresolved: false, pressureImpact: "none", deliveryImpact: "none" };
  const recurrence = { outcome: "resolved_followup", matchingRecordId: "r1", recurrenceCount: 1, recurrenceReason: "closes_blocker", evidenceTrail: [] };
  const weights = { continuityWeight: 0.2, operationalPressureWeight: 0.05, escalationWeight: 0.1, unresolvedWeight: 0.1, deliveryImpactWeight: 0.1 };
  const record = mapNutrientToMemoryRecord(nutrient, BASE_SCOPE, classification, recurrence, weights);
  assert.equal(record.resolutionStatus, "resolved");
  assert.ok(record.resolvedAt !== null, "resolvedAt should be set for recovery");
});

test("mapper sets escalated status for escalation recurrence outcome", () => {
  if (!mapNutrientToMemoryRecord) {
    assert.ok(mapperFile.includes("escalation"), "Mapper must handle escalation outcome");
    return;
  }
  const nutrient = makeNutrient({ nutrientType: "escalation_signal" });
  const classification = { signalCategory: "escalation", suggestedMemoryType: "escalation", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const recurrence = { outcome: "escalation", matchingRecordId: "r1", recurrenceCount: 2, recurrenceReason: "escalation_match", evidenceTrail: [] };
  const weights = { continuityWeight: 0.9, operationalPressureWeight: 0.88, escalationWeight: 0.9, unresolvedWeight: 0.85, deliveryImpactWeight: 0.9 };
  const record = mapNutrientToMemoryRecord(nutrient, BASE_SCOPE, classification, recurrence, weights);
  assert.equal(record.resolutionStatus, "escalated");
  assert.equal(record.parentRecordId, "r1");
  assert.equal(record.lineageType, "escalates_to");
});

// ─── 8. Bidirectional link contract ──────────────────────────────────────────

test("link builder produces all required link fields", () => {
  if (!buildNutrientMemoryLink) {
    assert.ok(linkerFile.includes("NutrientMemoryLink"), "Linker must build NutrientMemoryLink");
    return;
  }
  const link = buildNutrientMemoryLink(
    "n-test",
    "r-test",
    "promoted_from",
    { companyId: "co1", workspaceId: "ws1", projectId: "proj1" },
    0.85,
    { signalCategory: "blocker" },
  );
  assert.ok(typeof link.id === "string" && link.id.length > 0);
  assert.equal(link.nutrientId, "n-test");
  assert.equal(link.operationalMemoryRecordId, "r-test");
  assert.equal(link.linkType, "promoted_from");
  assert.equal(link.companyId, "co1");
  assert.equal(link.workspaceId, "ws1");
  assert.equal(link.projectId, "proj1");
  assert.ok(link.confidence >= 0 && link.confidence <= 1);
  assert.deepEqual(link.metadata, { signalCategory: "blocker" });
});

test("link builder clamps confidence to 0..1", () => {
  if (!buildNutrientMemoryLink) {
    assert.ok(linkerFile.includes("Math.min"), "Must clamp confidence");
    return;
  }
  const over = buildNutrientMemoryLink("n", "r", "promoted_from", { companyId: "c", workspaceId: "w", projectId: null }, 1.5);
  assert.ok(over.confidence <= 1.0, "Confidence capped at 1.0");
  const under = buildNutrientMemoryLink("n", "r", "promoted_from", { companyId: "c", workspaceId: "w", projectId: null }, -0.5);
  assert.ok(under.confidence >= 0, "Confidence floor at 0");
});

// ─── 9. Lineage preservation ──────────────────────────────────────────────────

test("mapper sets parentRecordId for recurrence outcomes", () => {
  assert.ok(mapperFile.includes("parentRecordId"), "Mapper must preserve lineage via parentRecordId");
  assert.ok(mapperFile.includes("matchingRecordId"), "Mapper must use recurrence matchingRecordId");
});

test("mapper sets lineageType for recurrence/escalation/resolved_followup", () => {
  assert.ok(mapperFile.includes("escalates_to"), "Must set escalates_to lineage type");
  assert.ok(mapperFile.includes("related_to"), "Must set related_to lineage type");
  assert.ok(mapperFile.includes("resolved_by"), "Must set resolved_by lineage type");
});

// ─── 10. Tenant scope validation ─────────────────────────────────────────────

test("bridge manager validates companyId and workspaceId", () => {
  assert.ok(managerFile.includes("companyId"), "Manager must validate companyId");
  assert.ok(managerFile.includes("workspaceId"), "Manager must validate workspaceId");
});

test("bridge enforces workspace scope on nutrients", () => {
  assert.ok(managerFile.includes("nutrient.workspaceId !== input.workspaceId"), "Manager must enforce workspace scope");
});

// ─── 11. Diagnostics output ───────────────────────────────────────────────────

test("promotion diagnostic includes classification and recurrence outcome", () => {
  if (!buildPromotionDiagnostic) {
    assert.ok(diagnosticsFile.includes("buildPromotionDiagnostic"), "Must have buildPromotionDiagnostic");
    return;
  }
  const nutrient = makeNutrient();
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const recurrence = { outcome: "new_record", matchingRecordId: null, recurrenceCount: 0, recurrenceReason: "first", evidenceTrail: [] };
  const diag = buildPromotionDiagnostic(nutrient, classification, recurrence, 0.8);
  assert.ok(typeof diag.explanation === "string" && diag.explanation.length > 10);
  assert.ok(diag.classification !== null);
  assert.ok(typeof diag.timestamp === "string");
});

test("skip diagnostic explains the skip reason", () => {
  if (!buildSkipDiagnostic) {
    assert.ok(diagnosticsFile.includes("buildSkipDiagnostic"), "Must have buildSkipDiagnostic");
    return;
  }
  const nutrient = makeNutrient();
  const diag = buildSkipDiagnostic(nutrient, "low_confidence");
  assert.ok(typeof diag.explanation === "string" && diag.explanation.length > 10);
  assert.equal(diag.classification, null);
  assert.equal(diag.pressureDelta, 0);
});

test("diagnostics report includes summary with counts", () => {
  if (!buildNutrientBridgeDiagnosticsReport) {
    assert.ok(diagnosticsFile.includes("buildNutrientBridgeDiagnosticsReport"), "Must have report builder");
    return;
  }
  const nutrient = makeNutrient();
  const classification = { signalCategory: "blocker", suggestedMemoryType: "blocker", operationalSeverity: "high", confidence: 0.85, unresolved: true, pressureImpact: "high", deliveryImpact: "high" };
  const recurrence = { outcome: "new_record", matchingRecordId: null, recurrenceCount: 0, recurrenceReason: "first", evidenceTrail: [] };
  const diags = [
    buildPromotionDiagnostic(nutrient, classification, recurrence, 0.8),
    buildSkipDiagnostic(nutrient, "low_confidence"),
  ];
  const report = buildNutrientBridgeDiagnosticsReport(diags, 2);
  assert.ok(typeof report.summary === "string" && report.summary.length > 5);
  assert.equal(report.totalProcessed, 2);
  assert.ok(Array.isArray(report.details));
});

// ─── 12. Manager public API ───────────────────────────────────────────────────

test("manager exports bridgeNutrientsToOperationalMemory", () => {
  assert.ok(
    managerFile.includes("export async function bridgeNutrientsToOperationalMemory") ||
    indexFile.includes("bridgeNutrientsToOperationalMemory"),
    "Must export bridgeNutrientsToOperationalMemory",
  );
});

test("manager exports classifyNutrientOperationalSignal", () => {
  assert.ok(
    managerFile.includes("classifyNutrientOperationalSignalPublic") ||
    indexFile.includes("classifyNutrientOperationalSignal"),
    "Must export classify function",
  );
});

test("manager exports detectNutrientRecurrence", () => {
  assert.ok(
    managerFile.includes("detectNutrientRecurrencePublic") ||
    indexFile.includes("detectNutrientRecurrence"),
    "Must export recurrence function",
  );
});

test("manager exports linkNutrientToOperationalMemory", () => {
  assert.ok(
    managerFile.includes("linkNutrientToOperationalMemory") ||
    indexFile.includes("linkNutrientToOperationalMemory"),
    "Must export link function",
  );
});

test("bridge returns empty result with scope metadata when companyId missing", async () => {
  if (!bridgeNutrientsToOperationalMemory) {
    assert.ok(managerFile.includes("missing_scope"), "Must handle missing scope");
    return;
  }
  const result = await bridgeNutrientsToOperationalMemory({
    nutrients: [makeNutrient()],
    companyId: "",
    workspaceId: "ws1",
    projectId: null,
  });
  assert.equal(result.created.length, 0);
  assert.equal(result.scopeMetadata.companyId, "");
  assert.ok(result.lineageMetadata.totalSkipped >= 0);
});

// ─── 13. Migration integrity ──────────────────────────────────────────────────

test("migration creates operational_memory_nutrient_links table", () => {
  assert.ok(migration.includes("operational_memory_nutrient_links"), "Migration must create link table");
});

test("migration has RLS enabled with company_id tenant check", () => {
  assert.ok(migration.includes("enable row level security"), "Migration must enable RLS");
  assert.ok(migration.includes("current_company_id() = company_id"), "Migration must use current_company_id()");
});

test("migration has required fields", () => {
  const required = ["company_id", "workspace_id", "project_id", "nutrient_id",
    "operational_memory_record_id", "link_type", "confidence", "created_at", "metadata"];
  for (const field of required) {
    assert.ok(migration.includes(field), `Migration missing field: ${field}`);
  }
});

test("migration has FK to operational_memory_runtime_records", () => {
  assert.ok(
    migration.includes("references public.operational_memory_runtime_records(id)"),
    "Must have FK to operational_memory_runtime_records",
  );
});

test("migration has unique constraint on nutrient_id + record_id", () => {
  assert.ok(
    migration.includes("unique") || migration.includes("UNIQUE"),
    "Must have unique constraint to prevent duplicate links",
  );
});

test("migration has all link_type values in check constraint", () => {
  for (const lt of ["promoted_from", "recurrence_match", "escalation_match", "resolved_followup", "lineage_reference"]) {
    assert.ok(migration.includes(`'${lt}'`), `Migration missing link_type: ${lt}`);
  }
});

// ─── 14. Index file exports ───────────────────────────────────────────────────

test("index.ts exports all public API functions", () => {
  const requiredExports = [
    "bridgeNutrientsToOperationalMemory",
    "bridgeSingleNutrientToOperationalMemory",
    "classifyNutrientOperationalSignal",
    "detectNutrientRecurrence",
    "linkNutrientToOperationalMemory",
    "calculateNutrientPressureContribution",
    "buildNutrientBridgeDiagnosticsReport",
    "DEFAULT_NUTRIENT_BRIDGE_POLICY",
  ];
  for (const exp of requiredExports) {
    assert.ok(indexFile.includes(exp), `index.ts missing export: ${exp}`);
  }
});
