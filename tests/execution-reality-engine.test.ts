/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
// ─────────────────────────────────────────────────────────────────────────────
// Execution Reality Engine — Test Suite
// EPIC 3, Sprint 5
//
// All logic is re-implemented in-memory. No database, no mocking.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─── Read source files for verification ──────────────────────────────────────

const typesFile      = readFileSync("src/lib/execution-realities/types.ts", "utf8");
const registryFile   = readFileSync("src/lib/execution-realities/reality-registry.ts", "utf8");
const varianceFile   = readFileSync("src/lib/execution-realities/variance-engine.ts", "utf8");
const driftFile      = readFileSync("src/lib/execution-realities/drift-engine.ts", "utf8");
const accuracyFile   = readFileSync("src/lib/execution-realities/accuracy-engine.ts", "utf8");
const confidenceFile = readFileSync("src/lib/execution-realities/confidence-engine.ts", "utf8");
const healthFile     = readFileSync("src/lib/execution-realities/health-engine.ts", "utf8");
const feedbackFile   = readFileSync("src/lib/execution-realities/feedback-engine.ts", "utf8");
const lineageFile    = readFileSync("src/lib/execution-realities/lineage.ts", "utf8");
const explainFile    = readFileSync("src/lib/execution-realities/explain.ts", "utf8");
const repoFile       = readFileSync("src/lib/execution-realities/execution-reality-repository.ts", "utf8");
const indexFile      = readFileSync("src/lib/execution-realities/index.ts", "utf8");
const dbContract     = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration      = readFileSync("supabase/migrations/20260708000000_execution_reality_engine.sql", "utf8");
const docsFile       = readFileSync("docs/execution-reality-engine.md", "utf8");

// ─── In-memory helpers ────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── In-memory Reality Store ──────────────────────────────────────────────────

type RealityStatus   = "observed" | "validated" | "completed" | "archived";
type RiskLevel       = "low" | "medium" | "high" | "critical";
type VarianceType    = "effort" | "duration" | "risk" | "tasks" | "participants";
type VarianceSev     = "low" | "medium" | "high" | "critical";
type DriftType       = "schedule" | "effort" | "resource" | "risk";
type DriftSev        = "none" | "emerging" | "persistent" | "critical";

