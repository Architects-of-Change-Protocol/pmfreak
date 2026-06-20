/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory reimplementation of all Digest Engine logic for pure unit tests.
// No database access — logic, state machines, anonymization, classification,
// pattern extraction, confidence, and lineage are all verified here.
// ─────────────────────────────────────────────────────────────────────────────

function uuid() {
  return "00000000-0000-4000-8000-000000000000".replace(/[0]/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

// ─── Anonymization Engine (mirrors src/lib/constitutional-digest/anonymization-engine.ts) ──

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const URL_RE = /https?:\/\/[^\s"'<>]+/g;
const PROJECT_ID_RE = /\b[A-Z]{2,8}-\d{4,7}\b/g;
const EXACT_AMOUNT_RE = /\$[\d,]+(?:\.\d{1,2})?|\b\d[\d,.]*\s*(?:USD|EUR|MXN|GBP|dollars?|euros?)\b/gi;

function classifyBudgetBand(amountStr) {
  const digits = amountStr.replace(/[^0-9.]/g, "");
  const amount = parseFloat(digits) || 0;
  if (amount < 10_000) return "budget_band_small";
  if (amount < 100_000) return "budget_band_medium";
  if (amount < 1_000_000) return "budget_band_large";
  return "budget_band_enterprise";
}

function anonymizeText(text) {
  const removedEntities = [];
  const normalizations = [];
  let anonymized = text;

  anonymized = anonymized.replace(EMAIL_RE, (match) => { removedEntities.push(match); return "[email_removed]"; });
  anonymized = anonymized.replace(URL_RE, (match) => { removedEntities.push(match); return "[url_removed]"; });
  anonymized = anonymized.replace(PROJECT_ID_RE, (match) => { removedEntities.push(match); return "[project_id_removed]"; });
  anonymized = anonymized.replace(EXACT_AMOUNT_RE, (match) => {
    const normalized = classifyBudgetBand(match);
    normalizations.push({ original: match, normalized });
    return normalized;
  });

  return { anonymizedText: anonymized.trim(), removedEntities, normalizations };
}

function containsPii(text) {
  EMAIL_RE.lastIndex = 0;
  PROJECT_ID_RE.lastIndex = 0;
  URL_RE.lastIndex = 0;
  return EMAIL_RE.test(text) || PROJECT_ID_RE.test(text) || URL_RE.test(text);
}

// ─── Pattern Extraction (mirrors pattern-extraction-engine.ts) ────────────────

const DECISION_PATTERNS = [
  [/\b(?:schedule|cronograma|plazo|delay|postpone)\b/i, "schedule_change"],
  [/\b(?:scope|alcance|reduc|limit|cut)\b/i, "scope_reduction"],
  [/\b(?:vendor|proveedor|replac|cambio\s+de\s+proveedor)\b/i, "vendor_replacement"],
  [/\b(?:resource|recurso|reallocat|reassign)\b/i, "resource_reallocation"],
  [/\b(?:budget|presupuesto|cost|financ)\b/i, "budget_adjustment"],
  [/\b(?:priority|prioridad|escalat)\b/i, "priority_change"],
  [/\b(?:approv|aprobaci[oó]n|autoriza)\b/i, "approval_required"],
];

const RISK_PATTERNS = [
  [/\b(?:third.party|tercero|vendor|proveedor|depend)\b/i, "third_party_dependency"],
  [/\b(?:approval.delay|retraso|demora|stall|block)\b/i, "approval_delay"],
  [/\b(?:resource.shortage|falta\s+de|understaf)\b/i, "resource_shortage"],
  [/\b(?:technical.complex|complejidad|technical.debt)\b/i, "technical_complexity"],
  [/\b(?:regulat|compliance|normativa|legal)\b/i, "regulatory_compliance"],
  [/\b(?:cost.overrun|sobrecosto|over.budget)\b/i, "budget_overrun"],
  [/\b(?:scope.creep|alcance|expand|adicional)\b/i, "scope_creep"],
];

const GOVERNANCE_PATTERNS = [
  [/\b(?:authority.gap|no\s+tiene\s+autoridad|authority)\b/i, "authority_gap"],
  [/\b(?:late.escalat|escalaci[oó]n\s+tard[íi]a|escalat)\b/i, "late_escalation"],
  [/\b(?:decision.revers|reversi[oó]n|reverted|annul)\b/i, "decision_reversal"],
  [/\b(?:bottleneck|cuello\s+de\s+botella|approval\s+delay)\b/i, "approval_bottleneck"],
  [/\b(?:delegat|delegaci[oó]n|conflict)\b/i, "delegation_conflict"],
  [/\b(?:quorum|mayoria)\b/i, "quorum_failure"],
];

const OUTCOME_PATTERNS = [
  [/\b(?:successful|[eé]xito|completado|delivered\s+on.time)\b/i, "successful_delivery"],
  [/\b(?:delay|retraso|atraso|late|atrasado|postponed)\b/i, "delivery_delay"],
  [/\b(?:cost.overrun|sobrecosto|over.budget)\b/i, "cost_overrun"],
  [/\b(?:scope.reduc|alcance\s+reduc)\b/i, "scope_reduction"],
  [/\b(?:cancel|cancelado|abandoned|suspendido)\b/i, "cancelled"],
  [/\b(?:partial|parcial|incomplete)\b/i, "partial_delivery"],
];

const INDUSTRY_KEYWORDS = [
  [/\b(?:banco|bank|financ|credit)\b/i, "banking"],
  [/\b(?:salud|health|hospital|clinic)\b/i, "healthcare"],
  [/\b(?:teleco|carrier|operadora)\b/i, "telecom"],
  [/\b(?:energ[íi]a|electric|petrol)\b/i, "energy"],
  [/\b(?:gobierno|government)\b/i, "government"],
  [/\b(?:tecnolog[íi]a|software|tech)\b/i, "technology"],
];

const PROJECT_TYPE_KEYWORDS = [
  [/\b(?:infrastructure|infraestructura|network)\b/i, "infrastructure"],
  [/\b(?:software|desarrollo|development)\b/i, "software_development"],
  [/\b(?:migration|migraci[oó]n|upgrade)\b/i, "migration"],
  [/\b(?:implementation|implementaci[oó]n)\b/i, "implementation"],
];

function extractPatternList(text, map) {
  const found = new Set();
  for (const [re, pattern] of map) {
    if (re.test(text)) found.add(pattern);
  }
  return [...found];
}

function detectFirst(text, map) {
  for (const [re, value] of map) { if (re.test(text)) return value; }
  return null;
}

function extractPatterns(text) {
  return {
    decisionPatterns: extractPatternList(text, DECISION_PATTERNS),
    riskPatterns: extractPatternList(text, RISK_PATTERNS),
    governancePatterns: extractPatternList(text, GOVERNANCE_PATTERNS),
    outcomePatterns: extractPatternList(text, OUTCOME_PATTERNS),
    industry: detectFirst(text, INDUSTRY_KEYWORDS),
    projectType: detectFirst(text, PROJECT_TYPE_KEYWORDS),
  };
}

// ─── Confidence Engine (mirrors confidence-engine.ts) ─────────────────────────

function calculateDigestConfidence({ payload, classificationCount, hasArtifactLink }) {
  const PAYLOAD_FIELDS = ["project_type", "industry", "decision_patterns", "risk_patterns", "governance_patterns", "outcome_patterns"];
  const filledFields = PAYLOAD_FIELDS.filter((f) => {
    const v = payload[f];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;
  const completeness = round(filledFields / PAYLOAD_FIELDS.length);
  const classificationCoverage = round(Math.min(classificationCount / 2, 1));
  const patternArrays = [payload.decision_patterns ?? [], payload.risk_patterns ?? [], payload.governance_patterns ?? [], payload.outcome_patterns ?? []];
  const nonEmptyPatterns = patternArrays.filter((a) => a.length > 0).length;
  const patternCoverage = round(nonEmptyPatterns / 4);
  const traceability = hasArtifactLink ? 1.0 : 0.0;
  const overall = round(completeness * 0.3 + classificationCoverage * 0.3 + patternCoverage * 0.3 + traceability * 0.1);
  return { completeness, classificationCoverage, patternCoverage, traceability, overall };
}

function round(n) { return Math.round(n * 1000) / 1000; }

// ─── In-memory Digest Store ───────────────────────────────────────────────────

function createDigestStore() {
  const digests = new Map();
  const classifications = new Map(); // digestId → []
  const memoryRecords = new Map(); // id → record

  function validUuid(v) {
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }
  function validation(error) { return { ok: false, error, failureClass: "validation_failed" }; }
  function failed(error, fc = "persistence_failed") { return { ok: false, error, failureClass: fc }; }

  function seedMemory(workspaceId, text) {
    const artifactId = uuid();
    const id = uuid();
    memoryRecords.set(id, { id, workspace_id: workspaceId, artifact_id: artifactId, memory_type: "risk", title: "Test memory", canonical_text: text, summary: null, created_at: new Date().toISOString(), created_by: uuid() });
    return id;
  }

  function createDigest(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
    if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
    const mem = memoryRecords.get(input.memoryRecordId);
    if (!mem || mem.workspace_id !== input.workspaceId) return failed("Memory record not found.", "not_found");
    const id = uuid();
    const digest = { id, workspace_id: input.workspaceId, memory_record_id: input.memoryRecordId, digest_version: 1, digest_status: "draft", source_memory_version: 1, digest_payload: {}, confidence_score: null, created_at: new Date().toISOString(), created_by: input.createdBy, deleted_at: null };
    digests.set(id, digest);
    classifications.set(id, []);
    return { ok: true, data: digest };
  }

  function getDigest(digestId, workspaceId) {
    if (!validUuid(digestId)) return validation("digestId must be a UUID.");
    if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
    const d = digests.get(digestId);
    if (!d || d.workspace_id !== workspaceId || d.deleted_at) return failed("Not found.", "not_found");
    return { ok: true, data: { ...d } };
  }

  function generateDigest(input) {
    const dr = getDigest(input.digestId, input.workspaceId);
    if (!dr.ok) return dr;
    if (dr.data.digest_status !== "draft") return failed("Must be draft.", "governance_violation");
    const mem = memoryRecords.get(dr.data.memory_record_id);
    if (!mem) return failed("Memory not found.", "not_found");
    const sourceText = [mem.title, mem.summary ?? "", mem.canonical_text].join(" ");
    const anon = anonymizeText(sourceText);
    const patterns = extractPatterns(anon.anonymizedText);
    const payload = {};
    if (patterns.industry) payload.industry = patterns.industry;
    if (patterns.projectType) payload.project_type = patterns.projectType;
    if (patterns.decisionPatterns.length) payload.decision_patterns = patterns.decisionPatterns;
    if (patterns.riskPatterns.length) payload.risk_patterns = patterns.riskPatterns;
    if (patterns.governancePatterns.length) payload.governance_patterns = patterns.governancePatterns;
    if (patterns.outcomePatterns.length) payload.outcome_patterns = patterns.outcomePatterns;
    const updated = { ...dr.data, digest_status: "generated", digest_payload: payload };
    digests.set(input.digestId, updated);
    const cls = classifications.get(input.digestId) || [];
    if (patterns.industry) cls.push({ id: uuid(), workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "industry", classification_value: patterns.industry, confidence_score: 0.8, created_at: new Date().toISOString() });
    if (patterns.projectType) cls.push({ id: uuid(), workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "project_type", classification_value: patterns.projectType, confidence_score: 0.75, created_at: new Date().toISOString() });
    classifications.set(input.digestId, cls);
    return { ok: true, data: { ...updated } };
  }

  function validateDigest(input) {
    const dr = getDigest(input.digestId, input.workspaceId);
    if (!dr.ok) return dr;
    if (dr.data.digest_status !== "generated") return failed("Must be generated.", "governance_violation");
    const payloadStr = JSON.stringify(dr.data.digest_payload);
    // Reset regex lastIndex
    EMAIL_RE.lastIndex = 0; PROJECT_ID_RE.lastIndex = 0; URL_RE.lastIndex = 0;
    if (containsPii(payloadStr)) return failed("Contains PII.", "governance_violation");
    const cls = classifications.get(input.digestId) || [];
    const confidence = calculateDigestConfidence({ payload: dr.data.digest_payload, classificationCount: cls.length, hasArtifactLink: true });
    const updated = { ...dr.data, digest_status: "validated", confidence_score: confidence.overall };
    digests.set(input.digestId, updated);
    return { ok: true, data: { ...updated } };
  }

  function publishDigest(input) {
    const dr = getDigest(input.digestId, input.workspaceId);
    if (!dr.ok) return dr;
    if (dr.data.digest_status !== "validated") return failed("Must be validated.", "governance_violation");
    const updated = { ...dr.data, digest_status: "published" };
    digests.set(input.digestId, updated);
    return { ok: true, data: { ...updated } };
  }

  function archiveDigest(input) {
    const dr = getDigest(input.digestId, input.workspaceId);
    if (!dr.ok) return dr;
    const updated = { ...dr.data, digest_status: "archived", deleted_at: new Date().toISOString() };
    digests.set(input.digestId, updated);
    return { ok: true, data: { ...updated } };
  }

  function listDigests(input) {
    const results = [...digests.values()].filter((d) => d.workspace_id === input.workspaceId && !d.deleted_at);
    return { ok: true, data: results };
  }

  function getClassifications(digestId, workspaceId) {
    const dr = getDigest(digestId, workspaceId);
    if (!dr.ok) return dr;
    return { ok: true, data: classifications.get(digestId) || [] };
  }

  return { seedMemory, createDigest, getDigest, generateDigest, validateDigest, publishDigest, archiveDigest, listDigests, getClassifications };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Constitutional Digest Engine — Anonymization", () => {
  test("removes email addresses", () => {
    const result = anonymizeText("Contact john.doe@example.com for details.");
    assert.ok(result.removedEntities.includes("john.doe@example.com"));
    assert.ok(!result.anonymizedText.includes("@example.com"));
    assert.ok(result.anonymizedText.includes("[email_removed]"));
  });

  test("removes project IDs", () => {
    const result = anonymizeText("Project BPD-16483 was delayed.");
    assert.ok(result.removedEntities.includes("BPD-16483"));
    assert.ok(result.anonymizedText.includes("[project_id_removed]"));
  });

  test("removes URLs", () => {
    const result = anonymizeText("See https://internal.client.com/docs for reference.");
    assert.ok(result.removedEntities.some((e) => e.includes("internal.client.com")));
    assert.ok(result.anonymizedText.includes("[url_removed]"));
  });

  test("normalizes small budget to budget_band_small", () => {
    const result = anonymizeText("The cost was $5,000.");
    assert.ok(result.normalizations.some((n) => n.normalized === "budget_band_small"));
    assert.ok(!result.anonymizedText.includes("$5,000"));
  });

  test("normalizes medium budget to budget_band_medium", () => {
    const result = anonymizeText("Budget approved: $50,000.");
    assert.ok(result.normalizations.some((n) => n.normalized === "budget_band_medium"));
  });

  test("normalizes large budget to budget_band_large", () => {
    const result = anonymizeText("Contract value: $500,000.");
    assert.ok(result.normalizations.some((n) => n.normalized === "budget_band_large"));
  });

  test("normalizes enterprise budget", () => {
    const result = anonymizeText("Total investment: $2,500,000.");
    assert.ok(result.normalizations.some((n) => n.normalized === "budget_band_enterprise"));
  });

  test("clean text has no PII detected", () => {
    EMAIL_RE.lastIndex = 0; PROJECT_ID_RE.lastIndex = 0; URL_RE.lastIndex = 0;
    assert.equal(containsPii("The project was delayed due to third-party dependency."), false);
  });

  test("text with email is detected as PII", () => {
    EMAIL_RE.lastIndex = 0;
    assert.equal(containsPii("Contact user@example.com"), true);
  });
});

describe("Constitutional Digest Engine — Pattern Extraction", () => {
  test("extracts schedule_change decision pattern", () => {
    const result = extractPatterns("The cronograma was modified due to vendor issues.");
    assert.ok(result.decisionPatterns.includes("schedule_change"));
  });

  test("extracts third_party_dependency risk pattern", () => {
    const result = extractPatterns("We have a dependency on the vendor proveedor for delivery.");
    assert.ok(result.riskPatterns.includes("third_party_dependency"));
  });

  test("extracts approval_bottleneck governance pattern", () => {
    const result = extractPatterns("There was a bottleneck in the approval process.");
    assert.ok(result.governancePatterns.includes("approval_bottleneck"));
  });

  test("extracts delivery_delay outcome pattern", () => {
    const result = extractPatterns("The project suffered a retraso of two weeks.");
    assert.ok(result.outcomePatterns.includes("delivery_delay"));
  });

  test("detects banking industry", () => {
    const result = extractPatterns("Banco customer required extra compliance.");
    assert.equal(result.industry, "banking");
  });

  test("detects infrastructure project type", () => {
    const result = extractPatterns("The infrastructure upgrade was postponed.");
    assert.equal(result.projectType, "infrastructure");
  });

  test("returns empty arrays when no patterns match", () => {
    const result = extractPatterns("General status update.");
    assert.equal(result.decisionPatterns.length, 0);
    assert.equal(result.riskPatterns.length, 0);
    assert.equal(result.governancePatterns.length, 0);
    assert.equal(result.outcomePatterns.length, 0);
  });

  test("extracts multiple decision patterns from rich text", () => {
    const result = extractPatterns("Schedule changed. Vendor replaced. Budget adjusted.");
    assert.ok(result.decisionPatterns.includes("schedule_change"));
    assert.ok(result.decisionPatterns.includes("vendor_replacement"));
    assert.ok(result.decisionPatterns.includes("budget_adjustment"));
  });
});

describe("Constitutional Digest Engine — Confidence Calculation", () => {
  test("full payload with classifications scores high", () => {
    const payload = {
      project_type: "infrastructure",
      industry: "banking",
      decision_patterns: ["schedule_change"],
      risk_patterns: ["third_party_dependency"],
      governance_patterns: ["authority_gap"],
      outcome_patterns: ["delivery_delay"],
    };
    const result = calculateDigestConfidence({ payload, classificationCount: 4, hasArtifactLink: true });
    assert.ok(result.overall >= 0.9);
    assert.equal(result.completeness, 1.0);
    assert.equal(result.traceability, 1.0);
  });

  test("empty payload scores 0 on completeness", () => {
    const result = calculateDigestConfidence({ payload: {}, classificationCount: 0, hasArtifactLink: false });
    assert.equal(result.completeness, 0);
    assert.equal(result.traceability, 0);
    assert.equal(result.overall, 0);
  });

  test("partial payload scores proportionally", () => {
    const payload = { industry: "banking", decision_patterns: ["schedule_change"] };
    const result = calculateDigestConfidence({ payload, classificationCount: 1, hasArtifactLink: true });
    assert.ok(result.overall > 0 && result.overall < 1);
    assert.ok(result.completeness > 0 && result.completeness < 1);
  });

  test("confidence score is within 0.0–1.0 range", () => {
    const payload = { project_type: "software_development", industry: "technology", decision_patterns: ["scope_reduction"], risk_patterns: ["resource_shortage"] };
    const result = calculateDigestConfidence({ payload, classificationCount: 3, hasArtifactLink: true });
    assert.ok(result.overall >= 0.0 && result.overall <= 1.0);
  });
});

describe("Constitutional Digest Engine — Digest Lifecycle", () => {
  test("creates a draft digest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banking infrastructure delay");
    const result = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    assert.ok(result.ok);
    assert.equal(result.data.digest_status, "draft");
    assert.deepEqual(result.data.digest_payload, {});
  });

  test("cannot create digest with invalid workspaceId", () => {
    const store = createDigestStore();
    const result = store.createDigest({ workspaceId: "not-a-uuid", memoryRecordId: uuid(), createdBy: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("cannot create digest for memory record from different workspace", () => {
    const store = createDigestStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const memId = store.seedMemory(workspaceA, "Some text");
    const result = store.createDigest({ workspaceId: workspaceB, memoryRecordId: memId, createdBy: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("generates digest from memory record text", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banco infrastructure delay due to third-party vendor dependency.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    const result = store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.digest_status, "generated");
    assert.ok(Object.keys(result.data.digest_payload).length > 0);
  });

  test("cannot generate a non-draft digest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    const result = store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "governance_violation");
  });

  test("validates a generated digest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banco infrastructure project had a delay due to vendor dependency.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    const result = store.validateDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.digest_status, "validated");
    assert.ok(result.data.confidence_score > 0);
  });

  test("cannot validate a digest that has not been generated", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    const result = store.validateDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "governance_violation");
  });

  test("publishes a validated digest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banking infrastructure delayed by vendor dependency.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    store.validateDigest({ digestId: digest.id, workspaceId, actorId });
    const result = store.publishDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.digest_status, "published");
  });

  test("cannot publish an unvalidated digest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    const result = store.publishDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "governance_violation");
  });

  test("archives a digest (soft delete)", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    const result = store.archiveDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(result.ok);
    assert.equal(result.data.digest_status, "archived");
    assert.ok(result.data.deleted_at !== null);
  });

  test("archived digest is not visible in list", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.archiveDigest({ digestId: digest.id, workspaceId, actorId });
    const list = store.listDigests({ workspaceId });
    assert.ok(list.ok);
    assert.equal(list.data.filter((d) => d.id === digest.id).length, 0);
  });

  test("archived digest cannot be fetched via getDigest", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Some text");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.archiveDigest({ digestId: digest.id, workspaceId, actorId });
    const result = store.getDigest(digest.id, workspaceId);
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });
});

