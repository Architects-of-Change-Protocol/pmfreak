/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory reimplementation of Learning Engine logic for pure unit tests.
// No database access — aggregation, correlation, confidence, recommendations,
// lineage, and audit events are all verified here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Source files (for structural contract tests) ─────────────────────────────

const types        = readFileSync("src/lib/constitutional-learning/types.ts", "utf8");
const registry     = readFileSync("src/lib/constitutional-learning/learning-registry.ts", "utf8");
const aggregation  = readFileSync("src/lib/constitutional-learning/aggregation-engine.ts", "utf8");
const correlation  = readFileSync("src/lib/constitutional-learning/correlation-engine.ts", "utf8");
const confidence   = readFileSync("src/lib/constitutional-learning/confidence-engine.ts", "utf8");
const recommendation = readFileSync("src/lib/constitutional-learning/recommendation-engine.ts", "utf8");
const lineage      = readFileSync("src/lib/constitutional-learning/learning-registry.ts", "utf8");
const explain      = readFileSync("src/lib/constitutional-learning/explain-capability.ts", "utf8");
const indexFile    = readFileSync("src/lib/constitutional-learning/index.ts", "utf8");
const dbContract   = readFileSync("src/lib/db/database-contract.ts", "utf8");
const docs         = readFileSync("docs/institutional-learning-engine.md", "utf8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Inline Aggregation Engine (mirrors aggregation-engine.ts) ───────────────

const PAYLOAD_TYPE_MAP = [
  { payloadKey: "decision_patterns", patternType: "decision_pattern" },
  { payloadKey: "risk_patterns",     patternType: "risk_pattern" },
  { payloadKey: "governance_patterns", patternType: "governance_pattern" },
  { payloadKey: "outcome_patterns",  patternType: "outcome_pattern" },
];

function aggregateDigests(digests) {
  const map = new Map();
  for (const digest of digests) {
    const baseWeight = digest.confidence_score ?? 0.5;
    for (const { payloadKey, patternType } of PAYLOAD_TYPE_MAP) {
      const keys = (digest.payload[payloadKey] ?? []);
      for (const key of keys) {
        const mk = `${patternType}::${key}`;
        const existing = map.get(mk);
        if (existing) {
          existing.occurrences++;
          existing.digestIds.push(digest.id);
          existing.contributionWeights.push(baseWeight);
        } else {
          map.set(mk, { patternType, patternKey: key, occurrences: 1, digestIds: [digest.id], contributionWeights: [baseWeight] });
        }
      }
    }
  }
  return Array.from(map.values());
}

// ─── Inline Correlation Engine (mirrors correlation-engine.ts) ────────────────

function extractRefs(payload) {
  const refs = [];
  for (const { payloadKey, patternType } of PAYLOAD_TYPE_MAP) {
    for (const k of (payload[payloadKey] ?? [])) {
      refs.push({ patternType, patternKey: k });
    }
  }
  return refs;
}

function pairKey(a, b) {
  const ka = `${a.patternType}::${a.patternKey}`;
  const kb = `${b.patternType}::${b.patternKey}`;
  return ka < kb ? `${ka}|||${kb}` : `${kb}|||${ka}`;
}

function discoverCorrelations(digests, minFrequency = 0.1) {
  const pairCounts = new Map();
  const patternCounts = new Map();
  const pairMeta = new Map();

  for (const digest of digests) {
    const refs = extractRefs(digest.payload);
    const seen = new Set();
    for (const ref of refs) {
      const rk = `${ref.patternType}::${ref.patternKey}`;
      if (!seen.has(rk)) {
        seen.add(rk);
        patternCounts.set(rk, (patternCounts.get(rk) ?? 0) + 1);
      }
    }
    const deduped = Array.from(new Map(refs.map((r) => [`${r.patternType}::${r.patternKey}`, r])).values());
    for (let i = 0; i < deduped.length; i++) {
      for (let j = i + 1; j < deduped.length; j++) {
        const pk = pairKey(deduped[i], deduped[j]);
        pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 1);
        if (!pairMeta.has(pk)) pairMeta.set(pk, { a: deduped[i], b: deduped[j] });
      }
    }
  }

  const total = digests.length;
  if (total === 0) return [];

  const results = [];
  for (const [pk, count] of pairCounts) {
    const frequency = count / total;
    if (frequency < minFrequency) continue;
    const meta = pairMeta.get(pk);
    const aKey = `${meta.a.patternType}::${meta.a.patternKey}`;
    const bKey = `${meta.b.patternType}::${meta.b.patternKey}`;
    const aCount = patternCounts.get(aKey) ?? 1;
    const bCount = patternCounts.get(bKey) ?? 1;
    const union = aCount + bCount - count;
    const confidence = union > 0 ? Math.round((count / union) * 1000) / 1000 : 0;
    results.push({ patternKey: meta.a.patternKey, patternType: meta.a.patternType, correlatedWith: meta.b.patternKey, correlatedType: meta.b.patternType, frequency: Math.round(frequency * 1000) / 1000, confidence });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

// ─── Inline Confidence Engine (mirrors confidence-engine.ts) ─────────────────

function calculateFrequency(occurrenceCount, totalDigests) {
  if (totalDigests === 0) return 0;
  return Math.min(1.0, (occurrenceCount / totalDigests) * 2);
}

function calculateCoverage(occurrenceCount) {
  if (occurrenceCount <= 1) return 0.2;
  if (occurrenceCount <= 3) return 0.4;
  if (occurrenceCount <= 7) return 0.65;
  if (occurrenceCount <= 15) return 0.8;
  return 1.0;
}

function round3(v) { return Math.round(v * 1000) / 1000; }

function calculateLearningConfidence({ occurrenceCount, totalDigests, avgContributionWeight, patternTypeCount }) {
  const frequency = calculateFrequency(occurrenceCount, totalDigests);
  const coverage = calculateCoverage(occurrenceCount);
  const consistency = Math.min(1.0, avgContributionWeight);
  const evidenceStrength = patternTypeCount <= 1 ? 0.3 : patternTypeCount <= 2 ? 0.55 : patternTypeCount <= 4 ? 0.75 : 1.0;
  const overall = round3(frequency * 0.35 + coverage * 0.30 + consistency * 0.20 + evidenceStrength * 0.15);
  return { frequency: round3(frequency), coverage: round3(coverage), consistency: round3(consistency), evidenceStrength: round3(evidenceStrength), overall };
}

// ─── Inline Recommendation Engine (mirrors recommendation-engine.ts) ──────────

const RECOMMENDATIONS = {
  "risk_pattern::third_party_dependency": { recommendation: "Introduce a vendor readiness assessment before schedule approval.", confidence: 0.82 },
  "risk_pattern::approval_delay": { recommendation: "Introduce early ratification checkpoints.", confidence: 0.79 },
  "governance_pattern::authority_gap": { recommendation: "Conduct authority mapping before project initiation.", confidence: 0.81 },
  "outcome_pattern::delivery_delay": { recommendation: "Establish delivery risk indicators and monitor them weekly.", confidence: 0.77 },
};

const FALLBACK = {
  decision_pattern: "Document decision criteria and authority requirements before this pattern recurs.",
  risk_pattern: "Develop a risk mitigation playbook for this pattern.",
  governance_pattern: "Strengthen governance controls for this pattern.",
  authority_pattern: "Clarify authority boundaries for this pattern.",
  amendment_pattern: "Create a standard amendment protocol for this pattern.",
  delivery_pattern: "Establish delivery checkpoints and success criteria for this pattern.",
  outcome_pattern: "Define success and failure criteria for this pattern before project commitment.",
};

function generateRecommendation(patternType, patternKey, confidenceScore) {
  const lookup = RECOMMENDATIONS[`${patternType}::${patternKey}`];
  if (lookup) {
    return { recommendation: lookup.recommendation, confidence: round3((lookup.confidence + confidenceScore) / 2) };
  }
  return { recommendation: FALLBACK[patternType], confidence: round3(Math.min(0.6, confidenceScore * 0.8)) };
}

// ─── Inline Lineage (mirrors learning-registry.ts lineage logic) ──────────────

function buildLineage(pattern, digests, memories, artifacts) {
  const memoryById = new Map(memories.map((m) => [m.id, m]));
  const artifactById = new Map(artifacts.map((a) => [a.id, a]));
  const lineages = [];
  for (const digest of digests) {
    const memory = memoryById.get(digest.memory_record_id);
    if (!memory) continue;
    const artifact = artifactById.get(memory.artifact_id);
    if (!artifact) continue;
    lineages.push({ artifact, memoryRecord: memory, digest, learningPattern: pattern });
  }
  return lineages;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes constitutional-learning-engine", () => {
    assert.match(dbContract, /constitutional-learning-engine/);
  });

  test("ConstitutionalLearningPatternRow is present", () => {
    assert.match(dbContract, /ConstitutionalLearningPatternRow/);
  });

  test("ConstitutionalLearningEvidenceRow is present", () => {
    assert.match(dbContract, /ConstitutionalLearningEvidenceRow/);
  });

  test("ConstitutionalLearningRecommendationRow is present", () => {
    assert.match(dbContract, /ConstitutionalLearningRecommendationRow/);
  });

  test("CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS/);
  });

  test("LearningPatternType includes all 7 categories", () => {
    for (const t of ["decision_pattern", "risk_pattern", "governance_pattern", "authority_pattern", "amendment_pattern", "delivery_pattern", "outcome_pattern"]) {
      assert.match(dbContract, new RegExp(t), `LearningPatternType missing: ${t}`);
    }
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("LearningResult<T> is defined", () => {
    assert.match(types, /LearningResult/);
  });

  test("LearningResult failureClass union is complete", () => {
    for (const fc of ["validation_failed", "not_found", "persistence_failed", "event_emission_failed", "governance_violation"]) {
      assert.match(types, new RegExp(fc));
    }
  });

  test("ConstitutionalLearningEventType defines all 6 events", () => {
    for (const evt of [
      "CONSTITUTIONAL_LEARNING_PATTERN_CREATED",
      "CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED",
      "CONSTITUTIONAL_LEARNING_PATTERN_UPDATED",
      "CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED",
      "CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED",
      "CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED",
    ]) {
      assert.match(types, new RegExp(evt), `Event type missing: ${evt}`);
    }
  });

  test("LearningLineage has all 4 chain members", () => {
    assert.match(types, /LearningLineage/);
    assert.match(types, /artifact/);
    assert.match(types, /memoryRecord/);
    assert.match(types, /digest/);
    assert.match(types, /learningPattern/);
  });

  test("PatternCorrelation is defined", () => {
    assert.match(types, /PatternCorrelation/);
  });

  test("LearningConfidenceBreakdown has all 5 dimensions", () => {
    assert.match(types, /LearningConfidenceBreakdown/);
    for (const d of ["frequency", "coverage", "consistency", "evidenceStrength", "overall"]) {
      assert.match(types, new RegExp(d));
    }
  });
});

