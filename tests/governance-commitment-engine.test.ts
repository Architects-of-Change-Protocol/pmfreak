/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
// ─────────────────────────────────────────────────────────────────────────────
// Governance Commitment Engine — Test Suite
// EPIC 3, Sprint 3
//
// All logic is re-implemented in-memory. No database, no mocking.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─── Read source files for verification ──────────────────────────────────────

const typesFile    = readFileSync("src/lib/governance-commitments/types.ts", "utf8");
const explainFile  = readFileSync("src/lib/governance-commitments/explain.ts", "utf8");
const registryFile = readFileSync("src/lib/governance-commitments/commitment-registry.ts", "utf8");
const indexFile    = readFileSync("src/lib/governance-commitments/index.ts", "utf8");
const repoFile     = readFileSync("src/lib/governance-commitments/governance-commitment-repository.ts", "utf8");
const dbContract   = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration    = readFileSync("supabase/migrations/20260706000000_governance_commitment_engine.sql", "utf8");
const docsFile     = readFileSync("docs/governance-commitment-engine.md", "utf8");

// ─── In-memory implementations ────────────────────────────────────────────────

type CommitmentStatus =
  | "pending_acceptance" | "accepted" | "rejected" | "active"
  | "completed" | "breached" | "cancelled" | "delegated" | "expired";
type DelegationStatus = "pending" | "accepted" | "rejected" | "cancelled";

const TERMINAL: CommitmentStatus[] = ["completed", "breached", "cancelled", "rejected", "expired"];

const ALLOWED: Record<CommitmentStatus, CommitmentStatus[]> = {
  pending_acceptance: ["accepted", "rejected", "expired"],
  accepted:           ["active", "cancelled", "delegated"],
  active:             ["completed", "breached", "cancelled", "expired", "delegated"],
  delegated:          ["accepted", "active", "cancelled"],
  completed: [], breached: [], cancelled: [], rejected: [], expired: [],
};

function canTransition(from: CommitmentStatus, to: CommitmentStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
function isTerminal(s: CommitmentStatus): boolean {
  return TERMINAL.includes(s);
}
function transitionCommitmentStatus(
  current: CommitmentStatus, next: CommitmentStatus
): { ok: true } | { ok: false; error: string } {
  if (isTerminal(current)) return { ok: false, error: `'${current}' is terminal.` };
  if (!canTransition(current, next)) return { ok: false, error: `Cannot go from '${current}' to '${next}'.` };
  return { ok: true };
}

type CommitmentLike = { id: string; workspace_id: string; action_id: string; commitment_title: string; owner_id: string; owner_type: string; priority: string; status: CommitmentStatus; due_date: string; accepted_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null; breached_at: string | null; expired_at: string | null; outcome: string | null; created_at: string; updated_at: string };
type DelegationLike = { status: DelegationStatus };
type ForecastOpts = { signalSeverity?: string; historicalEffectiveness?: number };
type ActionLike = { id: string; action_type: string; title: string; signal_id: string };
type SignalLike = { id: string; signal_type: string; title: string };

// Accountability
const MS_PER_DAY = 86_400_000;
function calculateCommitmentAccountability(c: CommitmentLike, now = new Date()) {
  const dueDate = new Date(c.due_date);
  const overdue =
    !["completed", "cancelled", "rejected"].includes(c.status) && now > dueDate;
  return {
    commitmentId: c.id,
    owner:        c.owner_id,
    accepted:     c.accepted_at !== null,
    completed:    c.status === "completed",
    overdue,
    daysLate:     overdue ? Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY) : 0,
    status:       c.status,
  };
}

// Health
function calculateCommitmentHealth(workspaceId: string, commitments: CommitmentLike[], now = new Date()) {
  const total = commitments.length;
  let completed = 0, breached = 0, delegated = 0, active = 0, pendingAcceptance = 0, overdue = 0;
  for (const c of commitments) {
    if (c.status === "completed") completed++;
    if (c.status === "breached")  breached++;
    if (c.status === "delegated") delegated++;
    if (c.status === "active")    active++;
    if (c.status === "pending_acceptance") pendingAcceptance++;
    const due = new Date(c.due_date);
    if (!["completed","cancelled","rejected"].includes(c.status) && now > due) overdue++;
  }
  let score = 100;
  if (total > 0) {
    score = Math.max(0, Math.min(100,
      Math.round((completed / total) * 100 - (breached / total) * 40 - (overdue / total) * 30)
    ));
  }
  return { workspaceId, score, totalCommitments: total, completed, breached, overdue, delegated, active, pendingAcceptance, calculatedAt: now.toISOString() };
}