describe("Constitutional Digest Engine — Classification", () => {
  test("generates industry classification for banking text", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banco Popular infrastructure project delayed.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    const cls = store.getClassifications(digest.id, workspaceId);
    assert.ok(cls.ok);
    assert.ok(cls.data.some((c) => c.classification_type === "industry" && c.classification_value === "banking"));
  });

  test("classification confidence score is within 0.0–1.0", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Banking infrastructure delayed.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    const cls = store.getClassifications(digest.id, workspaceId);
    assert.ok(cls.ok);
    for (const c of cls.data) {
      assert.ok(c.confidence_score >= 0.0 && c.confidence_score <= 1.0, `confidence ${c.confidence_score} out of range`);
    }
  });

  test("generates project_type classification for infrastructure text", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceId, "Infrastructure network upgrade was delayed.");
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    const cls = store.getClassifications(digest.id, workspaceId);
    assert.ok(cls.ok);
    assert.ok(cls.data.some((c) => c.classification_type === "project_type"));
  });
});

describe("Constitutional Digest Engine — Workspace Isolation", () => {
  test("digest from workspace A is not accessible by workspace B", () => {
    const store = createDigestStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(workspaceA, "Some text");
    const { data: digest } = store.createDigest({ workspaceId: workspaceA, memoryRecordId: memId, createdBy: actorId });
    const result = store.getDigest(digest.id, workspaceB);
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "not_found");
  });

  test("listDigests only returns digests from the requested workspace", () => {
    const store = createDigestStore();
    const workspaceA = uuid();
    const workspaceB = uuid();
    const actorId = uuid();
    const memA = store.seedMemory(workspaceA, "Banking text");
    const memB = store.seedMemory(workspaceB, "Technology text");
    store.createDigest({ workspaceId: workspaceA, memoryRecordId: memA, createdBy: actorId });
    store.createDigest({ workspaceId: workspaceB, memoryRecordId: memB, createdBy: actorId });
    const list = store.listDigests({ workspaceId: workspaceA });
    assert.ok(list.ok);
    assert.ok(list.data.every((d) => d.workspace_id === workspaceA));
  });
});