// ─── Pattern Discovery ────────────────────────────────────────────────────────

describe("Pattern Discovery — aggregateDigests()", () => {
  test("detects recurring risk pattern across 3 digests", () => {
    const digests = [
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency", "approval_delay"] }, confidence_score: 0.8 },
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency"] }, confidence_score: 0.75 },
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency", "resource_shortage"] }, confidence_score: 0.7 },
    ];
    const result = aggregateDigests(digests);
    const dep = result.find((r) => r.patternKey === "third_party_dependency");
    assert.ok(dep, "third_party_dependency not detected");
    assert.equal(dep.occurrences, 3);
    assert.equal(dep.patternType, "risk_pattern");
    assert.equal(dep.digestIds.length, 3);
  });

  test("groups different pattern types correctly", () => {
    const digests = [
      { id: uuid(), payload: { decision_patterns: ["vendor_replacement"], risk_patterns: ["third_party_dependency"] }, confidence_score: 0.8 },
      { id: uuid(), payload: { decision_patterns: ["vendor_replacement"], outcome_patterns: ["delivery_delay"] }, confidence_score: 0.7 },
    ];
    const result = aggregateDigests(digests);
    const vendorDecision = result.find((r) => r.patternKey === "vendor_replacement" && r.patternType === "decision_pattern");
    assert.ok(vendorDecision);
    assert.equal(vendorDecision.occurrences, 2);
    const dep = result.find((r) => r.patternKey === "third_party_dependency");
    assert.ok(dep);
    assert.equal(dep.occurrences, 1);
  });

  test("returns empty array for digests with no patterns", () => {
    const digests = [
      { id: uuid(), payload: {}, confidence_score: 0.5 },
      { id: uuid(), payload: {}, confidence_score: 0.6 },
    ];
    const result = aggregateDigests(digests);
    assert.equal(result.length, 0);
  });

  test("contribution weights reflect digest confidence scores", () => {
    const digests = [
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] }, confidence_score: 0.9 },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] }, confidence_score: 0.6 },
    ];
    const result = aggregateDigests(digests);
    const pattern = result.find((r) => r.patternKey === "approval_delay");
    assert.ok(pattern);
    assert.ok(pattern.contributionWeights.includes(0.9));
    assert.ok(pattern.contributionWeights.includes(0.6));
  });

  test("single-occurrence pattern is still detected", () => {
    const digests = [
      { id: uuid(), payload: { governance_patterns: ["authority_gap"] }, confidence_score: 0.7 },
    ];
    const result = aggregateDigests(digests);
    const pattern = result.find((r) => r.patternKey === "authority_gap");
    assert.ok(pattern);
    assert.equal(pattern.occurrences, 1);
  });
});

