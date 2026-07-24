/**
 * Behavioral contract tests for the Command Center activation lifecycle.
 *
 * Static-analysis style, matching create-pmo-flow.test.mjs.
 *
 * These replace the previous suite, which pinned a simulated lifecycle:
 * created -> initializing -> ready driven by setTimeout, per-stage
 * provisioning copy, an agent-activation roster, and a "Keep Waiting" button.
 * None of that corresponded to real backend work — savePmoTenant is a single
 * synchronous server action with no queue, worker, or persisted operation — and
 * the fake sequence concealed a real hang: a rejected save left the UI pinned
 * on "Creating Command Center..." forever.
 *
 * The real lifecycle is: idle -> submitting -> success | failure.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ACTIVATION_DIR = "src/components/pmfreak/activation/command-center-activation";

const wizard = readFileSync(join(ROOT, "src/components/pmfreak/pmo/create-pmo-wizard.tsx"), "utf8");
const hook = readFileSync(join(ROOT, ACTIVATION_DIR, "use-command-center-activation.ts"), "utf8");
const sequence = readFileSync(join(ROOT, ACTIVATION_DIR, "CommandCenterActivationSequence.tsx"), "utf8");
const config = readFileSync(join(ROOT, ACTIVATION_DIR, "activation-sequence-config.ts"), "utf8");
const failureState = readFileSync(join(ROOT, ACTIVATION_DIR, "ActivationFailureState.tsx"), "utf8");
const transitionOverlay = readFileSync(join(ROOT, ACTIVATION_DIR, "TransitionOverlay.tsx"), "utf8");
const types = readFileSync(join(ROOT, ACTIVATION_DIR, "types.ts"), "utf8");

const ACTIVATION_SOURCES = [hook, sequence, config, failureState, transitionOverlay, types].join("\n");

// Strips // line comments and /* */ block comments so the forbidden-pattern
// checks below match executable code, not the explanatory comments that
// document what was deliberately removed (this codebase writes a lot of those).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const ACTIVATION_CODE = stripComments(ACTIVATION_SOURCES);
const WIZARD_CODE = stripComments(wizard);
const FAILURE_STATE_CODE = stripComments(failureState);
const TRANSITION_OVERLAY_CODE = stripComments(transitionOverlay);
const TYPES_CODE = stripComments(types);


// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 1: the simulated lifecycle is gone, not relabelled
// ─────────────────────────────────────────────────────────────────────────────

test("the simulated-progress modules no longer exist", () => {
  for (const file of ["timer-progress-source.ts", "AgentActivationList.tsx", "InitializationStage.tsx", "ActivationTimeoutState.tsx"]) {
    assert.equal(existsSync(join(ROOT, ACTIVATION_DIR, file)), false, `${file} must be deleted, not retained`);
  }
});

test("no simulated progress driver survives anywhere in the activation module", () => {
  for (const banned of ["ProgressSource", "createTimerProgressSource", "stage-start", "sequence-complete", "agentStatuses", "INITIALIZATION_STAGES"]) {
    assert.ok(!ACTIVATION_CODE.includes(banned), `${banned} belongs to the removed simulated sequence`);
  }
});

test("no copy claims provisioning, initialization, or memory preparation that does not happen", () => {
  for (const claim of ["Provisioning", "Preparing Memory", "Activating Governance Agents", "Reading Context Seed", "Registering Delivery Configuration"]) {
    assert.ok(!ACTIVATION_CODE.includes(claim), `copy "${claim}" describes work no backend operation performs`);
  }
});