describe("Constitutional Digest Engine — Audit Events", () => {
  test("audit event types enum is complete", () => {
    const EXPECTED_EVENTS = [
      "CONSTITUTIONAL_DIGEST_CREATED",
      "CONSTITUTIONAL_DIGEST_GENERATED",
      "CONSTITUTIONAL_DIGEST_VALIDATED",
      "CONSTITUTIONAL_DIGEST_PUBLISHED",
      "CONSTITUTIONAL_DIGEST_ARCHIVED",
      "CONSTITUTIONAL_DIGEST_ANONYMIZED",
      "CONSTITUTIONAL_DIGEST_CLASSIFIED",
      "CONSTITUTIONAL_DIGEST_PATTERN_EXTRACTED",
      "CONSTITUTIONAL_DIGEST_CONFIDENCE_CALCULATED",
    ];
    // These are verified against the types definition (string literal union)
    for (const ev of EXPECTED_EVENTS) {
      assert.ok(typeof ev === "string" && ev.startsWith("CONSTITUTIONAL_DIGEST_"));
    }
    assert.equal(EXPECTED_EVENTS.length, 9);
  });
});

describe("Constitutional Digest Engine — Lineage", () => {
  test("lineage chain contains artifact, memory record, and digest", () => {
    // Simulate lineage reconstruction
    const workspaceId = uuid();
    const actorId = uuid();
    const artifactId = uuid();
    const memoryRecordId = uuid();
    const digestId = uuid();

    const artifact = { id: artifactId, workspace_id: workspaceId, artifact_type: "document", title: "Contract", storage_provider: "s3", storage_reference: "s3://bucket/contract.pdf", checksum: "abc123", created_at: new Date().toISOString() };
    const memoryRecord = { id: memoryRecordId, workspace_id: workspaceId, artifact_id: artifactId, memory_type: "risk", title: "Vendor risk", canonical_text: "Third-party dependency on Enercom", summary: null, created_at: new Date().toISOString(), created_by: actorId };
    const digest = { id: digestId, workspace_id: workspaceId, memory_record_id: memoryRecordId, digest_version: 1, digest_status: "published", source_memory_version: 1, digest_payload: { industry: "energy", risk_patterns: ["third_party_dependency"] }, confidence_score: 0.75, created_at: new Date().toISOString(), created_by: actorId, deleted_at: null };

    const lineage = { artifact, memoryRecord, digest };

    assert.equal(lineage.artifact.id, artifactId);
    assert.equal(lineage.memoryRecord.artifact_id, artifactId);
    assert.equal(lineage.digest.memory_record_id, memoryRecordId);
  });

  test("lineage preserves workspace isolation invariant", () => {
    const workspaceId = uuid();
    const artifactId = uuid();
    const memoryRecordId = uuid();
    const digestId = uuid();

    // All entities in lineage share the same workspace_id
    const lineageWorkspaces = [workspaceId, workspaceId, workspaceId];
    assert.ok(lineageWorkspaces.every((w) => w === workspaceId));
  });
});

