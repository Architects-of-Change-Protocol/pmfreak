/**
 * Founder Circle Program — canonical state machine tests.
 *
 * The transition table is an allowlist: everything not listed is forbidden.
 * These tests validate behavior (who may move which state where, when a
 * reason is mandatory, which states grant access) — not implementation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FOUNDER_ACCESS_STATES,
  FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS,
  FOUNDER_APPROVED_CAPACITY_STATES,
  FOUNDER_LIFECYCLE_STATES,
  FOUNDER_TERMINAL_STATES,
  FOUNDER_TRANSITION_RULES,
  checkFounderTransition,
  grantsProgramAccess,
  isTerminalFounderState,
} from "../src/lib/founder-program/lifecycle";

test("all 18 canonical states exist exactly once", () => {
  assert.equal(FOUNDER_LIFECYCLE_STATES.length, 18);
  assert.equal(new Set(FOUNDER_LIFECYCLE_STATES).size, 18);
});

test("terminal states admit no outgoing transition for any actor", () => {
  for (const from of FOUNDER_TERMINAL_STATES) {
    for (const to of FOUNDER_LIFECYCLE_STATES) {
      for (const actor of ["participant", "operator", "system"] as const) {
        const result = checkFounderTransition({ from, to, actor, reason: "any" });
        assert.equal(result.allowed, false, `${from} -> ${to} (${actor}) must be forbidden`);
      }
    }
  }
});

test("participants can never approve, activate, or operate", () => {
  const operatorOnlyTargets = ["approved", "rejected", "waitlisted", "onboarding_active", "paused", "completed"] as const;
  for (const from of FOUNDER_LIFECYCLE_STATES) {
    for (const to of operatorOnlyTargets) {
      const result = checkFounderTransition({ from, to, actor: "participant", reason: "any" });
      assert.equal(result.allowed, false, `participant must not drive ${from} -> ${to}`);
    }
  }
});

test("agreement cannot be skipped: approved never reaches activation directly", () => {
  for (const actor of ["participant", "operator", "system"] as const) {
    assert.equal(checkFounderTransition({ from: "approved", to: "onboarding_active", actor }).allowed, false);
    assert.equal(checkFounderTransition({ from: "approved", to: "activated", actor }).allowed, false);
    assert.equal(checkFounderTransition({ from: "agreement_pending", to: "onboarding_active", actor }).allowed, false);
  }
});

test("activation is system-driven and only from onboarding_active", () => {
  assert.equal(checkFounderTransition({ from: "onboarding_active", to: "activated", actor: "system" }).allowed, true);
  assert.equal(checkFounderTransition({ from: "onboarding_active", to: "activated", actor: "operator" }).allowed, false);
  for (const from of FOUNDER_LIFECYCLE_STATES.filter((s) => s !== "onboarding_active")) {
    assert.equal(checkFounderTransition({ from, to: "activated", actor: "system" }).allowed, false, `${from} -> activated must be forbidden`);
  }
});

test("reject/waitlist/pause/revoke require a reason", () => {
  const cases = [
    { from: "under_review", to: "rejected", actor: "operator" },
    { from: "applied", to: "waitlisted", actor: "operator" },
    { from: "activated", to: "paused", actor: "operator" },
    { from: "onboarding_active", to: "revoked", actor: "operator" },
    { from: "invited", to: "revoked", actor: "operator" },
    { from: "nominated", to: "revoked", actor: "operator" },
  ] as const;
  for (const { from, to, actor } of cases) {
    const withoutReason = checkFounderTransition({ from, to, actor });
    assert.equal(withoutReason.allowed, false);
    assert.equal(withoutReason.allowed === false && withoutReason.reason, "reason_required");
    const blankReason = checkFounderTransition({ from, to, actor, reason: "   " });
    assert.equal(blankReason.allowed, false, "whitespace-only reason must not satisfy the requirement");
    assert.equal(checkFounderTransition({ from, to, actor, reason: "documented reason" }).allowed, true);
  }
});

test("the happy path is fully traversable with the right actors", () => {
  const path = [
    { from: "nominated", to: "invited", actor: "operator" },
    { from: "invited", to: "invite_viewed", actor: "system" },
    { from: "invite_viewed", to: "applied", actor: "participant" },
    { from: "applied", to: "under_review", actor: "operator" },
    { from: "under_review", to: "approved", actor: "operator" },
    { from: "approved", to: "agreement_pending", actor: "system" },
    { from: "agreement_pending", to: "agreement_accepted", actor: "participant" },
    { from: "agreement_accepted", to: "onboarding_pending", actor: "system" },
    { from: "onboarding_pending", to: "onboarding_active", actor: "operator" },
    { from: "onboarding_active", to: "activated", actor: "system" },
    { from: "activated", to: "feedback_active", actor: "system" },
    { from: "feedback_active", to: "completed", actor: "operator" },
  ] as const;
  for (const step of path) {
    const result = checkFounderTransition(step);
    assert.equal(result.allowed, true, `${step.from} -> ${step.to} (${step.actor}) must be allowed`);
  }
});

test("participants may withdraw before and after approval; operators may not fake a withdrawal", () => {
  for (const from of ["applied", "under_review", "waitlisted", "approved", "agreement_pending", "onboarding_active", "activated", "paused"] as const) {
    assert.equal(checkFounderTransition({ from, to: "withdrawn", actor: "participant" }).allowed, true, `${from} -> withdrawn`);
    assert.equal(checkFounderTransition({ from, to: "withdrawn", actor: "operator" }).allowed, false);
  }
});

test("invitation states cannot jump straight to approval", () => {
  for (const from of ["invited", "invite_viewed"] as const) {
    assert.equal(checkFounderTransition({ from, to: "approved", actor: "operator" }).allowed, false);
  }
});

test("access is granted only in the three active states; paused has no access", () => {
  assert.deepEqual([...FOUNDER_ACCESS_STATES], ["onboarding_active", "activated", "feedback_active"]);
  for (const state of FOUNDER_LIFECYCLE_STATES) {
    const expected = (FOUNDER_ACCESS_STATES as readonly string[]).includes(state);
    assert.equal(grantsProgramAccess(state), expected, state);
  }
  assert.equal(grantsProgramAccess("paused"), false);
});

test("capacity-enforced rules carry the right scope", () => {
  const approve = checkFounderTransition({ from: "under_review", to: "approved", actor: "operator" });
  assert.ok(approve.allowed && approve.rule.capacityScope === "approved");
  const activate = checkFounderTransition({ from: "onboarding_pending", to: "onboarding_active", actor: "operator" });
  assert.ok(activate.allowed && activate.rule.capacityScope === "active");
  const resume = checkFounderTransition({ from: "paused", to: "onboarding_active", actor: "operator" });
  assert.ok(resume.allowed && resume.rule.capacityScope === "active");
});

test("approved-capacity states cover approved-through-paused and exclude terminals", () => {
  for (const state of FOUNDER_APPROVED_CAPACITY_STATES) {
    assert.equal(isTerminalFounderState(state), false);
  }
  assert.ok((FOUNDER_APPROVED_CAPACITY_STATES as readonly string[]).includes("paused"));
  assert.ok(!(FOUNDER_APPROVED_CAPACITY_STATES as readonly string[]).includes("applied"));
});

test("unknown states and unknown pairs are rejected, not guessed", () => {
  assert.equal(checkFounderTransition({ from: "not_a_state", to: "approved", actor: "operator" }).allowed, false);
  assert.equal(checkFounderTransition({ from: "applied", to: "not_a_state", actor: "operator" }).allowed, false);
  const unknownPair = checkFounderTransition({ from: "nominated", to: "activated", actor: "operator" });
  assert.equal(unknownPair.allowed, false);
  assert.equal(unknownPair.allowed === false && unknownPair.reason, "invalid_transition");
});

test("every transition rule references only canonical states and actors", () => {
  for (const rule of FOUNDER_TRANSITION_RULES) {
    assert.ok((FOUNDER_LIFECYCLE_STATES as readonly string[]).includes(rule.to), rule.to);
    for (const from of rule.from) {
      assert.ok((FOUNDER_LIFECYCLE_STATES as readonly string[]).includes(from), from);
      assert.equal(isTerminalFounderState(from), false, `terminal state ${from} must have no outgoing rules`);
    }
    assert.ok(rule.actors.length > 0);
  }
});

test("canonical activation criterion requires the five concrete checkpoints", () => {
  assert.deepEqual(
    [...FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS],
    ["agreement_accepted", "first_login", "workspace_ready", "first_project_created", "first_core_capability_used"],
  );
});
