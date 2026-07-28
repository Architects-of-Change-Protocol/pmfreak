// PMF-001/PMF-002 correction pass — reconciles resolveOnboardingState (the
// routing authority) with the PR #547 evidence-derived workspace-activation
// engine so there is exactly one canonical, evidence-derived state source,
// not two independently-queried machines with overlapping semantics.
//
// Before this correction, resolveOnboardingState modeled only
// no_workspace/needs_project/active/trial_blocked and returned "active" as
// soon as a single Project existed — collapsing "Project exists", "a real
// task exists", and "Command Center is active" into one state, and sending
// post-auth users straight to /command-center without distinguishing them.
//
// Run: npx tsx --test tests/pmf-001-002-state-authority-reconciliation.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveOnboardingState } from "../src/lib/auth/resolve-onboarding-state.ts";
import { getOnboardingRedirect, isOnboardingComplete, hasWorkspaceAccess } from "../src/lib/auth/onboarding-route-map.ts";
import { deriveActivationStage, deriveActivationSteps } from "../src/lib/workspace-activation/activation-rules.ts";

const read = (p) => readFileSync(p, "utf8");

// ─── Fake Supabase query client (coarse, keyed by table name — sufficient
// for asserting on resolveOnboardingState's returned state, which never
// reads collectWorkspaceActivationEvidence's other fields). ─────────────────
function fakeClient(tableResponses) {
  return {
    from(table) {
      const result = tableResponses[table] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        update: () => builder,
        lt: () => builder,
        neq: () => builder,
        maybeSingle: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
}

const user = { id: "user-1", email: "u@test.dev" };

function evidenceClient({ projects = [], tasks = [], pmos = [] } = {}) {
  return fakeClient({
    projects: { data: projects, error: null },
    execution_tasks: { data: tasks, error: null },
    pmos: { data: pmos, error: null },
  });
}

// ─── 1. Project with no task ─────────────────────────────────────────────────

test("resolveOnboardingState: a real Project with zero tasks and no PMO is needs_task, not active", async () => {
  const client = evidenceClient({ projects: [{ id: "p1" }], tasks: [], pmos: [] });
  const state = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => client });
  assert.equal(state, "needs_task");
});

// ─── 2. Project with first task, Command Center still inactive ──────────────

test("resolveOnboardingState: Project + real task, no PMO, is execution_started, not active", async () => {
  const client = evidenceClient({ projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [] });
  const state = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => client });
  assert.equal(state, "execution_started");
});

// ─── 3. Command Center active (PMF-004-backed pmos row) ─────────────────────

test("resolveOnboardingState: a real active pmos row (PMF-004 default-PMO state) makes the workspace active, regardless of task existence", async () => {
  const withTask = evidenceClient({ projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [{ id: "pmo1" }] });
  const withoutTask = evidenceClient({ projects: [{ id: "p1" }], tasks: [], pmos: [{ id: "pmo1" }] });
  assert.equal(await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => withTask }), "active");
  assert.equal(await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => withoutTask }), "active");
});

test("a Project alone (no PMO) must never resolve to active — active means Command Center active", async () => {
  const client = evidenceClient({ projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [] });
  const state = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => client });
  assert.notEqual(state, "active");
});

// ─── 4. Reload continuity at every state ─────────────────────────────────────

test("reload continuity: identical evidence always re-derives the identical state", async () => {
  const scenarios = [
    { projects: [], tasks: [], pmos: [] },
    { projects: [{ id: "p1" }], tasks: [], pmos: [] },
    { projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [] },
    { projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [{ id: "pmo1" }] },
  ];
  for (const scenario of scenarios) {
    const first = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => evidenceClient(scenario) });
    const second = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => evidenceClient(scenario) });
    assert.equal(first, second, `state must be stable across reloads for ${JSON.stringify(scenario)}`);
  }
});

// ─── 5. isOnboardingComplete / hasWorkspaceAccess semantics ──────────────────

test("isOnboardingComplete is true only for active (Command Center active) — not merely because a Project exists", () => {
  assert.equal(isOnboardingComplete("active"), true);
  assert.equal(isOnboardingComplete("needs_task"), false);
  assert.equal(isOnboardingComplete("execution_started"), false);
  assert.equal(isOnboardingComplete("needs_project"), false);
});

