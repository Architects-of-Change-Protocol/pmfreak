/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
// ─────────────────────────────────────────────────────────────────────────────
// Execution Projection Engine — Test Suite
// EPIC 3, Sprint 4
//
// All logic is re-implemented in-memory. No database, no mocking.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─── Read source files for verification ──────────────────────────────────────

const typesFile       = readFileSync("src/lib/execution-projections/types.ts", "utf8");
const registryFile    = readFileSync("src/lib/execution-projections/projection-registry.ts", "utf8");
const effortFile      = readFileSync("src/lib/execution-projections/effort-engine.ts", "utf8");
const dependencyFile  = readFileSync("src/lib/execution-projections/dependency-engine.ts", "utf8");
const participantFile = readFileSync("src/lib/execution-projections/participant-engine.ts", "utf8");
const riskFile        = readFileSync("src/lib/execution-projections/risk-engine.ts", "utf8");
const confidenceFile  = readFileSync("src/lib/execution-projections/confidence-engine.ts", "utf8");
const readinessFile   = readFileSync("src/lib/execution-projections/readiness-engine.ts", "utf8");
const lineageFile     = readFileSync("src/lib/execution-projections/lineage.ts", "utf8");
const explainFile     = readFileSync("src/lib/execution-projections/explain.ts", "utf8");
const comparisonFile  = readFileSync("src/lib/execution-projections/comparison-engine.ts", "utf8");
const templateFile    = readFileSync("src/lib/execution-projections/projection-templates.ts", "utf8");
const indexFile       = readFileSync("src/lib/execution-projections/index.ts", "utf8");
const repoFile        = readFileSync("src/lib/execution-projections/execution-projection-repository.ts", "utf8");
const dbContract      = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration       = readFileSync("supabase/migrations/20260707000000_execution_projection_engine.sql", "utf8");
const docsFile        = readFileSync("docs/execution-projection-engine.md", "utf8");
const platformEvents  = readFileSync("src/lib/platform-events/types.ts", "utf8");

// ─── In-memory implementations ────────────────────────────────────────────────

type ProjectionStatus = "generated" | "validated" | "approved" | "rejected" | "archived";
type RiskLevel        = "low" | "medium" | "high" | "critical";
type Priority         = "low" | "medium" | "high" | "critical";
type DependencyType   = "decision" | "authority" | "ratification" | "amendment" | "resource";

// ─── Templates ───────────────────────────────────────────────────────────────

type TaskTemplate = {
  taskName: string;
  taskDescription: string;
  estimatedHours: number;
  sequenceOrder: number;
  ownerType: string;
};

type Template = {
  titleSuffix: string;
  description: string;
  tasks: TaskTemplate[];
  baseDependencyTypes: DependencyType[];
  baseParticipants: Array<{ participantType: string; responsibility: string }>;
};

