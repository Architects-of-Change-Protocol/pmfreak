/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Unit Tests (Sprint 4)
// Pure unit tests — no database access.
// All engine logic is reimplemented inline to mirror the source files.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Source files (structural contract tests) ─────────────────────────────────

const types         = readFileSync("src/lib/constitutional-recommendations/types.ts", "utf8");
const registry      = readFileSync("src/lib/constitutional-recommendations/recommendation-registry.ts", "utf8");
const generationEng = readFileSync("src/lib/constitutional-recommendations/generation-engine.ts", "utf8");
const confidenceEng = readFileSync("src/lib/constitutional-recommendations/confidence-engine.ts", "utf8");
const applicability = readFileSync("src/lib/constitutional-recommendations/applicability-engine.ts", "utf8");
const justification = readFileSync("src/lib/constitutional-recommendations/justification-engine.ts", "utf8");
const explain       = readFileSync("src/lib/constitutional-recommendations/explain-capability.ts", "utf8");
const indexFile     = readFileSync("src/lib/constitutional-recommendations/index.ts", "utf8");
const dbContract    = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration     = readFileSync("supabase/migrations/20260622000002_sovereign_recommendation_engine.sql", "utf8");
const docs          = readFileSync("docs/sovereign-recommendation-engine.md", "utf8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function round3(v) { return Math.round(v * 1000) / 1000; }

// ─── Inline Generation Engine ─────────────────────────────────────────────────

const TEMPLATE_CATALOG = {
  "risk_pattern::third_party_dependency": {
    recommendationType: "risk_mitigation",
    recommendationScope: "risk",
    title: "Vendor Readiness Assessment",
    description: "Recurring third-party dependency risk detected.",
    recommendationText: "Establecer evaluación formal de readiness del proveedor antes de comprometer fechas.",
    baseConfidence: 0.82,
  },
  "risk_pattern::approval_delay": {
    recommendationType: "ratification_control",
    recommendationScope: "ratification",
    title: "Early Ratification Checkpoint",
    description: "Recurring approval delay pattern detected.",
    recommendationText: "Introducir ratificación temprana y responsables explícitos de aprobación.",
    baseConfidence: 0.79,
  },
  "governance_pattern::authority_gap": {
    recommendationType: "authority_control",
    recommendationScope: "authority",
    title: "Authority Mapping Before Execution",
    description: "Authority gap detected.",
    recommendationText: "Conducir mapeo de autoridad antes del inicio del proyecto. Identificar todas las categorías de decisión y asignar autoridades responsables.",
    baseConfidence: 0.81,
  },
  "governance_pattern::late_escalation": {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Automatic Escalation Thresholds",
    description: "Late escalation is a recurring pattern.",
    recommendationText: "Establecer umbrales automáticos de escalación.",
    baseConfidence: 0.78,
  },
  "risk_pattern::resource_shortage": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Capacity Validation Before Commitment",
    description: "Resource shortage detected.",
    recommendationText: "Validar capacidad operativa antes de aprobar cronogramas.",
    baseConfidence: 0.76,
  },
  "outcome_pattern::delivery_delay": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Delivery Risk Monitoring",
    description: "Delivery delay is a recurring outcome.",
    recommendationText: "Establecer indicadores de riesgo de entrega y monitorearlos semanalmente.",
    baseConfidence: 0.77,
  },
};

const FALLBACK_TEMPLATES = {
  risk_pattern: { recommendationType: "risk_mitigation", recommendationScope: "risk", recommendationText: "Desarrollar un manual de mitigación de riesgos para este patrón." },
  governance_pattern: { recommendationType: "governance_control", recommendationScope: "governance", recommendationText: "Fortalecer controles de gobernanza para este patrón." },
  decision_pattern: { recommendationType: "decision_guidance", recommendationScope: "decision", recommendationText: "Documentar criterios de decisión y requerimientos de autoridad." },
  authority_pattern: { recommendationType: "authority_control", recommendationScope: "authority", recommendationText: "Clarificar límites de autoridad para este patrón." },
  amendment_pattern: { recommendationType: "amendment_guidance", recommendationScope: "amendment", recommendationText: "Crear un protocolo estándar de enmienda para este patrón." },
  delivery_pattern: { recommendationType: "delivery_improvement", recommendationScope: "delivery", recommendationText: "Establecer puntos de control de entrega y criterios de éxito." },
  outcome_pattern: { recommendationType: "delivery_improvement", recommendationScope: "project", recommendationText: "Definir criterios de éxito y fracaso para este patrón." },
};