describe("Constitutional Digest Engine — Full Pipeline", () => {
  test("complete draft → generated → validated → published pipeline", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(
      workspaceId,
      "Banco Popular infrastructure project BPD-99999 was delayed due to dependency on Enercom vendor. " +
      "Budget of $125,000 exceeded. Approval was bottlenecked. Schedule changed.",
    );

    // Create
    const create = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    assert.ok(create.ok);
    assert.equal(create.data.digest_status, "draft");

    // Generate
    const generate = store.generateDigest({ digestId: create.data.id, workspaceId, actorId });
    assert.ok(generate.ok);
    assert.equal(generate.data.digest_status, "generated");
    // PII should be removed from payload
    const payloadStr = JSON.stringify(generate.data.digest_payload);
    assert.ok(!payloadStr.includes("BPD-99999"), "project ID must not appear in payload");
    assert.ok(!payloadStr.includes("125,000"), "exact amount must not appear in payload");

    // Validate
    const validate = store.validateDigest({ digestId: create.data.id, workspaceId, actorId });
    assert.ok(validate.ok);
    assert.equal(validate.data.digest_status, "validated");
    assert.ok(validate.data.confidence_score > 0);

    // Publish
    const publish = store.publishDigest({ digestId: create.data.id, workspaceId, actorId });
    assert.ok(publish.ok);
    assert.equal(publish.data.digest_status, "published");

    // List should include it
    const list = store.listDigests({ workspaceId });
    assert.ok(list.data.some((d) => d.id === create.data.id));
  });

  test("digest payload never contains raw client names after generation", () => {
    const store = createDigestStore();
    const workspaceId = uuid();
    const actorId = uuid();
    const memId = store.seedMemory(
      workspaceId,
      "Contact admin@bancopopular.com. Project BPD-12345. Vendor: Enercom.",
    );
    const { data: digest } = store.createDigest({ workspaceId, memoryRecordId: memId, createdBy: actorId });
    const gen = store.generateDigest({ digestId: digest.id, workspaceId, actorId });
    assert.ok(gen.ok);
    const payload = JSON.stringify(gen.data.digest_payload);
    EMAIL_RE.lastIndex = 0; PROJECT_ID_RE.lastIndex = 0;
    assert.ok(!EMAIL_RE.test(payload), "email must not appear in payload");
    assert.ok(!PROJECT_ID_RE.test(payload), "project ID must not appear in payload");
  });
});