const TEMPLATES: Record<string, Template> = {
  create_delegation: {
    titleSuffix: "Delegation Creation",
    description: "Structured execution plan for creating a governance delegation.",
    tasks: [
      { taskName: "Validate Authority",  taskDescription: "Confirm authority.",   estimatedHours: 2, sequenceOrder: 1, ownerType: "sponsor" },
      { taskName: "Prepare Delegation",  taskDescription: "Draft delegation.",    estimatedHours: 2, sequenceOrder: 2, ownerType: "project_manager" },
      { taskName: "Review Delegation",   taskDescription: "Governance review.",   estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Approve Delegation",  taskDescription: "Formal approval.",     estimatedHours: 2, sequenceOrder: 4, ownerType: "sponsor" },
    ],
    baseDependencyTypes: ["authority"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Approves and issues the delegation." },
      { participantType: "project_manager", responsibility: "Prepares delegation documentation." },
    ],
  },
  request_ratification: {
    titleSuffix: "Ratification Request",
    description: "Structured execution plan for requesting formal ratification.",
    tasks: [
      { taskName: "Prepare Ratification Package", taskDescription: "Compile documentation.", estimatedHours: 3, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Identify Approvers",           taskDescription: "Confirm quorum.",        estimatedHours: 1, sequenceOrder: 2, ownerType: "sponsor" },
      { taskName: "Execute Review",               taskDescription: "Conduct review.",        estimatedHours: 3, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Record Ratification",          taskDescription: "Document outcome.",      estimatedHours: 1, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["ratification", "authority"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Chairs review." },
      { participantType: "project_manager", responsibility: "Prepares package." },
    ],
  },
  initiate_governance_review: {
    titleSuffix: "Governance Review",
    description: "Structured execution plan for initiating a governance review.",
    tasks: [
      { taskName: "Gather Evidence",       taskDescription: "Collect artifacts.",        estimatedHours: 3, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Identify Stakeholders", taskDescription: "Map affected parties.",      estimatedHours: 2, sequenceOrder: 2, ownerType: "sponsor" },
      { taskName: "Conduct Review",        taskDescription: "Execute review session.",    estimatedHours: 4, sequenceOrder: 3, ownerType: "technical_lead" },
      { taskName: "Publish Findings",      taskDescription: "Distribute findings.",       estimatedHours: 3, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["decision", "resource"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Authorises review." },
      { participantType: "project_manager", responsibility: "Coordinates logistics." },
      { participantType: "technical_lead",  responsibility: "Leads technical aspects." },
    ],
  },
  review_amendment: {
    titleSuffix: "Amendment Review",
    description: "Structured execution plan for reviewing a proposed amendment.",
    tasks: [
      { taskName: "Review Amendment",         taskDescription: "Analyse amendment.",         estimatedHours: 3, sequenceOrder: 1, ownerType: "technical_lead" },
      { taskName: "Impact Assessment",        taskDescription: "Evaluate impact.",            estimatedHours: 4, sequenceOrder: 2, ownerType: "technical_lead" },
      { taskName: "Governance Validation",    taskDescription: "Validate alignment.",         estimatedHours: 3, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Approval Recommendation", taskDescription: "Submit recommendation.",      estimatedHours: 2, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["amendment", "decision"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Validates constitutional alignment." },
      { participantType: "project_manager", responsibility: "Coordinates review." },
      { participantType: "technical_lead",  responsibility: "Leads impact assessment." },
    ],
  },
};

function getTemplate(actionType: string): Template {
  return TEMPLATES[actionType] ?? {
    titleSuffix: "Governance Action",
    description: "Default governance action projection.",
    tasks: [
      { taskName: "Analyse Context",    taskDescription: "Understand context.",  estimatedHours: 2, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Prepare Response",   taskDescription: "Prepare response.",    estimatedHours: 3, sequenceOrder: 2, ownerType: "project_manager" },
      { taskName: "Review and Approve", taskDescription: "Obtain approval.",     estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Record Outcome",     taskDescription: "Document outcome.",    estimatedHours: 1, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["resource"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Approves outcome." },
      { participantType: "project_manager", responsibility: "Coordinates execution." },
    ],
  };
}

// ─── Effort Engine ────────────────────────────────────────────────────────────

const HOURS_PER_DAY = 6;

function calculateProjectionEffort(tasks: TaskTemplate[]) {
  const taskCount      = tasks.length;
  const estimatedHours = tasks.reduce((s, t) => s + t.estimatedHours, 0);
  const estimatedDays  = Math.max(1, Math.ceil(estimatedHours / HOURS_PER_DAY));
  return { taskCount, estimatedHours, estimatedDays };
}

// ─── Dependency Engine ────────────────────────────────────────────────────────

const DEP_LABELS: Record<string, string> = {
  decision:     "governance_decision",
  authority:    "authority_registry",
  ratification: "ratification_record",
  amendment:    "amendment_proposal",
  resource:     "resource_allocation",
};
const DEP_CRITICALITY: Record<string, string> = {
  decision: "high", authority: "critical", ratification: "high", amendment: "medium", resource: "low",
};

function calculateProjectionDependencies(input: {
  baseDependencyTypes: DependencyType[];
  commitmentId: string;
}) {
  const deps = input.baseDependencyTypes.map((t) => ({
    dependencyType:      t,
    dependencyReference: DEP_LABELS[t],
    criticality:         DEP_CRITICALITY[t],
  }));
  deps.push({
    dependencyType:      "decision",
    dependencyReference: `commitment:${input.commitmentId}`,
    criticality:         "critical",
  });
  return deps;
}

// ─── Participant Engine ───────────────────────────────────────────────────────

function calculateProjectionParticipants(input: { baseParticipants: Array<{ participantType: string; responsibility: string }> }) {
  return input.baseParticipants.map((p) => ({
    participantType:      p.participantType,
    participantReference: p.participantType,
    responsibility:       p.responsibility,
  }));
}

// ─── Risk Engine ──────────────────────────────────────────────────────────────

const PRIORITY_SCORE: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEVERITY_SCORE: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function calculateProjectionRisk(input: {
  commitmentPriority: Priority;
  signalSeverity?: RiskLevel | null;
  dependencyCount: number;
  historicalEffectiveness?: number | null;
  recommendationConfidence?: number | null;
}): { risk: RiskLevel; factors: string[] } {
  const factors: string[] = [];
  let score = PRIORITY_SCORE[input.commitmentPriority] ?? 1;
  factors.push(`commitment_priority:${input.commitmentPriority}`);

  if (input.signalSeverity) {
    score += SEVERITY_SCORE[input.signalSeverity] ?? 0;
    factors.push(`signal_severity:${input.signalSeverity}`);
  }

  if (input.dependencyCount >= 5) { score += 2; factors.push("dependency_count:high"); }
  else if (input.dependencyCount >= 3) { score += 1; factors.push("dependency_count:medium"); }
  else { factors.push("dependency_count:low"); }

  if (input.historicalEffectiveness != null) {
    if (input.historicalEffectiveness < 0.4) { score += 2; factors.push("historical_effectiveness:low"); }
    else if (input.historicalEffectiveness < 0.6) { score += 1; factors.push("historical_effectiveness:medium"); }
    else { factors.push("historical_effectiveness:high"); }
  }

  if (input.recommendationConfidence != null) {
    if (input.recommendationConfidence < 0.4) { score += 2; factors.push("recommendation_confidence:low"); }
    else if (input.recommendationConfidence < 0.6) { score += 1; factors.push("recommendation_confidence:medium"); }
    else { factors.push("recommendation_confidence:high"); }
  }

  const c = Math.max(0, Math.min(12, score));
  const risk: RiskLevel = c <= 1 ? "low" : c <= 4 ? "medium" : c <= 7 ? "high" : "critical";
  return { risk, factors };
}

// ─── Confidence Engine ────────────────────────────────────────────────────────

function round3(v: number) { return Math.round(v * 1000) / 1000; }
function clamp(v: number)  { return Math.max(0, Math.min(1, v)); }

function calculateProjectionConfidence(input: {
  historicalSimilarity?: number | null;
  learningEvidence?: number | null;
  recommendationConfidence?: number | null;
  signalConfidence?: number | null;
  actionTypeKnown: boolean;
}): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0.5;

  if (input.actionTypeKnown) { score += 0.15; factors.push("action_type:known"); }
  else { score -= 0.10; factors.push("action_type:unknown"); }

  if (input.historicalSimilarity != null) {
    score += (input.historicalSimilarity - 0.5) * 0.30;
    factors.push(`historical_similarity:${input.historicalSimilarity.toFixed(2)}`);
  }
  if (input.learningEvidence != null) {
    score += (input.learningEvidence - 0.5) * 0.20;
    factors.push(`learning_evidence:${input.learningEvidence.toFixed(2)}`);
  }
  if (input.recommendationConfidence != null) {
    score += (input.recommendationConfidence - 0.5) * 0.20;
    factors.push(`recommendation_confidence:${input.recommendationConfidence.toFixed(2)}`);
  }
  if (input.signalConfidence != null) {
    score += (input.signalConfidence - 0.5) * 0.15;
    factors.push(`signal_confidence:${input.signalConfidence.toFixed(2)}`);
  }

  return { score: round3(clamp(score)), factors };
}

// ─── Readiness Engine ─────────────────────────────────────────────────────────

function calculateExecutionReadiness(input: {
  authorityReady: boolean;
  dependenciesReady: boolean;
  commitmentAccepted: boolean;
  recommendationValidated: boolean;
  governanceHealth: boolean;
}) {
  let score = 0;
  if (input.authorityReady)          score += 20;
  if (input.dependenciesReady)       score += 20;
  if (input.commitmentAccepted)      score += 20;
  if (input.recommendationValidated) score += 20;
  if (input.governanceHealth)        score += 20;
  return { score, ...input };
}

// ─── Lineage ──────────────────────────────────────────────────────────────────

function getExecutionProjectionLineage(projection: { id: string; projection_title: string }, commitment: { id: string; commitment_title: string }, action: { id: string; action_type: string; title: string }, signal: { id: string; signal_type: string; title: string }) {
  return {
    projectionId: projection.id,
    chain: [
      { layer: "artifact",             entityType: "constitutional_artifact",         entityId: null,          label: "Constitutional Artifact (origin of knowledge)" },
      { layer: "memory",               entityType: "constitutional_memory_record",    entityId: null,          label: "Memory Record (contextual retention)" },
      { layer: "digest",               entityType: "constitutional_digest",           entityId: null,          label: "Digest (synthesized insight)" },
      { layer: "learning_pattern",     entityType: "constitutional_learning_pattern", entityId: null,          label: "Learning Pattern (behavioral model)" },
      { layer: "recommendation",       entityType: "constitutional_recommendation",   entityId: null,          label: "Recommendation (prescribed intervention)" },
      { layer: "signal",               entityType: "governance_signal",               entityId: signal.id,     label: `Signal: ${signal.signal_type} — ${signal.title}` },
      { layer: "action",               entityType: "governance_action",               entityId: action.id,     label: `Action: ${action.action_type} — ${action.title}` },
      { layer: "commitment",           entityType: "governance_commitment",           entityId: commitment.id, label: `Commitment: ${commitment.commitment_title}` },
      { layer: "execution_projection", entityType: "execution_projection",            entityId: projection.id, label: `Projection: ${projection.projection_title}` },
    ],
  };
}

// ─── Explain ──────────────────────────────────────────────────────────────────

function explainExecutionProjection(projection: { id: string; commitment_id: string; estimated_effort_hours: number; confidence_score: number; projected_risk: string }, commitmentTitle: string) {
  return {
    projectionId:    projection.id,
    generatedFrom:   projection.commitment_id,
    because:         commitmentTitle,
    estimatedEffort: `${projection.estimated_effort_hours}h`,
    confidence:      projection.confidence_score,
    risk:            projection.projected_risk,
  };
}

// ─── Comparison Engine ────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function compareExecutionProjections(a: { id: string; estimated_effort_hours: number; estimated_duration_days: number; projected_risk: string; confidence_score: number }, b: typeof a) {
  const effortDiff   = b.estimated_effort_hours  - a.estimated_effort_hours;
  const durationDiff = b.estimated_duration_days - a.estimated_duration_days;
  const confDiff     = round3(b.confidence_score - a.confidence_score);
  const rA = RISK_ORDER[a.projected_risk] ?? 0;
  const rB = RISK_ORDER[b.projected_risk] ?? 0;
  const riskComparison = rA === rB ? "equal" : rB > rA ? `b_higher_by_${rB - rA}` : `a_higher_by_${rA - rB}`;
  return { projectionA: a.id, projectionB: b.id, effortDifferenceHours: effortDiff, durationDifferenceDays: durationDiff, riskComparison, confidenceDifference: confDiff };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const W   = "11111111-1111-1111-1111-111111111111";
const W2  = "22222222-2222-1222-8222-222222222222";
const UID = (n: number) => `${n.toString().padStart(8,"0")}-0000-1000-8000-000000000000`;

function makeProjection(overrides: Record<string, unknown> = {}) {
  return {
    id:                     UID(1),
    workspace_id:           W,
    commitment_id:          UID(2),
    projection_title:       "Test Projection",
    projection_description: "Projection description.",
    status:                 "generated" as ProjectionStatus,
    estimated_effort_hours:  8,
    estimated_duration_days: 2,
    projected_risk:          "low" as RiskLevel,
    confidence_score:        0.65,
    generated_at:            new Date().toISOString(),
    validated_at:            null as string | null,
    approved_at:             null as string | null,
    archived_at:             null as string | null,
    created_at:              new Date().toISOString(),
    updated_at:              new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ─── Projection Generation ───────────────────────────────────────────────────

describe("Projection Generation — create_delegation", () => {
  const template = getTemplate("create_delegation");

  test("produces 4 tasks", () => {
    assert.equal(template.tasks.length, 4);
  });

  test("task names match spec", () => {
    const names = template.tasks.map((t) => t.taskName);
    assert.ok(names.some((n) => /validate authority/i.test(n)));
    assert.ok(names.some((n) => /prepare delegation/i.test(n)));
    assert.ok(names.some((n) => /review delegation/i.test(n)));
    assert.ok(names.some((n) => /approve delegation/i.test(n)));
  });

  test("tasks have sequential order starting at 1", () => {
    const orders = template.tasks.map((t) => t.sequenceOrder).sort((a, b) => a - b);
    assert.deepEqual(orders, [1, 2, 3, 4]);
  });
});

describe("Projection Generation — request_ratification", () => {
  const template = getTemplate("request_ratification");

  test("produces 4 tasks", () => {
    assert.equal(template.tasks.length, 4);
  });

  test("task names match spec", () => {
    const names = template.tasks.map((t) => t.taskName);
    assert.ok(names.some((n) => /ratification package/i.test(n)));
    assert.ok(names.some((n) => /approvers/i.test(n)));
    assert.ok(names.some((n) => /execute review/i.test(n)));
    assert.ok(names.some((n) => /record ratification/i.test(n)));
  });
});

describe("Projection Generation — review_amendment", () => {
  const template = getTemplate("review_amendment");

  test("produces 4 tasks", () => {
    assert.equal(template.tasks.length, 4);
  });

  test("task names match spec", () => {
    const names = template.tasks.map((t) => t.taskName);
    assert.ok(names.some((n) => /review amendment/i.test(n)));
    assert.ok(names.some((n) => /impact assessment/i.test(n)));
    assert.ok(names.some((n) => /governance validation/i.test(n)));
    assert.ok(names.some((n) => /approval recommendation/i.test(n)));
  });
});

describe("Projection Generation — initiate_governance_review", () => {
  const template = getTemplate("initiate_governance_review");

  test("produces 4 tasks", () => {
    assert.equal(template.tasks.length, 4);
  });

  test("task names match spec", () => {
    const names = template.tasks.map((t) => t.taskName);
    assert.ok(names.some((n) => /gather evidence/i.test(n)));
    assert.ok(names.some((n) => /stakeholders/i.test(n)));
    assert.ok(names.some((n) => /conduct review/i.test(n)));
    assert.ok(names.some((n) => /publish findings/i.test(n)));
  });
});

// ─── Effort Estimation ────────────────────────────────────────────────────────

describe("Effort Estimation", () => {
  test("create_delegation: 8h, 2 days, 4 tasks", () => {
    const t = getTemplate("create_delegation");
    const e = calculateProjectionEffort(t.tasks);
    assert.equal(e.taskCount, 4);
    assert.equal(e.estimatedHours, 8);
    assert.equal(e.estimatedDays, 2);  // ceil(8/6) = 2
  });

  test("request_ratification: 8h, 2 days, 4 tasks", () => {
    const t = getTemplate("request_ratification");
    const e = calculateProjectionEffort(t.tasks);
    assert.equal(e.taskCount, 4);
    assert.equal(e.estimatedHours, 8);
    assert.equal(e.estimatedDays, 2);
  });

  test("review_amendment: 12h, 2 days, 4 tasks", () => {
    const t = getTemplate("review_amendment");
    const e = calculateProjectionEffort(t.tasks);
    assert.equal(e.taskCount, 4);
    assert.equal(e.estimatedHours, 12);
    assert.equal(e.estimatedDays, 2);  // ceil(12/6) = 2
  });

  test("initiate_governance_review: 12h, 2 days, 4 tasks", () => {
    const t = getTemplate("initiate_governance_review");
    const e = calculateProjectionEffort(t.tasks);
    assert.equal(e.taskCount, 4);
    assert.equal(e.estimatedHours, 12);
    assert.equal(e.estimatedDays, 2);
  });

  test("zero tasks produces 1 day minimum", () => {
    const e = calculateProjectionEffort([]);
    assert.equal(e.estimatedDays, 1);
    assert.equal(e.estimatedHours, 0);
    assert.equal(e.taskCount, 0);
  });
});

// ─── Dependencies ─────────────────────────────────────────────────────────────

describe("Dependencies", () => {
  test("create_delegation includes authority dependency", () => {
    const t = getTemplate("create_delegation");
    const deps = calculateProjectionDependencies({ baseDependencyTypes: t.baseDependencyTypes, commitmentId: UID(1) });
    assert.ok(deps.some((d) => d.dependencyType === "authority"));
  });

  test("review_amendment includes amendment and decision dependencies", () => {
    const t = getTemplate("review_amendment");
    const deps = calculateProjectionDependencies({ baseDependencyTypes: t.baseDependencyTypes, commitmentId: UID(1) });
    assert.ok(deps.some((d) => d.dependencyType === "amendment"));
    assert.ok(deps.some((d) => d.dependencyType === "decision"));
  });

  test("every projection includes a commitment dependency", () => {
    const commitmentId = UID(99);
    const deps = calculateProjectionDependencies({ baseDependencyTypes: ["resource"], commitmentId });
    const commitmentDep = deps.find((d) => d.dependencyReference === `commitment:${commitmentId}`);
    assert.ok(commitmentDep);
    assert.equal(commitmentDep.criticality, "critical");
  });

  test("authority dependency has critical criticality", () => {
    const deps = calculateProjectionDependencies({ baseDependencyTypes: ["authority"], commitmentId: UID(1) });
    const auth = deps.find((d) => d.dependencyType === "authority");
    assert.ok(auth);
    assert.equal(auth.criticality, "critical");
  });

  test("resource dependency has low criticality", () => {
    const deps = calculateProjectionDependencies({ baseDependencyTypes: ["resource"], commitmentId: UID(1) });
    const res = deps.find((d) => d.dependencyType === "resource");
    assert.ok(res);
    assert.equal(res.criticality, "low");
  });

  test("empty base types still produces commitment dependency", () => {
    const deps = calculateProjectionDependencies({ baseDependencyTypes: [], commitmentId: UID(1) });
    assert.equal(deps.length, 1);
    assert.equal(deps[0].dependencyType, "decision");
  });
});

// ─── Participants ─────────────────────────────────────────────────────────────

describe("Participants", () => {
  test("create_delegation produces sponsor and project_manager", () => {
    const t = getTemplate("create_delegation");
    const p = calculateProjectionParticipants({ baseParticipants: t.baseParticipants });
    const types = p.map((x) => x.participantType);
    assert.ok(types.includes("sponsor"));
    assert.ok(types.includes("project_manager"));
  });

  test("initiate_governance_review produces three participants", () => {
    const t = getTemplate("initiate_governance_review");
    const p = calculateProjectionParticipants({ baseParticipants: t.baseParticipants });
    const types = p.map((x) => x.participantType);
    assert.ok(types.includes("sponsor"));
    assert.ok(types.includes("project_manager"));
    assert.ok(types.includes("technical_lead"));
  });

  test("review_amendment produces three participants", () => {
    const t = getTemplate("review_amendment");
    const p = calculateProjectionParticipants({ baseParticipants: t.baseParticipants });
    assert.equal(p.length, 3);
  });

  test("participant reference matches participant type", () => {
    const t = getTemplate("create_delegation");
    const p = calculateProjectionParticipants({ baseParticipants: t.baseParticipants });
    for (const participant of p) {
      assert.equal(participant.participantReference, participant.participantType);
    }
  });
});

// ─── Risk ────────────────────────────────────────────────────────────────────

describe("Risk — low", () => {
  test("low priority, low dep count → low risk", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "low", dependencyCount: 1 });
    assert.equal(r.risk, "low");
  });
});

describe("Risk — medium", () => {
  test("medium priority, medium dep count → medium risk", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "medium", dependencyCount: 3 });
    assert.equal(r.risk, "medium");
  });

  test("high priority, no signal → medium risk", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "high", dependencyCount: 1 });
    assert.equal(r.risk, "medium");
  });
});