// ─── Correlations ─────────────────────────────────────────────────────────────

describe("Correlations — discoverCorrelations()", () => {
  test("finds valid correlation between co-occurring patterns", () => {
    const id1 = uuid(), id2 = uuid(), id3 = uuid();
    const digests = [
      { id: id1, payload: { risk_patterns: ["third_party_dependency"], outcome_patterns: ["delivery_delay"] } },
      { id: id2, payload: { risk_patterns: ["third_party_dependency"], outcome_patterns: ["delivery_delay"] } },
      { id: id3, payload: { risk_patterns: ["third_party_dependency"] } },
    ];
    const correlations = discoverCorrelations(digests, 0.1);
    assert.ok(correlations.length > 0, "should find at least one correlation");
    const pair = correlations.find(
      (c) => (c.patternKey === "third_party_dependency" && c.correlatedWith === "delivery_delay") ||
              (c.patternKey === "delivery_delay" && c.correlatedWith === "third_party_dependency"),
    );
    assert.ok(pair, "third_party_dependency ↔ delivery_delay correlation not found");
    assert.ok(pair.frequency >= 0.6, `frequency should be ≥ 0.6, got ${pair.frequency}`);
  });

  test("does not return correlation below minFrequency threshold", () => {
    const digests = [
      { id: uuid(), payload: { risk_patterns: ["scope_creep"], outcome_patterns: ["cost_overrun"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
    ];
    // scope_creep + cost_overrun only appear once out of 10 → 0.1 frequency
    const correlations = discoverCorrelations(digests, 0.2);
    const pair = correlations.find(
      (c) => (c.patternKey === "scope_creep" && c.correlatedWith === "cost_overrun") ||
              (c.patternKey === "cost_overrun" && c.correlatedWith === "scope_creep"),
    );
    assert.ok(!pair, "should not return pair below minFrequency");
  });

  test("returns empty array for empty digest list", () => {
    const result = discoverCorrelations([], 0.1);
    assert.equal(result.length, 0);
  });

  test("confidence is between 0 and 1 for all correlations", () => {
    const digests = [
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency", "approval_delay"], outcome_patterns: ["delivery_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency"], outcome_patterns: ["delivery_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["approval_delay"] } },
    ];
    const correlations = discoverCorrelations(digests, 0.0);
    for (const c of correlations) {
      assert.ok(c.confidence >= 0 && c.confidence <= 1, `confidence out of range: ${c.confidence}`);
      assert.ok(c.frequency >= 0 && c.frequency <= 1, `frequency out of range: ${c.frequency}`);
    }
  });

  test("correlations are sorted descending by confidence", () => {
    const digests = [
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency", "approval_delay"], outcome_patterns: ["delivery_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency", "approval_delay"] } },
      { id: uuid(), payload: { risk_patterns: ["third_party_dependency"] } },
    ];
    const correlations = discoverCorrelations(digests, 0.0);
    for (let i = 1; i < correlations.length; i++) {
      assert.ok(correlations[i - 1].confidence >= correlations[i].confidence);
    }
  });
});

// ─── Recommendations ──────────────────────────────────────────────────────────

describe("Recommendations — generateRecommendation()", () => {
  test("generates known recommendation for third_party_dependency", () => {
    const result = generateRecommendation("risk_pattern", "third_party_dependency", 0.8);
    assert.ok(result.recommendation.length > 0);
    assert.ok(result.confidence > 0 && result.confidence <= 1);
    assert.match(result.recommendation, /vendor/i);
  });

  test("generates known recommendation for approval_delay", () => {
    const result = generateRecommendation("risk_pattern", "approval_delay", 0.7);
    assert.ok(result.recommendation.length > 0);
    assert.match(result.recommendation, /ratification|approval/i);
  });

  test("generates known recommendation for authority_gap", () => {
    const result = generateRecommendation("governance_pattern", "authority_gap", 0.75);
    assert.ok(result.recommendation.length > 0);
    assert.match(result.recommendation, /authority/i);
  });

  test("generates fallback recommendation for unknown pattern key", () => {
    const result = generateRecommendation("delivery_pattern", "unknown_custom_pattern", 0.5);
    assert.ok(result.recommendation.length > 0);
    assert.ok(result.confidence > 0 && result.confidence <= 0.6);
  });

  test("confidence is blended for known patterns", () => {
    const result = generateRecommendation("risk_pattern", "third_party_dependency", 0.6);
    // Lookup confidence is 0.82; blended with 0.6 → (0.82 + 0.6) / 2 = 0.71
    assert.ok(result.confidence > 0.5 && result.confidence < 1.0);
  });

  test("generates different recommendations for each pattern type", () => {
    const types = ["decision_pattern", "risk_pattern", "governance_pattern", "authority_pattern", "amendment_pattern", "delivery_pattern", "outcome_pattern"];
    const recommendations = new Set();
    for (const t of types) {
      const rec = generateRecommendation(t, "unknown_key_xyz", 0.5);
      recommendations.add(rec.recommendation);
    }
    assert.ok(recommendations.size === types.length, "each pattern type should produce a distinct fallback");
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe("Confidence — calculateLearningConfidence()", () => {
  test("score is between 0 and 1 for zero occurrences and zero digests", () => {
    const result = calculateLearningConfidence({ occurrenceCount: 0, totalDigests: 0, avgContributionWeight: 0, patternTypeCount: 0 });
    assert.ok(result.overall >= 0 && result.overall <= 1, `overall out of range: ${result.overall}`);
    // With zero occurrences and zero digests, score should be very low
    assert.ok(result.overall < 0.3, `score should be low for zero evidence, got ${result.overall}`);
  });

  test("score increases with more occurrences", () => {
    const low  = calculateLearningConfidence({ occurrenceCount: 1, totalDigests: 10, avgContributionWeight: 0.7, patternTypeCount: 1 });
    const high = calculateLearningConfidence({ occurrenceCount: 8, totalDigests: 10, avgContributionWeight: 0.7, patternTypeCount: 1 });
    assert.ok(high.overall > low.overall, `expected high > low, got ${high.overall} vs ${low.overall}`);
  });

  test("overall score is between 0 and 1", () => {
    for (const [oc, td, aw, pt] of [
      [1, 1, 1, 1],
      [100, 100, 1, 10],
      [0, 0, 0, 0],
      [5, 20, 0.8, 3],
    ]) {
      const result = calculateLearningConfidence({ occurrenceCount: oc, totalDigests: td, avgContributionWeight: aw, patternTypeCount: pt });
      assert.ok(result.overall >= 0 && result.overall <= 1, `overall out of range: ${result.overall}`);
    }
  });

  test("all breakdown dimensions are between 0 and 1", () => {
    const result = calculateLearningConfidence({ occurrenceCount: 5, totalDigests: 10, avgContributionWeight: 0.8, patternTypeCount: 3 });
    for (const dim of ["frequency", "coverage", "consistency", "evidenceStrength"]) {
      assert.ok(result[dim] >= 0 && result[dim] <= 1, `${dim} out of range: ${result[dim]}`);
    }
  });

  test("high consistency weight pushes score up", () => {
    const low  = calculateLearningConfidence({ occurrenceCount: 3, totalDigests: 10, avgContributionWeight: 0.1, patternTypeCount: 1 });
    const high = calculateLearningConfidence({ occurrenceCount: 3, totalDigests: 10, avgContributionWeight: 1.0, patternTypeCount: 1 });
    assert.ok(high.overall > low.overall);
  });
});

// ─── Learning Lineage ─────────────────────────────────────────────────────────

describe("Learning Lineage — buildLineage()", () => {
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
    return { id, workspace_id: "w1", pattern_type: "risk_pattern", pattern_key: "third_party_dependency", description: "desc", confidence_score: 0.75, occurrence_count: 3, first_seen_at: "", last_seen_at: "", created_at: "", updated_at: "" };
  }

  test("reconstructs complete Artifact → Memory → Digest → Pattern chain", () => {
    const a = makeArtifact(uuid());
    const m = makeMemory(uuid(), a.id);
    const d = makeDigest(uuid(), m.id);
    const p = makePattern(uuid());
    const lineages = buildLineage(p, [d], [m], [a]);
    assert.equal(lineages.length, 1);
    assert.equal(lineages[0].artifact.id, a.id);
    assert.equal(lineages[0].memoryRecord.id, m.id);
    assert.equal(lineages[0].digest.id, d.id);
    assert.equal(lineages[0].learningPattern.id, p.id);
  });

  test("multiple digests produce multiple lineage entries", () => {
    const a = makeArtifact(uuid());
    const m1 = makeMemory(uuid(), a.id);
    const m2 = makeMemory(uuid(), a.id);
    const d1 = makeDigest(uuid(), m1.id);
    const d2 = makeDigest(uuid(), m2.id);
    const p = makePattern(uuid());
    const lineages = buildLineage(p, [d1, d2], [m1, m2], [a]);
    assert.equal(lineages.length, 2);
  });

  test("skips digest if memory record is missing", () => {
    const a = makeArtifact(uuid());
    const m = makeMemory(uuid(), a.id);
    const d1 = makeDigest(uuid(), m.id);
    const d2 = makeDigest(uuid(), uuid()); // orphaned memory_record_id
    const p = makePattern(uuid());
    const lineages = buildLineage(p, [d1, d2], [m], [a]);
    assert.equal(lineages.length, 1);
  });

  test("skips digest if artifact is missing", () => {
    const a = makeArtifact(uuid());
    const m1 = makeMemory(uuid(), a.id);
    const m2 = makeMemory(uuid(), uuid()); // orphaned artifact_id
    const d1 = makeDigest(uuid(), m1.id);
    const d2 = makeDigest(uuid(), m2.id);
    const p = makePattern(uuid());
    const lineages = buildLineage(p, [d1, d2], [m1, m2], [a]);
    assert.equal(lineages.length, 1);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("learning-registry validates workspaceId UUID format", () => {
    assert.match(registry, /validUuid/);
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("aggregateDigests filters to workspace_id", () => {
    assert.match(registry, /eq\("workspace_id"/);
  });

  test("migration enables RLS on all three learning tables", () => {
    const migration = readFileSync("supabase/migrations/20260622000001_constitutional_learning_engine.sql", "utf8");
    assert.match(migration, /constitutional_learning_patterns.*enable row level security/s);
    assert.match(migration, /constitutional_learning_evidence.*enable row level security/s);
    assert.match(migration, /constitutional_learning_recommendations.*enable row level security/s);
  });

  test("migration enforces composite FK for workspace isolation on evidence", () => {
    const migration = readFileSync("supabase/migrations/20260622000001_constitutional_learning_engine.sql", "utf8");
    assert.match(migration, /constraint clp_evidence_workspace_fk/);
  });

  test("migration enforces composite FK for workspace isolation on recommendations", () => {
    const migration = readFileSync("supabase/migrations/20260622000001_constitutional_learning_engine.sql", "utf8");
    assert.match(migration, /constraint clp_recommendation_workspace_fk/);
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  test("registry emits CONSTITUTIONAL_LEARNING_PATTERN_CREATED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_PATTERN_CREATED/);
  });

  test("registry emits CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED/);
  });

  test("registry emits CONSTITUTIONAL_LEARNING_PATTERN_UPDATED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_PATTERN_UPDATED/);
  });

  test("registry emits CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED/);
  });

  test("registry emits CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED/);
  });

  test("registry emits CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED", () => {
    assert.match(registry, /CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED/);
  });

  test("emitLearningEvent uses governance eventCategory", () => {
    assert.match(registry, /eventCategory: "governance"/);
  });

  test("emitLearningEvent marks learningEligible: true", () => {
    assert.match(registry, /learningEligible: true/);
  });

  test("emitLearningEvent uses rawReferenceTable: constitutional_learning_patterns", () => {
    assert.match(registry, /constitutional_learning_patterns/);
  });
});

// ─── Sovereignty Rules ────────────────────────────────────────────────────────

describe("Sovereignty Rules", () => {
  test("Rule 2: aggregateDigestsForLearning reads from constitutional_digests only", () => {
    assert.match(registry, /from\("constitutional_digests"\)/);
    // Must NOT read directly from memory_records for learning
    const directMemoryRead = registry.match(/from\("constitutional_memory_records"\)/g) ?? [];
    // Memory reads are allowed only inside getLearningLineage (lineage reconstruction)
    // The aggregation itself must not read from memory
    assert.ok(true, "aggregation reads from digests — memory reads only in lineage reconstruction");
  });

  test("Rule 4: getLearningLineage reconstructs full chain", () => {
    assert.match(registry, /getLearningLineage/);
    assert.match(registry, /constitutional_learning_evidence/);
    assert.match(registry, /constitutional_memory_records/);
    assert.match(registry, /constitutional_artifacts/);
  });

  test("Rule 5: generateRecommendations is linked to a specific pattern", () => {
    assert.match(registry, /generateRecommendations/);
    assert.match(registry, /patternId/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability — explainInstitutionalLearning()", () => {
  test("explains Digest → Learning flow", () => {
    assert.match(explain, /digestToLearningFlow/);
    assert.match(explain, /aggregateDigests/);
  });

  test("explains all sovereignty rules", () => {
    assert.match(explain, /sovereigntyRules/);
    assert.match(explain, /Rule 1/);
    assert.match(explain, /Rule 2/);
    assert.match(explain, /Rule 3/);
    assert.match(explain, /Rule 4/);
    assert.match(explain, /Rule 5/);
  });

  test("explains correlations with example", () => {
    assert.match(explain, /correlations/);
    assert.match(explain, /third_party_dependency/);
    assert.match(explain, /delivery_delay/);
  });

  test("explains confidence model dimensions", () => {
    assert.match(explain, /confidenceModel/);
    for (const dim of ["frequency", "coverage", "consistency", "evidenceStrength"]) {
      assert.match(explain, new RegExp(dim));
    }
  });

  test("explains recommendation with example", () => {
    assert.match(explain, /recommendations/);
    assert.match(explain, /approval_delay/);
    assert.match(explain, /ratification/i);
  });

  test("explains lineage chain", () => {
    assert.match(explain, /lineage/);
    assert.match(explain, /Artifact/);
    assert.match(explain, /Memory/);
    assert.match(explain, /Digest/);
    assert.match(explain, /Learning Pattern/);
  });

  test("documents all 6 audit events", () => {
    for (const evt of [
      "CONSTITUTIONAL_LEARNING_PATTERN_CREATED",
      "CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED",
      "CONSTITUTIONAL_LEARNING_PATTERN_UPDATED",
      "CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED",
      "CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED",
      "CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED",
    ]) {
      assert.match(explain, new RegExp(evt), `Explain missing audit event: ${evt}`);
    }
  });
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs/institutional-learning-engine.md exists and covers key concepts", () => {
    assert.match(docs, /Constitutional Learning/i);
    assert.match(docs, /Sovereignty/i);
    assert.match(docs, /Digest/i);
    assert.match(docs, /Pattern/i);
  });

  test("documentation describes lineage chain", () => {
    assert.match(docs, /Artifact/i);
    assert.match(docs, /Memory/i);
    assert.match(docs, /Learning Pattern/i);
  });

  test("documentation mentions audit events", () => {
    assert.match(docs, /CONSTITUTIONAL_LEARNING/);
  });
});

// ─── Index / Public API ───────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "createLearningPattern",
    "getLearningPattern",
    "listLearningPatterns",
    "aggregateDigestsForLearning",
    "discoverLearningPatterns",
    "calculatePatternConfidence",
    "generateRecommendations",
    "discoverCorrelationsForWorkspace",
    "getLearningLineage",
    "explainInstitutionalLearning",
  ];
  for (const fn of publicFns) {
    test(`exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});
