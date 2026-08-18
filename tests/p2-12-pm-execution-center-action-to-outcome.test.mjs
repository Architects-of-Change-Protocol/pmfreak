import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * P2-12 — PM Execution Center Action-to-Outcome and Accessibility Gate.
 *
 * The behavioural assertions below run the real P2-12 execution read model and the real Command
 * Center components (rendered through react-dom/server) via `tests/p2-12-execution-center-harness.tsx`.
 * Only assertions that depend on live browser interaction or on a module's dependency direction
 * fall back to reading source, and those are marked as such.
 *
 * P2-12 is integration: it must prove composition invariants, not re-prove P2-06/07/08/09/10.
 */

const harness = JSON.parse(
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "tests/p2-12-execution-center-harness.tsx"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim()
);

const readModel = readFileSync("src/modules/workspace/presentation/command-center/execution-read-model.ts", "utf8");
const panel = readFileSync("src/modules/workspace/presentation/command-center/execution-chain-panel.tsx", "utf8");
const operationalData = readFileSync("src/modules/workspace/presentation/command-center/operational-data.ts", "utf8");
const layout = readFileSync("src/modules/workspace/screens/command-center/command-center-layout.tsx", "utf8");
const service = readFileSync("src/lib/operational-flow/operational-flow-service.ts", "utf8");

const text = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── A. Canonical contract fidelity ───────────────────────────────────────────

test("P2-12 A1: eligibility mirrors the server contracts and invents no status", () => {
  assert.deepEqual(harness.contract.actionEligibleStatuses, ["accepted", "modified"]);
  assert.deepEqual(harness.contract.taskEligibleGovernanceStates, ["authorized", "not_required"]);
  assert.deepEqual(harness.contract.executionCommands, ["queue", "start", "block", "fail", "retry", "complete"]);
});

test("P2-12 A2: chain identity derives from the canonical Decision, never minted", () => {
  assert.equal(harness.decidedOnly.id, "governed-chain-dec-1");
});

test("P2-12 A3: non-terminal Decisions authorize nothing downstream", () => {
  // An escalation leaves the Recommendation open; it is not a governed execution chain.
  assert.equal(harness.escalated.chains, 0);
});

// ── B. Decision != Action ────────────────────────────────────────────────────

test("P2-12 B1: a recorded Decision does not create a Material Action", () => {
  assert.equal(harness.decidedOnly.action, null);
  assert.equal(harness.decidedOnly.actionStage.state, "not_started");
  // The stage is offered, but nothing exists until the PM explicitly requests it.
  assert.equal(harness.decidedOnly.actionStage.actionable, true);
});

test("P2-12 B2: the Action stage states plainly that it neither executes nor creates a Task", () => {
  assert.match(harness.decidedOnly.actionStage.effect, /does not execute anything and does not create a Task/i);
});

test("P2-12 B3: a rejected Decision cannot acquire a Material Action", () => {
  assert.equal(harness.rejected.chains, 1, "rejected chains stay visible rather than being hidden");
  assert.equal(harness.rejected.actionStage.actionable, false);
  assert.match(harness.rejected.actionStage.blockedReason, /rejected Decision does not authorize/i);
});

test("P2-12 B4: only the deciding actor may request that Decision's Action", () => {
  assert.equal(harness.foreignActor.actionStage.actionable, false);
  assert.match(harness.foreignActor.actionStage.blockedReason, /only the person who recorded this Decision/i);
});

test("P2-12 B5: a Decision without an evidence snapshot cannot produce an Action", () => {
  assert.equal(harness.noEvidenceLink.actionStage.actionable, false);
  assert.match(harness.noEvidenceLink.actionStage.blockedReason, /no linked evidence snapshot/i);
});

// ── C. Action != Task ────────────────────────────────────────────────────────

test("P2-12 C1: an Action that is not authorized cannot become work", () => {
  assert.equal(harness.requiresApproval.governanceState, "requires_approval");
  assert.equal(harness.requiresApproval.taskStage.actionable, false);
  assert.match(harness.requiresApproval.taskStage.blockedReason, /requires approval/i);
  assert.equal(harness.deniedAction.taskStage.actionable, false);
  assert.match(harness.deniedAction.taskStage.blockedReason, /denied/i);
});