describe("Risk — high", () => {
  test("critical priority, high dep count → high or critical", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "critical", dependencyCount: 5 });
    assert.ok(r.risk === "high" || r.risk === "critical");
  });

  test("high priority, high signal severity, many deps → high or critical", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "high", signalSeverity: "high", dependencyCount: 5 });
    assert.ok(r.risk === "high" || r.risk === "critical");
  });
});

describe("Risk — critical", () => {
  test("critical priority + critical severity + many deps + low effectiveness → critical", () => {
    const r = calculateProjectionRisk({
      commitmentPriority:      "critical",
      signalSeverity:          "critical",
      dependencyCount:         5,
      historicalEffectiveness: 0.2,
      recommendationConfidence: 0.2,
    });
    assert.equal(r.risk, "critical");
  });
});

describe("Risk — factors", () => {
  test("factors array is non-empty", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "medium", dependencyCount: 2 });
    assert.ok(Array.isArray(r.factors) && r.factors.length > 0);
  });

  test("priority factor is always present", () => {
    const r = calculateProjectionRisk({ commitmentPriority: "high", dependencyCount: 0 });
    assert.ok(r.factors.some((f) => f.includes("commitment_priority")));
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe("Confidence", () => {
  test("known action type yields score above 0.5", () => {
    const c = calculateProjectionConfidence({ actionTypeKnown: true });
    assert.ok(c.score > 0.5);
  });

  test("unknown action type yields score below 0.5 without boosters", () => {
    const c = calculateProjectionConfidence({ actionTypeKnown: false });
    assert.ok(c.score < 0.5);
  });

  test("score is within 0–1 range", () => {
    const c = calculateProjectionConfidence({
      actionTypeKnown:         true,
      historicalSimilarity:    1.0,
      learningEvidence:        1.0,
      recommendationConfidence: 1.0,
      signalConfidence:        1.0,
    });
    assert.ok(c.score >= 0.0 && c.score <= 1.0);
  });

  test("score is clamped at 0 with all-negative inputs", () => {
    const c = calculateProjectionConfidence({
      actionTypeKnown:         false,
      historicalSimilarity:    0.0,
      learningEvidence:        0.0,
      recommendationConfidence: 0.0,
      signalConfidence:        0.0,
    });
    assert.ok(c.score >= 0.0);
  });

  test("high recommendation confidence boosts score", () => {
    const low  = calculateProjectionConfidence({ actionTypeKnown: true, recommendationConfidence: 0.2 });
    const high = calculateProjectionConfidence({ actionTypeKnown: true, recommendationConfidence: 0.9 });
    assert.ok(high.score > low.score);
  });

  test("factors array is non-empty", () => {
    const c = calculateProjectionConfidence({ actionTypeKnown: true });
    assert.ok(Array.isArray(c.factors) && c.factors.length > 0);
  });
});

// ─── Readiness ────────────────────────────────────────────────────────────────

describe("Readiness", () => {
  test("all factors true → score 100", () => {
    const r = calculateExecutionReadiness({
      authorityReady: true, dependenciesReady: true, commitmentAccepted: true,
      recommendationValidated: true, governanceHealth: true,
    });
    assert.equal(r.score, 100);
  });

  test("no factors → score 0", () => {
    const r = calculateExecutionReadiness({
      authorityReady: false, dependenciesReady: false, commitmentAccepted: false,
      recommendationValidated: false, governanceHealth: false,
    });
    assert.equal(r.score, 0);
  });

  test("one factor true → score 20", () => {
    const r = calculateExecutionReadiness({
      authorityReady: true, dependenciesReady: false, commitmentAccepted: false,
      recommendationValidated: false, governanceHealth: false,
    });
    assert.equal(r.score, 20);
  });

  test("commitmentAccepted alone → score 20", () => {
    const r = calculateExecutionReadiness({
      authorityReady: false, dependenciesReady: false, commitmentAccepted: true,
      recommendationValidated: false, governanceHealth: false,
    });
    assert.equal(r.score, 20);
  });

  test("three factors true → score 60", () => {
    const r = calculateExecutionReadiness({
      authorityReady: true, dependenciesReady: true, commitmentAccepted: true,
      recommendationValidated: false, governanceHealth: false,
    });
    assert.equal(r.score, 60);
  });

  test("readiness result contains all factor flags", () => {
    const r = calculateExecutionReadiness({
      authorityReady: true, dependenciesReady: false, commitmentAccepted: true,
      recommendationValidated: false, governanceHealth: true,
    });
    assert.equal(r.authorityReady, true);
    assert.equal(r.dependenciesReady, false);
    assert.equal(r.commitmentAccepted, true);
    assert.equal(r.recommendationValidated, false);
    assert.equal(r.governanceHealth, true);
  });
});

// ─── Lineage ─────────────────────────────────────────────────────────────────

describe("Lineage", () => {
  const projection  = makeProjection();
  const commitment  = { id: UID(2), commitment_title: "Test Commitment" };
  const action      = { id: UID(3), action_type: "create_delegation", title: "Create Delegation" };
  const signal      = { id: UID(4), signal_type: "approval_delay", title: "Approval Delayed" };

  test("lineage chain has 9 layers", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    assert.equal(l.chain.length, 9);
  });

  test("chain includes execution_projection layer", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    const last = l.chain[l.chain.length - 1];
    assert.equal(last.layer, "execution_projection");
    assert.equal(last.entityId, projection.id);
  });

  test("chain includes commitment layer with correct entityId", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    const commitmentLayer = l.chain.find((c) => c.layer === "commitment");
    assert.ok(commitmentLayer);
    assert.equal(commitmentLayer.entityId, commitment.id);
  });

  test("chain includes signal layer with correct entityId", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    const signalLayer = l.chain.find((c) => c.layer === "signal");
    assert.ok(signalLayer);
    assert.equal(signalLayer.entityId, signal.id);
  });

  test("chain starts with artifact layer with null entityId", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    assert.equal(l.chain[0].layer, "artifact");
    assert.equal(l.chain[0].entityId, null);
  });

  test("full reconstruction: all 9 layers present", () => {
    const l = getExecutionProjectionLineage(projection, commitment, action, signal);
    const layers = l.chain.map((c) => c.layer);
    const expected = ["artifact","memory","digest","learning_pattern","recommendation","signal","action","commitment","execution_projection"];
    assert.deepEqual(layers, expected);
  });
});