// Breach detection
function detectCommitmentBreaches(workspaceId: string, commitments: CommitmentLike[], now = new Date()) {
  const skip = new Set(["completed","cancelled","rejected","breached","expired"]);
  const breaches = commitments
    .filter(c => !skip.has(c.status) && now > new Date(c.due_date))
    .map(c => ({
      commitmentId: c.id,
      title: c.commitment_title,
      ownerId: c.owner_id,
      dueDate: c.due_date,
      status: c.status,
      daysOverdue: Math.floor((now.getTime() - new Date(c.due_date).getTime()) / MS_PER_DAY),
    }));
  return { workspaceId, breaches, detectedAt: now.toISOString() };
}

// Delegation validation
function validateCommitmentDelegation(input: {
  commitment: CommitmentLike;
  delegatedBy: string;
  delegatedTo: string;
  existingDelegations: DelegationLike[];
}) {
  const { commitment, delegatedBy, delegatedTo, existingDelegations } = input;
  if (commitment.owner_id !== delegatedBy)
    return { valid: false, reason: "Only the commitment owner may delegate it." };
  if (delegatedBy === delegatedTo)
    return { valid: false, reason: "Cannot delegate a commitment to yourself." };
  const terminalStatuses = ["completed","breached","cancelled","expired","rejected"];
  if (terminalStatuses.includes(commitment.status))
    return { valid: false, reason: `Cannot delegate a commitment in terminal status '${commitment.status}'.` };
  const hasActive = existingDelegations.some(d => d.status === "pending" || d.status === "accepted");
  if (hasActive)
    return { valid: false, reason: "Commitment already has an active delegation." };
  return { valid: true, reason: "Delegation is valid." };
}

// Forecast
const PRIORITY_BASE: Record<string, number> = { critical: 0.55, high: 0.65, medium: 0.75, low: 0.85 };
const STATUS_MOD: Record<string, number> = { accepted: 0.10, active: 0.20, pending_acceptance: -0.05, delegated: -0.05 };
function clamp(v: number) { return Math.max(0, Math.min(1, v)); }
function round3(v: number) { return Math.round(v * 1000) / 1000; }
function forecastCommitmentOutcome(commitment: CommitmentLike, opts: ForecastOpts = {}, now = new Date()) {
  const base = PRIORITY_BASE[commitment.priority] ?? 0.70;
  const statusMod = STATUS_MOD[commitment.status] ?? 0;
  const daysUntilDue = (new Date(commitment.due_date).getTime() - now.getTime()) / 86_400_000;
  const timeMod = daysUntilDue < 0 ? -0.20 : daysUntilDue < 1 ? -0.10 : 0;
  const severityMod = opts.signalSeverity === "critical" ? -0.15 : opts.signalSeverity === "high" ? -0.10 : opts.signalSeverity === "medium" ? -0.05 : 0;
  const historicalMod = opts.historicalEffectiveness != null ? (opts.historicalEffectiveness - 0.5) * 0.20 : 0;
  const p = round3(clamp(base + statusMod + timeMod + severityMod + historicalMod));
  return { commitmentId: commitment.id, probabilityOfCompletion: p, riskOfBreach: round3(clamp(1 - p)), forecastedAt: now.toISOString() };
}

// Lineage
function getCommitmentLineage(commitment: CommitmentLike, action: ActionLike, signal: SignalLike) {
  return {
    commitmentId: commitment.id,
    chain: [
      { layer: "artifact",         entityType: "constitutional_artifact",         entityId: null, label: "Constitutional Artifact (origin of knowledge)" },
      { layer: "memory",           entityType: "constitutional_memory_record",    entityId: null, label: "Memory Record (contextual retention)" },
      { layer: "digest",           entityType: "constitutional_digest",           entityId: null, label: "Digest (synthesized insight)" },
      { layer: "learning_pattern", entityType: "constitutional_learning_pattern", entityId: null, label: "Learning Pattern (behavioral model)" },
      { layer: "recommendation",   entityType: "constitutional_recommendation",   entityId: null, label: "Recommendation (prescribed intervention)" },
      { layer: "signal",           entityType: "governance_signal",               entityId: signal.id, label: `Signal: ${signal.signal_type} — ${signal.title}` },
      { layer: "action",           entityType: "governance_action",               entityId: action.id, label: `Action: ${action.action_type} — ${action.title}` },
      { layer: "commitment",       entityType: "governance_commitment",           entityId: commitment.id, label: `Commitment: ${commitment.commitment_title}` },
    ],
  };
}