test("Keep Waiting is gone — there is no async operation to keep observing", () => {
  assert.ok(!ACTIVATION_CODE.includes("Keep Waiting"), "Keep Waiting must not exist");
  assert.ok(!ACTIVATION_CODE.includes("keepWaiting"), "keepWaiting handler must not exist");
  assert.ok(!WIZARD_CODE.includes("onKeepWaiting"), "the wizard must not pass onKeepWaiting");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 2: the state machine models only real states
// ─────────────────────────────────────────────────────────────────────────────

test("ActivationStatus is exactly idle | submitting | success | failure", () => {
  for (const status of ['"idle"', '"submitting"', '"success"', '"failure"']) {
    assert.ok(types.includes(status), `${status} must be part of ActivationStatus`);
  }
  for (const removed of ['"activation_started"', '"request_sent"', '"created"', '"initializing"', '"ready"']) {
    assert.ok(!TYPES_CODE.includes(removed), `${removed} modelled a state with no real backend counterpart`);
  }
});

test("the timedOut flag is gone — a timeout now produces a terminal failure", () => {
  assert.ok(!TYPES_CODE.includes("timedOut"), "timedOut must not exist");
  assert.match(hook, /status:\s*"failure"/, "the timeout must resolve to a failure state");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 3: timers are single-shot, cancelled, and never recurring
// ─────────────────────────────────────────────────────────────────────────────

test("the hook never uses a recurring interval", () => {
  assert.ok(!stripComments(hook).includes("setInterval"), "setInterval re-fired the timeout overlay forever");
  assert.match(hook, /setTimeout\(/, "a single setTimeout guard is expected");
});

test("the timeout is cleared on every transition and on unmount", () => {
  assert.match(hook, /const clearPendingTimeout = useCallback/, "a single clear helper must exist");
  for (const fn of ["markSubmitting", "markSuccess", "markFailure", "reset"]) {
    const body = hook.slice(hook.indexOf(`const ${fn} = useCallback`));
    assert.match(body.slice(0, 400), /clearPendingTimeout\(\)/, `${fn} must clear the pending timeout`);
  }
  assert.match(hook, /useEffect\(\(\) => clearPendingTimeout/, "the timer must be cleared on unmount");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 4: the wizard lifecycle — idle -> submitting -> success | failure
// ─────────────────────────────────────────────────────────────────────────────

test("markSubmitting runs before the server action is awaited", () => {
  const submitIdx = wizard.indexOf("activation.markSubmitting()");
  const saveIdx = wizard.indexOf("await savePmoTenant(tenant)");
  assert.ok(submitIdx > 0, "markSubmitting must exist");
  assert.ok(submitIdx < saveIdx, "markSubmitting must run before awaiting savePmoTenant");
});

test("the save is wrapped in try/catch/finally so a rejection can never strand the lifecycle", () => {
  const start = wizard.indexOf("const handleCreate = async");
  const body = wizard.slice(start, wizard.indexOf("const handleRetryActivation"));
  assert.match(body, /try\s*\{[\s\S]*await savePmoTenant\(tenant\)/, "the save must be inside a try block");
  assert.match(body, /\}\s*catch\s*\(err\)\s*\{/, "a catch must handle a rejected server action");
  assert.match(body, /\}\s*finally\s*\{/, "a finally must always release the in-flight guard");
  assert.match(body, /finally\s*\{[\s\S]*setCreating\(false\)[\s\S]*inFlightRef\.current = false/, "finally must reset both flags");
});

test("both failure paths end in an explicit failure state, never a silent reset to idle", () => {
  const start = wizard.indexOf("const handleCreate = async");
  const body = wizard.slice(start, wizard.indexOf("const handleRetryActivation"));
  const failures = [...body.matchAll(/activation\.markFailure\(/g)];
  assert.equal(failures.length, 2, "one failure transition for a typed failure, one for a rejection");
  assert.ok(!body.includes("activation.reset()"), "failure must not drop the user back to idle");
});

test("success transitions explicitly and exactly once", () => {
  const successes = [...wizard.matchAll(/activation\.markSuccess\(\)/g)];
  assert.equal(successes.length, 1, "exactly one success transition");
});

test("duplicate submissions are prevented by a single in-flight guard", () => {
  assert.match(wizard, /const inFlightRef = useRef\(false\)/, "an in-flight ref must exist");
  assert.match(wizard, /if \(inFlightRef\.current\) return;/, "re-entry must be rejected while a save is in flight");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 5: retry is a genuine new attempt
// ─────────────────────────────────────────────────────────────────────────────

test("retry starts a real new activation attempt through the same guarded path", () => {
  assert.match(wizard, /const handleRetryActivation = \(\) => \{[\s\S]*?void handleCreate\(\);/, "retry must invoke handleCreate");
  assert.ok(!WIZARD_CODE.includes("handleRetryAfterTimeout"), "the old timeout-only retry must be gone");
  assert.match(wizard, /onRetry=\{handleRetryActivation\}/, "the overlay must be wired to the real retry");
});

test("the failure UI offers Retry and never offers to keep waiting", () => {
  assert.match(failureState, /Retry/, "failure state must offer Retry");
  assert.ok(!FAILURE_STATE_CODE.includes("Keep Waiting"), "failure state must not offer Keep Waiting");
  assert.match(failureState, /disabled=\{retrying\}/, "the retry button must disable while in flight");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 6: success routes automatically to the canonical destination
// ─────────────────────────────────────────────────────────────────────────────

test("success navigates automatically after a brief confirmation, with no manual click", () => {
  assert.match(wizard, /if \(activation\.state\.status !== "success"\) return;/, "navigation must be driven by the success state");
  assert.match(wizard, /router\.push\("\/command-center\?from=onboarding"\)/, "must route to the Command Center");
  assert.match(wizard, /\}, SUCCESS_CONFIRMATION_DURATION_MS\);/, "the confirmation delay must come from config");
  assert.ok(!WIZARD_CODE.includes("handleContinueToCommandCenter"), "the manual continue handler must be gone");
  assert.ok(!TRANSITION_OVERLAY_CODE.includes("onContinue"), "the success confirmation must not require a click");
});

test("successful activation does not depend on brainActivated=1", () => {
  assert.ok(!WIZARD_CODE.includes("brainActivated"), "the durable ingestion marker decides the landing view, not a query flag");
});

test("the redirect appears exactly once", () => {
  const pushes = [...wizard.matchAll(/router\.push\("\/command-center\?from=onboarding"\)/g)];
  assert.equal(pushes.length, 1, "exactly one Command Center redirect");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 7: no fabricated metrics survive in the success confirmation
// ─────────────────────────────────────────────────────────────────────────────

test("success confirmation counts derive from real wizard props, not literals", () => {
  assert.match(transitionOverlay, /\{enabledAgentCount\}/, "agent count must come from props");
  assert.match(transitionOverlay, /\{deliveryChallengeCount\}/, "challenge count must come from props");
  assert.ok(!TRANSITION_OVERLAY_CODE.includes("Agents Online"), "agents were configured, not brought online");
});

test("the timeout constant is defined in config, not hardcoded in the hook", () => {
  assert.match(config, /export const SUBMIT_TIMEOUT_MS/, "timeout must live in config");
  assert.match(config, /export const SUCCESS_CONFIRMATION_DURATION_MS/, "confirmation duration must live in config");
  assert.match(hook, /import \{ SUBMIT_TIMEOUT_MS \} from "\.\/activation-sequence-config"/, "the hook must import its timing");
});