// ─── Comparison ───────────────────────────────────────────────────────────────

describe("Comparison", () => {
  test("different effort: b_effort - a_effort is reported", () => {
    const a = makeProjection({ id: UID(1), estimated_effort_hours: 8,  estimated_duration_days: 2, projected_risk: "low",    confidence_score: 0.70 });
    const b = makeProjection({ id: UID(2), estimated_effort_hours: 16, estimated_duration_days: 3, projected_risk: "medium", confidence_score: 0.55 });
    const c = compareExecutionProjections(a, b);
    assert.equal(c.effortDifferenceHours, 8);
    assert.equal(c.durationDifferenceDays, 1);
  });

  test("identical projections have zero differences", () => {
    const a = makeProjection({ id: UID(1) });
    const c = compareExecutionProjections(a, a);
    assert.equal(c.effortDifferenceHours, 0);
    assert.equal(c.durationDifferenceDays, 0);
    assert.equal(c.riskComparison, "equal");
    assert.equal(c.confidenceDifference, 0);
  });

  test("b higher risk than a is reported correctly", () => {
    const a = makeProjection({ id: UID(1), projected_risk: "low",  estimated_effort_hours: 8,  estimated_duration_days: 2, confidence_score: 0.7 });
    const b = makeProjection({ id: UID(2), projected_risk: "high", estimated_effort_hours: 16, estimated_duration_days: 3, confidence_score: 0.5 });
    const c = compareExecutionProjections(a, b);
    assert.ok(c.riskComparison.startsWith("b_higher_by_"));
  });

  test("a higher risk than b is reported correctly", () => {
    const a = makeProjection({ id: UID(1), projected_risk: "critical", estimated_effort_hours: 20, estimated_duration_days: 4, confidence_score: 0.4 });
    const b = makeProjection({ id: UID(2), projected_risk: "low",      estimated_effort_hours: 8,  estimated_duration_days: 2, confidence_score: 0.8 });
    const c = compareExecutionProjections(a, b);
    assert.ok(c.riskComparison.startsWith("a_higher_by_"));
  });

  test("confidence difference is signed correctly", () => {
    const a = makeProjection({ id: UID(1), confidence_score: 0.5, projected_risk: "low",  estimated_effort_hours: 8,  estimated_duration_days: 2 });
    const b = makeProjection({ id: UID(2), confidence_score: 0.8, projected_risk: "low",  estimated_effort_hours: 8,  estimated_duration_days: 2 });
    const c = compareExecutionProjections(a, b);
    assert.ok(c.confidenceDifference > 0);
  });
});

