/**
 * Behavioral contract tests for the Command Center activation sequence
 * (the cinematic state machine layered around the "Activate Command Center"
 * button). Static-analysis tests — same style as create-pmo-flow.test.mjs —
 * verifying: initialization never starts before persistence is confirmed,
 * the agent roster shown is always the real user-selected one, no fabricated
 * metrics leak into the sequence, and the timeout overlay never cancels the
 * underlying request.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ACTIVATION_DIR = "src/components/pmfreak/activation/command-center-activation";

const wizard = readFileSync(join(ROOT, "src/components/pmfreak/pmo/create-pmo-wizard.tsx"), "utf8");
const hook = readFileSync(join(ROOT, ACTIVATION_DIR, "use-command-center-activation.ts"), "utf8");
const sequence = readFileSync(join(ROOT, ACTIVATION_DIR, "CommandCenterActivationSequence.tsx"), "utf8");
const timerSource = readFileSync(join(ROOT, ACTIVATION_DIR, "timer-progress-source.ts"), "utf8");
const config = readFileSync(join(ROOT, ACTIVATION_DIR, "activation-sequence-config.ts"), "utf8");
const transitionOverlay = readFileSync(join(ROOT, ACTIVATION_DIR, "TransitionOverlay.tsx"), "utf8");
const timeoutState = readFileSync(join(ROOT, ACTIVATION_DIR, "ActivationTimeoutState.tsx"), "utf8");
const types = readFileSync(join(ROOT, ACTIVATION_DIR, "types.ts"), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 1: Estado 1 (click received) is immediate, before the network call
// ─────────────────────────────────────────────────────────────────────────────

test("activation.markStarted() runs before setCreating(true)", () => {
  const startedIdx = wizard.indexOf("activation.markStarted()");
  const setCreatingIdx = wizard.indexOf("setCreating(true)");
  assert.ok(startedIdx > 0, "markStarted() call must exist");
  assert.ok(startedIdx < setCreatingIdx, "markStarted() must run before setCreating(true)");
});

test("activation.markRequestSent() runs before the server action is awaited", () => {
  const sentIdx = wizard.indexOf("activation.markRequestSent()");
  const saveIdx = wizard.indexOf("await savePmoTenant(tenant)");
  assert.ok(sentIdx > 0, "markRequestSent() call must exist");
  assert.ok(sentIdx < saveIdx, "markRequestSent() must run before awaiting savePmoTenant");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 2: initialization never starts before persistence is confirmed
// ─────────────────────────────────────────────────────────────────────────────

test("runInitializationSequence is only called after the success guard", () => {
  const guardIdx = wizard.indexOf('result.status !== "success"');
  const initIdx = wizard.indexOf("activation.runInitializationSequence(");
  assert.ok(guardIdx > 0, "success guard must exist");
  assert.ok(initIdx > guardIdx, "initialization must be triggered after the success guard");
});

test("wizard still redirects to /pmo/invite-team exactly once, after savePmoTenant", () => {
  const saveIdx = wizard.indexOf("await savePmoTenant(tenant)");
  const pushIdx = wizard.indexOf('router.push("/pmo/invite-team")');
  assert.ok(saveIdx > 0 && pushIdx > saveIdx, "redirect must come after savePmoTenant");
  const allPushes = [...wizard.matchAll(/router\.push\("\/pmo\/invite-team"\)/g)];
  assert.equal(allPushes.length, 1, "redirect to invite-team must appear exactly once");
});

test("failure branch hands control back to the existing error UI via activation.reset()", () => {
  const guardStart = wizard.indexOf('result.status !== "success"');
  const guardEnd = wizard.indexOf("// Persistence confirmed");
  assert.ok(guardStart > 0 && guardEnd > guardStart, "failure branch boundaries must be identifiable");
  const failureBranch = wizard.slice(guardStart, guardEnd);
  assert.match(failureBranch, /activation\.reset\(\)/, "failure branch must reset the activation overlay");
  assert.match(failureBranch, /setCreating\(false\)/, "existing creating=false contract must be untouched");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 3: the agent roster is always the real, user-selected one
// ─────────────────────────────────────────────────────────────────────────────

test("initialization sequence is fed the real enabled-agents list, not a fixed roster", () => {
  assert.match(
    wizard,
    /activation\.runInitializationSequence\(agents\.filter\(\(a\) => a\.enabled\)\.map\(\(a\) => a\.agentId\)\)/,
    "must derive the agent list from wizard state, filtered by enabled"
  );
});

test("CommandCenterActivationSequence does not hardcode a fixed agent roster", () => {
  assert.doesNotMatch(
    sequence,
    /"scope"\s*,\s*"timeline"\s*,\s*"cost"/,
    "the sequence component must not hardcode the agent id list — it must receive enabledAgentIds as a prop"
  );
});

test("AgentActivationList renders only agents passed in via props", () => {
  const agentList = readFileSync(join(ROOT, ACTIVATION_DIR, "AgentActivationList.tsx"), "utf8");
  assert.match(agentList, /enabledAgentIds\.map/, "must iterate the enabledAgentIds prop");
  assert.doesNotMatch(
    agentList,
    /DEFAULT_AGENT_STATES/,
    "must not fall back to the default agent roster — only real enabled agents"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 4: zero-fabrication — no invented risk/signal/initiative counts
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_FABRICATIONS = [
  /Risks? Detected/i,
  /Opportunities Identified/i,
  /Active Signals/i,
  /initiatives detected/i,
  /Knowledge Objects Indexed/i,
];

// Stage copy must describe real setup/configuration operations, never analysis
// or synthesis that isn't actually happening in those seconds.
const FORBIDDEN_ANALYSIS_LANGUAGE = [
  /Building Operational Graph/,
  /Generating Executive Picture/,
  /Analyzing/i,
  /Intelligence Network/,
];

test("no fabricated metrics appear in the transition overlay", () => {
  for (const pattern of FORBIDDEN_FABRICATIONS) {
    assert.doesNotMatch(transitionOverlay, pattern, `TransitionOverlay must not contain fabricated metric: ${pattern}`);
  }
});

test("no fabricated metrics appear anywhere in the activation module", () => {
  for (const source of [sequence, config, hook, timerSource]) {
    for (const pattern of FORBIDDEN_FABRICATIONS) {
      assert.doesNotMatch(source, pattern, `must not contain fabricated metric: ${pattern}`);
    }
  }
});

test("stage copy describes real setup operations, never live analysis/synthesis", () => {
  for (const source of [config, sequence, transitionOverlay]) {
    for (const pattern of FORBIDDEN_ANALYSIS_LANGUAGE) {
      assert.doesNotMatch(source, pattern, `must not imply live analysis: ${pattern}`);
    }
  }
});

test("ready-state counts are derived from real wizard props, not literals", () => {
  assert.match(transitionOverlay, /enabledAgentCount/, "agent count must come from a prop");
  assert.match(transitionOverlay, /deliveryChallengeCount/, "challenge count must come from a prop");
  assert.match(transitionOverlay, /hasContextSeed/, "context-seed presence must come from a prop");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 5: timeout never cancels the underlying request
// ─────────────────────────────────────────────────────────────────────────────

test("keepWaiting only dismisses the timeout flag, it does not touch status", () => {
  const fnMatch = hook.match(/const keepWaiting = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/);
  assert.ok(fnMatch, "keepWaiting implementation must exist");
  assert.doesNotMatch(fnMatch[1], /status:\s*"/, "keepWaiting must not change status — only clear timedOut");
  assert.match(fnMatch[1], /timedOut:\s*false/, "keepWaiting must clear the timedOut flag");
});

test("ActivationTimeoutState does not abort or cancel the in-flight request", () => {
  assert.doesNotMatch(timeoutState, /\.abort\(/, "timeout UI must never abort the underlying request");
  assert.match(timeoutState, /Keep Waiting/, "must offer Keep Waiting");
  assert.match(timeoutState, /Retry/, "must offer Retry");
});

test("timeout is a flag layered on request_sent, not a new terminal status", () => {
  assert.doesNotMatch(types, /"timeout"/, "timeout must not be modeled as its own ActivationStatus value");
  assert.match(types, /timedOut:\s*boolean/, "timedOut must be a boolean flag on ActivationState");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 6: configuration lives in one place, not scattered magic numbers
// ─────────────────────────────────────────────────────────────────────────────

test("stage timing/copy is defined in activation-sequence-config.ts", () => {
  assert.match(config, /export const INITIALIZATION_STAGES/, "stages must be declared in the config module");
  assert.match(config, /durationMs/, "each stage must declare a configurable duration");
  assert.match(config, /enabled:\s*true/, "each stage must declare an enabled flag");
});

test("the hook imports its timing constants from config instead of hardcoding them", () => {
  assert.match(
    hook,
    /import \{ CREATED_CONFIRMATION_DURATION_MS, DEFAULT_TIMEOUT_MS \} from "\.\/activation-sequence-config"/,
    "hook must source durations from the config module"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 7: pluggable progress source (future SSE/WebSocket readiness)
// ─────────────────────────────────────────────────────────────────────────────

test("ProgressSource is an abstraction, not hardwired to timers in the hook", () => {
  assert.match(hook, /createProgressSource\s*\?\?\s*createTimerProgressSource/, "hook must accept a pluggable progress source, defaulting to timers");
});

test("timer-progress-source documents itself as the swappable default", () => {
  assert.match(timerSource, /SSE|WebSocket/, "must document the real-time extension point");
});