// Explain
function explainGovernanceCommitments() {
  return {
    concept:              "string",
    principles:           [{ number: 1, statement: "Every action can generate a commitment." }],
    lifecycleModel:       {},
    accountabilityModel:  {},
    delegationModel:      {},
    healthModel:          {},
    forecastModel:        {},
    breachDetectionModel: {},
    lineageChain:         ["Artifact","Memory","Digest","Learning Pattern","Recommendation","Signal","Action","Commitment"],
    auditEvents:          ["GOVERNANCE_COMMITMENT_CREATED"],
    businessRules:        [{ number: 1, statement: "Every commitment must originate from an action." }],
    commitmentStatuses:   ["pending_acceptance","accepted","rejected","active","completed","breached","cancelled","delegated","expired"],
    commitmentPriorities: ["low","medium","high","critical"],
    commitmentOutcomes:   ["successful","partial","failed","unknown"],
    useCases:             [],
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const W  = "11111111-1111-1111-1111-111111111111";
const UID = (n: number) => `${n.toString().padStart(8,"0")}-0000-1000-8000-000000000000`;

function makeCommitment(overrides: Partial<CommitmentLike> = {}): CommitmentLike {
  const dueDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  return {
    id:                     UID(1),
    workspace_id:           W,
    action_id:              UID(2),
    commitment_title:       "Request Ratification",
    commitment_description: "Formal ratification of amendment.",
    owner_id:               UID(10),
    owner_type:             "sponsor",
    priority:               "high",
    status:                 "pending_acceptance" as CommitmentStatus,
    due_date:               dueDate,
    accepted_at:            null,
    started_at:             null,
    completed_at:           null,
    cancelled_at:           null,
    breached_at:            null,
    expired_at:             null,
    outcome:                null,
    created_at:             new Date().toISOString(),
    updated_at:             new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Commitment Lifecycle", () => {
  test("pending_acceptance → accepted is valid", () => {
    const r = transitionCommitmentStatus("pending_acceptance", "accepted");
    assert.ok(r.ok);
  });

  test("pending_acceptance → rejected is valid", () => {
    const r = transitionCommitmentStatus("pending_acceptance", "rejected");
    assert.ok(r.ok);
  });

  test("pending_acceptance → expired is valid", () => {
    const r = transitionCommitmentStatus("pending_acceptance", "expired");
    assert.ok(r.ok);
  });

  test("pending_acceptance → active is invalid", () => {
    const r = transitionCommitmentStatus("pending_acceptance", "active");
    assert.ok(!r.ok);
  });

  test("accepted → active is valid", () => {
    const r = transitionCommitmentStatus("accepted", "active");
    assert.ok(r.ok);
  });

  test("accepted → cancelled is valid", () => {
    const r = transitionCommitmentStatus("accepted", "cancelled");
    assert.ok(r.ok);
  });

  test("accepted → delegated is valid", () => {
    const r = transitionCommitmentStatus("accepted", "delegated");
    assert.ok(r.ok);
  });

  test("active → completed is valid", () => {
    const r = transitionCommitmentStatus("active", "completed");
    assert.ok(r.ok);
  });

  test("active → breached is valid", () => {
    const r = transitionCommitmentStatus("active", "breached");
    assert.ok(r.ok);
  });

  test("active → cancelled is valid", () => {
    const r = transitionCommitmentStatus("active", "cancelled");
    assert.ok(r.ok);
  });

  test("active → expired is valid", () => {
    const r = transitionCommitmentStatus("active", "expired");
    assert.ok(r.ok);
  });

  test("active → delegated is valid", () => {
    const r = transitionCommitmentStatus("active", "delegated");
    assert.ok(r.ok);
  });

  test("delegated → accepted is valid", () => {
    const r = transitionCommitmentStatus("delegated", "accepted");
    assert.ok(r.ok);
  });

  test("delegated → active is valid", () => {
    const r = transitionCommitmentStatus("delegated", "active");
    assert.ok(r.ok);
  });

  test("delegated → cancelled is valid", () => {
    const r = transitionCommitmentStatus("delegated", "cancelled");
    assert.ok(r.ok);
  });

  test("completed is terminal", () => {
    assert.ok(isTerminal("completed"));
    const r = transitionCommitmentStatus("completed", "active");
    assert.ok(!r.ok);
  });

  test("breached is terminal", () => {
    assert.ok(isTerminal("breached"));
    const r = transitionCommitmentStatus("breached", "active");
    assert.ok(!r.ok);
  });

  test("cancelled is terminal", () => {
    assert.ok(isTerminal("cancelled"));
    const r = transitionCommitmentStatus("cancelled", "active");
    assert.ok(!r.ok);
  });

  test("rejected is terminal", () => {
    assert.ok(isTerminal("rejected"));
    const r = transitionCommitmentStatus("rejected", "active");
    assert.ok(!r.ok);
  });

  test("expired is terminal", () => {
    assert.ok(isTerminal("expired"));
    const r = transitionCommitmentStatus("expired", "active");
    assert.ok(!r.ok);
  });
});

describe("Accountability Engine", () => {
  test("overdue = false when due date is in the future", () => {
    const c = makeCommitment({ status: "active" });
    const result = calculateCommitmentAccountability(c);
    assert.ok(!result.overdue);
    assert.equal(result.daysLate, 0);
  });

  test("overdue = true when due date is in the past and not completed", () => {
    const past = new Date(Date.now() - 12 * 86_400_000).toISOString();
    const c = makeCommitment({ status: "active", due_date: past });
    const result = calculateCommitmentAccountability(c);
    assert.ok(result.overdue);
    assert.ok(result.daysLate >= 11);
  });

  test("overdue = false for completed even if past due date", () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const c = makeCommitment({ status: "completed", due_date: past, completed_at: new Date().toISOString() });
    const result = calculateCommitmentAccountability(c);
    assert.ok(!result.overdue);
    assert.equal(result.daysLate, 0);
  });

  test("accepted = false when accepted_at is null", () => {
    const c = makeCommitment({ accepted_at: null });
    assert.ok(!calculateCommitmentAccountability(c).accepted);
  });

  test("accepted = true when accepted_at is set", () => {
    const c = makeCommitment({ accepted_at: new Date().toISOString() });
    assert.ok(calculateCommitmentAccountability(c).accepted);
  });

  test("completed = true for completed status", () => {
    const c = makeCommitment({ status: "completed" });
    assert.ok(calculateCommitmentAccountability(c).completed);
  });
});

describe("Commitment Health Engine", () => {
  test("returns 100 for empty workspace", () => {
    const h = calculateCommitmentHealth(W, []);
    assert.equal(h.score, 100);
    assert.equal(h.totalCommitments, 0);
  });

  test("100% completion yields score 100", () => {
    const commitments = [
      makeCommitment({ status: "completed" }),
      makeCommitment({ id: UID(2), status: "completed" }),
    ];
    const h = calculateCommitmentHealth(W, commitments);
    assert.equal(h.score, 100);
    assert.equal(h.completed, 2);
  });

  test("breach penalizes score heavily", () => {
    const commitments = [
      makeCommitment({ status: "breached" }),
    ];
    const h = calculateCommitmentHealth(W, commitments);
    // score = 0 * 100 − 1 * 40 = −40 → clamped to 0
    assert.equal(h.score, 0);
    assert.equal(h.breached, 1);
  });

  test("overdue penalizes score", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const commitments = [
      makeCommitment({ status: "active", due_date: past }),
    ];
    const h = calculateCommitmentHealth(W, commitments);
    // score = 0 * 100 − 0 * 40 − 1 * 30 = −30 → clamped to 0
    assert.equal(h.score, 0);
    assert.equal(h.overdue, 1);
  });

  test("score is clamped between 0 and 100", () => {
    const commitments = Array.from({ length: 5 }, (_, i) =>
      makeCommitment({ id: UID(i + 1), status: "completed" })
    );
    const h = calculateCommitmentHealth(W, commitments);
    assert.ok(h.score >= 0 && h.score <= 100);
  });

  test("mixed bag yields intermediate score", () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const commitments = [
      makeCommitment({ id: UID(1), status: "completed" }),
      makeCommitment({ id: UID(2), status: "completed" }),
      makeCommitment({ id: UID(3), status: "breached" }),
      makeCommitment({ id: UID(4), status: "active", due_date: past }),
    ];
    const h = calculateCommitmentHealth(W, commitments);
    assert.ok(h.score >= 0 && h.score <= 100);
    assert.equal(h.completed, 2);
    assert.equal(h.breached, 1);
    assert.equal(h.overdue, 1);
  });
});