test("P2-12 C2: an authorized Action still creates no Task by itself", () => {
  assert.equal(harness.authorized.task, null);
  assert.equal(harness.authorized.taskStage.state, "not_started");
  assert.equal(harness.authorized.taskStage.actionable, true);
});

test("P2-12 C3: authorization is not execution", () => {
  assert.equal(harness.authorized.canExecute, false);
});

test("P2-12 C4: a Task is attached only by the canonical sourceActionId link", () => {
  // A governed task belonging to another Action must never be adopted by this chain.
  assert.equal(harness.foreignTask.task, null);
  assert.equal(harness.foreignTask.executions, 0);
  // A non-governed task carries no governed link at all, even with a matching id inside.
  assert.equal(harness.ungovernedTask.task, null);
  assert.equal(harness.ungovernedTask.readSourceActionId, null);
});

// ── D. Task completion != Outcome achievement (the P2-12 invariant) ──────────

test("P2-12 D1: completed internal work does not achieve, create or observe an Outcome", () => {
  const boundary = harness.workDoneNoOutcome.boundary;
  assert.equal(boundary.executionCompleted, true);
  assert.equal(boundary.taskCompleted, true);
  assert.equal(boundary.outcomeExists, false);
  assert.equal(boundary.outcomeAchieved, false);
  assert.equal(boundary.observationCount, 0);
  assert.equal(boundary.completedWorkWithoutAchievedOutcome, true);
  assert.equal(harness.workDoneNoOutcome.outcome, null);
  assert.equal(harness.workDoneNoOutcome.observations, 0);
});

test("P2-12 D2: the surface says so in words, not by layout alone", () => {
  assert.match(
    harness.workDoneNoOutcome.boundary.statement,
    /Internal work completed\. No expected Outcome has been defined yet, so nothing has been achieved\./
  );
  assert.match(text(harness.rendered.workDoneNoOutcome), /No expected Outcome has been defined yet, so nothing has been achieved/i);
});

test("P2-12 D3: an Outcome that merely exists is not an achieved Outcome", () => {
  assert.equal(harness.workDoneOutcomeExpected.outcomeState, "expected");
  assert.equal(harness.workDoneOutcomeExpected.boundary.outcomeAchieved, false);
  assert.equal(harness.workDoneOutcomeExpected.boundary.completedWorkWithoutAchievedOutcome, true);
  assert.match(harness.workDoneOutcomeExpected.boundary.statement, /no evidence-backed Observation yet, so achievement is still unknown/i);
});

test("P2-12 D4: achievement is claimed only when the canonical Outcome itself says achieved", () => {
  assert.equal(harness.achieved.boundary.outcomeAchieved, true);
  assert.equal(harness.achieved.boundary.completedWorkWithoutAchievedOutcome, false);
});

test("P2-12 D5: defining an expected Outcome is not claiming it happened", () => {
  assert.match(harness.workDoneNoOutcome.outcomeStage.effect, /Defining it does not claim it happened/i);
});

// ── E. Outcome != Observation, evidence-backed ───────────────────────────────

test("P2-12 E1: an Observation cannot be recorded without an Outcome", () => {
  assert.equal(harness.workDoneNoOutcome.observationStage.actionable, false);
  assert.match(harness.workDoneNoOutcome.observationStage.blockedReason, /No expected Outcome exists to observe/i);
});

test("P2-12 E2: an Observation requires supporting evidence", () => {
  const rendered = text(harness.rendered.noEvidence);
  assert.match(rendered, /No live, provenance-bearing evidence is available for this project yet/i);
  // The Observation write always carries evidence references.
  assert.match(operationalData, /operation:\s*"record_outcome_observation"[\s\S]*evidenceReferenceIds:\s*operation\.evidenceReferenceIds/);
});

// ── F. Missing / disputed / inconclusive stay explicit ───────────────────────

test("P2-12 F1: an inconclusive Observation is never coerced into success", () => {
  assert.equal(harness.inconclusive.observationState, "inconclusive");
  assert.equal(harness.inconclusive.missingDataState, "PARTIAL");
  assert.equal(harness.inconclusive.boundary.outcomeAchieved, false);
  assert.match(harness.inconclusive.boundary.statement, /inconclusive/i);
  assert.match(text(harness.rendered.inconclusive), /inconclusive/i);
});