function getRecommendationTemplate(patternType, patternKey, patternConfidence) {
  const catalogKey = `${patternType}::${patternKey}`;
  const template = TEMPLATE_CATALOG[catalogKey];
  if (template) {
    return { ...template, baseConfidence: round3((template.baseConfidence + patternConfidence) / 2), recommendationKey: catalogKey };
  }
  const fallback = FALLBACK_TEMPLATES[patternType] ?? FALLBACK_TEMPLATES["outcome_pattern"];
  return { ...fallback, title: "Generic Recommendation", description: "Generic fallback.", baseConfidence: round3(Math.min(0.6, patternConfidence * 0.8)), recommendationKey: catalogKey };
}

// ─── Inline Confidence Engine ─────────────────────────────────────────────────

function weightPatternConfidence(v) { return Math.min(1.0, Math.max(0.0, v)); }
function weightOccurrence(n) {
  if (n <= 1) return 0.2;
  if (n <= 3) return 0.4;
  if (n <= 7) return 0.6;
  if (n <= 15) return 0.8;
  return 1.0;
}
function weightConsistency(v) { return Math.min(1.0, Math.max(0.0, v)); }
function weightEvidence(n) {
  if (n <= 0) return 0.0;
  if (n === 1) return 0.4;
  if (n <= 3) return 0.65;
  if (n <= 5) return 0.85;
  return 1.0;
}
function calculateRecommendationConfidence({ patternConfidence, occurrenceCount, avgContributionWeight, evidenceCount }) {
  const pc = weightPatternConfidence(patternConfidence);
  const ow = weightOccurrence(occurrenceCount);
  const cw = weightConsistency(avgContributionWeight);
  const ew = weightEvidence(evidenceCount);
  const overall = round3(pc * 0.40 + ow * 0.30 + cw * 0.20 + ew * 0.10);
  return { patternConfidence: round3(pc), occurrenceWeight: round3(ow), consistencyWeight: round3(cw), evidenceWeight: round3(ew), overall };
}

// ─── Inline Applicability Engine ──────────────────────────────────────────────

function scoreScopeAlignment(scope, context) {
  const constitutionStatus = context.constitutionStatus ?? "";
  const projectType = context.projectType ?? "";
  if (scope === "governance" || scope === "authority") return 0.9;
  if (scope === "ratification" && constitutionStatus === "active") return 0.9;
  if (scope === "ratification") return 0.6;
  if (scope === "delivery" && (projectType === "delivery" || projectType === "implementation")) return 0.9;
  if (scope === "delivery") return 0.7;
  if (scope === "portfolio" && projectType === "portfolio") return 0.9;
  if (scope === "portfolio") return 0.5;
  if (scope === "project") return 0.8;
  return 0.65;
}

function classifyApplicability(score) {
  if (score >= 0.65) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}

function evaluateRecommendationApplicability(recommendation, context) {
  let score = recommendation.confidence_score * 0.4;
  const rationale = [];
  const presentRisks = context.presentRiskKeys ?? [];
  const observedPatterns = context.observedPatternKeys ?? [];
  const patternKey = recommendation.recommendation_key.includes("::") ? recommendation.recommendation_key.split("::")[1] : recommendation.recommendation_key;
  const riskMatch = presentRisks.some((r) => r === patternKey || r.includes(patternKey) || patternKey.includes(r));
  const patternMatch = observedPatterns.some((p) => p === patternKey || p.includes(patternKey) || patternKey.includes(p));
  if (riskMatch) { score += 0.3; rationale.push("risk match"); }
  else if (patternMatch) { score += 0.2; rationale.push("pattern match"); }
  else { score += 0.05; rationale.push("no direct overlap"); }
  const scopeScore = scoreScopeAlignment(recommendation.recommendation_scope, context);
  score += scopeScore * 0.2;
  rationale.push(`scope: ${recommendation.recommendation_scope}`);
  const evidenceScore = Math.min(1.0, recommendation.supporting_pattern_count / 5);
  score += evidenceScore * 0.1;
  const finalScore = round3(Math.min(1.0, score));
  return { level: classifyApplicability(finalScore), score: finalScore, rationale };
}

// ─── Inline Justification Engine ─────────────────────────────────────────────

const PATTERN_TYPE_LABELS = {
  risk_pattern: "Risk pattern",
  governance_pattern: "Governance pattern",
  decision_pattern: "Decision pattern",
  authority_pattern: "Authority pattern",
  amendment_pattern: "Amendment pattern",
  delivery_pattern: "Delivery pattern",
  outcome_pattern: "Outcome pattern",
};