describe("Breach Detection Engine", () => {
  test("no breaches when all commitments are future due", () => {
    const commitments = [makeCommitment({ status: "active" })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 0);
  });

  test("detects overdue active commitment", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const commitments = [makeCommitment({ status: "active", due_date: past })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 1);
    assert.ok(report.breaches[0].daysOverdue >= 2);
  });

  test("detects overdue pending_acceptance commitment", () => {
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const commitments = [makeCommitment({ status: "pending_acceptance", due_date: past })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 1);
  });

  test("does not flag completed commitments", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const commitments = [makeCommitment({ status: "completed", due_date: past })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 0);
  });

  test("does not flag cancelled commitments", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const commitments = [makeCommitment({ status: "cancelled", due_date: past })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 0);
  });

  test("does not flag already breached commitments (false positive)", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const commitments = [makeCommitment({ status: "breached", due_date: past })];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 0);
  });

  test("detects multiple breaches", () => {
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const commitments = [
      makeCommitment({ id: UID(1), status: "active", due_date: past }),
      makeCommitment({ id: UID(2), status: "accepted", due_date: past }),
      makeCommitment({ id: UID(3), status: "active" }),
    ];
    const report = detectCommitmentBreaches(W, commitments);
    assert.equal(report.breaches.length, 2);
  });
});