test("P2-12 F2: correlation is never promoted to causation", () => {
  assert.equal(harness.inconclusive.hasCorrelationOnly, true);
  assert.match(
    text(harness.rendered.inconclusive),
    /Some links are correlation only, so this chain does not establish causation/i
  );
});

test("P2-12 F3: lineage gaps are reported, never synthesised", () => {
  assert.deepEqual(harness.inconclusive.gaps, ["No raw input recorded for this chain"]);
  assert.equal(harness.inconclusive.missingStep, "No raw input recorded for this chain");
  assert.equal(harness.inconclusive.lineageStatus, "inconclusive");
  assert.match(text(harness.rendered.inconclusive), /No raw input recorded for this chain/i);
});

test("P2-12 F4: absent lineage is reported as absent rather than fabricated", () => {
  assert.equal(harness.decidedOnly.lineage, null);
  assert.equal(harness.workDoneNoOutcome.lineage, null);
  assert.equal(harness.workDoneNoOutcome.reviewStage.state, "not_started");
  assert.match(harness.workDoneNoOutcome.reviewStage.blockedReason, /becomes available once an expected Outcome exists/i);
});

// ── G. Authority is server-derived and fails closed ──────────────────────────

test("P2-12 G1: a read-only actor can advance nothing", () => {
  assert.equal(harness.viewer.anyActionable, false);
  for (const stage of harness.viewer.stages) {
    assert.equal(stage.actionable, false, `${stage.key} must not be actionable for a read-only actor`);
    assert.ok(stage.blockedReason, `${stage.key} must explain why in text`);
  }
});

test("P2-12 G2: the denial is conveyed as text, not colour", () => {
  assert.match(text(harness.rendered.viewer), /Your role cannot record governed operations in this project/i);
});