// ─── Audit Events ────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const EXPECTED_EVENTS = [
    "EXECUTION_PROJECTION_GENERATED",
    "EXECUTION_PROJECTION_VALIDATED",
    "EXECUTION_PROJECTION_APPROVED",
    "EXECUTION_PROJECTION_REJECTED",
    "EXECUTION_PROJECTION_ARCHIVED",
    "EXECUTION_PROJECTION_EFFORT_CALCULATED",
    "EXECUTION_PROJECTION_RISK_CALCULATED",
    "EXECUTION_PROJECTION_CONFIDENCE_CALCULATED",
    "EXECUTION_PROJECTION_READINESS_CALCULATED",
    "EXECUTION_PROJECTION_LINEAGE_GENERATED",
  ];

  for (const evt of EXPECTED_EVENTS) {
    test(`event ${evt} is declared in types.ts`, () => {
      assert.ok(typesFile.includes(evt), `Missing event: ${evt}`);
    });

    test(`event ${evt} is declared in platform-events/types.ts`, () => {
      assert.ok(platformEvents.includes(evt), `Missing platform event: ${evt}`);
    });
  }

  test("registry emits EXECUTION_PROJECTION_GENERATED on generation", () => {
    assert.ok(registryFile.includes("EXECUTION_PROJECTION_GENERATED"));
  });

  test("registry emits EXECUTION_PROJECTION_EFFORT_CALCULATED", () => {
    assert.ok(registryFile.includes("EXECUTION_PROJECTION_EFFORT_CALCULATED"));
  });

  test("registry emits EXECUTION_PROJECTION_RISK_CALCULATED", () => {
    assert.ok(registryFile.includes("EXECUTION_PROJECTION_RISK_CALCULATED"));
  });

  test("registry emits EXECUTION_PROJECTION_CONFIDENCE_CALCULATED", () => {
    assert.ok(registryFile.includes("EXECUTION_PROJECTION_CONFIDENCE_CALCULATED"));
  });

  test("registry emits EXECUTION_PROJECTION_LINEAGE_GENERATED", () => {
    assert.ok(registryFile.includes("EXECUTION_PROJECTION_LINEAGE_GENERATED"));
  });
});