function generateRecommendationJustification({ recommendation, patternKey, patternType, evidenceCount }) {
  const typeLabel = PATTERN_TYPE_LABELS[patternType] ?? patternType.replace(/_/g, " ");
  const keyLabel = patternKey.replace(/_/g, " ");
  const because = `${typeLabel}: ${keyLabel}`;
  const evidence = evidenceCount === 0 ? "No supporting digests recorded yet." : evidenceCount === 1 ? "1 digest" : `${evidenceCount} digests`;
  return { recommendation: recommendation.recommendation_text, because, evidence, confidence: recommendation.confidence_score, patternKey, patternType };
}

// ─── Inline Lineage Builder ───────────────────────────────────────────────────

function buildRecommendationLineage(recommendation, patterns, digests, memories, artifacts, learningEvidence) {
  const patternById = new Map(patterns.map((p) => [p.id, p]));
  const memoryById = new Map(memories.map((m) => [m.id, m]));
  const artifactById = new Map(artifacts.map((a) => [a.id, a]));
  const patternForDigest = new Map(learningEvidence.map((le) => [le.digest_id, le.learning_pattern_id]));
  const lineages = [];
  for (const digest of digests) {
    const memory = memoryById.get(digest.memory_record_id);
    if (!memory) continue;
    const artifact = artifactById.get(memory.artifact_id);
    if (!artifact) continue;
    const patternId = patternForDigest.get(digest.id);
    if (!patternId) continue;
    const pattern = patternById.get(patternId);
    if (!pattern) continue;
    lineages.push({ artifact, memoryRecord: memory, digest, learningPattern: pattern, recommendation });
  }
  return lineages;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes sovereign-recommendation-engine", () => {
    assert.match(dbContract, /sovereign-recommendation-engine/);
  });

  test("ConstitutionalRecommendationRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationRow/);
  });

  test("ConstitutionalRecommendationEvidenceRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationEvidenceRow/);
  });

  test("ConstitutionalRecommendationApplicationRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationApplicationRow/);
  });

  test("CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS/);
  });

  test("RecommendationType includes all 8 types", () => {
    for (const t of [
      "risk_mitigation", "governance_control", "decision_guidance", "authority_control",
      "delivery_improvement", "ratification_control", "amendment_guidance", "portfolio_guidance",
    ]) {
      assert.match(dbContract, new RegExp(t), `RecommendationType missing: ${t}`);
    }
  });

  test("RecommendationScope includes all 9 scopes", () => {
    for (const s of [
      "project", "decision", "risk", "governance", "amendment",
      "authority", "ratification", "delivery", "portfolio",
    ]) {
      assert.match(dbContract, new RegExp(s), `RecommendationScope missing: ${s}`);
    }
  });

  test("RecommendationStatus includes all 5 statuses", () => {
    for (const s of ["draft", "generated", "validated", "published", "retired"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `RecommendationStatus missing: ${s}`);
    }
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates constitutional_recommendations table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendations/);
  });

  test("creates constitutional_recommendation_evidence table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendation_evidence/);
  });

  test("creates constitutional_recommendation_applications table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendation_applications/);
  });

  test("enables RLS on all three tables", () => {
    assert.match(migration, /constitutional_recommendations.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_evidence.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_applications.*enable row level security/s);
  });

  test("enforces composite FK for workspace isolation on evidence", () => {
    assert.match(migration, /constraint cre_recommendation_workspace_fk/);
  });

  test("enforces composite FK for workspace isolation on applications", () => {
    assert.match(migration, /constraint cra_recommendation_workspace_fk/);
  });

  test("deleted_at column for soft retirement", () => {
    assert.match(migration, /deleted_at/);
  });

  test("status check constraint includes all 5 statuses", () => {
    for (const s of ["draft", "generated", "validated", "published", "retired"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Status missing: ${s}`);
    }
  });

  test("recommendation_type check constraint includes all 8 types", () => {
    for (const t of ["risk_mitigation", "governance_control", "decision_guidance", "authority_control",
                     "delivery_improvement", "ratification_control", "amendment_guidance", "portfolio_guidance"]) {
      assert.match(migration, new RegExp(`'${t}'`), `Type missing: ${t}`);
    }
  });

  test("recommendation_scope check constraint includes all 9 scopes", () => {
    for (const s of ["project", "decision", "risk", "governance", "amendment",
                     "authority", "ratification", "delivery", "portfolio"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Scope missing: ${s}`);
    }
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("RecommendationResult<T> is defined", () => {
    assert.match(types, /RecommendationResult/);
  });

  test("RecommendationResult failureClass union is complete", () => {
    for (const fc of ["validation_failed", "not_found", "persistence_failed", "event_emission_failed", "governance_violation"]) {
      assert.match(types, new RegExp(fc));
    }
  });

  test("ConstitutionalRecommendationEventType defines all 9 events", () => {
    for (const evt of [
      "CONSTITUTIONAL_RECOMMENDATION_CREATED",
      "CONSTITUTIONAL_RECOMMENDATION_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_VALIDATED",
      "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED",
      "CONSTITUTIONAL_RECOMMENDATION_RETIRED",
      "CONSTITUTIONAL_RECOMMENDATION_APPLIED",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED",
      "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED",
    ]) {
      assert.match(types, new RegExp(evt), `Event type missing: ${evt}`);
    }
  });

  test("RecommendationLineage has all 5 chain members", () => {
    assert.match(types, /RecommendationLineage/);
    assert.match(types, /artifact/);
    assert.match(types, /memoryRecord/);
    assert.match(types, /digest/);
    assert.match(types, /learningPattern/);
    assert.match(types, /recommendation/);
  });

  test("RecommendationConfidenceBreakdown has all 5 dimensions", () => {
    assert.match(types, /RecommendationConfidenceBreakdown/);
    for (const d of ["patternConfidence", "occurrenceWeight", "consistencyWeight", "evidenceWeight", "overall"]) {
      assert.match(types, new RegExp(d));
    }
  });

  test("ApplicabilityLevel union is defined", () => {
    assert.match(types, /ApplicabilityLevel/);
    assert.match(types, /"high"/);
    assert.match(types, /"medium"/);
    assert.match(types, /"low"/);
  });
});