test("P2-12 G3: gating never infers authority from a client-side role name", () => {
  const code = stripComments(readModel);
  assert.doesNotMatch(code, /===\s*["'](pm|owner|admin|viewer)["']/);
  assert.doesNotMatch(stripComments(panel), /===\s*["'](pm|owner|admin|viewer)["']/);
  // It reads the server-provided capability instead.
  assert.match(code, /summary\.actor\?\.canCreateEvidence === true/);
});

// ── H. Scope: integration only, no second aggregate ──────────────────────────

test("P2-12 H1: no new aggregate, endpoint, migration or status is introduced", () => {
  const code = stripComments(readModel) + stripComments(panel) + stripComments(operationalData);
  assert.doesNotMatch(code, /crypto\.randomUUID\(\)\s*(as|,)?\s*(actionId|taskId|outcomeId|observationId|decisionId)/);
  // Canonical writes go to operations that already existed, each backed by a service
  // function P2-12 did not author.
  const reused = {
    propose_material_action: "proposeGovernedMaterialAction",
    dispatch_material_action_to_task: "dispatchGovernedMaterialActionToTask",
    ensure_expected_outcome: "ensureExpectedOutcome",
    record_outcome_observation: "recordOutcomeObservation",
  };
  for (const [operation, serviceFunction] of Object.entries(reused)) {
    assert.match(operationalData, new RegExp(`operation:\\s*"${operation}"`), `${operation} must be reused`);
    assert.match(service, new RegExp(`export async function ${serviceFunction}\\b`), `${serviceFunction} must already exist server-side`);
  }
});

/**
 * Resolves the merge-base against the first base ref this checkout actually has.
 *
 * `.github/workflows/ci-governance.yml` uses `actions/checkout@v4` with the default
 * fetch-depth, so CI runs against a shallow clone with no `origin/main` ref. These two
 * assertions are history-dependent by nature; where the history is absent they skip
 * honestly rather than failing on a ref the checkout never fetched. Everything they
 * guard is also covered without git by H1 (reuse) and by the staged-diff review (scope).
 */
function resolveBaseCommit() {
  for (const ref of ["origin/main", "main"]) {
    try {
      return execFileSync("git", ["merge-base", "HEAD", ref], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // ref not present in this checkout — try the next one
    }
  }
  return null;
}

test("P2-12 H4: the canonical operations predate P2-12 rather than being added by it", (t) => {
  // Reuse is proven against the branch point, so "integration" cannot quietly become
  // "new backend lifecycle".
  const base = resolveBaseCommit();
  if (!base) return t.skip("no base ref in this checkout (shallow CI clone); H1 covers reuse without git");
  const baseService = execFileSync("git", ["show", `${base}:src/lib/operational-flow/operational-flow-service.ts`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  for (const serviceFunction of [
    "proposeGovernedMaterialAction",
    "dispatchGovernedMaterialActionToTask",
    "ensureExpectedOutcome",
    "recordOutcomeObservation",
  ]) {
    assert.match(baseService, new RegExp(`export async function ${serviceFunction}\\b`), `${serviceFunction} must predate P2-12`);
  }
});

test("P2-12 H5: no migration and no new API route is introduced", (t) => {
  const base = resolveBaseCommit();
  if (!base) return t.skip("no base ref in this checkout (shallow CI clone); scope is enforced at staging review");
  const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(changed.filter((file) => file.startsWith("supabase/migrations/")), []);
  assert.deepEqual(changed.filter((file) => /^src\/app\/api\/.*route\.ts$/.test(file)), []);
});

test("P2-12 H2: the read model owns no records and stays framework-free", () => {
  assert.doesNotMatch(readModel, /from "react"/);
  assert.doesNotMatch(readModel, /useState|useEffect|fetch\(/);
});

test("P2-12 H3: canonical ids are rendered from persisted rows, never generated in the panel", () => {
  assert.doesNotMatch(stripComments(panel), /randomUUID|Math\.random/);
});

// ── L. Idempotency, correlation and epistemic honesty ────────────────────────

test("P2-12 L1: an Observation retry reconciles instead of creating a second one", () => {
  // P2-09 makes (workspace, project, idempotency_key) unique and replays identical
  // content as `existing`, so the key must be a function of content, not of time.
  assert.equal(harness.idempotency.stable, true, "identical submission => identical key");
  assert.equal(harness.idempotency.reorderedEvidence, true, "reordered evidence ids => identical key");
  assert.equal(harness.idempotency.whitespaceNormalised, true, "trimmed summary => identical key");
  assert.doesNotMatch(operationalData, /idempotencyKey:.*Date\.now\(\)/);
  assert.doesNotMatch(operationalData, /idempotencyKey:.*randomUUID/);
});

test("P2-12 L2: a genuinely different observation gets a different identity", () => {
  assert.equal(harness.idempotency.differsOnState, true);
  assert.equal(harness.idempotency.differsOnSummary, true);
  assert.equal(harness.idempotency.differsOnEvidence, true);
  assert.equal(harness.idempotency.differsOnOutcome, true);
});

test("P2-12 L1b: a later identical observation is a DISTINCT canonical event", () => {
  // Canonical Observations are a temporal stream: the same Outcome may legitimately be
  // observed twice with an identical state, summary and evidence set. Content-only
  // identity would collapse the second into the first and silently lose it.
  assert.equal(harness.idempotency.differsOnAttempt, true,
    "different submission attempt + identical content => different idempotency key");
});

test("P2-12 L1c: the attempt token survives failure and is cleared only on success", () => {
  const lifecycle = harness.idempotency.lifecycle;
  assert.equal(lifecycle.retryReusesAttempt, true, "a retry of the same submission reuses its token");
  assert.equal(lifecycle.retainedAfterFailure, true, "a failed submission retains its token");
  assert.equal(lifecycle.clearedAfterSuccess, null, "a server-accepted submission clears the token");
  assert.equal(lifecycle.nextSubmissionIsNew, true, "the next submission mints a fresh token");
  assert.equal(lifecycle.mintCount, 2, "exactly two tokens for two submissions across three begin() calls");
});

test("P2-12 L1d: a conflict does not rotate the attempt — it stays visible and fails closed", () => {
  // `succeed()` runs only after `onRun` resolves. A conflict is surfaced as a thrown
  // error (the route answers 409), so the token is retained rather than silently
  // rotating into a second write.
  assert.match(panel, /await onRun\(operation\);[\s\S]{0,400}attempt\.current\.succeed\(\)/);
  assert.match(panel, /catch \(caught\) \{[\s\S]{0,200}setError\(/);
  assert.doesNotMatch(panel, /catch[\s\S]{0,200}succeed\(\)/);
});

test("P2-12 L2b: the digest is a full, untruncated SHA-256 from the platform primitive", () => {
  // `canonical_outcome_observations.idempotency_key` is unbounded `text`, so the whole
  // hex digest is stored — no truncation, and no added dependency.
  assert.equal(harness.idempotency.knownAnswer, true, "sha256Hex must match the SHA-256 known answer for 'abc'");
  assert.match(harness.idempotency.digest, /^[0-9a-f]{64}$/, "a full 64-hex-character digest");
  assert.match(harness.idempotency.sample, /^p2-12:observation:out-1:[0-9a-f]{64}$/);
  assert.match(readModel, /crypto\.subtle\.digest\("SHA-256"/);
  // FNV-1a is gone; it is not collision-resistant enough for a durable canonical identity.
  assert.doesNotMatch(readModel, /0x811c9dc5|FNV/i);
});

test("P2-12 L2c: the hashed payload is canonically and unambiguously serialized", () => {
  // A JSON array, so a summary containing the delimiter cannot collide with a different
  // submission, and evidence is compared as a set rather than a sequence. The attempt
  // token is the final element; `observedAt` is deliberately absent — it is the fact
  // being recorded, and including it would break retry stability.
  assert.equal(
    harness.idempotency.canonicalPayload,
    '["out-1","inconclusive","The client replied.",["ev-1","ev-2"],"attempt-A"]'
  );
  assert.doesNotMatch(readModel, /observedAt[\s\S]{0,80}canonicalObservationPayload/);
});

test("P2-12 L3: Outcome and Observation reuse the chain's persisted correlation", () => {
  assert.equal(harness.correlation.actionCorrelationId, "corr-1");
  // No stage mints a fresh correlation id.
  assert.doesNotMatch(stripComments(operationalData), /correlationId:\s*crypto\.randomUUID\(\)/);
  assert.match(operationalData, /correlationId:\s*operation\.correlationId/);
  // It is read from the persisted Action, which P2-08 also copies onto the Execution.
  assert.match(panel, /chain\.action\?\.correlationId/);
});

test("P2-12 L4: observation confidence and missing-data are supplied, never assumed", () => {
  assert.doesNotMatch(operationalData, /confidenceScore:\s*1\b/);
  assert.doesNotMatch(operationalData, /missingDataState:\s*"COMPLETE"/);
  assert.match(operationalData, /confidenceScore:\s*operation\.quality\.confidenceScore/);
  assert.match(operationalData, /missingDataState:\s*operation\.quality\.missingDataState/);
  assert.deepEqual(harness.contract.missingDataStates, ["COMPLETE", "PARTIAL", "UNKNOWN"]);
  const rendered = text(harness.rendered.inconclusive);
  assert.match(rendered, /How confident is this observation\? 0 to 1 \(required\)/i);
  assert.match(rendered, /Was any needed data missing\? \(required\)/i);
  assert.match(rendered, /needs a summary, supporting evidence, a confidence value and a missing-data state/i);
});

test("P2-12 L4b: only evidence P2-09 accepts is offered as the basis of an Observation", () => {
  // The RPC refuses anything that is not canonical, provenance-bearing LIVE evidence
  // (`observation_evidence_scope_invalid`), so offering it would be a control that always fails.
  const e = harness.evidenceEligibility;
  assert.equal(e.live, true);
  assert.equal(e.fixture, false, "demo fixture evidence cannot promote an outcome");
  assert.equal(e.noProvenance, false);
  assert.equal(e.degraded, false);
  assert.equal(e.rejected, false);
  assert.equal(e.stale, false);
  assert.equal(e.notCurrent, false);
  assert.equal(e.notRecorded, false);
  assert.equal(e.unevaluated, false);
  assert.match(operationalData, /filter\(\(row\) => isObservationEligibleEvidence\(row\)\)/);
});

test("P2-12 L4c: when no eligible evidence exists the surface says so", () => {
  assert.match(
    text(harness.rendered.noEvidence),
    /No live, provenance-bearing evidence is available for this project yet/i
  );
  assert.match(text(harness.rendered.noEvidence), /Demo or fixture evidence cannot promote an outcome/i);
});

test("P2-12 L5: material action classification is supplied by the human, not invented", () => {
  // materiality — and therefore the governance state — derives from these four, so none
  // may be hardcoded on the PM's behalf.
  for (const field of ["actionClass", "risk", "reversibility", "sideEffect"]) {
    assert.match(operationalData, new RegExp(`${field}:\\s*operation\\.draft\\.${field}`), `${field} must come from the human`);
  }
  assert.doesNotMatch(operationalData, /actionClass:\s*"external_write"/);
  assert.doesNotMatch(operationalData, /risk:\s*"high"/);
  assert.doesNotMatch(operationalData, /targetResourceType:\s*"project_schedule"/);
  assert.deepEqual(harness.contract.materialActionClasses, [
    "ordinary_business_write",
    "external_write",
    "authority_mutation",
    "material_agent_action",
    "knowledge_elevation",
    "policy_classified",
  ]);
  assert.deepEqual(harness.contract.materialActionRisks, ["low", "medium", "high", "critical", "unknown"]);
});

test("P2-12 L6: the remaining action fields have an honest source", () => {
  // The Decision's own recorded rationale justifies acting.
  assert.match(operationalData, /justification:\s*operation\.justification/);
  assert.match(panel, /justification: chain\.rationale/);
  // Factual rather than assumed: P2-06 persists an inert authorization scoped to this project.
  assert.match(operationalData, /intendedOperation:\s*"propose_only"/);
  assert.match(operationalData, /targetResourceType:\s*"project"/);
  assert.match(operationalData, /targetResourceId:\s*projectId/);
});

test("P2-12 L7: the action stage says governance depends on the human's answers", () => {
  assert.match(
    text(harness.rendered.decidedOnlyActionForm),
    /Governance classifies this action from what you state below/i
  );
});

// ── I. Persistence and reconciliation ────────────────────────────────────────

test("P2-12 I1: every stage awaits the server write before revalidating", () => {
  assert.match(layout, /await runExecutionOperation\([\s\S]{0,120}\);\s*await mutateFlow\(\);/);
});

test("P2-12 I2: a denied execution disposition is treated as failure, not success", () => {
  assert.match(operationalData, /disposition === "denied" \|\| result\.disposition === "conflict"/);
});

test("P2-12 I3: retrying a Material Action reconciles instead of duplicating", () => {
  // Deterministic per Decision, so P2-06 idempotency resolves a retry to the same Action.
  assert.match(operationalData, /idempotencyKey:\s*`p2-12:material-action:\$\{operation\.decisionId\}`/);
});

test("P2-12 I4: the open drawer is resolved fresh so it reconciles after each write", () => {
  assert.match(layout, /executionChains\.find\(\(entry\) => entry\.decisionId === openChainId\)/);
});

// ── J. Surface composition ───────────────────────────────────────────────────

test("P2-12 J1: the continuation is reachable from the Command Center at every breakpoint", () => {
  // Rendered in the desktop rail and inside the mobile overlay, so it never becomes unreachable.
  const occurrences = layout.match(/<ExecutionQueue/g) ?? [];
  assert.equal(occurrences.length, 2);
});

test("P2-12 J2: the queue reports real stage progress and an honest empty state", () => {
  const populated = text(harness.rendered.queuePopulated);
  assert.match(populated, /After Your Decision/i);
  assert.match(populated, /Work completed — no expected outcome yet/i);
  assert.match(populated, /In progress/i);
  assert.doesNotMatch(populated, /Outcome achieved/i);
  assert.match(text(harness.rendered.queueEmpty), /Nothing has been decided yet/i);
});

test("P2-12 J3: chain lookup is scoped to this project's persisted decisions", () => {
  assert.equal(harness.lookup.found, true);
  assert.equal(harness.lookup.foreign, false);
});

// ── K. Accessibility semantics ───────────────────────────────────────────────

test("P2-12 K1: stage controls carry labels, status and alert semantics", () => {
  assert.match(panel, /role="status"\s+aria-live="polite"/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /<label htmlFor=\{expectedId\}/);
  assert.match(panel, /<label htmlFor=\{summaryId\}/);
  assert.match(panel, /<label htmlFor=\{stateId\}/);
  assert.match(panel, /aria-labelledby=\{headingId\}/);
});

test("P2-12 K2: stage state is available as text, not colour alone", () => {
  const rendered = text(harness.rendered.workDoneNoOutcome);
  for (const label of ["Governed material action", "Canonical internal task", "Internal execution", "Expected outcome"]) {
    assert.match(rendered, new RegExp(label, "i"));
  }
  assert.match(rendered, /Not started|Recorded|Complete/);
});

test("P2-12 K3: required input is explained rather than silently disabling the control", () => {
  assert.match(text(harness.rendered.workDoneNoOutcome), /Describe the expected outcome to continue/i);
});