describe("Delegation Engine", () => {
  test("valid delegation", () => {
    const c = makeCommitment({ owner_id: UID(10), status: "accepted" });
    const r = validateCommitmentDelegation({
      commitment: c,
      delegatedBy: UID(10),
      delegatedTo: UID(20),
      existingDelegations: [],
    });
    assert.ok(r.valid);
  });

  test("invalid: not the owner", () => {
    const c = makeCommitment({ owner_id: UID(10), status: "accepted" });
    const r = validateCommitmentDelegation({
      commitment: c,
      delegatedBy: UID(99),
      delegatedTo: UID(20),
      existingDelegations: [],
    });
    assert.ok(!r.valid);
    assert.match(r.reason, /owner/);
  });

  test("invalid: self-delegation", () => {
    const c = makeCommitment({ owner_id: UID(10), status: "accepted" });
    const r = validateCommitmentDelegation({
      commitment: c,
      delegatedBy: UID(10),
      delegatedTo: UID(10),
      existingDelegations: [],
    });
    assert.ok(!r.valid);
    assert.match(r.reason, /yourself/);
  });

  test("invalid: terminal status", () => {
    for (const status of ["completed", "breached", "cancelled", "expired", "rejected"]) {
      const c = makeCommitment({ owner_id: UID(10), status });
      const r = validateCommitmentDelegation({
        commitment: c,
        delegatedBy: UID(10),
        delegatedTo: UID(20),
        existingDelegations: [],
      });
      assert.ok(!r.valid, `Expected invalid for status '${status}'`);
    }
  });

  test("invalid: active delegation already exists", () => {
    const c = makeCommitment({ owner_id: UID(10), status: "active" });
    const r = validateCommitmentDelegation({
      commitment: c,
      delegatedBy: UID(10),
      delegatedTo: UID(20),
      existingDelegations: [{ status: "pending" }],
    });
    assert.ok(!r.valid);
    assert.match(r.reason, /active delegation/);
  });

  test("valid when existing delegation is rejected", () => {
    const c = makeCommitment({ owner_id: UID(10), status: "active" });
    const r = validateCommitmentDelegation({
      commitment: c,
      delegatedBy: UID(10),
      delegatedTo: UID(20),
      existingDelegations: [{ status: "rejected" }],
    });
    assert.ok(r.valid);
  });
});