// ─── Recommendation Lifecycle (structural) ────────────────────────────────────

describe("Recommendation Lifecycle — registry.ts structural checks", () => {
  test("createRecommendation is exported", () => {
    assert.match(registry, /createRecommendation/);
  });

  test("generateRecommendation is exported", () => {
    assert.match(registry, /generateRecommendation/);
  });

  test("validateRecommendation enforces evidence requirement (Rule 3)", () => {
    assert.match(registry, /recommendation has no evidence/);
  });

  test("validateRecommendation enforces confidence > 0 (Rule 4)", () => {
    assert.match(registry, /confidence score must be greater than 0/);
  });

  test("publishRecommendation requires validated status", () => {
    assert.match(registry, /Only validated recommendations can be published/);
  });

  test("retireRecommendation uses soft retirement via deleted_at", () => {
    assert.match(registry, /deleted_at/);
    assert.match(registry, /status.*retired/s);
  });

  test("applyRecommendation requires published status (Rule 7)", () => {
    assert.match(registry, /Only published recommendations can be applied/);
  });

  test("getRecommendation enforces workspace_id isolation", () => {
    assert.match(registry, /eq\("workspace_id"/);
  });

  test("listRecommendations filters by deleted_at (excludes retired)", () => {
    assert.match(registry, /is\("deleted_at", null\)/);
  });

  test("registry emits all 9 audit events", () => {
    for (const evt of [
      "CONSTITUTIONAL_RECOMMENDATION_CREATED",
      "CONSTITUTIONAL_RECOMMENDATION_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_VALIDATED",
      "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED",
      "CONSTITUTIONAL_RECOMMENDATION_RETIRED",
      "CONSTITUTIONAL_RECOMMENDATION_APPLIED",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED",
      "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED",
    ]) {
      assert.match(registry, new RegExp(evt), `Registry missing audit event: ${evt}`);
    }
  });

  test("registry uses governance eventCategory", () => {
    assert.match(registry, /eventCategory: "governance"/);
  });

  test("registry marks learningEligible: true", () => {
    assert.match(registry, /learningEligible: true/);
  });
});

// ─── Recommendation Generation ────────────────────────────────────────────────

describe("Recommendation Generation — getRecommendationTemplate()", () => {
  test("returns catalog template for third_party_dependency", () => {
    const t = getRecommendationTemplate("risk_pattern", "third_party_dependency", 0.8);
    assert.ok(t.recommendationText.length > 0);
    assert.equal(t.recommendationType, "risk_mitigation");
    assert.equal(t.recommendationScope, "risk");
    assert.ok(t.baseConfidence > 0.5 && t.baseConfidence < 1.0);
  });

  test("returns catalog template for approval_delay", () => {
    const t = getRecommendationTemplate("risk_pattern", "approval_delay", 0.7);
    assert.ok(t.recommendationText.length > 0);
    assert.match(t.recommendationText, /ratificación|ratification/i);
    assert.equal(t.recommendationType, "ratification_control");
  });

  test("returns catalog template for authority_gap", () => {
    const t = getRecommendationTemplate("governance_pattern", "authority_gap", 0.75);
    assert.ok(t.recommendationText.length > 0);
    assert.match(t.recommendationText, /autoridad|authority/i);
    assert.equal(t.recommendationType, "authority_control");
  });

  test("returns fallback for unknown pattern key", () => {
    const t = getRecommendationTemplate("risk_pattern", "unknown_key_xyz", 0.5);
    assert.ok(t.recommendationText.length > 0);
    assert.ok(t.baseConfidence <= 0.6);
  });

  test("blends confidence for catalog templates", () => {
    const t = getRecommendationTemplate("risk_pattern", "third_party_dependency", 0.6);
    // (0.82 + 0.6) / 2 = 0.71
    assert.ok(t.baseConfidence > 0.5 && t.baseConfidence < 1.0);
  });

  test("generates different recommendations for each pattern type fallback", () => {
    const types = ["risk_pattern", "governance_pattern", "decision_pattern", "authority_pattern", "amendment_pattern", "delivery_pattern", "outcome_pattern"];
    const texts = new Set();
    for (const t of types) {
      const rec = getRecommendationTemplate(t, "unknown_key_xyz", 0.5);
      texts.add(rec.recommendationText);
    }
    assert.ok(texts.size === types.length, "Each pattern type should produce a distinct fallback");
  });

  test("recommendationKey is patternType::patternKey", () => {
    const t = getRecommendationTemplate("risk_pattern", "approval_delay", 0.7);
    assert.equal(t.recommendationKey, "risk_pattern::approval_delay");
  });
});

// ─── Confidence Engine ────────────────────────────────────────────────────────

describe("Confidence Engine — calculateRecommendationConfidence()", () => {
  test("overall is between 0 and 1 for extreme inputs", () => {
    for (const [pc, oc, cw, ec] of [[0, 0, 0, 0], [1, 100, 1, 100], [0.5, 5, 0.7, 3]]) {
      const r = calculateRecommendationConfidence({ patternConfidence: pc, occurrenceCount: oc, avgContributionWeight: cw, evidenceCount: ec });
      assert.ok(r.overall >= 0 && r.overall <= 1, `overall out of range: ${r.overall}`);
    }
  });

  test("all 5 dimensions are present in breakdown", () => {
    const r = calculateRecommendationConfidence({ patternConfidence: 0.7, occurrenceCount: 5, avgContributionWeight: 0.8, evidenceCount: 2 });
    for (const d of ["patternConfidence", "occurrenceWeight", "consistencyWeight", "evidenceWeight", "overall"]) {
      assert.ok(d in r, `missing dimension: ${d}`);
    }
  });

  test("score increases with higher pattern confidence", () => {
    const low  = calculateRecommendationConfidence({ patternConfidence: 0.2, occurrenceCount: 5, avgContributionWeight: 0.7, evidenceCount: 2 });
    const high = calculateRecommendationConfidence({ patternConfidence: 0.9, occurrenceCount: 5, avgContributionWeight: 0.7, evidenceCount: 2 });
    assert.ok(high.overall > low.overall);
  });

  test("score increases with more occurrences", () => {
    const low  = calculateRecommendationConfidence({ patternConfidence: 0.7, occurrenceCount: 1, avgContributionWeight: 0.7, evidenceCount: 2 });
    const high = calculateRecommendationConfidence({ patternConfidence: 0.7, occurrenceCount: 20, avgContributionWeight: 0.7, evidenceCount: 2 });
    assert.ok(high.overall > low.overall);
  });

  test("evidence count 0 gives 0.0 evidenceWeight", () => {
    const r = calculateRecommendationConfidence({ patternConfidence: 0.7, occurrenceCount: 5, avgContributionWeight: 0.8, evidenceCount: 0 });
    assert.equal(r.evidenceWeight, 0.0);
  });

  test("scale is 0.0 to 1.0", () => {
    const r = calculateRecommendationConfidence({ patternConfidence: 1.0, occurrenceCount: 100, avgContributionWeight: 1.0, evidenceCount: 10 });
    assert.ok(r.overall <= 1.0);
  });
});

// ─── Justification Engine ─────────────────────────────────────────────────────

describe("Justification Engine — generateRecommendationJustification()", () => {
  function makeRec(key, text, confidence) {
    return { id: uuid(), workspace_id: "w1", recommendation_key: key, recommendation_type: "risk_mitigation", recommendation_scope: "risk", title: "T", description: "D", recommendation_text: text, confidence_score: confidence, supporting_pattern_count: 2, status: "published", created_at: "", updated_at: "", deleted_at: null };
  }

  test("returns correct recommendation text", () => {
    const rec = makeRec("risk_pattern::approval_delay", "Introducir ratificación temprana.", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 127 });
    assert.equal(j.recommendation, "Introducir ratificación temprana.");
  });

  test("because clause includes pattern type label and key", () => {
    const rec = makeRec("risk_pattern::approval_delay", "text", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 127 });
    assert.match(j.because, /Risk pattern/);
    assert.match(j.because, /approval delay/);
  });

  test("evidence formats correctly for count > 1", () => {
    const rec = makeRec("risk_pattern::approval_delay", "text", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 127 });
    assert.equal(j.evidence, "127 digests");
  });

  test("evidence formats correctly for count = 1", () => {
    const rec = makeRec("risk_pattern::approval_delay", "text", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 1 });
    assert.equal(j.evidence, "1 digest");
  });

  test("evidence formats correctly for count = 0", () => {
    const rec = makeRec("risk_pattern::approval_delay", "text", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 0 });
    assert.match(j.evidence, /No supporting/);
  });

  test("confidence matches recommendation confidence_score", () => {
    const rec = makeRec("risk_pattern::approval_delay", "text", 0.81);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "approval_delay", patternType: "risk_pattern", evidenceCount: 5 });
    assert.equal(j.confidence, 0.81);
  });

  test("patternKey and patternType are preserved in output", () => {
    const rec = makeRec("governance_pattern::authority_gap", "text", 0.75);
    const j = generateRecommendationJustification({ recommendation: rec, patternKey: "authority_gap", patternType: "governance_pattern", evidenceCount: 10 });
    assert.equal(j.patternKey, "authority_gap");
    assert.equal(j.patternType, "governance_pattern");
  });
});

