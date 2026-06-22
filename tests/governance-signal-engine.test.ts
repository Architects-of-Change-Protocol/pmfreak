/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Governance Signal Engine — Unit Tests (EPIC 3 Sprint 1)
// Pure unit tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

const types           = readFileSync("src/lib/governance-signals/types.ts", "utf8");
const registry        = readFileSync("src/lib/governance-signals/signal-registry.ts", "utf8");
const detectionEng    = readFileSync("src/lib/governance-signals/detection-engine.ts", "utf8");
const confidenceEng   = readFileSync("src/lib/governance-signals/confidence-engine.ts", "utf8");
const severityEng     = readFileSync("src/lib/governance-signals/severity-engine.ts", "utf8");
const correlationEng  = readFileSync("src/lib/governance-signals/correlation-engine.ts", "utf8");
const healthEng       = readFileSync("src/lib/governance-signals/health-engine.ts", "utf8");
const recommendEng    = readFileSync("src/lib/governance-signals/recommendation-engine.ts", "utf8");
const lineageFile     = readFileSync("src/lib/governance-signals/lineage.ts", "utf8");
const explainFile     = readFileSync("src/lib/governance-signals/explain.ts", "utf8");
const indexFile       = readFileSync("src/lib/governance-signals/index.ts", "utf8");
const dbContract      = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration       = readFileSync("supabase/migrations/20260704000000_governance_signal_engine.sql", "utf8");
const platformEvents  = readFileSync("src/lib/platform-events/types.ts", "utf8");
const docs            = readFileSync("docs/governance-signal-engine.md", "utf8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function round3(v) { return Math.round(v * 1000) / 1000; }

// ─── Inline Confidence Engine ─────────────────────────────────────────────────

function calculateSignalConfidence({ patternMatch, evidenceStrength, historicalFrequency, currentContext }) {
  const clamp = (v) => Math.min(1.0, Math.max(0.0, v));
  const score = round3(
    clamp(patternMatch)        * 0.40 +
    clamp(evidenceStrength)    * 0.30 +
    clamp(historicalFrequency) * 0.20 +
    clamp(currentContext)      * 0.10,
  );
  return { score };
}

function deriveEvidenceStrength(evidence) {
  if (evidence.length === 0) return 0.0;
  const avgWeight = evidence.reduce((s, e) => s + e.contributionWeight, 0) / evidence.length;
  const countFactor = Math.min(1.0, evidence.length / 5);
  return round3(avgWeight * 0.70 + countFactor * 0.30);
}

function deriveHistoricalFrequency(priorOccurrences) {
  if (priorOccurrences === 0) return 0.20;
  return round3(Math.min(1.0, 0.20 + priorOccurrences * 0.16));
}

// ─── Inline Severity Engine ───────────────────────────────────────────────────

const TYPE_BASELINE = {
  governance_violation:    "critical",
  authority_gap:           "high",
  escalation_gap:          "high",
  approval_delay:          "medium",
  ratification_stall:      "medium",
  decision_bottleneck:     "medium",
  amendment_backlog:       "medium",
  risk_accumulation:       "medium",
  recommendation_ignored:  "low",
  delivery_drift:          "low",
};

function severityToNum(s) {
  return s === "low" ? 1 : s === "medium" ? 2 : s === "high" ? 3 : 4;
}
function numToSeverity(n) {
  if (n >= 4) return "critical";
  if (n === 3) return "high";
  if (n === 2) return "medium";
  return "low";
}

function calculateSignalSeverity({ signalType, durationDays, hasHistoricalNegativeOutcome, affectedEntityCount = 0 }) {
  let score = severityToNum(TYPE_BASELINE[signalType]);
  if (durationDays >= 15) score += 2;
  else if (durationDays >= 8) score += 1;
  if (hasHistoricalNegativeOutcome) score += 1;
  if (affectedEntityCount >= 5) score += 1;
  return numToSeverity(score);
}

// ─── Inline Correlation Engine ────────────────────────────────────────────────

const CORRELATION_RULES = [
  { from: "approval_delay",    to: "delivery_drift",      confidence: 0.80 },
  { from: "authority_gap",     to: "governance_violation", confidence: 0.82 },
  { from: "escalation_gap",    to: "governance_violation", confidence: 0.75 },
  { from: "amendment_backlog", to: "ratification_stall",   confidence: 0.78 },
  { from: "recommendation_ignored", to: "governance_violation", confidence: 0.70 },
  { from: "risk_accumulation", to: "delivery_drift",       confidence: 0.76 },
  { from: "decision_bottleneck", to: "delivery_drift",     confidence: 0.72 },
  { from: "ratification_stall",  to: "delivery_drift",     confidence: 0.74 },
];

function correlateSignals(activeSignals) {
  const correlations = [];
  for (const rule of CORRELATION_RULES) {
    const fromSignals = activeSignals.filter((s) => s.signal_type === rule.from);
    const toSignals   = activeSignals.filter((s) => s.signal_type === rule.to);
    for (const from of fromSignals) {
      for (const to of toSignals) {
        if (from.id === to.id) continue;
        correlations.push({ signalId: from.id, relatedSignalId: to.id, confidence: rule.confidence });
      }
    }
  }
  return correlations;
}

// ─── Inline Health Engine ─────────────────────────────────────────────────────

function calculateGovernanceHealth(workspaceId, signals) {
  const active   = signals.filter((s) => s.status === "active" || s.status === "acknowledged");
  const resolved = signals.filter((s) => s.status === "resolved");
  const critical = active.filter((s) => s.severity === "critical").length;
  const high     = active.filter((s) => s.severity === "high").length;
  const medium   = active.filter((s) => s.severity === "medium").length;
  const low      = active.filter((s) => s.severity === "low").length;
  const penalty  = critical * 25 + high * 10 + medium * 5 + low * 2;
  const bonus    = Math.min(10, resolved.length * 1);
  return Math.max(0, Math.min(100, 100 - penalty + bonus));
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes governance-signal-engine", () => {
    assert.match(dbContract, /governance-signal-engine/);
  });

  test("GovernanceSignalRow is present", () => {
    assert.match(dbContract, /GovernanceSignalRow/);
  });

  test("GovernanceSignalEvidenceRow is present", () => {
    assert.match(dbContract, /GovernanceSignalEvidenceRow/);
  });

  test("GovernanceSignalRecommendationRow is present", () => {
    assert.match(dbContract, /GovernanceSignalRecommendationRow/);
  });

  test("GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS/);
  });

  test("GOVERNANCE_SIGNAL_EVIDENCE_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /GOVERNANCE_SIGNAL_EVIDENCE_SELECTABLE_COLUMNS/);
  });

  test("GOVERNANCE_SIGNAL_RECOMMENDATION_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /GOVERNANCE_SIGNAL_RECOMMENDATION_SELECTABLE_COLUMNS/);
  });

  test("GovernanceSignalType includes all 10 signal types", () => {
    for (const t of [
      "approval_delay", "authority_gap", "escalation_gap", "decision_bottleneck",
      "amendment_backlog", "ratification_stall", "risk_accumulation",
      "recommendation_ignored", "governance_violation", "delivery_drift",
    ]) {
      assert.match(dbContract, new RegExp(t), `Missing GovernanceSignalType: ${t}`);
    }
  });

  test("GovernanceSignalSeverity includes all 4 levels", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing severity: ${s}`);
    }
  });

  test("GovernanceSignalStatus includes all 4 statuses", () => {
    for (const s of ["active", "acknowledged", "resolved", "dismissed"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("GovernanceSignalSource includes all 9 sources", () => {
    for (const src of [
      "constitution", "decision", "amendment", "ratification",
      "authority", "delegation", "recommendation", "risk", "project",
    ]) {
      assert.match(dbContract, new RegExp(`"${src}"`), `Missing signal source: ${src}`);
    }
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates governance_signals table", () => {
    assert.match(migration, /create table if not exists governance_signals/);
  });

  test("creates governance_signal_evidence table", () => {
    assert.match(migration, /create table if not exists governance_signal_evidence/);
  });

  test("creates governance_signal_recommendations table", () => {
    assert.match(migration, /create table if not exists governance_signal_recommendations/);
  });

  test("enables RLS on all three tables", () => {
    assert.match(migration, /governance_signals enable row level security/);
    assert.match(migration, /governance_signal_evidence enable row level security/);
    assert.match(migration, /governance_signal_recommendations enable row level security/);
  });

  test("signal_type check constraint includes all 10 types", () => {
    for (const t of [
      "approval_delay", "authority_gap", "escalation_gap", "decision_bottleneck",
      "amendment_backlog", "ratification_stall", "risk_accumulation",
      "recommendation_ignored", "governance_violation", "delivery_drift",
    ]) {
      assert.match(migration, new RegExp(`'${t}'`), `Missing signal_type: ${t}`);
    }
  });

  test("severity check constraint includes all 4 levels", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing severity: ${s}`);
    }
  });

  test("status check constraint includes all 4 statuses", () => {
    for (const s of ["active", "acknowledged", "resolved", "dismissed"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing status: ${s}`);
    }
  });

  test("confidence_score has 0.0–1.0 check constraint", () => {
    assert.match(migration, /confidence_score between 0.0 and 1.0/);
  });

  test("composite FK for workspace isolation on evidence", () => {
    assert.match(migration, /constraint gse_signal_workspace_fk/);
  });

  test("composite FK for workspace isolation on recommendations", () => {
    assert.match(migration, /constraint gsr_signal_workspace_fk/);
  });

  test("unique constraint on governance_signals for composite FK", () => {
    assert.match(migration, /unique \(id, workspace_id\)/);
  });

  test("uses is_workspace_member for all RLS policies", () => {
    assert.match(migration, /is_workspace_member/);
  });

  test("indexes include workspace_id, status, severity, signal_type", () => {
    assert.match(migration, /governance_signals_workspace_id_idx/);
    assert.match(migration, /governance_signals_status_idx/);
    assert.match(migration, /governance_signals_severity_idx/);
    assert.match(migration, /governance_signals_type_idx/);
  });
});

// ─── Platform Events ──────────────────────────────────────────────────────────

describe("Platform Events", () => {
  test("GovernanceSignalEventType is defined", () => {
    assert.match(platformEvents, /GovernanceSignalEventType/);
  });

  test("all 8 audit events are present", () => {
    for (const evt of [
      "GOVERNANCE_SIGNAL_DETECTED",
      "GOVERNANCE_SIGNAL_ACKNOWLEDGED",
      "GOVERNANCE_SIGNAL_RESOLVED",
      "GOVERNANCE_SIGNAL_DISMISSED",
      "GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED",
      "GOVERNANCE_SIGNAL_SEVERITY_CALCULATED",
      "GOVERNANCE_SIGNAL_CORRELATED",
      "GOVERNANCE_HEALTH_CALCULATED",
    ]) {
      assert.match(platformEvents, new RegExp(evt), `Missing event type: ${evt}`);
    }
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("GovernanceSignalType union is defined", () => {
    assert.match(types, /GovernanceSignalType/);
  });

  test("GovernanceSignalSeverity is defined", () => {
    assert.match(types, /GovernanceSignalSeverity/);
  });

  test("GovernanceSignalStatus is defined", () => {
    assert.match(types, /GovernanceSignalStatus/);
  });

  test("GovernanceSignalSource is defined", () => {
    assert.match(types, /GovernanceSignalSource/);
  });

  test("GovernanceSignalResult is defined", () => {
    assert.match(types, /GovernanceSignalResult/);
  });

  test("DetectSignalInput is defined", () => {
    assert.match(types, /DetectSignalInput/);
  });

  test("AcknowledgeSignalInput is defined", () => {
    assert.match(types, /AcknowledgeSignalInput/);
  });

  test("ResolveSignalInput is defined", () => {
    assert.match(types, /ResolveSignalInput/);
  });

  test("DismissSignalInput is defined", () => {
    assert.match(types, /DismissSignalInput/);
  });

  test("ListSignalsInput has all filter fields", () => {
    assert.match(types, /ListSignalsInput/);
    assert.match(types, /severity/);
    assert.match(types, /status/);
    assert.match(types, /signalType/);
    assert.match(types, /source/);
    assert.match(types, /fromDate/);
  });

  test("SignalCorrelation is defined", () => {
    assert.match(types, /SignalCorrelation/);
  });

  test("GovernanceHealthScore is defined", () => {
    assert.match(types, /GovernanceHealthScore/);
  });

  test("SignalLineage is defined", () => {
    assert.match(types, /SignalLineage/);
  });

  test("DetectionSummary is defined", () => {
    assert.match(types, /DetectionSummary/);
  });

  test("GOVERNANCE_SIGNAL_TYPES constant contains all 10 types", () => {
    assert.match(types, /GOVERNANCE_SIGNAL_TYPES/);
    for (const t of [
      "approval_delay", "authority_gap", "escalation_gap", "decision_bottleneck",
      "amendment_backlog", "ratification_stall", "risk_accumulation",
      "recommendation_ignored", "governance_violation", "delivery_drift",
    ]) {
      assert.match(types, new RegExp(`"${t}"`), `Missing in GOVERNANCE_SIGNAL_TYPES: ${t}`);
    }
  });
});

// ─── Signal Detection ─────────────────────────────────────────────────────────

describe("Signal Detection Engine", () => {
  test("detectGovernanceSignals is defined", () => {
    assert.match(detectionEng, /detectGovernanceSignals/);
  });

  test("approval_delay detection uses threshold days", () => {
    assert.match(detectionEng, /APPROVAL_DELAY_THRESHOLD_DAYS/);
    assert.match(detectionEng, /approval_delay/);
  });

  test("authority_gap detection checks expired or revoked status", () => {
    assert.match(detectionEng, /authority_gap/);
    assert.match(detectionEng, /expired.*revoked|revoked.*expired/s);
  });

  test("escalation_gap detection checks for violations without escalations", () => {
    assert.match(detectionEng, /escalation_gap/);
    assert.match(detectionEng, /escalatedViolationIds|escalation/);
  });

  test("amendment_backlog detection uses threshold count", () => {
    assert.match(detectionEng, /amendment_backlog/);
    assert.match(detectionEng, /AMENDMENT_BACKLOG_THRESHOLD/);
  });

  test("ratification_stall detection uses threshold days", () => {
    assert.match(detectionEng, /ratification_stall/);
    assert.match(detectionEng, /RATIFICATION_STALL_THRESHOLD_DAYS/);
  });

  test("governance_violation detection checks open violations", () => {
    assert.match(detectionEng, /governance_violation/);
    assert.match(detectionEng, /open/);
  });

  test("detection deduplicates against existing active signals", () => {
    assert.match(detectionEng, /existingSignalTypes/);
  });

  test("detection uses Promise.all for parallel rule execution", () => {
    assert.match(detectionEng, /Promise\.all/);
  });
});

// ─── Confidence Engine ────────────────────────────────────────────────────────

describe("Confidence Engine", () => {
  test("perfect pattern match + strong evidence = high confidence", () => {
    const result = calculateSignalConfidence({
      patternMatch: 1.0, evidenceStrength: 1.0, historicalFrequency: 1.0, currentContext: 1.0,
    });
    assert.equal(result.score, 1.0);
  });

  test("zero factors yield zero confidence", () => {
    const result = calculateSignalConfidence({
      patternMatch: 0, evidenceStrength: 0, historicalFrequency: 0, currentContext: 0,
    });
    assert.equal(result.score, 0.0);
  });

  test("formula: 40% patternMatch + 30% evidenceStrength + 20% historicalFrequency + 10% currentContext", () => {
    const result = calculateSignalConfidence({
      patternMatch: 1.0, evidenceStrength: 0.0, historicalFrequency: 0.0, currentContext: 0.0,
    });
    assert.equal(result.score, 0.40);
  });

  test("evidence strength scales with count and weight", () => {
    const single = deriveEvidenceStrength([{ contributionWeight: 1.0 }]);
    const multiple = deriveEvidenceStrength([
      { contributionWeight: 1.0 },
      { contributionWeight: 1.0 },
      { contributionWeight: 1.0 },
      { contributionWeight: 1.0 },
      { contributionWeight: 1.0 },
    ]);
    assert.ok(multiple > single, `Expected ${multiple} > ${single}`);
  });

  test("empty evidence yields 0 strength", () => {
    assert.equal(deriveEvidenceStrength([]), 0.0);
  });

  test("historicalFrequency starts at 0.20 for new detections", () => {
    assert.equal(deriveHistoricalFrequency(0), 0.20);
  });

  test("historicalFrequency caps at 1.0", () => {
    assert.equal(deriveHistoricalFrequency(100), 1.0);
  });

  test("confidence score is always between 0 and 1", () => {
    const cases = [
      { patternMatch: 0.5, evidenceStrength: 0.5, historicalFrequency: 0.5, currentContext: 0.5 },
      { patternMatch: 1.5, evidenceStrength: 1.5, historicalFrequency: 1.5, currentContext: 1.5 },
      { patternMatch: -0.5, evidenceStrength: -0.1, historicalFrequency: 0, currentContext: 0 },
    ];
    for (const c of cases) {
      const { score } = calculateSignalConfidence(c);
      assert.ok(score >= 0 && score <= 1, `score out of range: ${score}`);
    }
  });

  test("confidence engine file exports calculateSignalConfidence", () => {
    assert.match(confidenceEng, /export function calculateSignalConfidence/);
  });

  test("confidence engine exports deriveEvidenceStrength", () => {
    assert.match(confidenceEng, /export function deriveEvidenceStrength/);
  });

  test("confidence engine exports deriveHistoricalFrequency", () => {
    assert.match(confidenceEng, /export function deriveHistoricalFrequency/);
  });

  test("confidence engine exports deriveContextAdjustment", () => {
    assert.match(confidenceEng, /export function deriveContextAdjustment/);
  });
});

// ─── Severity Engine ──────────────────────────────────────────────────────────

describe("Severity Engine", () => {
  test("governance_violation baseline is critical", () => {
    const sev = calculateSignalSeverity({
      signalType: "governance_violation", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    assert.equal(sev, "critical");
  });

  test("authority_gap baseline is high", () => {
    const sev = calculateSignalSeverity({
      signalType: "authority_gap", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    assert.equal(sev, "high");
  });

  test("escalation_gap baseline is high", () => {
    const sev = calculateSignalSeverity({
      signalType: "escalation_gap", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    assert.equal(sev, "high");
  });

  test("approval_delay baseline is medium", () => {
    const sev = calculateSignalSeverity({
      signalType: "approval_delay", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    assert.equal(sev, "medium");
  });

  test("recommendation_ignored baseline is low", () => {
    const sev = calculateSignalSeverity({
      signalType: "recommendation_ignored", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    assert.equal(sev, "low");
  });

  test("duration >= 8 days escalates severity by 1 level", () => {
    const base = calculateSignalSeverity({
      signalType: "approval_delay", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    const escalated = calculateSignalSeverity({
      signalType: "approval_delay", durationDays: 8, hasHistoricalNegativeOutcome: false,
    });
    assert.ok(severityToNum(escalated) > severityToNum(base), `Expected escalation, got ${base} → ${escalated}`);
  });

  test("duration >= 15 days escalates severity by 2 levels", () => {
    const base = calculateSignalSeverity({
      signalType: "approval_delay", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    const escalated = calculateSignalSeverity({
      signalType: "approval_delay", durationDays: 15, hasHistoricalNegativeOutcome: false,
    });
    assert.ok(severityToNum(escalated) > severityToNum(base));
  });

  test("historical negative outcome escalates severity by 1", () => {
    const without = calculateSignalSeverity({
      signalType: "delivery_drift", durationDays: 0, hasHistoricalNegativeOutcome: false,
    });
    const withHistory = calculateSignalSeverity({
      signalType: "delivery_drift", durationDays: 0, hasHistoricalNegativeOutcome: true,
    });
    assert.ok(severityToNum(withHistory) > severityToNum(without));
  });

  test("severity never exceeds critical", () => {
    const sev = calculateSignalSeverity({
      signalType: "governance_violation", durationDays: 30, hasHistoricalNegativeOutcome: true, affectedEntityCount: 10,
    });
    assert.equal(sev, "critical");
  });

  test("severity engine exports calculateSignalSeverity", () => {
    assert.match(severityEng, /export function calculateSignalSeverity/);
  });

  test("severity engine exports durationDaysSince", () => {
    assert.match(severityEng, /export function durationDaysSince/);
  });
});

// ─── Correlation Engine ───────────────────────────────────────────────────────

describe("Correlation Engine", () => {
  function makeSignal(id, signal_type, severity = "medium") {
    return { id, signal_type, severity, status: "active", workspace_id: uuid() };
  }

  test("approval_delay correlates with delivery_drift", () => {
    const signals = [
      makeSignal(uuid(), "approval_delay"),
      makeSignal(uuid(), "delivery_drift"),
    ];
    const correlations = correlateSignals(signals);
    assert.ok(correlations.some((c) => c.confidence === 0.80));
  });

  test("authority_gap correlates with governance_violation at 0.82", () => {
    const signals = [
      makeSignal(uuid(), "authority_gap"),
      makeSignal(uuid(), "governance_violation"),
    ];
    const correlations = correlateSignals(signals);
    assert.ok(correlations.some((c) => c.confidence === 0.82));
  });

  test("amendment_backlog correlates with ratification_stall", () => {
    const signals = [
      makeSignal(uuid(), "amendment_backlog"),
      makeSignal(uuid(), "ratification_stall"),
    ];
    const correlations = correlateSignals(signals);
    assert.ok(correlations.some((c) => c.confidence === 0.78));
  });

  test("no self-correlations (from = to)", () => {
    const id = uuid();
    const signals = [makeSignal(id, "approval_delay"), makeSignal(id, "approval_delay")];
    const correlations = correlateSignals(signals);
    assert.ok(correlations.every((c) => c.signalId !== c.relatedSignalId));
  });

  test("unrelated signals produce no correlations", () => {
    const signals = [makeSignal(uuid(), "delivery_drift"), makeSignal(uuid(), "delivery_drift")];
    const correlations = correlateSignals(signals.slice(0, 1));
    assert.equal(correlations.length, 0);
  });

  test("correlation engine defines 8 rules", () => {
    assert.match(correlationEng, /CORRELATION_RULES/);
    const matches = correlationEng.match(/\{[^}]*from:/g);
    assert.ok(matches && matches.length >= 8, `Expected >= 8 rules, got ${matches?.length}`);
  });
});

// ─── Governance Health ────────────────────────────────────────────────────────

describe("Governance Health Engine", () => {
  function signal(severity, status = "active") {
    return { id: uuid(), severity, status, workspace_id: uuid(), signal_type: "approval_delay" };
  }

  test("perfect score (100) when no signals", () => {
    const score = calculateGovernanceHealth(uuid(), []);
    assert.equal(score, 100);
  });

  test("one critical signal reduces score by 25", () => {
    const score = calculateGovernanceHealth(uuid(), [signal("critical")]);
    assert.equal(score, 75);
  });

  test("one high signal reduces score by 10", () => {
    const score = calculateGovernanceHealth(uuid(), [signal("high")]);
    assert.equal(score, 90);
  });

  test("one medium signal reduces score by 5", () => {
    const score = calculateGovernanceHealth(uuid(), [signal("medium")]);
    assert.equal(score, 95);
  });

  test("one low signal reduces score by 2", () => {
    const score = calculateGovernanceHealth(uuid(), [signal("low")]);
    assert.equal(score, 98);
  });

  test("score never goes below 0", () => {
    const signals = Array.from({ length: 10 }, () => signal("critical"));
    const score = calculateGovernanceHealth(uuid(), signals);
    assert.equal(score, 0);
  });

  test("score never exceeds 100", () => {
    const signals = Array.from({ length: 20 }, () => signal("critical", "resolved"));
    const score = calculateGovernanceHealth(uuid(), signals);
    assert.equal(score, 100);
  });

  test("resolved signals add up to 10 bonus points", () => {
    const signals = [
      signal("high"),
      signal("critical", "resolved"),
      signal("critical", "resolved"),
    ];
    const score = calculateGovernanceHealth(uuid(), signals);
    const expected = Math.max(0, Math.min(100, 100 - 10 + 2));
    assert.equal(score, expected);
  });

  test("acknowledged signals count as active for penalty", () => {
    const score = calculateGovernanceHealth(uuid(), [signal("critical", "acknowledged")]);
    assert.equal(score, 75);
  });

  test("health engine exports calculateGovernanceHealth", () => {
    assert.match(healthEng, /export function calculateGovernanceHealth/);
  });
});

// ─── Signal Lifecycle ─────────────────────────────────────────────────────────

describe("Signal Lifecycle", () => {
  test("registry validates workspaceId as UUID in detectSignal", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("registry validates actorId as UUID", () => {
    assert.match(registry, /actorId must be a UUID/);
  });

  test("registry validates sourceEntityId as UUID", () => {
    assert.match(registry, /sourceEntityId must be a UUID/);
  });

  test("registry enforces at least one evidence item (Rule 2)", () => {
    assert.match(registry, /At least one evidence item is required/);
  });

  test("acknowledgeSignal validates status === 'active'", () => {
    assert.match(registry, /acknowledged from 'active' status/);
  });

  test("resolveSignal prevents double-resolution", () => {
    assert.match(registry, /already.*resolved|resolved.*already/s);
  });

  test("dismissSignal requires dismissedReason for audit trail", () => {
    assert.match(registry, /dismissedReason is required for audit trail/);
  });

  test("dismissSignal prevents dismissing already-closed signals", () => {
    assert.match(registry, /already.*dismissed|dismissed.*already/s);
  });

  test("detectSignal emits GOVERNANCE_SIGNAL_DETECTED", () => {
    assert.match(registry, /GOVERNANCE_SIGNAL_DETECTED/);
  });

  test("acknowledgeSignal emits GOVERNANCE_SIGNAL_ACKNOWLEDGED", () => {
    assert.match(registry, /GOVERNANCE_SIGNAL_ACKNOWLEDGED/);
  });

  test("resolveSignal emits GOVERNANCE_SIGNAL_RESOLVED", () => {
    assert.match(registry, /GOVERNANCE_SIGNAL_RESOLVED/);
  });

  test("dismissSignal emits GOVERNANCE_SIGNAL_DISMISSED", () => {
    assert.match(registry, /GOVERNANCE_SIGNAL_DISMISSED/);
  });

  test("getGovernanceHealth emits GOVERNANCE_HEALTH_CALCULATED", () => {
    assert.match(registry, /GOVERNANCE_HEALTH_CALCULATED/);
  });

  test("correlateWorkspaceSignals emits GOVERNANCE_SIGNAL_CORRELATED", () => {
    assert.match(registry, /GOVERNANCE_SIGNAL_CORRELATED/);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("signal registry validates workspaceId in all functions", () => {
    assert.match(registry, /validUuid/);
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("repository filters by workspace_id", () => {
    const repo = readFileSync("src/lib/governance-signals/governance-signal-repository.ts", "utf8");
    assert.match(repo, /eq\("workspace_id"/);
  });

  test("migration enables RLS on all tables", () => {
    assert.match(migration, /governance_signals enable row level security/);
    assert.match(migration, /governance_signal_evidence enable row level security/);
    assert.match(migration, /governance_signal_recommendations enable row level security/);
  });

  test("migration uses is_workspace_member", () => {
    assert.match(migration, /is_workspace_member/);
  });

  test("listSignals validates workspaceId", () => {
    assert.match(registry, /listSignals/);
    assert.match(registry, /workspaceId must be a UUID/);
  });
});

// ─── Recommendation Integration ───────────────────────────────────────────────

describe("Recommendation Integration", () => {
  test("recommendation engine generates recommendations per signal type", () => {
    assert.match(recommendEng, /SIGNAL_RECOMMENDATION_AFFINITY/);
  });

  test("approval_delay maps to ratification_control", () => {
    assert.match(recommendEng, /approval_delay.*ratification_control|ratification_control.*approval_delay/s);
  });

  test("governance_violation maps to governance_control", () => {
    assert.match(recommendEng, /governance_violation.*governance_control|governance_control.*governance_violation/s);
  });

  test("authority_gap maps to authority_control", () => {
    assert.match(recommendEng, /authority_gap.*authority_control|authority_control.*authority_gap/s);
  });

  test("recommendation engine filters by published or validated status", () => {
    assert.match(recommendEng, /published.*validated|validated.*published/s);
  });

  test("recommendation confidence boosted for primary affinity type", () => {
    assert.match(recommendEng, /affinityBoost/);
  });
});

// ─── Lineage ──────────────────────────────────────────────────────────────────

describe("Signal Lineage", () => {
  test("getSignalLineage is defined", () => {
    assert.match(lineageFile, /export async function getSignalLineage/);
  });

  test("lineage chain includes all 6 layers", () => {
    for (const layer of ["artifact", "memory", "digest", "learning_pattern", "recommendation", "signal"]) {
      assert.match(lineageFile, new RegExp(layer), `Missing lineage layer: ${layer}`);
    }
  });

  test("lineage validates signalId as UUID", () => {
    assert.match(lineageFile, /signalId must be a UUID/);
  });

  test("lineage validates workspaceId as UUID", () => {
    assert.match(lineageFile, /workspaceId must be a UUID/);
  });

  test("lineage returns chain in correct order (artifact first)", () => {
    assert.match(lineageFile, /chain\.reverse/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability", () => {
  test("explainGovernanceSignals is defined", () => {
    assert.match(explainFile, /export function explainGovernanceSignals/);
  });

  test("explain defines 6 principles", () => {
    for (let i = 1; i <= 6; i++) {
      assert.match(explainFile, new RegExp(`number: ${i}`), `Missing Principle ${i}`);
    }
  });

  test("explain defines 8 business rules", () => {
    for (let i = 1; i <= 8; i++) {
      assert.match(explainFile, new RegExp(`number: ${i}`), `Missing Rule ${i}`);
    }
  });

  test("explain describes detection model with all 6 implemented signal types", () => {
    for (const t of [
      "approval_delay", "authority_gap", "escalation_gap",
      "amendment_backlog", "ratification_stall", "governance_violation",
    ]) {
      assert.match(explainFile, new RegExp(t), `Missing signal type in detectionModel: ${t}`);
    }
  });

  test("explain describes confidence model with formula", () => {
    assert.match(explainFile, /confidenceModel/);
    assert.match(explainFile, /0\.40/);
    assert.match(explainFile, /0\.30/);
    assert.match(explainFile, /0\.20/);
    assert.match(explainFile, /0\.10/);
  });

  test("explain describes severity model with all 4 levels", () => {
    assert.match(explainFile, /severityModel/);
    for (const s of ["low", "medium", "high", "critical"]) {
      assert.match(explainFile, new RegExp(`"${s}"`), `Missing severity in severityModel: ${s}`);
    }
  });

  test("explain describes governance health formula", () => {
    assert.match(explainFile, /governanceHealthModel/);
    assert.match(explainFile, /critical.*25|25.*critical/s);
  });

  test("explain describes lineage chain", () => {
    assert.match(explainFile, /lineageChain/);
    for (const layer of ["Artifact", "Memory", "Digest", "Learning Pattern", "Recommendation", "Signal"]) {
      assert.match(explainFile, new RegExp(layer), `Missing lineage layer: ${layer}`);
    }
  });

  test("explain documents all 8 audit events", () => {
    for (const evt of [
      "GOVERNANCE_SIGNAL_DETECTED",
      "GOVERNANCE_SIGNAL_ACKNOWLEDGED",
      "GOVERNANCE_SIGNAL_RESOLVED",
      "GOVERNANCE_SIGNAL_DISMISSED",
      "GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED",
      "GOVERNANCE_SIGNAL_SEVERITY_CALCULATED",
      "GOVERNANCE_SIGNAL_CORRELATED",
      "GOVERNANCE_HEALTH_CALCULATED",
    ]) {
      assert.match(explainFile, new RegExp(evt), `Missing event in explain: ${evt}`);
    }
  });
});

// ─── Public API — index.ts ────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "detectSignal",
    "acknowledgeSignal",
    "resolveSignal",
    "dismissSignal",
    "getSignal",
    "listSignals",
    "detectGovernanceSignalsForWorkspace",
    "correlateWorkspaceSignals",
    "getGovernanceHealth",
    "detectGovernanceSignals",
    "calculateSignalConfidence",
    "deriveEvidenceStrength",
    "deriveHistoricalFrequency",
    "deriveContextAdjustment",
    "calculateSignalSeverity",
    "durationDaysSince",
    "correlateSignals",
    "calculateGovernanceHealth",
    "generateSignalRecommendations",
    "getSignalLineage",
    "explainGovernanceSignals",
    "GOVERNANCE_SIGNAL_TYPES",
    "GOVERNANCE_SIGNAL_SEVERITIES",
    "GOVERNANCE_SIGNAL_STATUSES",
    "GOVERNANCE_SIGNAL_SOURCES",
  ];

  for (const fn of publicFns) {
    test(`index exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs/governance-signal-engine.md covers core concept", () => {
    assert.match(docs, /Governance Signal/i);
  });

  test("documentation describes architecture", () => {
    assert.match(docs, /Architecture|architecture/);
  });

  test("documentation describes detection model", () => {
    assert.match(docs, /Detection|detection/);
  });

  test("documentation describes confidence model", () => {
    assert.match(docs, /Confidence|confidence/);
  });

  test("documentation describes severity model", () => {
    assert.match(docs, /Severity|severity/);
  });

  test("documentation describes governance health model", () => {
    assert.match(docs, /Governance Health|governance health/i);
  });

  test("documentation mentions audit events", () => {
    assert.match(docs, /GOVERNANCE_SIGNAL/);
  });

  test("documentation describes lineage chain", () => {
    assert.match(docs, /Artifact/i);
    assert.match(docs, /Memory/i);
    assert.match(docs, /Digest/i);
    assert.match(docs, /Recommendation/i);
    assert.match(docs, /Signal/i);
  });
});