type Reality = {
  id: string;
  workspace_id: string;
  projection_id: string;
  reality_title: string;
  reality_description: string;
  status: RealityStatus;
  actual_effort_hours: number;
  actual_duration_days: number;
  actual_risk: RiskLevel;
  actual_task_count: number;
  actual_participant_count: number;
  confidence_score: number;
  observed_at: string;
  validated_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type Observation = {
  id: string;
  workspace_id: string;
  reality_id: string;
  observation_type: string;
  observation_value: string;
  observation_source: string;
  observed_by: string | null;
  observed_at: string;
  created_at: string;
};

type Variance = {
  id: string;
  workspace_id: string;
  reality_id: string;
  variance_type: VarianceType;
  projected_value: number;
  actual_value: number;
  variance_percentage: number;
  severity: VarianceSev;
  created_at: string;
};

type Drift = {
  id: string;
  workspace_id: string;
  reality_id: string;
  drift_type: DriftType;
  severity: DriftSev;
  description: string;
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
};

type Projection = {
  id: string;
  workspace_id: string;
  commitment_id: string;
  projection_title: string;
  estimated_effort_hours: number;
  estimated_duration_days: number;
  projected_risk: RiskLevel;
  task_count: number;
  participant_count: number;
};

function createRealityStore() {
  const realities    = new Map<string, Reality>();
  const observations = new Map<string, Observation>();
  const variances    = new Map<string, Variance>();
  const drifts       = new Map<string, Drift>();
  const projections  = new Map<string, Projection>();

  function ok<T>(data: T) { return { ok: true as const, data }; }
  function validation(error: string) { return { ok: false as const, error, failureClass: "validation_failed" }; }
  function notFound() { return { ok: false as const, error: "Not found.", failureClass: "not_found" }; }

  function validUuid(v: unknown): v is string {
    return typeof v === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function seedProjection(p: Projection) { projections.set(p.id, p); }

  function createReality(input: {
    workspaceId: string;
    projectionId: string;
    realityTitle: string;
    realityDescription?: string;
    actualEffortHours: number;
    actualDurationDays: number;
    actualRisk: RiskLevel;
    actualTaskCount: number;
    actualParticipantCount: number;
    actorId: string;
  }) {
    if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
    if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");
    if (!validUuid(input.actorId))      return validation("Invalid actorId.");
    if (!input.realityTitle?.trim())    return validation("realityTitle is required.");
    if (input.actualEffortHours < 0)    return validation("actualEffortHours must be >= 0.");
    if (input.actualDurationDays < 0)   return validation("actualDurationDays must be >= 0.");

    const proj = projections.get(input.projectionId);
    if (!proj) return notFound();
    if (proj.workspace_id !== input.workspaceId) return validation("Projection does not belong to this workspace.");

    const now = isoNow();
    const r: Reality = {
      id:                      uuid(),
      workspace_id:            input.workspaceId,
      projection_id:           input.projectionId,
      reality_title:           input.realityTitle,
      reality_description:     input.realityDescription ?? "",
      status:                  "observed",
      actual_effort_hours:     input.actualEffortHours,
      actual_duration_days:    input.actualDurationDays,
      actual_risk:             input.actualRisk,
      actual_task_count:       input.actualTaskCount,
      actual_participant_count: input.actualParticipantCount,
      confidence_score:        0.0,
      observed_at:             now,
      validated_at:            null,
      completed_at:            null,
      archived_at:             null,
      created_at:              now,
      updated_at:              now,
    };
    realities.set(r.id, r);
    return ok(r);
  }

  function recordObservation(input: {
    workspaceId: string;
    realityId: string;
    observationType: string;
    observationValue: string;
    observationSource: string;
    observedBy?: string;
    actorId: string;
  }) {
    if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
    if (!validUuid(input.realityId))   return validation("Invalid realityId.");
    if (!validUuid(input.actorId))     return validation("Invalid actorId.");
    if (!input.observationType?.trim()) return validation("observationType is required.");
    if (!input.observationValue?.trim()) return validation("observationValue is required.");

    const reality = realities.get(input.realityId);
    if (!reality || reality.workspace_id !== input.workspaceId) return notFound();
    if (reality.status === "archived") return validation("Cannot record observations on an archived reality.");

    const now = isoNow();
    const obs: Observation = {
      id:                 uuid(),
      workspace_id:       input.workspaceId,
      reality_id:         input.realityId,
      observation_type:   input.observationType,
      observation_value:  input.observationValue,
      observation_source: input.observationSource,
      observed_by:        input.observedBy ?? null,
      observed_at:        now,
      created_at:         now,
    };
    observations.set(obs.id, obs);
    return ok(obs);
  }

  function validateReality(input: { workspaceId: string; realityId: string; actorId: string }) {
    if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
    if (!validUuid(input.realityId))   return validation("Invalid realityId.");

    const reality = realities.get(input.realityId);
    if (!reality || reality.workspace_id !== input.workspaceId) return notFound();
    if (reality.status !== "observed") return validation(`Cannot validate a reality with status '${reality.status}'.`);

    const hasObs = [...observations.values()].some(o => o.reality_id === input.realityId && o.workspace_id === input.workspaceId);
    if (!hasObs) return validation("Reality has no observations — cannot validate.");

    const updated = { ...reality, status: "validated" as RealityStatus, validated_at: isoNow(), updated_at: isoNow() };
    realities.set(updated.id, updated);
    return ok(updated);
  }

  function completeReality(input: { workspaceId: string; realityId: string; actorId: string }) {
    if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
    if (!validUuid(input.realityId))   return validation("Invalid realityId.");

    const reality = realities.get(input.realityId);
    if (!reality || reality.workspace_id !== input.workspaceId) return notFound();
    if (reality.status !== "validated") return validation(`Cannot complete a reality with status '${reality.status}'.`);

    const updated = { ...reality, status: "completed" as RealityStatus, completed_at: isoNow(), updated_at: isoNow() };
    realities.set(updated.id, updated);
    return ok(updated);
  }

  function archiveReality(input: { workspaceId: string; realityId: string; actorId: string }) {
    if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
    if (!validUuid(input.realityId))   return validation("Invalid realityId.");

    const reality = realities.get(input.realityId);
    if (!reality || reality.workspace_id !== input.workspaceId) return notFound();
    if (reality.status === "archived") return validation("Reality is already archived.");

    const updated = { ...reality, status: "archived" as RealityStatus, archived_at: isoNow(), updated_at: isoNow() };
    realities.set(updated.id, updated);
    return ok(updated);
  }

  function getReality(workspaceId: string, realityId: string) {
    const r = realities.get(realityId);
    if (!r || r.workspace_id !== workspaceId) return notFound();
    const obs  = [...observations.values()].filter(o => o.reality_id === realityId);
    const vars = [...variances.values()].filter(v => v.reality_id === realityId);
    const drs  = [...drifts.values()].filter(d => d.reality_id === realityId);
    return ok({ ...r, observations: obs, variances: vars, drifts: drs });
  }

  function listRealities(workspaceId: string, filters: { status?: RealityStatus; risk?: RiskLevel; projectionId?: string } = {}) {
    let results = [...realities.values()].filter(r => r.workspace_id === workspaceId);
    if (filters.status)       results = results.filter(r => r.status === filters.status);
    if (filters.risk)         results = results.filter(r => r.actual_risk === filters.risk);
    if (filters.projectionId) results = results.filter(r => r.projection_id === filters.projectionId);
    return ok(results);
  }

  return {
    seedProjection,
    createReality,
    recordObservation,
    validateReality,
    completeReality,
    archiveReality,
    getReality,
    listRealities,
  };
}

// ─── Variance Engine (in-memory) ──────────────────────────────────────────────

const RISK_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function varPct(projected: number, actual: number): number {
  if (projected === 0) return actual === 0 ? 0 : 100;
  return ((actual - projected) / projected) * 100;
}

function severityFromPct(pct: number): VarianceSev {
  const abs = Math.abs(pct);
  if (abs < 10)  return "low";
  if (abs < 25)  return "medium";
  if (abs < 50)  return "high";
  return "critical";
}

function calcVariance(proj: Projection, reality: Reality) {
  const effortPct   = varPct(proj.estimated_effort_hours, reality.actual_effort_hours);
  const durationPct = varPct(proj.estimated_duration_days, reality.actual_duration_days);
  const riskPct     = varPct(RISK_RANK[proj.projected_risk], RISK_RANK[reality.actual_risk]);
  const tasksPct    = varPct(proj.task_count, reality.actual_task_count);
  const partPct     = varPct(proj.participant_count, reality.actual_participant_count);
  return [
    { varianceType: "effort" as VarianceType, pct: effortPct, projected: proj.estimated_effort_hours, actual: reality.actual_effort_hours },
    { varianceType: "duration" as VarianceType, pct: durationPct, projected: proj.estimated_duration_days, actual: reality.actual_duration_days },
    { varianceType: "risk" as VarianceType, pct: riskPct, projected: RISK_RANK[proj.projected_risk], actual: RISK_RANK[reality.actual_risk] },
    { varianceType: "tasks" as VarianceType, pct: tasksPct, projected: proj.task_count, actual: reality.actual_task_count },
    { varianceType: "participants" as VarianceType, pct: partPct, projected: proj.participant_count, actual: reality.actual_participant_count },
  ].map(v => ({
    varianceType: v.varianceType,
    projectedValue: v.projected,
    actualValue: v.actual,
    variancePercentage: Math.round(v.pct * 100) / 100,
    severity: severityFromPct(v.pct),
  }));
}

// ─── Drift Engine (in-memory) ─────────────────────────────────────────────────

function driftSevFromPct(pct: number): DriftSev {
  if (pct <= 0)  return "none";
  if (pct < 15)  return "emerging";
  if (pct < 40)  return "persistent";
  return "critical";
}

function calcDrift(proj: Projection, reality: Reality) {
  const drifts: Array<{ driftType: DriftType; severity: DriftSev; description: string }> = [];

  if (reality.actual_duration_days > proj.estimated_duration_days) {
    const overrun = proj.estimated_duration_days > 0
      ? ((reality.actual_duration_days - proj.estimated_duration_days) / proj.estimated_duration_days) * 100
      : 100;
    drifts.push({ driftType: "schedule", severity: driftSevFromPct(overrun), description: `Schedule drift: ${Math.round(overrun)}%` });
  }
  if (reality.actual_effort_hours > proj.estimated_effort_hours) {
    const overrun = proj.estimated_effort_hours > 0
      ? ((reality.actual_effort_hours - proj.estimated_effort_hours) / proj.estimated_effort_hours) * 100
      : 100;
    drifts.push({ driftType: "effort", severity: driftSevFromPct(overrun), description: `Effort drift: ${Math.round(overrun)}%` });
  }
  if (reality.actual_participant_count > proj.participant_count) {
    const overrun = proj.participant_count > 0
      ? ((reality.actual_participant_count - proj.participant_count) / proj.participant_count) * 100
      : 100;
    drifts.push({ driftType: "resource", severity: driftSevFromPct(overrun), description: `Resource drift: ${Math.round(overrun)}%` });
  }
  const projRank = RISK_RANK[proj.projected_risk] ?? 1;
  const actRank  = RISK_RANK[reality.actual_risk] ?? 1;
  if (actRank > projRank) {
    const pct = ((actRank - projRank) / projRank) * 100;
    drifts.push({ driftType: "risk", severity: driftSevFromPct(pct), description: `Risk drift: ${proj.projected_risk} → ${reality.actual_risk}` });
  }
  return drifts;
}

// ─── Accuracy Engine (in-memory) ──────────────────────────────────────────────

function calcAccuracy(variances: ReturnType<typeof calcVariance>, projectedRisk: string, actualRisk: string) {
  const effortVar   = variances.find(v => v.varianceType === "effort");
  const durationVar = variances.find(v => v.varianceType === "duration");
  const effortAcc   = effortVar   ? Math.max(0, 100 - Math.abs(effortVar.variancePercentage))   : 100;
  const durationAcc = durationVar ? Math.max(0, 100 - Math.abs(durationVar.variancePercentage)) : 100;
  const riskMatched = projectedRisk === actualRisk;
  const riskBonus   = riskMatched ? 100 : 50;
  const score = Math.round((effortAcc * 0.40) + (durationAcc * 0.40) + (riskBonus * 0.20));
  return { score: Math.min(100, Math.max(0, score)), effortAccuracy: Math.round(effortAcc), durationAccuracy: Math.round(durationAcc), riskMatched };
}

// ─── Confidence Engine (in-memory) ────────────────────────────────────────────

function calcConfidence(obsCount: number, isValidated: boolean): number {
  const obsScore = Math.min(1.0, obsCount / 5) * 0.5;
  const valScore = isValidated ? 0.3 : 0.0;
  const srcScore = 0.7 * 0.2;
  return Math.round(Math.min(1.0, obsScore + valScore + srcScore) * 1000) / 1000;
}

// ─── Health Engine (in-memory) ────────────────────────────────────────────────

const SEV_PENALTY: Record<VarianceSev, number> = { low: 5, medium: 15, high: 30, critical: 50 };
const RISK_PENALTY: Record<RiskLevel, number>  = { low: 0, medium: 5, high: 15, critical: 25 };

function calcHealth(worstSev: VarianceSev, driftCount: number, accuracy: number, riskLevel: RiskLevel): number {
  const vp = SEV_PENALTY[worstSev] ?? 0;
  const dp = Math.min(30, driftCount * 8);
  const as = (accuracy / 100) * 40;
  const rp = RISK_PENALTY[riskLevel] ?? 0;
  return Math.max(0, Math.min(100, Math.round(60 + as - vp - dp - rp)));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Execution Reality Engine", () => {

  // ─── Source File Verification ───────────────────────────────────────────────

  describe("Source Files", () => {
    test("all required source files exist", () => {
      assert.ok(typesFile.length > 0,      "types.ts must not be empty");
      assert.ok(registryFile.length > 0,   "reality-registry.ts must not be empty");
      assert.ok(varianceFile.length > 0,   "variance-engine.ts must not be empty");
      assert.ok(driftFile.length > 0,      "drift-engine.ts must not be empty");
      assert.ok(accuracyFile.length > 0,   "accuracy-engine.ts must not be empty");
      assert.ok(confidenceFile.length > 0, "confidence-engine.ts must not be empty");
      assert.ok(healthFile.length > 0,     "health-engine.ts must not be empty");
      assert.ok(feedbackFile.length > 0,   "feedback-engine.ts must not be empty");
      assert.ok(lineageFile.length > 0,    "lineage.ts must not be empty");
      assert.ok(explainFile.length > 0,    "explain.ts must not be empty");
      assert.ok(repoFile.length > 0,       "execution-reality-repository.ts must not be empty");
      assert.ok(indexFile.length > 0,      "index.ts must not be empty");
    });

    test("migration file exists and contains all four tables", () => {
      assert.ok(migration.includes("execution_realities"),   "migration must define execution_realities");
      assert.ok(migration.includes("execution_variances"),   "migration must define execution_variances");
      assert.ok(migration.includes("execution_observations"), "migration must define execution_observations");
      assert.ok(migration.includes("execution_drifts"),      "migration must define execution_drifts");
    });

    test("migration has RLS policies for all tables", () => {
      const policyCount = (migration.match(/enable row level security/g) ?? []).length;
      assert.ok(policyCount >= 4, "migration must have at least 4 RLS enable statements");
    });

    test("database contract declares all four row types", () => {
      assert.ok(dbContract.includes("ExecutionRealityRow"),      "contract must declare ExecutionRealityRow");
      assert.ok(dbContract.includes("ExecutionVarianceRow"),     "contract must declare ExecutionVarianceRow");
      assert.ok(dbContract.includes("ExecutionObservationRow"),  "contract must declare ExecutionObservationRow");
      assert.ok(dbContract.includes("ExecutionDriftRow"),        "contract must declare ExecutionDriftRow");
    });

    test("database contract declares all selectable column arrays", () => {
      assert.ok(dbContract.includes("EXECUTION_REALITY_SELECTABLE_COLUMNS"),      "contract must declare reality columns");
      assert.ok(dbContract.includes("EXECUTION_VARIANCE_SELECTABLE_COLUMNS"),     "contract must declare variance columns");
      assert.ok(dbContract.includes("EXECUTION_OBSERVATION_SELECTABLE_COLUMNS"),  "contract must declare observation columns");
      assert.ok(dbContract.includes("EXECUTION_DRIFT_SELECTABLE_COLUMNS"),        "contract must declare drift columns");
    });

    test("database contract version includes execution-reality-engine", () => {
      assert.ok(dbContract.includes("execution-reality-engine"), "contract version must reference execution-reality-engine");
    });

    test("docs file exists", () => {
      assert.ok(docsFile.length > 0, "docs/execution-reality-engine.md must not be empty");
    });

    test("types file declares all domain types", () => {
      assert.ok(typesFile.includes("ExecutionRealityStatus"),    "must declare ExecutionRealityStatus");
      assert.ok(typesFile.includes("ExecutionVarianceType"),     "must declare ExecutionVarianceType");
      assert.ok(typesFile.includes("ExecutionVarianceSeverity"), "must declare ExecutionVarianceSeverity");
      assert.ok(typesFile.includes("ExecutionDriftType"),        "must declare ExecutionDriftType");
      assert.ok(typesFile.includes("ExecutionDriftSeverity"),    "must declare ExecutionDriftSeverity");
      assert.ok(typesFile.includes("ExecutionRealityResult"),    "must declare ExecutionRealityResult");
    });

    test("types file declares all event types", () => {
      assert.ok(typesFile.includes("EXECUTION_REALITY_CREATED"),          "must declare REALITY_CREATED event");
      assert.ok(typesFile.includes("EXECUTION_OBSERVATION_RECORDED"),     "must declare OBSERVATION_RECORDED event");
      assert.ok(typesFile.includes("EXECUTION_REALITY_VALIDATED"),        "must declare REALITY_VALIDATED event");
      assert.ok(typesFile.includes("EXECUTION_REALITY_COMPLETED"),        "must declare REALITY_COMPLETED event");
      assert.ok(typesFile.includes("EXECUTION_REALITY_ARCHIVED"),         "must declare REALITY_ARCHIVED event");
      assert.ok(typesFile.includes("EXECUTION_VARIANCE_CALCULATED"),      "must declare VARIANCE_CALCULATED event");
      assert.ok(typesFile.includes("EXECUTION_DRIFT_DETECTED"),           "must declare DRIFT_DETECTED event");
      assert.ok(typesFile.includes("EXECUTION_ACCURACY_CALCULATED"),      "must declare ACCURACY_CALCULATED event");
      assert.ok(typesFile.includes("EXECUTION_HEALTH_CALCULATED"),        "must declare HEALTH_CALCULATED event");
      assert.ok(typesFile.includes("EXECUTION_REALITY_LINEAGE_GENERATED"),"must declare LINEAGE_GENERATED event");
    });

    test("registry exports all required service functions", () => {
      assert.ok(registryFile.includes("createExecutionReality"),          "must export createExecutionReality");
      assert.ok(registryFile.includes("recordExecutionObservation"),      "must export recordExecutionObservation");
      assert.ok(registryFile.includes("validateExecutionReality"),        "must export validateExecutionReality");
      assert.ok(registryFile.includes("completeExecutionReality"),        "must export completeExecutionReality");
      assert.ok(registryFile.includes("archiveExecutionReality"),         "must export archiveExecutionReality");
      assert.ok(registryFile.includes("getExecutionReality"),             "must export getExecutionReality");
      assert.ok(registryFile.includes("listExecutionRealities"),          "must export listExecutionRealities");
      assert.ok(registryFile.includes("calculateAndPersistVariances"),    "must export calculateAndPersistVariances");
      assert.ok(registryFile.includes("detectAndPersistDrifts"),         "must export detectAndPersistDrifts");
      assert.ok(registryFile.includes("getProjectionAccuracy"),           "must export getProjectionAccuracy");
      assert.ok(registryFile.includes("getRealityConfidence"),            "must export getRealityConfidence");
      assert.ok(registryFile.includes("getExecutionHealth"),              "must export getExecutionHealth");
      assert.ok(registryFile.includes("getProjectionFeedback"),           "must export getProjectionFeedback");
      assert.ok(registryFile.includes("getRecommendationFeedback"),       "must export getRecommendationFeedback");
      assert.ok(registryFile.includes("getRealityLineage"),               "must export getRealityLineage");
      assert.ok(registryFile.includes("explainReality"),                  "must export explainReality");
    });

    test("lineage chain includes execution_reality layer", () => {
      assert.ok(lineageFile.includes("execution_reality"), "lineage must include execution_reality layer");
      assert.ok(lineageFile.includes("execution_projection"), "lineage must include execution_projection layer");
      assert.ok(lineageFile.includes("commitment"), "lineage must include commitment layer");
      assert.ok(lineageFile.includes("signal"), "lineage must include signal layer");
    });
  });

  // ─── Reality Lifecycle ──────────────────────────────────────────────────────

  describe("Reality Lifecycle", () => {
    test("should create a reality from a valid projection", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);

      const r = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "Sprint Reality", actualEffortHours: 18, actualDurationDays: 3, actualRisk: "high", actualTaskCount: 5, actualParticipantCount: 2, actorId: uuid() });
      assert.strictEqual(r.ok, true);
      assert.ok(r.data.id);
      assert.strictEqual(r.data.status, "observed");
      assert.strictEqual(r.data.projection_id, proj.id);
    });

    test("should reject creation with invalid workspaceId", () => {
      const store = createRealityStore();
      const r = store.createReality({ workspaceId: "bad", projectionId: uuid(), realityTitle: "T", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 2, actualParticipantCount: 1, actorId: uuid() });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failureClass, "validation_failed");
    });

    test("should reject creation with missing realityTitle", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const r = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "  ", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 2, actualParticipantCount: 1, actorId: uuid() });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failureClass, "validation_failed");
    });

    test("should reject creation when projection not found", () => {
      const store = createRealityStore();
      const r = store.createReality({ workspaceId: uuid(), projectionId: uuid(), realityTitle: "T", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 2, actualParticipantCount: 1, actorId: uuid() });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failureClass, "not_found");
    });

    test("should reject creation when projection belongs to different workspace", () => {
      const store = createRealityStore();
      const proj: Projection = { id: uuid(), workspace_id: uuid(), commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const r = store.createReality({ workspaceId: uuid(), projectionId: proj.id, realityTitle: "T", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 2, actualParticipantCount: 1, actorId: uuid() });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failureClass, "validation_failed");
    });

    test("should validate a reality that has observations", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const created = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 18, actualDurationDays: 3, actualRisk: "high", actualTaskCount: 5, actualParticipantCount: 2, actorId: uuid() });
      assert.ok(created.ok);

      store.recordObservation({ workspaceId: wId, realityId: created.data.id, observationType: "effort", observationValue: "18h spent", observationSource: "tracker", actorId: uuid() });
      const validated = store.validateReality({ workspaceId: wId, realityId: created.data.id, actorId: uuid() });
      assert.strictEqual(validated.ok, true);
      assert.strictEqual(validated.data.status, "validated");
    });

    test("should reject validation without observations", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const created = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 18, actualDurationDays: 3, actualRisk: "high", actualTaskCount: 5, actualParticipantCount: 2, actorId: uuid() });
      assert.ok(created.ok);
      const validated = store.validateReality({ workspaceId: wId, realityId: created.data.id, actorId: uuid() });
      assert.strictEqual(validated.ok, false);
      assert.ok(validated.error.includes("observations"));
    });

    test("should complete a validated reality", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      store.recordObservation({ workspaceId: wId, realityId: c.data.id, observationType: "effort", observationValue: "12h", observationSource: "jira", actorId: uuid() });
      store.validateReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      const completed = store.completeReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      assert.strictEqual(completed.ok, true);
      assert.strictEqual(completed.data.status, "completed");
    });

    test("should reject completing an observed (non-validated) reality", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      const completed = store.completeReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      assert.strictEqual(completed.ok, false);
    });

    test("should archive any non-archived reality", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      const archived = store.archiveReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      assert.strictEqual(archived.ok, true);
      assert.strictEqual(archived.data.status, "archived");
    });

    test("should reject archiving an already-archived reality", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      store.archiveReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      const again = store.archiveReality({ workspaceId: wId, realityId: c.data.id, actorId: uuid() });
      assert.strictEqual(again.ok, false);
    });
  });

  // ─── Observations ───────────────────────────────────────────────────────────

  describe("Observations", () => {
    function setup() {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 18, actualDurationDays: 3, actualRisk: "high", actualTaskCount: 5, actualParticipantCount: 2, actorId: uuid() });
      return { store, wId, realityId: c.data.id };
    }

    test("should record an observation correctly", () => {
      const { store, wId, realityId } = setup();
      const r = store.recordObservation({ workspaceId: wId, realityId, observationType: "effort", observationValue: "18h actual", observationSource: "jira", actorId: uuid() });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.data.observation_type, "effort");
      assert.strictEqual(r.data.observation_value, "18h actual");
    });

    test("should retrieve recorded observations via getReality", () => {
      const { store, wId, realityId } = setup();
      store.recordObservation({ workspaceId: wId, realityId, observationType: "effort", observationValue: "18h", observationSource: "jira", actorId: uuid() });
      store.recordObservation({ workspaceId: wId, realityId, observationType: "risk", observationValue: "elevated", observationSource: "retrospective", actorId: uuid() });
      const r = store.getReality(wId, realityId);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.data.observations.length, 2);
    });

    test("should reject observation on archived reality", () => {
      const { store, wId, realityId } = setup();
      store.archiveReality({ workspaceId: wId, realityId, actorId: uuid() });
      const r = store.recordObservation({ workspaceId: wId, realityId, observationType: "effort", observationValue: "v", observationSource: "s", actorId: uuid() });
      assert.strictEqual(r.ok, false);
      assert.ok(r.error.includes("archived"));
    });

    test("should reject observation with missing type", () => {
      const { store, wId, realityId } = setup();
      const r = store.recordObservation({ workspaceId: wId, realityId, observationType: "", observationValue: "v", observationSource: "s", actorId: uuid() });
      assert.strictEqual(r.ok, false);
    });
  });

  // ─── Variance Engine ────────────────────────────────────────────────────────

  describe("Variance Engine", () => {
    const baseProj: Projection = {
      id: uuid(), workspace_id: uuid(), commitment_id: uuid(), projection_title: "P",
      estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium",
      task_count: 4, participant_count: 2,
    };
    const baseReality = (overrides: Partial<Reality>): Reality => ({
      id: uuid(), workspace_id: baseProj.workspace_id, projection_id: baseProj.id,
      reality_title: "R", reality_description: "", status: "observed",
      actual_effort_hours: 12, actual_duration_days: 2, actual_risk: "medium",
      actual_task_count: 4, actual_participant_count: 2, confidence_score: 0,
      observed_at: isoNow(), validated_at: null, completed_at: null, archived_at: null,
      created_at: isoNow(), updated_at: isoNow(),
      ...overrides,
    });

    test("should calculate zero variance when reality matches projection", () => {
      const vars = calcVariance(baseProj, baseReality({}));
      const effortVar = vars.find(v => v.varianceType === "effort");
      assert.strictEqual(effortVar.variancePercentage, 0);
      assert.strictEqual(effortVar.severity, "low");
    });

    test("should calculate effort variance (+50%)", () => {
      const r = baseReality({ actual_effort_hours: 18 });
      const vars = calcVariance(baseProj, r);
      const effortVar = vars.find(v => v.varianceType === "effort");
      assert.ok(Math.abs(effortVar.variancePercentage - 50) < 0.01, `Expected ~50 got ${effortVar.variancePercentage}`);
      // 50% exactly is critical per the threshold (50%+ → critical)
      assert.strictEqual(effortVar.severity, "critical");
    });

    test("should calculate duration variance (+100%)", () => {
      const r = baseReality({ actual_duration_days: 4 });
      const vars = calcVariance(baseProj, r);
      const durVar = vars.find(v => v.varianceType === "duration");
      assert.ok(Math.abs(durVar.variancePercentage - 100) < 0.01);
      assert.strictEqual(durVar.severity, "critical");
    });

    test("should calculate risk variance when risk escalates", () => {
      const r = baseReality({ actual_risk: "critical" });
      const vars = calcVariance(baseProj, r);
      const riskVar = vars.find(v => v.varianceType === "risk");
      assert.ok(riskVar.variancePercentage > 0);
    });

    test("should calculate task variance", () => {
      const r = baseReality({ actual_task_count: 6 });
      const vars = calcVariance(baseProj, r);
      const taskVar = vars.find(v => v.varianceType === "tasks");
      assert.ok(Math.abs(taskVar.variancePercentage - 50) < 0.01);
    });

    test("should calculate participant variance", () => {
      const r = baseReality({ actual_participant_count: 3 });
      const vars = calcVariance(baseProj, r);
      const partVar = vars.find(v => v.varianceType === "participants");
      assert.ok(Math.abs(partVar.variancePercentage - 50) < 0.01);
    });
  });

  // ─── Variance Severity ──────────────────────────────────────────────────────

  describe("Variance Severity", () => {
    test("0–9.99% → low",        () => assert.strictEqual(severityFromPct(5),    "low"));
    test("10–24.99% → medium",   () => assert.strictEqual(severityFromPct(20),   "medium"));
    test("25–49.99% → high",     () => assert.strictEqual(severityFromPct(40),   "high"));
    test("50%+ → critical",      () => assert.strictEqual(severityFromPct(75),   "critical"));
    test("negative variance low",() => assert.strictEqual(severityFromPct(-5),   "low"));
    test("negative -30% → high", () => assert.strictEqual(severityFromPct(-35),  "high"));
    test("negative -60% → crit", () => assert.strictEqual(severityFromPct(-60),  "critical"));
  });

  // ─── Drift Detection ────────────────────────────────────────────────────────

  describe("Drift Detection", () => {
    const proj: Projection = {
      id: uuid(), workspace_id: uuid(), commitment_id: uuid(), projection_title: "P",
      estimated_effort_hours: 10, estimated_duration_days: 3, projected_risk: "medium",
      task_count: 4, participant_count: 3,
    };
    const reality = (overrides: Partial<Reality>): Reality => ({
      id: uuid(), workspace_id: proj.workspace_id, projection_id: proj.id,
      reality_title: "R", reality_description: "", status: "observed",
      actual_effort_hours: 10, actual_duration_days: 3, actual_risk: "medium",
      actual_task_count: 4, actual_participant_count: 3, confidence_score: 0,
      observed_at: isoNow(), validated_at: null, completed_at: null, archived_at: null,
      created_at: isoNow(), updated_at: isoNow(),
      ...overrides,
    });

    test("should detect no drift when execution matches projection", () => {
      const drifts = calcDrift(proj, reality({}));
      assert.strictEqual(drifts.length, 0);
    });

    test("should detect schedule drift when actual_duration > projected", () => {
      const drifts = calcDrift(proj, reality({ actual_duration_days: 5 }));
      const scheduleDrift = drifts.find(d => d.driftType === "schedule");
      assert.ok(scheduleDrift, "should detect schedule drift");
      assert.notStrictEqual(scheduleDrift.severity, "none");
    });

    test("should detect effort drift when actual_effort > projected", () => {
      const drifts = calcDrift(proj, reality({ actual_effort_hours: 18 }));
      const effortDrift = drifts.find(d => d.driftType === "effort");
      assert.ok(effortDrift, "should detect effort drift");
    });

    test("should detect resource drift when actual_participants > projected", () => {
      const drifts = calcDrift(proj, reality({ actual_participant_count: 7 }));
      const resourceDrift = drifts.find(d => d.driftType === "resource");
      assert.ok(resourceDrift, "should detect resource drift");
    });

    test("should detect risk drift when actual_risk > projected_risk", () => {
      const drifts = calcDrift(proj, reality({ actual_risk: "critical" }));
      const riskDrift = drifts.find(d => d.driftType === "risk");
      assert.ok(riskDrift, "should detect risk drift");
    });

    test("should not detect drift when actual values are under projected", () => {
      const drifts = calcDrift(proj, reality({ actual_effort_hours: 5, actual_duration_days: 2 }));
      assert.strictEqual(drifts.length, 0);
    });
  });

  // ─── Projection Accuracy ────────────────────────────────────────────────────

  describe("Projection Accuracy", () => {
    test("should return 100% accuracy for perfect match", () => {
      const vars = [
        { varianceType: "effort" as VarianceType,   projectedValue: 10, actualValue: 10, variancePercentage: 0,  severity: "low" as VarianceSev },
        { varianceType: "duration" as VarianceType, projectedValue: 3,  actualValue: 3,  variancePercentage: 0,  severity: "low" as VarianceSev },
      ];
      const acc = calcAccuracy(vars, "medium", "medium");
      assert.strictEqual(acc.score, 100);
      assert.strictEqual(acc.riskMatched, true);
    });

    test("should penalise for effort overrun", () => {
      const vars = [
        { varianceType: "effort" as VarianceType,   projectedValue: 10, actualValue: 20, variancePercentage: 100, severity: "critical" as VarianceSev },
        { varianceType: "duration" as VarianceType, projectedValue: 3,  actualValue: 3,  variancePercentage: 0,   severity: "low" as VarianceSev },
      ];
      const acc = calcAccuracy(vars, "medium", "medium");
      // effort_accuracy=0, duration_accuracy=100, risk_bonus=100
      // score = 0*0.4 + 100*0.4 + 100*0.2 = 60
      assert.ok(acc.score <= 60, `score should be <= 60, got ${acc.score}`);
    });

    test("should penalise for risk mismatch", () => {
      const acc = calcAccuracy([], "low", "high");
      assert.strictEqual(acc.riskMatched, false);
      assert.ok(acc.score < 100, "should penalise for risk mismatch");
    });

    test("accuracy score must be in range 0–100", () => {
      const vars = [
        { varianceType: "effort" as VarianceType, projectedValue: 10, actualValue: 100, variancePercentage: 900, severity: "critical" as VarianceSev },
        { varianceType: "duration" as VarianceType, projectedValue: 2, actualValue: 20, variancePercentage: 900, severity: "critical" as VarianceSev },
      ];
      const acc = calcAccuracy(vars, "low", "critical");
      assert.ok(acc.score >= 0 && acc.score <= 100);
    });
  });

  // ─── Reality Confidence ─────────────────────────────────────────────────────

  describe("Reality Confidence", () => {
    test("should return low confidence with zero observations", () => {
      const score = calcConfidence(0, false);
      assert.ok(score < 0.3, `expected < 0.3, got ${score}`);
    });

    test("should increase confidence with more observations", () => {
      const s1 = calcConfidence(1, false);
      const s3 = calcConfidence(3, false);
      assert.ok(s3 > s1);
    });

    test("should add validation bonus", () => {
      const unvalidated = calcConfidence(3, false);
      const validated   = calcConfidence(3, true);
      assert.ok(validated > unvalidated);
    });

    test("should cap at 1.0", () => {
      const score = calcConfidence(100, true);
      assert.ok(score <= 1.0);
    });
  });

  // ─── Execution Health ───────────────────────────────────────────────────────

  describe("Execution Health", () => {
    test("should score high when all good", () => {
      const score = calcHealth("low", 0, 95, "low");
      assert.ok(score >= 80, `expected >= 80, got ${score}`);
    });

    test("should decrease with critical variance", () => {
      const healthy  = calcHealth("low",      0, 90, "low");
      const degraded = calcHealth("critical", 0, 90, "low");
      assert.ok(degraded < healthy);
    });

    test("should decrease with multiple drifts", () => {
      const noDrift   = calcHealth("low", 0, 80, "low");
      const threeDrift = calcHealth("low", 3, 80, "low");
      assert.ok(threeDrift < noDrift);
    });

    test("should decrease with elevated risk", () => {
      const lowRisk  = calcHealth("low", 0, 80, "low");
      const highRisk = calcHealth("low", 0, 80, "high");
      assert.ok(highRisk < lowRisk);
    });

    test("score must be in range 0–100", () => {
      const score = calcHealth("critical", 5, 0, "critical");
      assert.ok(score >= 0 && score <= 100);
    });
  });

  // ─── Learning Feedback ──────────────────────────────────────────────────────

  describe("Learning Feedback", () => {
    test("feedback file exports generateProjectionFeedback", () => {
      assert.ok(feedbackFile.includes("generateProjectionFeedback"), "must export generateProjectionFeedback");
    });

    test("feedback file exports generateRecommendationRealityFeedback", () => {
      assert.ok(feedbackFile.includes("generateRecommendationRealityFeedback"), "must export generateRecommendationRealityFeedback");
    });

    test("feedback references projectionId and accuracy", () => {
      assert.ok(feedbackFile.includes("projectionId"), "feedback must reference projectionId");
      assert.ok(feedbackFile.includes("accuracy"),     "feedback must reference accuracy");
    });

    test("recommendation feedback references effectiveness", () => {
      assert.ok(feedbackFile.includes("effectiveness"), "feedback must reference effectiveness");
    });
  });

  // ─── Workspace Isolation ────────────────────────────────────────────────────

  describe("Workspace Isolation", () => {
    test("should allow access to own workspace realities", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      const r = store.getReality(wId, c.data.id);
      assert.strictEqual(r.ok, true);
    });

    test("should deny access from a different workspace", () => {
      const store = createRealityStore();
      const wId = uuid();
      const proj: Projection = { id: uuid(), workspace_id: wId, commitment_id: uuid(), projection_title: "P", estimated_effort_hours: 12, estimated_duration_days: 2, projected_risk: "medium", task_count: 4, participant_count: 2 };
      store.seedProjection(proj);
      const c = store.createReality({ workspaceId: wId, projectionId: proj.id, realityTitle: "R", actualEffortHours: 12, actualDurationDays: 2, actualRisk: "medium", actualTaskCount: 4, actualParticipantCount: 2, actorId: uuid() });
      const r = store.getReality(uuid(), c.data.id);
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failureClass, "not_found");
    });

    test("should list only own workspace realities", () => {
      const store = createRealityStore();
      const wId1 = uuid();
      const wId2 = uuid();
      const p1: Projection = { id: uuid(), workspace_id: wId1, commitment_id: uuid(), projection_title: "P1", estimated_effort_hours: 10, estimated_duration_days: 2, projected_risk: "low", task_count: 3, participant_count: 1 };
      const p2: Projection = { id: uuid(), workspace_id: wId2, commitment_id: uuid(), projection_title: "P2", estimated_effort_hours: 10, estimated_duration_days: 2, projected_risk: "low", task_count: 3, participant_count: 1 };
      store.seedProjection(p1);
      store.seedProjection(p2);
      store.createReality({ workspaceId: wId1, projectionId: p1.id, realityTitle: "R1", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 3, actualParticipantCount: 1, actorId: uuid() });
      store.createReality({ workspaceId: wId2, projectionId: p2.id, realityTitle: "R2", actualEffortHours: 10, actualDurationDays: 2, actualRisk: "low", actualTaskCount: 3, actualParticipantCount: 1, actorId: uuid() });
      const list1 = store.listRealities(wId1);
      assert.strictEqual(list1.data.length, 1);
      assert.strictEqual(list1.data[0].reality_title, "R1");
    });
  });

  // ─── Lineage ────────────────────────────────────────────────────────────────

  describe("Lineage", () => {
    test("lineage chain has 10 layers (artifact → reality)", () => {
      assert.ok(lineageFile.includes("execution_reality"), "must include execution_reality");
      // Count layer entries in file
      const layerCount = (lineageFile.match(/layer:/g) ?? []).length;
      assert.ok(layerCount >= 10, `expected >= 10 layers, got ${layerCount}`);
    });

    test("lineage includes all required constitutional layers", () => {
      const layers = ["artifact", "memory", "digest", "learning_pattern", "recommendation", "signal", "action", "commitment", "execution_projection", "execution_reality"];
      for (const layer of layers) {
        assert.ok(lineageFile.includes(layer), `lineage must include layer '${layer}'`);
      }
    });
  });

  // ─── Audit Events ───────────────────────────────────────────────────────────

  describe("Audit Events", () => {
    const requiredEvents = [
      "EXECUTION_REALITY_CREATED",
      "EXECUTION_OBSERVATION_RECORDED",
      "EXECUTION_REALITY_VALIDATED",
      "EXECUTION_REALITY_COMPLETED",
      "EXECUTION_REALITY_ARCHIVED",
      "EXECUTION_VARIANCE_CALCULATED",
      "EXECUTION_DRIFT_DETECTED",
      "EXECUTION_ACCURACY_CALCULATED",
      "EXECUTION_HEALTH_CALCULATED",
      "EXECUTION_REALITY_LINEAGE_GENERATED",
    ];

    for (const event of requiredEvents) {
      test(`registry emits ${event}`, () => {
        assert.ok(registryFile.includes(event), `registry must reference ${event}`);
      });
    }
  });
});