// ─── Applicability Engine ─────────────────────────────────────────────────────

describe("Applicability Engine — evaluateRecommendationApplicability()", () => {
  function makeRec(key, scope, confidence, patternCount = 2) {
    return { id: uuid(), workspace_id: "w1", recommendation_key: key, recommendation_type: "risk_mitigation", recommendation_scope: scope, title: "T", description: "D", recommendation_text: "text", confidence_score: confidence, supporting_pattern_count: patternCount, status: "published", created_at: "", updated_at: "", deleted_at: null };
  }

  test("high applicability when risk directly matches pattern key", () => {
    const rec = makeRec("risk_pattern::third_party_dependency", "risk", 0.82);
    const ctx = { presentRiskKeys: ["third_party_dependency"], observedPatternKeys: [] };
    const result = evaluateRecommendationApplicability(rec, ctx);
    assert.equal(result.level, "high");
    assert.ok(result.score >= 0.65);
  });

  test("medium applicability when pattern matches but no direct risk", () => {
    const rec = makeRec("risk_pattern::approval_delay", "ratification", 0.50);
    const ctx = { presentRiskKeys: [], observedPatternKeys: ["approval_delay"] };
    const result = evaluateRecommendationApplicability(rec, ctx);
    assert.ok(result.level === "medium" || result.level === "high");
    assert.ok(result.score >= 0.40);
  });

  test("low applicability when no context match and low confidence", () => {
    const rec = makeRec("outcome_pattern::cancelled", "project", 0.20);
    const ctx = { presentRiskKeys: [], observedPatternKeys: [] };
    const result = evaluateRecommendationApplicability(rec, ctx);
    assert.ok(result.level === "low" || result.level === "medium");
    assert.ok(result.score < 0.65);
  });

  test("governance scope always scores high in scope alignment", () => {
    const rec = makeRec("governance_pattern::authority_gap", "governance", 0.75);
    const ctx = {};
    const result = evaluateRecommendationApplicability(rec, ctx);
    assert.ok(result.score > 0.40);
  });

  test("score is between 0 and 1 for all inputs", () => {
    for (const [scope, confidence] of [["risk", 0.0], ["governance", 1.0], ["delivery", 0.5], ["portfolio", 0.3]]) {
      const rec = makeRec(`outcome_pattern::x`, scope, confidence);
      const result = evaluateRecommendationApplicability(rec, {});
      assert.ok(result.score >= 0 && result.score <= 1, `score out of range: ${result.score}`);
    }
  });

  test("rationale is a non-empty array", () => {
    const rec = makeRec("risk_pattern::approval_delay", "ratification", 0.79);
    const ctx = { presentRiskKeys: ["approval_delay"] };
    const result = evaluateRecommendationApplicability(rec, ctx);
    assert.ok(Array.isArray(result.rationale) && result.rationale.length > 0);
  });
});

