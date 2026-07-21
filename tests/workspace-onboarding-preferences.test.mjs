// Guided Workspace Onboarding — display preference validation.
//
// The preference layer stores DISPLAY state only. These tests pin the two
// product guarantees: essential steps can never be "skipped" into looking
// complete, and only whitelisted fields with strict types are accepted.

import test from "node:test";
import assert from "node:assert/strict";
import {
  OnboardingPreferenceValidationError,
  sanitizeSkippedStepIds,
  validateOnboardingPreferencePatch,
} from "../src/lib/workspace-activation/onboarding-preferences.ts";

test("skipping optional steps is allowed and deduplicated", () => {
  const ids = sanitizeSkippedStepIds(["milestone_created", "raid_registered", "milestone_created"]);
  assert.deepEqual(ids, ["milestone_created", "raid_registered"]);
});

test("essential steps can never be skipped", () => {
  for (const id of ["workspace_created", "project_created", "task_created"]) {
    assert.throws(
      () => sanitizeSkippedStepIds([id]),
      OnboardingPreferenceValidationError,
      `${id} must be unskippable`,
    );
  }
});

test("unknown step ids are rejected", () => {
  assert.throws(() => sanitizeSkippedStepIds(["made_up_step"]), OnboardingPreferenceValidationError);
  assert.throws(() => sanitizeSkippedStepIds([42]), OnboardingPreferenceValidationError);
});

test("oversized skip lists are rejected", () => {
  const list = Array.from({ length: 33 }, () => "milestone_created");
  assert.throws(() => sanitizeSkippedStepIds(list), OnboardingPreferenceValidationError);
});

test("patch validation accepts recognized fields with strict types", () => {
  const patch = validateOnboardingPreferencePatch({
    collapsed: true,
    dismissed: false,
    skippedStepIds: ["conversation_started"],
    insightsViewed: true,
  });
  assert.deepEqual(patch, {
    collapsed: true,
    dismissed: false,
    skippedStepIds: ["conversation_started"],
    insightsViewed: true,
  });
});

test("patch validation rejects wrong types and empty bodies", () => {
  assert.throws(() => validateOnboardingPreferencePatch(null), OnboardingPreferenceValidationError);
  assert.throws(() => validateOnboardingPreferencePatch([]), OnboardingPreferenceValidationError);
  assert.throws(() => validateOnboardingPreferencePatch({}), OnboardingPreferenceValidationError);
  assert.throws(
    () => validateOnboardingPreferencePatch({ collapsed: "yes" }),
    OnboardingPreferenceValidationError,
  );
  assert.throws(
    () => validateOnboardingPreferencePatch({ dismissed: 1 }),
    OnboardingPreferenceValidationError,
  );
});

test("insightsViewed can only ever be set to true (never cleared)", () => {
  assert.throws(
    () => validateOnboardingPreferencePatch({ insightsViewed: false }),
    OnboardingPreferenceValidationError,
  );
});

test("there is no field that marks progress complete", () => {
  // The patch surface is display-only. Any attempt to write progress-like
  // fields must be rejected as unrecognized.
  for (const body of [
    { onboardingComplete: true },
    { completedStepIds: ["project_created"] },
    { stage: "insights_available" },
  ]) {
    assert.throws(() => validateOnboardingPreferencePatch(body), OnboardingPreferenceValidationError);
  }
});