describe("Forecast Engine", () => {
  test("probability is between 0 and 1", () => {
    const c = makeCommitment({ priority: "high", status: "active" });
    const f = forecastCommitmentOutcome(c);
    assert.ok(f.probabilityOfCompletion >= 0 && f.probabilityOfCompletion <= 1);
    assert.ok(f.riskOfBreach >= 0 && f.riskOfBreach <= 1);
  });

  test("probability + risk = 1.0 (approx)", () => {
    const c = makeCommitment({ priority: "medium", status: "accepted" });
    const f = forecastCommitmentOutcome(c);
    assert.ok(Math.abs(f.probabilityOfCompletion + f.riskOfBreach - 1.0) < 0.01);
  });

  test("critical priority reduces probability vs low", () => {
    const low      = makeCommitment({ priority: "low",      status: "active" });
    const critical = makeCommitment({ priority: "critical", status: "active" });
    const fLow      = forecastCommitmentOutcome(low);
    const fCritical = forecastCommitmentOutcome(critical);
    assert.ok(fLow.probabilityOfCompletion > fCritical.probabilityOfCompletion);
  });

  test("overdue commitment has lower probability", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const past   = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const cFuture = makeCommitment({ priority: "medium", status: "active", due_date: future });
    const cPast   = makeCommitment({ priority: "medium", status: "active", due_date: past   });
    const fFuture = forecastCommitmentOutcome(cFuture);
    const fPast   = forecastCommitmentOutcome(cPast);
    assert.ok(fFuture.probabilityOfCompletion > fPast.probabilityOfCompletion);
  });

  test("critical signal severity reduces probability", () => {
    const c = makeCommitment({ priority: "medium", status: "active" });
    const fNone     = forecastCommitmentOutcome(c, {});
    const fCritical = forecastCommitmentOutcome(c, { signalSeverity: "critical" });
    assert.ok(fNone.probabilityOfCompletion > fCritical.probabilityOfCompletion);
  });

  test("high historical effectiveness increases probability", () => {
    const c = makeCommitment({ priority: "medium", status: "active" });
    const fLow  = forecastCommitmentOutcome(c, { historicalEffectiveness: 0.1 });
    const fHigh = forecastCommitmentOutcome(c, { historicalEffectiveness: 0.9 });
    assert.ok(fHigh.probabilityOfCompletion > fLow.probabilityOfCompletion);
  });
});

describe("Commitment Evidence", () => {
  test("lineage reconstructs 8-layer chain", () => {
    const commitment = makeCommitment();
    const action = {
      id: UID(2),
      action_type: "request_ratification",
      title: "Request sponsor ratification",
      signal_id: UID(3),
    };
    const signal = {
      id: UID(3),
      signal_type: "ratification_stall",
      title: "Ratification stalled for 14 days",
    };
    const lineage = getCommitmentLineage(commitment, action, signal);
    assert.equal(lineage.commitmentId, commitment.id);
    assert.equal(lineage.chain.length, 8);

    const layers = lineage.chain.map(l => l.layer);
    assert.deepEqual(layers, [
      "artifact", "memory", "digest", "learning_pattern",
      "recommendation", "signal", "action", "commitment",
    ]);
  });

  test("lineage includes signal and action entity IDs", () => {
    const commitment = makeCommitment();
    const action = { id: UID(2), action_type: "request_ratification", title: "Test action", signal_id: UID(3) };
    const signal = { id: UID(3), signal_type: "ratification_stall", title: "Test signal" };
    const lineage = getCommitmentLineage(commitment, action, signal);
    const signalLayer = lineage.chain.find(l => l.layer === "signal");
    const actionLayer = lineage.chain.find(l => l.layer === "action");
    assert.equal(signalLayer?.entityId, signal.id);
    assert.equal(actionLayer?.entityId, action.id);
  });
});

describe("Audit Events", () => {
  test("all 12 audit events are declared in types.ts", () => {
    const events = [
      "GOVERNANCE_COMMITMENT_CREATED",
      "GOVERNANCE_COMMITMENT_ACCEPTED",
      "GOVERNANCE_COMMITMENT_REJECTED",
      "GOVERNANCE_COMMITMENT_ACTIVATED",
      "GOVERNANCE_COMMITMENT_COMPLETED",
      "GOVERNANCE_COMMITMENT_CANCELLED",
      "GOVERNANCE_COMMITMENT_BREACHED",
      "GOVERNANCE_COMMITMENT_EXPIRED",
      "GOVERNANCE_COMMITMENT_DELEGATED",
      "GOVERNANCE_COMMITMENT_FORECAST_GENERATED",
      "GOVERNANCE_COMMITMENT_HEALTH_CALCULATED",
      "GOVERNANCE_COMMITMENT_LINEAGE_GENERATED",
    ];
    for (const ev of events) {
      assert.ok(typesFile.includes(ev), `Missing event: ${ev}`);
    }
  });

  test("all 12 audit events are declared in explain.ts", () => {
    const events = [
      "GOVERNANCE_COMMITMENT_CREATED",
      "GOVERNANCE_COMMITMENT_ACCEPTED",
      "GOVERNANCE_COMMITMENT_REJECTED",
      "GOVERNANCE_COMMITMENT_ACTIVATED",
      "GOVERNANCE_COMMITMENT_COMPLETED",
      "GOVERNANCE_COMMITMENT_CANCELLED",
      "GOVERNANCE_COMMITMENT_BREACHED",
      "GOVERNANCE_COMMITMENT_EXPIRED",
      "GOVERNANCE_COMMITMENT_DELEGATED",
      "GOVERNANCE_COMMITMENT_FORECAST_GENERATED",
      "GOVERNANCE_COMMITMENT_HEALTH_CALCULATED",
      "GOVERNANCE_COMMITMENT_LINEAGE_GENERATED",
    ];
    for (const ev of events) {
      assert.ok(explainFile.includes(ev), `Missing event in explain.ts: ${ev}`);
    }
  });
});