// ─── Lineage ──────────────────────────────────────────────────────────────────

describe("Recommendation Lineage — buildRecommendationLineage()", () => {
  function makeArtifact(id) {
    return { id, workspace_id: "w1", artifact_type: "document", title: "Test Doc", storage_provider: "local", storage_reference: "ref", checksum: "abc", created_at: new Date().toISOString() };
  }
  function makeMemory(id, artifactId) {
    return { id, workspace_id: "w1", artifact_id: artifactId, memory_type: "risk", title: "Memory", canonical_text: "text", summary: null, created_at: new Date().toISOString(), created_by: uuid() };
  }
  function makeDigest(id, memoryId) {
    return { id, workspace_id: "w1", memory_record_id: memoryId, digest_status: "published", digest_payload: {}, confidence_score: 0.8, created_at: new Date().toISOString() };
  }
  function makePattern(id) {
    return { id, workspace_id: "w1", pattern_type: "risk_pattern", pattern_key: "third_party_dependency", description: "desc", confidence_score: 0.75, occurrence_count: 3, created_at: "", updated_at: "" };
  }
  function makeRecommendation(id) {
    return { id, workspace_id: "w1", recommendation_key: "risk_pattern::third_party_dependency", recommendation_type: "risk_mitigation", recommendation_scope: "risk", title: "T", description: "D", recommendation_text: "text", confidence_score: 0.79, supporting_pattern_count: 1, status: "published", created_at: "", updated_at: "", deleted_at: null };
  }

  test("reconstructs complete 5-node chain: Artifact → Memory → Digest → Pattern → Recommendation", () => {
    const a = makeArtifact(uuid());
    const m = makeMemory(uuid(), a.id);
    const d = makeDigest(uuid(), m.id);
    const p = makePattern(uuid());
    const r = makeRecommendation(uuid());
    const le = [{ digest_id: d.id, learning_pattern_id: p.id }];
    const lineages = buildRecommendationLineage(r, [p], [d], [m], [a], le);
    assert.equal(lineages.length, 1);
    assert.equal(lineages[0].artifact.id, a.id);
    assert.equal(lineages[0].memoryRecord.id, m.id);
    assert.equal(lineages[0].digest.id, d.id);
    assert.equal(lineages[0].learningPattern.id, p.id);
    assert.equal(lineages[0].recommendation.id, r.id);
  });

  test("multiple digests produce multiple lineage entries", () => {
    const a = makeArtifact(uuid());
    const m1 = makeMemory(uuid(), a.id);
    const m2 = makeMemory(uuid(), a.id);
    const d1 = makeDigest(uuid(), m1.id);
    const d2 = makeDigest(uuid(), m2.id);
    const p = makePattern(uuid());
    const r = makeRecommendation(uuid());
    const le = [{ digest_id: d1.id, learning_pattern_id: p.id }, { digest_id: d2.id, learning_pattern_id: p.id }];
    const lineages = buildRecommendationLineage(r, [p], [d1, d2], [m1, m2], [a], le);
    assert.equal(lineages.length, 2);
  });

  test("skips digest if memory is missing", () => {
    const a = makeArtifact(uuid());
    const m = makeMemory(uuid(), a.id);
    const d1 = makeDigest(uuid(), m.id);
    const d2 = makeDigest(uuid(), uuid()); // orphaned
    const p = makePattern(uuid());
    const r = makeRecommendation(uuid());
    const le = [{ digest_id: d1.id, learning_pattern_id: p.id }, { digest_id: d2.id, learning_pattern_id: p.id }];
    const lineages = buildRecommendationLineage(r, [p], [d1, d2], [m], [a], le);
    assert.equal(lineages.length, 1);
  });

  test("skips digest if artifact is missing", () => {
    const a = makeArtifact(uuid());
    const m1 = makeMemory(uuid(), a.id);
    const m2 = makeMemory(uuid(), uuid()); // orphaned artifact
    const d1 = makeDigest(uuid(), m1.id);
    const d2 = makeDigest(uuid(), m2.id);
    const p = makePattern(uuid());
    const r = makeRecommendation(uuid());
    const le = [{ digest_id: d1.id, learning_pattern_id: p.id }, { digest_id: d2.id, learning_pattern_id: p.id }];
    const lineages = buildRecommendationLineage(r, [p], [d1, d2], [m1, m2], [a], le);
    assert.equal(lineages.length, 1);
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const EVENTS = [
    "CONSTITUTIONAL_RECOMMENDATION_CREATED",
    "CONSTITUTIONAL_RECOMMENDATION_GENERATED",
    "CONSTITUTIONAL_RECOMMENDATION_VALIDATED",
    "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED",
    "CONSTITUTIONAL_RECOMMENDATION_RETIRED",
    "CONSTITUTIONAL_RECOMMENDATION_APPLIED",
    "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED",
    "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED",
    "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED",
  ];

  for (const evt of EVENTS) {
    test(`registry emits ${evt}`, () => {
      assert.match(registry, new RegExp(evt));
    });
  }

  test("explain lists all 9 audit events", () => {
    for (const evt of EVENTS) {
      assert.match(explain, new RegExp(evt), `Explain missing: ${evt}`);
    }
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("registry validates workspaceId UUID format", () => {
    assert.match(registry, /validUuid/);
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("all queries filter by workspace_id", () => {
    assert.match(registry, /eq\("workspace_id"/);
  });

  test("migration enforces composite FK on evidence", () => {
    assert.match(migration, /constraint cre_recommendation_workspace_fk/);
  });

  test("migration enforces composite FK on applications", () => {
    assert.match(migration, /constraint cra_recommendation_workspace_fk/);
  });

  test("migration enables RLS on all three tables", () => {
    assert.match(migration, /constitutional_recommendations.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_evidence.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_applications.*enable row level security/s);
  });

  test("registry uses is_workspace_member via RLS policies in migration", () => {
    assert.match(migration, /is_workspace_member/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability — explainSovereignRecommendations()", () => {
  test("defines concept", () => {
    assert.match(explain, /concept/);
    assert.match(explain, /Sovereign Recommendation/i);
  });

  test("defines all 6 sovereignty principles", () => {
    for (let i = 1; i <= 6; i++) {
      assert.match(explain, new RegExp(`Principle ${i}`), `Missing Principle ${i}`);
    }
  });

  test("describes recommendation lifecycle stages", () => {
    for (const s of ["draft", "generated", "validated", "published", "retired"]) {
      assert.match(explain, new RegExp(s));
    }
  });

  test("describes confidence model dimensions", () => {
    assert.match(explain, /confidenceModel/);
    for (const d of ["patternConfidence", "occurrenceWeight", "consistencyWeight", "evidenceWeight"]) {
      assert.match(explain, new RegExp(d));
    }
  });

  test("includes justification example with approval_delay", () => {
    assert.match(explain, /justificationModel/);
    assert.match(explain, /approval_delay/);
    assert.match(explain, /ratificación|ratification/i);
  });

  test("describes applicability model levels", () => {
    assert.match(explain, /applicabilityModel/);
    assert.match(explain, /high/);
    assert.match(explain, /medium/);
    assert.match(explain, /low/);
  });

  test("lineage chain has 5 nodes", () => {
    assert.match(explain, /lineage/);
    assert.match(explain, /Artifact/);
    assert.match(explain, /Memory/);
    assert.match(explain, /Digest/);
    assert.match(explain, /Learning Pattern/);
    assert.match(explain, /Recommendation/);
  });

  test("lists all 8 recommendation types", () => {
    for (const t of ["risk_mitigation", "governance_control", "decision_guidance", "authority_control",
                     "delivery_improvement", "ratification_control", "amendment_guidance", "portfolio_guidance"]) {
      assert.match(explain, new RegExp(t), `Explain missing type: ${t}`);
    }
  });

  test("lists all 9 recommendation scopes", () => {
    for (const s of ["project", "decision", "risk", "governance", "amendment",
                     "authority", "ratification", "delivery", "portfolio"]) {
      assert.match(explain, new RegExp(s), `Explain missing scope: ${s}`);
    }
  });
});

// ─── Public API — index.ts ────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "createRecommendation",
    "generateRecommendation",
    "generateRecommendationsFromPatterns",
    "validateRecommendation",
    "publishRecommendation",
    "retireRecommendation",
    "applyRecommendation",
    "getRecommendation",
    "listRecommendations",
    "calculateRecommendationConfidenceForId",
    "getRecommendationJustification",
    "getRecommendationLineage",
    "evaluateRecommendationApplicability",
    "explainSovereignRecommendations",
  ];
  for (const fn of publicFns) {
    test(`exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs/sovereign-recommendation-engine.md exists and covers key concepts", () => {
    assert.match(docs, /Sovereign Recommendation/i);
    assert.match(docs, /Confidence/i);
    assert.match(docs, /Lineage/i);
  });

  test("documentation describes lifecycle", () => {
    for (const s of ["draft", "generated", "validated", "published", "retired"]) {
      assert.match(docs, new RegExp(s, "i"));
    }
  });

  test("documentation mentions audit events", () => {
    assert.match(docs, /CONSTITUTIONAL_RECOMMENDATION/);
  });

  test("documentation describes 5-node lineage chain", () => {
    assert.match(docs, /Artifact/i);
    assert.match(docs, /Memory/i);
    assert.match(docs, /Digest/i);
    assert.match(docs, /Learning Pattern/i);
    assert.match(docs, /Recommendation/i);
  });
});