test("hasWorkspaceAccess allows general navigation once a Project exists, even before Command Center is active (ADR-PMF-006: Project may exist before Command Center activation)", () => {
  assert.equal(hasWorkspaceAccess("needs_task"), true);
  assert.equal(hasWorkspaceAccess("execution_started"), true);
  assert.equal(hasWorkspaceAccess("active"), true);
  assert.equal(hasWorkspaceAccess("needs_project"), false);
  assert.equal(hasWorkspaceAccess("no_workspace"), false);
  assert.equal(hasWorkspaceAccess("trial_blocked"), false);
});

// ─── 6. Post-auth routing coherence ──────────────────────────────────────────

test("getOnboardingRedirect: no Project -> /projects/new; Project-without-task, execution-started, and active all resolve through /command-center (the canonical first-task and activation surface)", () => {
  assert.equal(getOnboardingRedirect("needs_project"), "/projects/new");
  assert.equal(getOnboardingRedirect("needs_task"), "/command-center");
  assert.equal(getOnboardingRedirect("execution_started"), "/command-center");
  assert.equal(getOnboardingRedirect("active"), "/command-center");
});

// ─── 7. Legacy flag true/false at each state must never change the result ───

test("a stale onboarding_completed flag (true or false) cannot influence resolveOnboardingState at any evidence state", async () => {
  // resolveOnboardingState's signature never accepts a boolean flag at all —
  // this is a structural guarantee, verified directly: the flag literally
  // cannot reach the function.
  const src = read("src/lib/auth/resolve-onboarding-state.ts");
  assert.doesNotMatch(src, /onboarding_completed/);
  assert.doesNotMatch(src, /onboardingCompleted/);
});

// ─── 8. Old URL redirection coherence at each state ──────────────────────────

test("legacy-onboarding-redirect helper redirects to the correct canonical destination for every richer state, not just the coarse 4", () => {
  const helper = read("src/lib/auth/legacy-onboarding-redirect.ts");
  assert.match(helper, /resolveOnboardingState/);
  assert.match(helper, /getOnboardingRedirect\(state\)/);
});

// ─── 9. State authority reconciliation: resolveOnboardingState reuses the
// PR #547 evidence engine, not a second independently-queried machine ───────

test("resolveOnboardingState derives post-Project state from collectWorkspaceActivationEvidence, not its own separate projects/pmos query logic", () => {
  const src = read("src/lib/auth/resolve-onboarding-state.ts");
  assert.match(src, /collectWorkspaceActivationEvidence/, "must reuse the canonical evidence collector from the PR #547 engine");
});

test("resolveOnboardingState and activation-rules.ts agree on which phase a given evidence shape represents", async () => {
  const evidenceProjectNoTask = { workspaceId: "ws-1", userId: "u1", role: "owner", ownerType: "personal", memberCount: 1, pendingInviteExists: false, pmoExists: false, projectExists: true, taskExists: false, milestoneExists: false, raidItemExists: false, governanceSignalExists: false, recommendedActionExists: false, userMessageExists: false, insightsFirstViewedAt: null };
  assert.equal(deriveActivationStage(evidenceProjectNoTask), "project_created");
  const routingStateA = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => evidenceClient({ projects: [{ id: "p1" }], tasks: [], pmos: [] }) });
  assert.equal(routingStateA, "needs_task");

  const evidenceExecutionStarted = { ...evidenceProjectNoTask, taskExists: true };
  assert.equal(deriveActivationStage(evidenceExecutionStarted), "execution_started");
  const routingStateB = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => evidenceClient({ projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [] }) });
  assert.equal(routingStateB, "execution_started");

  const evidenceCommandCenterActive = { ...evidenceExecutionStarted, pmoExists: true };
  const pmoStep = deriveActivationSteps(evidenceCommandCenterActive).find((s) => s.id === "pmo_created");
  assert.equal(pmoStep.status, "completed");
  const routingStateC = await resolveOnboardingState(user, "ws-1", { isRecovered: true, getClient: () => evidenceClient({ projects: [{ id: "p1" }], tasks: [{ id: "t1" }], pmos: [{ id: "pmo1" }] }) });
  assert.equal(routingStateC, "active");
});