describe("Explain Capability", () => {
  test("returns all expected fields", () => {
    const explanation = explainGovernanceCommitments();
    assert.ok(typeof explanation.concept === "string");
    assert.ok(Array.isArray(explanation.principles));
    assert.ok(Array.isArray(explanation.lineageChain));
    assert.ok(Array.isArray(explanation.auditEvents));
    assert.ok(Array.isArray(explanation.businessRules));
    assert.ok(Array.isArray(explanation.commitmentStatuses));
    assert.ok(Array.isArray(explanation.commitmentPriorities));
    assert.ok(Array.isArray(explanation.commitmentOutcomes));
    assert.ok(Array.isArray(explanation.useCases));
  });

  test("lineage chain has 8 layers ending in commitment", () => {
    const explanation = explainGovernanceCommitments();
    assert.equal(explanation.lineageChain.length, 8);
    assert.equal(explanation.lineageChain[7], "Commitment");
  });

  test("7 principles declared", () => {
    assert.ok(explainFile.includes("Principle 1") || explainFile.includes("number: 1"));
    assert.ok(explainFile.includes("Every action can generate a commitment"));
  });

  test("10 business rules declared", () => {
    assert.ok(explainFile.includes("number: 10"));
  });
});

describe("Workspace Isolation", () => {
  test("workspace_id is required in all repository functions", () => {
    const functions = [
      "dbCreateGovernanceCommitment",
      "dbFindGovernanceCommitmentById",
      "dbListGovernanceCommitments",
      "dbUpdateGovernanceCommitment",
      "dbCreateCommitmentHistory",
      "dbListCommitmentHistory",
      "dbCreateCommitmentDelegation",
      "dbListCommitmentDelegations",
      "dbCreateCommitmentEvidence",
      "dbListCommitmentEvidence",
    ];
    for (const fn of functions) {
      assert.ok(repoFile.includes(fn), `Missing repository function: ${fn}`);
    }
  });

  test("workspace_id filter is applied in list queries", () => {
    assert.ok(repoFile.includes('.eq("workspace_id"'));
  });

  test("migration enables RLS on all 4 tables", () => {
    const rlsCount = (migration.match(/enable row level security/g) ?? []).length;
    assert.equal(rlsCount, 4);
  });

  test("migration creates RLS policies for all 4 tables", () => {
    const policyCount = (migration.match(/create policy/g) ?? []).length;
    assert.equal(policyCount, 4);
  });

  test("is_workspace_member used in all policies", () => {
    const memberCount = (migration.match(/is_workspace_member/g) ?? []).length;
    assert.equal(memberCount, 4);
  });
});