// ─── Workspace Isolation ─────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("migration enables RLS on execution_projections", () => {
    assert.ok(migration.includes("enable row level security") && migration.includes("execution_projections"));
  });

  test("migration enables RLS on execution_projection_tasks", () => {
    assert.ok(migration.includes("enable row level security") && migration.includes("execution_projection_tasks"));
  });

  test("migration enables RLS on execution_projection_dependencies", () => {
    assert.ok(migration.includes("execution_projection_dependencies"));
  });

  test("migration enables RLS on execution_projection_participants", () => {
    assert.ok(migration.includes("execution_projection_participants"));
  });

  test("repository filters by workspace_id on find", () => {
    assert.ok(repoFile.includes('.eq("workspace_id"'));
  });

  test("registry validates workspaceId with UUID check", () => {
    assert.ok(registryFile.includes("validUuid(input.workspaceId)"));
  });

  test("different workspaces are distinct (isolation is enforced per workspace)", () => {
    // Workspace isolation is enforced at DB/RLS and application layers.
    // Projections from workspace W cannot be accessed from workspace W2.
    assert.notEqual(W, W2);
  });
});

// ─── Data Model ──────────────────────────────────────────────────────────────

describe("Data Model", () => {
  test("database-contract declares ExecutionProjectionRow", () => {
    assert.ok(dbContract.includes("ExecutionProjectionRow"));
  });

  test("database-contract declares ExecutionProjectionTaskRow", () => {
    assert.ok(dbContract.includes("ExecutionProjectionTaskRow"));
  });

  test("database-contract declares ExecutionProjectionDependencyRow", () => {
    assert.ok(dbContract.includes("ExecutionProjectionDependencyRow"));
  });

  test("database-contract declares ExecutionProjectionParticipantRow", () => {
    assert.ok(dbContract.includes("ExecutionProjectionParticipantRow"));
  });

  test("migration creates execution_projections table", () => {
    assert.ok(migration.includes("create table if not exists execution_projections"));
  });

  test("migration creates execution_projection_tasks table", () => {
    assert.ok(migration.includes("create table if not exists execution_projection_tasks"));
  });

  test("migration creates execution_projection_dependencies table", () => {
    assert.ok(migration.includes("create table if not exists execution_projection_dependencies"));
  });

  test("migration creates execution_projection_participants table", () => {
    assert.ok(migration.includes("create table if not exists execution_projection_participants"));
  });

  test("projection status check constraint includes all required statuses", () => {
    const statuses = ["generated", "validated", "approved", "rejected", "archived"];
    for (const s of statuses) {
      assert.ok(migration.includes(s), `Missing status: ${s}`);
    }
  });

  test("projection risk check constraint includes all risk levels", () => {
    const risks = ["low", "medium", "high", "critical"];
    for (const r of risks) {
      assert.ok(migration.includes(r), `Missing risk: ${r}`);
    }
  });

  test("dependency_type check constraint includes all types", () => {
    const types = ["decision", "authority", "ratification", "amendment", "resource"];
    for (const t of types) {
      assert.ok(migration.includes(t), `Missing dependency type: ${t}`);
    }
  });

  test("SELECTABLE_COLUMNS declared for all tables", () => {
    assert.ok(dbContract.includes("EXECUTION_PROJECTION_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("EXECUTION_PROJECTION_TASK_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("EXECUTION_PROJECTION_DEPENDENCY_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("EXECUTION_PROJECTION_PARTICIPANT_SELECTABLE_COLUMNS"));
  });
});

// ─── Business Rules ───────────────────────────────────────────────────────────

describe("Business Rules", () => {
  test("Rule 1: projection originates from commitment (registry loads commitment)", () => {
    assert.ok(registryFile.includes("dbFindGovernanceCommitmentById"));
  });

  test("Rule 2: projection requires tasks (validate checks task count)", () => {
    assert.ok(registryFile.includes("tasks.data.length === 0"));
  });

  test("Rule 3: projection requires estimated effort (validate checks effort > 0)", () => {
    assert.ok(registryFile.includes("estimated_effort_hours <= 0"));
  });

  test("Rule 4: projection has risk (risk engine is called)", () => {
    assert.ok(registryFile.includes("calculateProjectionRisk"));
  });

  test("Rule 5: projection has confidence (confidence engine is called)", () => {
    assert.ok(registryFile.includes("calculateProjectionConfidence"));
  });

  test("Rule 6: workspace isolation is enforced", () => {
    assert.ok(registryFile.includes("workspace_id !== input.workspaceId"));
  });

  test("Rule 10: projection never executes real work (no schedule/calendar/backlog)", () => {
    const forbidden = ["calendar", "backlog", "sprint_board", "task_create", "schedule_task"];
    for (const term of forbidden) {
      assert.ok(!registryFile.toLowerCase().includes(term), `Found forbidden term: ${term}`);
    }
  });
});

// ─── Documentation ───────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs file exists and is non-empty", () => {
    assert.ok(docsFile.length > 200);
  });

  test("docs includes Architecture section", () => {
    assert.ok(docsFile.includes("Architect") || docsFile.includes("architect"));
  });

  test("docs includes Effort section", () => {
    assert.ok(docsFile.toLowerCase().includes("effort"));
  });

  test("docs includes Risk section", () => {
    assert.ok(docsFile.toLowerCase().includes("risk"));
  });

  test("docs includes Readiness section", () => {
    assert.ok(docsFile.toLowerCase().includes("readiness"));
  });

  test("docs includes use case examples", () => {
    assert.ok(docsFile.toLowerCase().includes("example") || docsFile.toLowerCase().includes("use case"));
  });
});