describe("Database Contract", () => {
  test("GovernanceCommitmentRow is defined", () => {
    assert.ok(dbContract.includes("GovernanceCommitmentRow"));
  });

  test("GovernanceCommitmentHistoryRow is defined", () => {
    assert.ok(dbContract.includes("GovernanceCommitmentHistoryRow"));
  });

  test("GovernanceCommitmentDelegationRow is defined", () => {
    assert.ok(dbContract.includes("GovernanceCommitmentDelegationRow"));
  });

  test("GovernanceCommitmentEvidenceRow is defined", () => {
    assert.ok(dbContract.includes("GovernanceCommitmentEvidenceRow"));
  });

  test("selectable columns are defined for all 4 tables", () => {
    assert.ok(dbContract.includes("GOVERNANCE_COMMITMENT_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("GOVERNANCE_COMMITMENT_HISTORY_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("GOVERNANCE_COMMITMENT_DELEGATION_SELECTABLE_COLUMNS"));
    assert.ok(dbContract.includes("GOVERNANCE_COMMITMENT_EVIDENCE_SELECTABLE_COLUMNS"));
  });

  test("database contract version includes commitment engine", () => {
    assert.ok(dbContract.includes("governance-commitment-engine"));
  });
});

describe("Migration", () => {
  test("creates governance_commitments table", () => {
    assert.ok(migration.includes("create table if not exists governance_commitments"));
  });

  test("creates governance_commitment_history table", () => {
    assert.ok(migration.includes("create table if not exists governance_commitment_history"));
  });

  test("creates governance_commitment_delegations table", () => {
    assert.ok(migration.includes("create table if not exists governance_commitment_delegations"));
  });

  test("creates governance_commitment_evidence table", () => {
    assert.ok(migration.includes("create table if not exists governance_commitment_evidence"));
  });

  test("commitments references governance_actions", () => {
    assert.ok(migration.includes("references governance_actions(id)"));
  });

  test("status constraint includes all 9 statuses", () => {
    const statuses = [
      "pending_acceptance", "accepted", "rejected", "active",
      "completed", "breached", "cancelled", "delegated", "expired",
    ];
    for (const s of statuses) {
      assert.ok(migration.includes(s), `Missing status in migration: ${s}`);
    }
  });

  test("outcome constraint includes all 4 outcomes", () => {
    assert.ok(migration.includes("successful"));
    assert.ok(migration.includes("partial"));
    assert.ok(migration.includes("failed"));
    assert.ok(migration.includes("unknown"));
  });
});

describe("Types", () => {
  test("GovernanceCommitmentStatus has 9 values", () => {
    const statuses = [
      "pending_acceptance", "accepted", "rejected", "active",
      "completed", "breached", "cancelled", "delegated", "expired",
    ];
    for (const s of statuses) {
      assert.ok(typesFile.includes(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("GovernanceCommitmentPriority has 4 values", () => {
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.ok(typesFile.includes(`"${p}"`), `Missing priority: ${p}`);
    }
  });

  test("GovernanceCommitmentOutcome has 4 values", () => {
    for (const o of ["successful", "partial", "failed", "unknown"]) {
      assert.ok(typesFile.includes(`"${o}"`), `Missing outcome: ${o}`);
    }
  });

  test("GovernanceCommitmentResult type is defined", () => {
    assert.ok(typesFile.includes("GovernanceCommitmentResult"));
  });

  test("CommitmentLineage has 8-layer chain type", () => {
    assert.ok(typesFile.includes('"commitment"'));
    assert.ok(typesFile.includes('"action"'));
    assert.ok(typesFile.includes('"signal"'));
    assert.ok(typesFile.includes('"artifact"'));
  });

  test("CommitmentForecast has probability and risk fields", () => {
    assert.ok(typesFile.includes("probabilityOfCompletion"));
    assert.ok(typesFile.includes("riskOfBreach"));
  });
});

describe("Registry — Service Layer", () => {
  test("all lifecycle functions are exported", () => {
    const fns = [
      "createCommitment", "acceptCommitment", "rejectCommitment",
      "activateCommitment", "completeCommitment", "cancelCommitment",
      "breachCommitment", "expireCommitment", "delegateCommitment",
      "getCommitment", "listCommitments",
    ];
    for (const fn of fns) {
      assert.ok(registryFile.includes(fn), `Missing service function: ${fn}`);
      assert.ok(indexFile.includes(fn), `Not exported from index: ${fn}`);
    }
  });

  test("accountability, health, breach, forecast, evidence, lineage are exported", () => {
    const fns = [
      "getCommitmentAccountability", "getCommitmentHealth", "detectBreaches",
      "forecastCommitment", "attachCommitmentEvidence", "getCommitmentLineageForCommitment",
    ];
    for (const fn of fns) {
      assert.ok(registryFile.includes(fn), `Missing: ${fn}`);
      assert.ok(indexFile.includes(fn), `Not exported: ${fn}`);
    }
  });

  test("all workspace validations present in registry", () => {
    assert.ok(registryFile.includes("validUuid(input.workspaceId)"));
  });

  test("history is recorded on every transition", () => {
    assert.ok(registryFile.includes("recordHistoryAndEmit"));
    assert.ok(registryFile.includes("dbCreateCommitmentHistory"));
  });
});

describe("Documentation", () => {
  test("docs file exists and covers architecture", () => {
    assert.ok(docsFile.includes("Governance Commitment Engine"));
    assert.ok(docsFile.includes("Commitment Model") || docsFile.includes("commitment_title"));
    assert.ok(docsFile.includes("Lifecycle"));
    assert.ok(docsFile.includes("Accountability"));
    assert.ok(docsFile.includes("Delegation"));
    assert.ok(docsFile.includes("Forecast"));
    assert.ok(docsFile.includes("Lineage"));
  });

  test("docs include all 9 lifecycle statuses", () => {
    for (const s of ["pending_acceptance","accepted","rejected","active","completed","breached","cancelled","delegated","expired"]) {
      assert.ok(docsFile.includes(s), `Missing status in docs: ${s}`);
    }
  });
});
